import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import { LocationPing } from "@/models/LocationPing";
import { Driver } from "@/models/Driver";
import "@/models/Vehicle";
import "@/models/Route";
import {
  apiResponse,
  apiForbidden,
  apiNotFound,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * GET /api/conductor/mis-recorridos?limit=<n>
 *
 * Devuelve los turnos del conductor autenticado con un sample del trazo
 * para mostrar la "ruta orgánica" recorrida en cada uno. Usado por la app
 * en la pantalla "Mis recorridos" para que el conductor vea su histórico.
 *
 * Cada item incluye:
 *   - métricas (km, distanceMeters, durationSeconds, compliance)
 *   - sample de hasta 30 puntos GPS distribuidos uniformemente en el turno
 *   - paraderos visitados
 *   - placa y nombre de ruta (si la tenía asignada)
 */
const SAMPLE_LIMIT = 30;
const PAGE_LIMIT_DEFAULT = 20;
const PAGE_LIMIT_MAX = 60;

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [ROLES.CONDUCTOR]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const url = new URL(request.url);
  const limit = Math.min(
    PAGE_LIMIT_MAX,
    Math.max(1, Number(url.searchParams.get("limit") ?? PAGE_LIMIT_DEFAULT)),
  );

  await connectDB();

  // 1. Resolver Driver por userId (vínculo directo).
  const driver = await Driver.findOne({ userId: auth.session.userId, active: true })
    .select("_id")
    .lean();
  if (!driver) {
    return apiNotFound("Sin registro de conductor asociado a tu cuenta");
  }

  // 2. Turnos más recientes primero.
  const entries = await FleetEntry.find({ driverId: driver._id })
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .populate("vehicleId", "plate vehicleTypeKey")
    .populate("routeId", "code name")
    .select(
      "vehicleId routeId date status departureTime returnTime km distanceMeters durationSeconds routeCompliancePercentage visitedStops startLocation endLocation currentLocation",
    )
    .lean();

  if (entries.length === 0) {
    return apiResponse({ items: [], total: 0 });
  }

  // 3. Sample uniforme de pings por entry (1 query agregada).
  const entryIds = entries.map((e) => e._id);
  const pingsByEntry = new Map<string, Array<{ lat: number; lng: number; ts: Date }>>();
  const grouped = await LocationPing.aggregate<{
    _id: unknown;
    points: Array<{ lat: number; lng: number; ts: Date }>;
    total: number;
  }>([
    { $match: { entryId: { $in: entryIds } } },
    { $sort: { entryId: 1, ts: 1 } },
    {
      $group: {
        _id: "$entryId",
        points: { $push: { lat: "$lat", lng: "$lng", ts: "$ts" } },
        total: { $sum: 1 },
      },
    },
  ]);

  for (const g of grouped) {
    // Sample uniforme: si hay más de SAMPLE_LIMIT, tomamos puntos cada N.
    const all = g.points;
    if (all.length <= SAMPLE_LIMIT) {
      pingsByEntry.set(String(g._id), all);
    } else {
      const step = Math.floor(all.length / SAMPLE_LIMIT);
      const sampled = [];
      for (let i = 0; i < all.length; i += step) sampled.push(all[i]);
      // Asegurar el último punto para que el trazo termine donde el bus paró.
      if (sampled[sampled.length - 1] !== all[all.length - 1]) {
        sampled.push(all[all.length - 1]);
      }
      pingsByEntry.set(String(g._id), sampled);
    }
  }

  const items = entries.map((e) => {
    const vehicle = e.vehicleId as { plate?: string; vehicleTypeKey?: string } | null;
    const route = e.routeId as { code?: string; name?: string } | null;
    const sample = pingsByEntry.get(String(e._id)) ?? [];
    return {
      id: String(e._id),
      date: e.date,
      status: e.status,
      departureTime: e.departureTime ?? null,
      returnTime: e.returnTime ?? null,
      vehiclePlate: vehicle?.plate ?? "—",
      routeName: route?.name ?? null,
      routeCode: route?.code ?? null,
      km: e.km ?? 0,
      distanceMeters: e.distanceMeters ?? null,
      durationSeconds: e.durationSeconds ?? null,
      routeCompliancePercentage: e.routeCompliancePercentage ?? null,
      visitedStopsCount: (e.visitedStops ?? []).length,
      startLocation: e.startLocation ?? null,
      endLocation: e.endLocation ?? null,
      currentLocation: e.currentLocation ?? null,
      // Trazo en formato [{lat,lng}] cronológico.
      track: sample.map((p) => ({ lat: p.lat, lng: p.lng })),
      trackPointsTotal: (grouped.find((g) => String(g._id) === String(e._id))?.total) ?? 0,
    };
  });

  return apiResponse({ items, total: items.length });
}
