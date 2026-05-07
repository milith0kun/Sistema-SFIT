import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
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
  //    Si el turno se cerró ahora y hay >=20 LocationPings, creamos una captura.
  //    - Con routeId         → status "raw"        (alimenta convergencia)
  //    - Sin routeId         → status "candidate"  (operador la valida)
  if (closingNow) {
    void (async () => {
      try {
        // Idempotencia: no duplicar si ya existe captura para este turno.
        const existing = await RouteCapture.findOne({ fleetEntryId: entry._id }).select("_id").lean();
        if (existing) return;

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
