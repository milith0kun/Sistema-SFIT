import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { RouteCapture } from "@/models/RouteCapture";
import { Route } from "@/models/Route";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { ROLES } from "@/lib/constants";
import { SERVICE_SCOPES } from "@/models/Company";
import { haversineMeters } from "@/lib/routes/converge";

const WaypointInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().max(100).optional(),
  order: z.number().int().min(0),
});

const Body = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(200),
  companyId: z.string().refine(isValidObjectId).optional(),
  originLabel: z.string().max(100).optional(),
  destinationLabel: z.string().max(100).optional(),
  vehicleTypeKey: z.string().max(64).optional(),
  serviceScope: z.enum(SERVICE_SCOPES as [string, ...string[]]).optional(),
  autoDetectStops: z.boolean().optional(),
  manualWaypoints: z.array(WaypointInputSchema).max(60).optional(),
});

/**
 * POST /api/rutas/candidatas/[id]/validar
 *
 * Promueve una RouteCapture (status="candidate") a una Route oficial.
 * Tres fuentes de waypoints, en orden de prioridad:
 *   1. `manualWaypoints` → usar tal cual.
 *   2. `autoDetectStops=true` → detectar paradas como clusters de puntos
 *      donde el vehículo estuvo >=30s en un radio <15m.
 *   3. Fallback → primer y último punto como 2 paradas.
 *
 * Crea la Route con status "activa" y enlaza la captura via
 * `promotedToRouteId`. La captura pasa a status "validated".
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0]?.toString() ?? "general";
      errors[k] = [...(errors[k] ?? []), i.message];
    }
    return apiValidationError(errors);
  }

  await connectDB();
  const cap = await RouteCapture.findById(id);
  if (!cap) return apiNotFound("Captura no encontrada");
  if (cap.status === "validated" && cap.promotedToRouteId) {
    return apiError("La captura ya fue validada", 409);
  }
  if (!(await canAccessMunicipality(auth.session, String(cap.municipalityId)))) return apiForbidden();

  // Determinar waypoints.
  const points = (cap.points ?? []) as Array<{ lat: number; lng: number; ts: Date }>;
  let waypoints: Array<{ lat: number; lng: number; label?: string; order: number }>;

  if (parsed.data.manualWaypoints && parsed.data.manualWaypoints.length > 0) {
    waypoints = [...parsed.data.manualWaypoints]
      .sort((a, b) => a.order - b.order)
      .map((w, idx) => ({ lat: w.lat, lng: w.lng, label: w.label, order: idx }));
  } else if (parsed.data.autoDetectStops && points.length >= 4) {
    const detected = detectStopClusters(points);
    if (detected.length >= 2) {
      waypoints = detected;
    } else {
      // Sin clusters claros: caer al primero/último.
      waypoints = endpointsFromPoints(points, parsed.data.originLabel, parsed.data.destinationLabel);
    }
  } else {
    waypoints = endpointsFromPoints(points, parsed.data.originLabel, parsed.data.destinationLabel);
  }

  if (waypoints.length < 2) {
    return apiError("La captura no tiene suficientes puntos para crear una ruta", 422);
  }

  // Verificar que el code no duplique en la misma muni.
  const dup = await Route.findOne({
    municipalityId: cap.municipalityId,
    code: parsed.data.code,
  }).select("_id").lean();
  if (dup) return apiError("Ya existe una ruta con ese código en la municipalidad", 409);

  const route = await Route.create({
    municipalityId: cap.municipalityId,
    code: parsed.data.code,
    name: parsed.data.name,
    type: "ruta",
    waypoints,
    status: "activa",
    companyId: parsed.data.companyId ?? cap.proposedCompanyId,
    vehicleTypeKey: parsed.data.vehicleTypeKey,
    serviceScope: parsed.data.serviceScope ?? "urbano_distrital",
  });

  // Marcar la captura como validada y enlazar.
  cap.status = "validated";
  cap.promotedToRouteId = route._id as typeof cap.promotedToRouteId;
  cap.routeId = route._id as typeof cap.routeId;
  await cap.save();

  // Recompute polyline real en background (Google Routes) — best-effort.
  if (route.waypoints.length >= 2) {
    void (async () => {
      try {
        const { routeAlongWaypoints } = await import("@/lib/routing/routingService");
        const geom = await routeAlongWaypoints(
          route.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
        );
        if (geom) {
          await Route.findByIdAndUpdate(route._id, {
            polylineGeometry: {
              coords: geom.coords,
              distanceMeters: geom.distanceMeters,
              durationSecondsBaseline: geom.durationSeconds,
              computedAt: new Date(),
            },
          });
        }
      } catch (err) {
        console.warn("[candidatas/validar] recompute geometry failed", err);
      }
    })();
  }

  return apiResponse({
    id: String(cap._id),
    name: route.name,
    code: route.code,
    routeId: String(route._id),
  }, 201);
}

/**
 * Detecta clusters de paradas a partir de los trackpoints.
 *
 * Definición operativa: una "parada" es un punto P_i tal que existe un
 * subconjunto contiguo de puntos alrededor de él que cumple
 *   - duración total ≥ 30s, y
 *   - todos a ≤ 15m de un anchor (P_i).
 *
 * Estrategia greedy: recorrer los puntos, mantener un anchor; si el siguiente
 * está a >15m del anchor, cerrar el segmento actual. Si la duración del
 * segmento ≥ 30s, registrar el centroide del segmento como parada.
 *
 * Limita a máximo 30 paradas (toma las más distribuidas si hay más).
 */
