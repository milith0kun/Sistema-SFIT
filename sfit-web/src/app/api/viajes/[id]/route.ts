import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { FleetEntry } from "@/models/FleetEntry";
import { LocationPing } from "@/models/LocationPing";
import { RouteCapture } from "@/models/RouteCapture";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { rolesFor } from "@/lib/auth/roleMatrix";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { computeQualityScore, polylineLengthMeters, type GpsPoint } from "@/lib/routes/converge";

const UpdateSchema = z.object({
  endTime: z.string().optional(),
  km: z.number().min(0).optional(),
  passengers: z.number().min(0).optional(),
  status: z
    .enum([
      "pendiente_aceptacion", "aceptado", "rechazado", "cancelado",
      "en_curso", "completado", "auto_cierre",
    ])
    .optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [...rolesFor("viajes", "view")]);
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

  // Scope: admins/fiscal/operador → filtro por municipalidad. Conductor →
  // sólo viajes donde figure como driverId. La matriz le permite VER
  // (apelar después si quiere) pero nunca viajes ajenos.
  if (auth.session.role === ROLES.CONDUCTOR) {
    const { Driver } = await import("@/models/Driver");
    const driver = await Driver.findOne({ userId: auth.session.userId })
      .select("_id")
      .lean<{ _id: unknown } | null>();
    if (!driver) return apiForbidden();
    if (!trip.driverId || String((trip.driverId as { _id?: unknown })._id ?? trip.driverId) !== String(driver._id)) {
      return apiForbidden();
    }
  } else {
    if (!(await canAccessMunicipality(auth.session, String(trip.municipalityId)))) return apiForbidden();
  }

  return apiResponse({ id: String(trip._id), ...trip });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [...rolesFor("viajes", "edit")]);
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

  // Scope para PATCH: mismo principio que en GET — admins/operador filtran
  // por municipalidad; conductor sólo edita su propio viaje (mismo driverId).
  if (auth.session.role === ROLES.CONDUCTOR) {
    const { Driver } = await import("@/models/Driver");
    const driver = await Driver.findOne({ userId: auth.session.userId })
      .select("_id")
      .lean<{ _id: unknown } | null>();
    if (!driver) return apiForbidden();
    if (!trip.driverId || String(trip.driverId) !== String(driver._id)) {
      return apiForbidden();
    }
  } else {
    if (!(await canAccessMunicipality(auth.session, String(trip.municipalityId)))) return apiForbidden();
  }

  const previousStatus = trip.status;
  if (parsed.data.endTime) (parsed.data as Record<string, unknown>).endTime = new Date(parsed.data.endTime);
  Object.assign(trip, parsed.data);
  await trip.save();

  // Hook auto-captura: si el viaje pasa a "completado" (o auto-cierre) y
  // tenía routeId + puntos GPS en su FleetEntry asociado, crear un
  // RouteCapture en status "raw" para alimentar la convergencia.
  // Best-effort: no rompe la respuesta si falla.
  const becameTerminal =
    parsed.data.status &&
    parsed.data.status !== previousStatus &&
    ["completado", "auto_cierre"].includes(parsed.data.status);

  // Propagación a CitizenTripRegistration: si el Trip llegó a terminal,
  // cerramos en cascada los registros del ciudadano que seguían activos
  // (`endedAt` no seteado). Marcamos `endReason="by_driver"` o `"auto"`
  // según quién cerró. Best-effort + push a cada ciudadano afectado para
  // que la UI se actualice sin esperar el siguiente poll.
  if (becameTerminal) {
    void (async () => {
      try {
        const { CitizenTripRegistration } = await import(
          "@/models/CitizenTripRegistration"
        );
        const endReason =
          parsed.data.status === "auto_cierre" ? "auto" : "by_driver";
        const now = new Date();
        const activeRegs = await CitizenTripRegistration.find({
          tripId: trip._id,
          endedAt: { $exists: false },
        })
          .select("_id userId vehicleId")
          .lean<Array<{ _id: unknown; userId: unknown; vehicleId: unknown }>>();
        if (activeRegs.length === 0) return;

        await CitizenTripRegistration.updateMany(
          { tripId: trip._id, endedAt: { $exists: false } },
          { $set: { endedAt: now, endReason } },
        );

        // Push + notif en bandeja a cada ciudadano. `createNotification`
        // (singular) ya dispara FCM internamente desde el fix previo.
        const { createNotification } = await import(
          "@/lib/notifications/create"
        );
        const title = "Tu viaje terminó";
        const body =
          endReason === "auto"
            ? "El sistema cerró automáticamente el viaje por inactividad. Si seguías a bordo, vuelve a registrarte."
            : "El conductor finalizó el viaje. Si necesitas continuar a bordo, registra un nuevo trayecto.";
        await Promise.all(
          activeRegs.map((r) =>
            createNotification({
              userId: String(r.userId),
              title,
              body,
              type: "info",
              category: "asignacion",
              link: "/ciudadano/mi-viaje",
              metadata: { tripId: String(trip._id), endReason },
            }),
          ),
        );
      } catch (e) {
        console.error("[viajes PATCH] cierre CitizenTripRegistration", e);
      }
    })();
  }

  if (becameTerminal && trip.routeId && trip.fleetEntryId) {
    void (async () => {
      try {
        // Lectura primaria desde LocationPing; fallback al array embebido
        // para turnos legacy.
        let tp = await LocationPing.find({ entryId: trip.fleetEntryId })
          .sort({ ts: 1 })
          .select("lat lng ts accuracy speed")
          .lean<Array<{ lat: number; lng: number; ts: Date; accuracy?: number; speed?: number }>>();
        if (tp.length === 0) {
          const entry = await FleetEntry.findById(trip.fleetEntryId)
            .select("trackPoints")
            .lean<{ trackPoints?: Array<{ lat: number; lng: number; ts: Date; accuracy?: number; speed?: number }> } | null>();
          tp = entry?.trackPoints ?? [];
        }
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
