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
  }

  // Detección automática de paso por paradero (solo si hay ruta asignada)
  let newlyVisited: { stopIndex: number; label?: string } | null = null;
  if (entry.routeId) {
    const route = await RouteModel.findById(entry.routeId)
      .select("waypoints")
      .lean();
    const waypoints = route?.waypoints ?? [];
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
