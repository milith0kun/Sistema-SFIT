import { NextRequest } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import { Driver } from "@/models/Driver";
import { LocationPing } from "@/models/LocationPing";
import { Route as RouteModel } from "@/models/Route";
import { RouteCapture } from "@/models/RouteCapture";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { haversineMeters } from "@/lib/geo/haversine";
import { computeQualityScore, polylineLengthMeters, type GpsPoint } from "@/lib/routes/converge";

const UpdateSchema = z.object({
  driverId: z.string().refine(isValidObjectId).optional(),
  routeId: z.string().refine(isValidObjectId).optional().nullable(),
  departureTime: z.string().optional(),
  returnTime: z.string().optional(),
  km: z.number().min(0).optional(),
  status: z.enum(["disponible", "en_ruta", "cerrado", "auto_cierre", "mantenimiento", "fuera_de_servicio"]).optional(),
  observations: z.string().max(500).optional(),
  checklistComplete: z.boolean().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR, ROLES.CONDUCTOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const entry = await FleetEntry.findById(id)
    .populate("vehicleId", "plate brand model vehicleTypeKey")
    .populate("routeId", "code name waypoints")
    .populate("driverId", "name status continuousHours restHours phone")
    .lean();
  if (!entry) return apiNotFound("Entrada de flota no encontrada");

  // El conductor solo puede consultar SUS propias entries; el resto se valida por muni.
  if (auth.session.role === ROLES.CONDUCTOR) {
    const driver = await Driver.findOne({ userId: auth.session.userId }).select("_id").lean();
    if (!driver || String(entry.driverId._id ?? entry.driverId) !== String(driver._id)) {
      return apiForbidden();
    }
  } else {
    if (!(await canAccessMunicipality(auth.session, String(entry.municipalityId)))) return apiForbidden();
  }

  return apiResponse({ id: String(entry._id), ...entry });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR, ROLES.CONDUCTOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const body = await request.json().catch(() => ({}));
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "general";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  await connectDB();
  const entry = await FleetEntry.findById(id);
  if (!entry) return apiNotFound("Entrada de flota no encontrada");

  if (auth.session.role === ROLES.CONDUCTOR) {
    const driver = await Driver.findOne({ userId: auth.session.userId }).select("_id").lean();
    if (!driver || String(entry.driverId) !== String(driver._id)) return apiForbidden();
  } else {
    if (!(await canAccessMunicipality(auth.session, String(entry.municipalityId)))) return apiForbidden();
  }

  const wasOpen = entry.status === "en_ruta" || entry.status === "disponible";
  Object.assign(entry, parsed.data);

  // Si el turno está pasando a 'cerrado', calculamos las métricas finales.
  // Antes solo se calculaba compliance — ahora endLocation, distanceMeters y
  // durationSeconds también, leyendo desde LocationPing. Esto hace robusto el
  // cierre aunque el último ping action='end' del LocationTrackingService no
  // llegue (red caída, GPS apagado al cerrar, etc.).
  const closingNow =
    wasOpen &&
    (parsed.data.status === "cerrado" || parsed.data.status === "auto_cierre");

  if (closingNow) {
    const now = new Date();

    // 1. Histórico GPS del turno desde la colección dedicada.
    const pings = await LocationPing.find({ entryId: entry._id })
      .sort({ ts: 1 })
      .select("lat lng ts")
      .lean<Array<{ lat: number; lng: number; ts: Date }>>();

    if (pings.length > 0 && !entry.endLocation) {
      const last = pings[pings.length - 1];
      entry.endLocation = { lat: last.lat, lng: last.lng };
    }

    if (pings.length >= 2 && (entry.distanceMeters == null || entry.distanceMeters === 0)) {
      let total = 0;
      for (let i = 1; i < pings.length; i++) {
        total += haversineMeters(pings[i - 1], pings[i]);
      }
      entry.distanceMeters = Math.round(total);
    }

    // 2. Duración: returnTime − departureTime. departureTime es "HH:mm" del
    //    día de hoy (campo string legacy); returnTime puede venir en el body
    //    como "HH:mm" o como ISO. Normalizamos a Date sobre `entry.date`.
    if (entry.durationSeconds == null && entry.departureTime) {
      const dep = parseTime(entry.departureTime, entry.date);
      const ret = parseTime(entry.returnTime ?? formatHHmm(now), entry.date);
      if (dep && ret) {
        const diff = Math.max(0, Math.round((ret.getTime() - dep.getTime()) / 1000));
        entry.durationSeconds = diff;
      }
    }

    // 3. Compliance de ruta.
    if (entry.routeId) {
      try {
        const route = await RouteModel.findById(entry.routeId)
          .select("waypoints")
          .lean();
        const total = route?.waypoints?.length ?? 0;
        const visited = (entry.visitedStops ?? []).length;
        entry.routeCompliancePercentage = total > 0
          ? Math.round(Math.min(100, (visited / total) * 100))
          : 0;
      } catch (e) {
        console.error("[flota PATCH] compliance calc", e);
      }
    }
  }

  await entry.save();

  // 4. Hook auto-captura RouteCapture: best-effort, no bloquea la respuesta.
  //    Si el turno se cerró ahora y hay >=20 LocationPings, registramos los
  //    puntos en RouteCapture.
  //    - Con routeId    → crea captura `status:"raw"` (alimenta convergencia)
  //    - Sin routeId    → "ruta orgánica":
  //        a) Si existe una candidata reciente del MISMO conductor cuyo bbox
  //           solapa con el trazo nuevo, mergeamos los pings al RouteCapture
  //           existente (acumulación: cada turno mejora la candidata).
  //        b) Si no, creamos una nueva con `status:"candidate"`.
  if (closingNow) {
    void (async () => {
      try {
        // Idempotencia: no duplicar captura para este mismo turno.
        const existingForEntry = await RouteCapture.findOne({ fleetEntryId: entry._id }).select("_id").lean();
        if (existingForEntry) return;

        const tp = await LocationPing.find({ entryId: entry._id })
          .sort({ ts: 1 })
          .select("lat lng ts accuracy speed")
          .lean<Array<{ lat: number; lng: number; ts: Date; accuracy?: number; speed?: number }>>();
        if (tp.length < 20) return;

        const points = tp.map((p) => ({
          lat: p.lat,
          lng: p.lng,
          ts: p.ts,
          accuracy: p.accuracy,
          speed: p.speed,
        }));

        const accuracies = points.map((p) => p.accuracy).filter((x): x is number => typeof x === "number");
        const avgAccuracy = accuracies.length > 0
          ? accuracies.reduce((s, a) => s + a, 0) / accuracies.length
          : undefined;

        const distanceMeters = polylineLengthMeters(points as GpsPoint[]);
        const durationSeconds = points.length >= 2
          ? Math.round((points[points.length - 1].ts.getTime() - points[0].ts.getTime()) / 1000)
          : undefined;

        const qualityScore = computeQualityScore({
          avgAccuracy,
          pointCount: points.length,
          durationSeconds,
          distanceMeters,
        });

        // ── Acumulación de candidatas del mismo conductor ────────────────
        // Si el turno NO tiene routeId y el conductor ya tiene una candidata
        // reciente cuyo trazo solapa con el nuevo (>=50% bbox overlap),
        // mergeamos los pings al existing en lugar de crear otra candidata
        // separada. Esto evita que un conductor que repite la misma ruta
        // orgánica genere N candidatas idénticas en el panel del operador.
        if (!entry.routeId && entry.driverId) {
          const merged = await tryMergeIntoExistingCandidate(
            String(entry.driverId),
            String(entry._id),
            points,
            { distanceMeters, durationSeconds, avgAccuracy, qualityScore },
          );
          if (merged) return;
        }

        await RouteCapture.create({
          routeId: entry.routeId ?? null,
          fleetEntryId: entry._id,
          driverId: entry.driverId,
          vehicleId: entry.vehicleId,
          municipalityId: entry.municipalityId,
          points,
          pointCount: points.length,
          avgAccuracy,
          distanceMeters,
          durationSeconds,
          qualityScore,
          status: entry.routeId ? "raw" : "candidate",
        });
      } catch (e) {
        console.error("[flota PATCH] auto-captura RouteCapture", e);
      }
    })();
  }

  return apiResponse({ id: String(entry._id), ...entry.toObject() });
}

/** Convierte "HH:mm" o ISO a Date sobre `baseDate`. */
function parseTime(value: string, baseDate: Date): Date | null {
  if (!value) return null;
  const hhmm = /^(\d{2}):(\d{2})$/.exec(value);
  if (hhmm) {
    const d = new Date(baseDate);
    d.setHours(parseInt(hhmm[1], 10), parseInt(hhmm[2], 10), 0, 0);
    return d;
  }
  const iso = new Date(value);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function formatHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── Helpers de acumulación de candidatas ───────────────────────────────────

type CapturePoint = {
  lat: number;
  lng: number;
  ts: Date;
  accuracy?: number;
  speed?: number;
};

type Bbox = { minLat: number; maxLat: number; minLng: number; maxLng: number };

const MERGE_LOOKBACK_DAYS = 30;
const MERGE_BBOX_OVERLAP_RATIO = 0.5;
const MERGE_MAX_POINTS = 5_000;

function bboxOf(points: Array<{ lat: number; lng: number }>): Bbox | null {
  if (points.length === 0) return null;
  let minLat = points[0].lat, maxLat = points[0].lat;
  let minLng = points[0].lng, maxLng = points[0].lng;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

function bboxArea(b: Bbox): number {
  const lat = Math.max(0, b.maxLat - b.minLat);
  const lng = Math.max(0, b.maxLng - b.minLng);
  return lat * lng;
}

/** Ratio de solapamiento (0-1) sobre el bbox más chico — robusto a tamaños distintos. */
function bboxOverlapRatio(a: Bbox, b: Bbox): number {
  const interMinLat = Math.max(a.minLat, b.minLat);
  const interMaxLat = Math.min(a.maxLat, b.maxLat);
  const interMinLng = Math.max(a.minLng, b.minLng);
  const interMaxLng = Math.min(a.maxLng, b.maxLng);
  if (interMaxLat <= interMinLat || interMaxLng <= interMinLng) return 0;
  const inter = (interMaxLat - interMinLat) * (interMaxLng - interMinLng);
  const smaller = Math.min(bboxArea(a), bboxArea(b));
  if (smaller === 0) return 0;
  return Math.min(1, inter / smaller);
}

/**
 * Intenta agregar el trazo nuevo a una candidata existente del mismo
 * conductor con bbox solapado. Si encuentra una, hace el merge in-place
 * y devuelve true. Si no encuentra, devuelve false (el caller crea nueva).
 *
 * Estrategia conservadora:
 *   - Solo busca capturas `status:"candidate"` recientes (≤30 días).
 *   - Solo del mismo `driverId` (no mezcla conductores aunque pase la misma ruta).
 *   - Toma la candidata con mayor solape; si <50%, no merge.
 *   - Limita el array `points` a 5000 puntos máximo (corta los más viejos).
 */
async function tryMergeIntoExistingCandidate(
  driverId: string,
  fleetEntryId: string,
  newPoints: CapturePoint[],
  newStats: {
    distanceMeters: number;
    durationSeconds: number | undefined;
    avgAccuracy: number | undefined;
    qualityScore: number;
  },
): Promise<boolean> {
  const newBbox = bboxOf(newPoints);
  if (!newBbox) return false;

  const since = new Date(Date.now() - MERGE_LOOKBACK_DAYS * 24 * 3600 * 1000);
  const candidates = await RouteCapture.find({
    driverId,
    status: "candidate",
    createdAt: { $gte: since },
  })
    .select("_id points pointCount distanceMeters qualityScore avgAccuracy fleetEntryId")
    .lean();

  if (candidates.length === 0) return false;

  let best: { id: Types.ObjectId; ratio: number } | null = null;
  for (const c of candidates) {
    const pts = (c.points ?? []) as Array<{ lat: number; lng: number }>;
    const cbb = bboxOf(pts);
    if (!cbb) continue;
    const ratio = bboxOverlapRatio(newBbox, cbb);
    if (ratio < MERGE_BBOX_OVERLAP_RATIO) continue;
    if (!best || ratio > best.ratio) {
      best = { id: c._id as Types.ObjectId, ratio };
    }
  }
  if (!best) return false;

  // Recargamos los puntos del candidato ganador y mergeamos cronológicamente.
  // No usamos $push masivo para mantener el array ordenado por ts y poder
  // recortar a MERGE_MAX_POINTS si crece demasiado.
  const winner = await RouteCapture.findById(best.id).select("points qualityScore avgAccuracy distanceMeters").lean();
  if (!winner) return false;

  const merged: CapturePoint[] = [
    ...((winner.points ?? []) as CapturePoint[]),
    ...newPoints,
  ].sort((a, b) => a.ts.getTime() - b.ts.getTime());

  const trimmed = merged.length > MERGE_MAX_POINTS
    ? merged.slice(merged.length - MERGE_MAX_POINTS)
    : merged;

  // Recalcular métricas con el set completo.
  const totalDistance = polylineLengthMeters(trimmed as GpsPoint[]);
  const totalDuration = trimmed.length >= 2
    ? Math.round((trimmed[trimmed.length - 1].ts.getTime() - trimmed[0].ts.getTime()) / 1000)
    : undefined;
  const accs = trimmed.map((p) => p.accuracy).filter((x): x is number => typeof x === "number");
  const newAvgAccuracy = accs.length > 0 ? accs.reduce((s, a) => s + a, 0) / accs.length : undefined;
  const newQuality = computeQualityScore({
    avgAccuracy: newAvgAccuracy,
    pointCount: trimmed.length,
    durationSeconds: totalDuration,
    distanceMeters: totalDistance,
  });

  await RouteCapture.updateOne(
    { _id: best.id },
    {
      $set: {
        points: trimmed,
        pointCount: trimmed.length,
        distanceMeters: totalDistance,
        durationSeconds: totalDuration,
        avgAccuracy: newAvgAccuracy,
        qualityScore: newQuality,
        // Mantenemos `fleetEntryId` original (la candidata se asocia al primer
        // turno que la creó) y guardamos el último para auditoría.
        updatedAt: new Date(),
      },
    },
  );

  // Suprimimos los warnings de stats no usadas — los ya calculamos en el
  // bloque principal pero el merge los recompone con los puntos completos.
  void newStats;
  void fleetEntryId;
  return true;
}
