import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import { Driver } from "@/models/Driver";
import { Route as RouteModel } from "@/models/Route";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { haversineMeters, DEFAULT_STOP_RADIUS_METERS } from "@/lib/geo/haversine";
import { distancePointToPolyline } from "@/lib/geo/pointToLine";

// Umbrales de detección off-route. Mantener consistentes con la UI:
// >100m considerado fuera, ≤50m considerado regresó (hysteresis).
const OFF_ROUTE_ENTRY_METERS = 100;
const OFF_ROUTE_EXIT_METERS = 50;

const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Precisión en metros reportada por el GPS del cliente. */
  accuracy: z.number().min(0).max(10000).optional(),
  /** Velocidad en m/s. */
  speed: z.number().min(0).max(100).optional(),
  action: z.enum(["start", "update", "end"]).optional(),
});

/**
 * PATCH /api/flota/[id]/location
 * Actualiza la posición GPS de una entrada de flota y registra el punto en trackPoints.
 * Si el turno tiene `routeId`, detecta automáticamente el paso por cada paradero
 * (waypoint dentro del radio configurado) y lo marca como visitado una sola vez.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, [
    ROLES.CONDUCTOR, ROLES.OPERADOR, ROLES.ADMIN_MUNICIPAL, ROLES.SUPER_ADMIN,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const body = await request.json().catch(() => ({}));
  const parsed = LocationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 422);
  }

  const { lat, lng, accuracy, speed, action } = parsed.data;

  await connectDB();
  const entry = await FleetEntry.findById(id);
  if (!entry) return apiNotFound("Entrada de flota no encontrada");

  if (auth.session.role === ROLES.CONDUCTOR) {
    const driver = await Driver.findOne({ userId: auth.session.userId }).select("_id").lean();
    if (!driver || String(entry.driverId) !== String(driver._id)) return apiForbidden();
  } else {
    if (!(await canAccessMunicipality(auth.session, String(entry.municipalityId)))) {
      return apiForbidden();
    }
  }

  const now = new Date();
  entry.currentLocation = {
    lat,
    lng,
    updatedAt: now,
    ...(accuracy !== undefined && { accuracy }),
    ...(speed !== undefined && { speed }),
  };

  if (action === "start") {
    entry.startLocation = { lat, lng };
    entry.status = "en_ruta";
    if (!entry.departureTime) {
      entry.departureTime = now.toISOString();
    }
  } else if (action === "end") {
    entry.endLocation = { lat, lng };
    entry.status = "cerrado";
    if (!entry.returnTime) {
      entry.returnTime = now.toISOString();
    }

    // Métricas finales del viaje:
    //   distanceMeters = suma haversine entre trackPoints (incluyendo el que
    //                    se está cerrando con esta misma request)
    //   durationSeconds = returnTime − departureTime
    //   routeCompliancePercentage = visitedStops.length / route.waypoints.length
    const points = [
      ...(entry.trackPoints ?? []).map((p) => ({ lat: p.lat, lng: p.lng })),
      { lat, lng },
    ];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += haversineMeters(points[i - 1], points[i]);
    }
    entry.distanceMeters = Math.round(total);

    if (entry.departureTime && entry.returnTime) {
      const dep = new Date(entry.departureTime);
      const ret = new Date(entry.returnTime);
      const seconds = Math.max(0, Math.round((ret.getTime() - dep.getTime()) / 1000));
      entry.durationSeconds = seconds;
    }

    if (entry.routeId && entry.routeCompliancePercentage == null) {
      try {
        const route = await RouteModel.findById(entry.routeId).select("waypoints").lean();
        const total = route?.waypoints?.length ?? 0;
        const visitedCount = entry.visitedStops?.length ?? 0;
        if (total > 0) {
          entry.routeCompliancePercentage = Math.round((visitedCount / total) * 100);
        }
      } catch {
        /* mejor effort */
      }
    }
  }

  // Detección automática de paso por paradero (solo si hay ruta asignada)
  let newlyVisited: { stopIndex: number; label?: string } | null = null;
  if (entry.routeId) {
    const route = await RouteModel.findById(entry.routeId)
      .select("waypoints polylineGeometry")
      .lean();
    const waypoints = route?.waypoints ?? [];

    // ── Off-route detection ──
    // Compara el punto contra la polyline real (geometría cacheada) si
    // existe; si no, contra los waypoints crudos (líneas rectas). Con
    // hysteresis: entra a "fuera" sobre 100m, sale a ≤50m.
    if (waypoints.length >= 2) {
      const polylinePoints =
        route?.polylineGeometry?.coords?.map(([cLat, cLng]) => ({ lat: cLat, lng: cLng })) ??
        waypoints.map(w => ({ lat: w.lat, lng: w.lng }));
      const dev = distancePointToPolyline({ lat, lng }, polylinePoints);

      // Track máxima desviación del turno actual
      if (dev > (entry.maxDeviationMeters ?? 0)) {
        entry.maxDeviationMeters = Math.round(dev);
      }

      if (entry.offRouteSince) {
        // Está marcado como fuera — salir si volvió a estar cerca
        if (dev <= OFF_ROUTE_EXIT_METERS) {
          entry.offRouteSince = null;
        }
      } else {
        // No está marcado — entrar si se alejó demasiado
        if (dev > OFF_ROUTE_ENTRY_METERS) {
          entry.offRouteSince = now;
        }
      }
    }
    const alreadyVisited = new Set(
      (entry.visitedStops ?? []).map((s) => s.stopIndex),
    );

    // Buscar el paradero más cercano dentro del radio
    let closest: { idx: number; dist: number; label?: string } | null = null;
    for (const wp of waypoints) {
      if (alreadyVisited.has(wp.order)) continue;
      const dist = haversineMeters({ lat, lng }, { lat: wp.lat, lng: wp.lng });
      if (dist <= DEFAULT_STOP_RADIUS_METERS) {
        if (!closest || dist < closest.dist) {
          closest = { idx: wp.order, dist, label: wp.label };
        }
      }
    }

    if (closest) {
      entry.visitedStops = [
        ...(entry.visitedStops ?? []),
        {
          stopIndex: closest.idx,
          label: closest.label,
          lat,
          lng,
          visitedAt: now,
        },
      ];
      newlyVisited = { stopIndex: closest.idx, label: closest.label };
    }
  }

  await entry.save();

  // Push atómico del trackPoint con límite de 1000 puntos
  await FleetEntry.updateOne(
    { _id: id },
    {
      $push: {
        trackPoints: {
          $each: [
            {
              lat,
              lng,
              ts: now,
              ...(accuracy !== undefined && { accuracy }),
              ...(speed !== undefined && { speed }),
            },
          ],
          $slice: -1000,
        },
      },
    }
  );

  return apiResponse({
    id: String(entry._id),
    status: entry.status,
    currentLocation: entry.currentLocation,
    startLocation: entry.startLocation,
    endLocation: entry.endLocation,
    departureTime: entry.departureTime,
    returnTime: entry.returnTime,
    visitedStops: entry.visitedStops ?? [],
    newlyVisited,
    distanceMeters: entry.distanceMeters ?? null,
    durationSeconds: entry.durationSeconds ?? null,
    routeCompliancePercentage: entry.routeCompliancePercentage ?? null,
  });
}

/**
 * GET /api/flota/[id]/location
 * Devuelve el trayecto completo y la posición actual de la entrada de flota.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, [
    ROLES.CONDUCTOR, ROLES.OPERADOR, ROLES.ADMIN_MUNICIPAL, ROLES.SUPER_ADMIN,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const entry = await FleetEntry.findById(id)
    .select("driverId municipalityId trackPoints currentLocation startLocation endLocation visitedStops")
    .lean();
  if (!entry) return apiNotFound("Entrada de flota no encontrada");

  if (auth.session.role === ROLES.CONDUCTOR) {
    const driver = await Driver.findOne({ userId: auth.session.userId }).select("_id").lean();
    if (!driver || String(entry.driverId) !== String(driver._id)) return apiForbidden();
  } else {
    if (!(await canAccessMunicipality(auth.session, String(entry.municipalityId)))) {
      return apiForbidden();
    }
  }

  return apiResponse({
    trackPoints: entry.trackPoints ?? [],
    currentLocation: entry.currentLocation ?? null,
    startLocation: entry.startLocation ?? null,
    endLocation: entry.endLocation ?? null,
    visitedStops: entry.visitedStops ?? [],
  });
}
