import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { FleetEntry } from "@/models/FleetEntry";
import { RouteCapture } from "@/models/RouteCapture";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { computeQualityScore, polylineLengthMeters, type GpsPoint } from "@/lib/routes/converge";

const UpdateSchema = z.object({
  endTime: z.string().optional(),
  km: z.number().min(0).optional(),
  passengers: z.number().min(0).optional(),
  status: z
    .enum([
      "pendiente_aceptacion", "aceptado", "rechazado", "cancelado",
      "en_curso", "completado", "auto_cierre", "cerrado_automatico",
    ])
    .optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const trip = await Trip.findById(id)
    .populate("vehicleId", "plate brand model")
    .populate("driverId", "name phone")
    .populate("routeId", "code name")
    .lean();
  if (!trip) return apiNotFound("Viaje no encontrado");
  if (!(await canAccessMunicipality(auth.session, String(trip.municipalityId)))) return apiForbidden();

  return apiResponse({ id: String(trip._id), ...trip });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR]);
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
  const trip = await Trip.findById(id);
  if (!trip) return apiNotFound("Viaje no encontrado");
  if (!(await canAccessMunicipality(auth.session, String(trip.municipalityId)))) return apiForbidden();

  const previousStatus = trip.status;
  if (parsed.data.endTime) (parsed.data as Record<string, unknown>).endTime = new Date(parsed.data.endTime);
  Object.assign(trip, parsed.data);
  await trip.save();

  // Hook auto-captura: si el viaje pasa a "completado" (o auto-cierre) y
  // tenía routeId + trackPoints en su FleetEntry asociado, crear un
  // RouteCapture en status "raw" para alimentar la convergencia.
  // Best-effort: no rompe la respuesta si falla.
  const becameTerminal =
    parsed.data.status &&
    parsed.data.status !== previousStatus &&
    ["completado", "auto_cierre", "cerrado_automatico"].includes(parsed.data.status);

  if (becameTerminal && trip.routeId && trip.fleetEntryId) {
    void (async () => {
      try {
        const entry = await FleetEntry.findById(trip.fleetEntryId)
          .select("trackPoints")
          .lean<{ trackPoints?: Array<{ lat: number; lng: number; ts: Date; accuracy?: number; speed?: number }> } | null>();
        const tp = entry?.trackPoints ?? [];
        if (tp.length < 4) return; // poca data → no vale la pena guardarla

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

        const sorted = [...points].sort((a, b) => a.ts.getTime() - b.ts.getTime());
        const durationSeconds = sorted.length >= 2
          ? Math.round((sorted[sorted.length - 1].ts.getTime() - sorted[0].ts.getTime()) / 1000)
          : undefined;

        const qualityScore = computeQualityScore({
          avgAccuracy,
          pointCount: points.length,
          durationSeconds,
          distanceMeters,
        });

        await RouteCapture.create({
          routeId: trip.routeId,
          tripId: trip._id,
          driverId: trip.driverId,
          vehicleId: trip.vehicleId,
          municipalityId: trip.municipalityId,
          points,
          pointCount: points.length,
          avgAccuracy,
          distanceMeters,
          durationSeconds,
          qualityScore,
          status: "raw",
        });
      } catch (e) {
        console.error("[viajes PATCH] auto-captura RouteCapture", e);
      }
    })();
  }

  return apiResponse({ id: String(trip._id), ...trip.toObject() });
}
