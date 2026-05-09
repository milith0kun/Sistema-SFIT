import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import { LocationPing } from "@/models/LocationPing";
import { Driver } from "@/models/Driver";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiNotFound,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { rolesFor } from "@/lib/auth/roleMatrix";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { haversineMeters } from "@/lib/geo/haversine";

/**
 * Subida en lote del trayecto GPS de un FleetEntry. Es el plan B cuando los
 * pings ping-by-ping fallaron durante el turno (red caída, auth, etc.) y
 * el cliente conserva el track localmente. Llama esto al cerrar / al abrir
 * el resumen para asegurar que el backend tenga los puntos.
 *
 * Política:
 *   - Idempotente: dedupa por (entryId, ts) — reenviar el mismo lote NO
 *     duplica registros.
 *   - Recalcula `distanceMeters` y `endLocation` con el set completo
 *     post-inserción si el FleetEntry está cerrado.
 *   - Acepta hasta 5000 puntos por request.
 */

const PointSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  ts: z.string().datetime().optional(),
  accuracy: z.number().finite().nonnegative().optional(),
  speed: z.number().finite().optional(),
});

const BulkSchema = z.object({
  points: z.array(PointSchema).min(1).max(5000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [...rolesFor("flota", "edit")]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const body = await request.json().catch(() => ({}));
  const parsed = BulkSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Datos inválidos",
      422,
    );
  }

  await connectDB();
  const entry = await FleetEntry.findById(id);
  if (!entry) return apiNotFound("Entrada de flota no encontrada");

  if (auth.session.role === ROLES.CONDUCTOR) {
    const driver = await Driver.findOne({ userId: auth.session.userId })
      .select("_id")
      .lean();
    if (!driver || String(entry.driverId) !== String(driver._id)) {
      return apiForbidden();
    }
  } else {
    if (
      !(await canAccessMunicipality(auth.session, String(entry.municipalityId)))
    ) {
      return apiForbidden();
    }
  }

  // Dedup por (entryId, ts): consultamos los timestamps que ya existen y
  // descartamos los duplicados antes de insertar. Si el cliente no manda
  // `ts`, le ponemos `now()` por orden incremental (caso edge).
  const points = parsed.data.points.map((p, i) => ({
    ...p,
    ts: p.ts ? new Date(p.ts) : new Date(Date.now() + i),
  }));

  const tsList = points.map((p) => p.ts);
  const existing = await LocationPing.find({
    entryId: entry._id,
    ts: { $in: tsList },
  })
    .select("ts")
    .lean<Array<{ ts: Date }>>();
  const existingTs = new Set(existing.map((e) => e.ts.getTime()));

  const fresh = points.filter((p) => !existingTs.has(p.ts.getTime()));

  if (fresh.length > 0) {
    await LocationPing.insertMany(
      fresh.map((p) => ({
        entryId: entry._id,
        driverId: entry.driverId,
        vehicleId: entry.vehicleId,
        municipalityId: entry.municipalityId,
        routeId: entry.routeId,
        lat: p.lat,
        lng: p.lng,
        ts: p.ts,
        ...(p.accuracy !== undefined && { accuracy: p.accuracy }),
        ...(p.speed !== undefined && { speed: p.speed }),
      })),
      { ordered: false },
    );
  }

  // Si el FleetEntry ya está cerrado, recalculamos métricas con el set
  // completo. Sin esto, distanceMeters quedaría desactualizado tras el bulk.
  const isClosed =
    entry.status === "cerrado" || entry.status === "auto_cierre";
  let recalculated = false;
  if (isClosed) {
    const all = await LocationPing.find({ entryId: entry._id })
      .sort({ ts: 1 })
      .select("lat lng")
      .lean<Array<{ lat: number; lng: number }>>();
    if (all.length >= 2) {
      let total = 0;
      for (let i = 1; i < all.length; i++) {
        total += haversineMeters(all[i - 1], all[i]);
      }
      entry.distanceMeters = Math.round(total);
      const last = all[all.length - 1];
      entry.endLocation = { lat: last.lat, lng: last.lng };
      await entry.save();
      recalculated = true;
    }
  }

  return apiResponse({
    received: points.length,
    inserted: fresh.length,
    duplicates: points.length - fresh.length,
    recalculated,
    distanceMeters: entry.distanceMeters ?? null,
  });
}