export function detectStopClusters(
  points: Array<{ lat: number; lng: number; ts: Date }>,
): Array<{ lat: number; lng: number; label?: string; order: number }> {
  if (points.length < 2) return [];

  const RADIUS_M = 15;
  const MIN_DURATION_S = 30;

  type Cluster = {
    startIdx: number;
    endIdx: number;
    durationSeconds: number;
    lat: number;
    lng: number;
  };

  const clusters: Cluster[] = [];
  let segStart = 0;
  let anchor = points[0];

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const d = haversineMeters(anchor, p);
    if (d > RADIUS_M) {
      // Cierra el segmento actual [segStart, i-1].
      const segEnd = i - 1;
      if (segEnd > segStart) {
        const dur =
          (points[segEnd].ts.getTime() - points[segStart].ts.getTime()) / 1000;
        if (dur >= MIN_DURATION_S) {
          // Centroide.
          let sumLat = 0;
          let sumLng = 0;
          for (let k = segStart; k <= segEnd; k++) {
            sumLat += points[k].lat;
            sumLng += points[k].lng;
          }
          const n = segEnd - segStart + 1;
          clusters.push({
            startIdx: segStart,
            endIdx: segEnd,
            durationSeconds: dur,
            lat: sumLat / n,
            lng: sumLng / n,
          });
        }
      }
      segStart = i;
      anchor = p;
    }
  }
  // Cerrar último segmento.
  const last = points.length - 1;
  if (last > segStart) {
    const dur = (points[last].ts.getTime() - points[segStart].ts.getTime()) / 1000;
    if (dur >= MIN_DURATION_S) {
      let sumLat = 0;
      let sumLng = 0;
      for (let k = segStart; k <= last; k++) {
        sumLat += points[k].lat;
        sumLng += points[k].lng;
      }
      const n = last - segStart + 1;
      clusters.push({
        startIdx: segStart,
        endIdx: last,
        durationSeconds: dur,
        lat: sumLat / n,
        lng: sumLng / n,
      });
    }
  }

  // Asegurar que el primer y último punto del recorrido estén siempre como
  // origen/destino aunque no formen cluster (los buses arrancan/llegan sin
  // estar 30s parados).
  const first = { lat: points[0].lat, lng: points[0].lng, durationSeconds: 0, startIdx: 0, endIdx: 0 };
  const lastPt = {
    lat: points[last].lat,
    lng: points[last].lng,
    durationSeconds: 0,
    startIdx: last,
    endIdx: last,
  };
  if (clusters.length === 0 || clusters[0].startIdx > 0) clusters.unshift(first as Cluster);
  if (clusters[clusters.length - 1].endIdx < last) clusters.push(lastPt as Cluster);

  // Si excede 30, sub-muestrear conservando primer y último.
  let selected = clusters;
  const MAX_STOPS = 30;
  if (selected.length > MAX_STOPS) {
    const step = (selected.length - 1) / (MAX_STOPS - 1);
    const picked: Cluster[] = [];
    for (let i = 0; i < MAX_STOPS; i++) {
      const idx = Math.min(selected.length - 1, Math.round(i * step));
      picked.push(selected[idx]);
    }
    selected = picked;
  }

  return selected.map((c, idx) => ({
    lat: c.lat,
    lng: c.lng,
    order: idx,
    label: idx === 0 ? "Origen" : idx === selected.length - 1 ? "Destino" : `Paradero ${idx}`,
  }));
}

function endpointsFromPoints(
  points: Array<{ lat: number; lng: number }>,
  originLabel?: string,
  destinationLabel?: string,
): Array<{ lat: number; lng: number; label?: string; order: number }> {
  if (points.length === 0) return [];
  const first = points[0];
  const last = points[points.length - 1];
  return [
    { lat: first.lat, lng: first.lng, label: originLabel ?? "Origen", order: 0 },
    { lat: last.lat, lng: last.lng, label: destinationLabel ?? "Destino", order: 1 },
  ];
}
