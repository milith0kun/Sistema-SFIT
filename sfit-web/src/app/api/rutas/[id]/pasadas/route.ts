/**
 * GET /api/rutas/[id]/pasadas
 *
 * Lista las pasadas (FleetEntry cerradas) de una ruta con:
 *   - score: 0-1, ponderación 50% compliance + 30% coverage + 20% continuity
 *   - isBest: la mejor pasada por score automático
 *   - isPreferred: marcada manualmente por el operador como preferida
 *
 * Usado por el operador para auditar el historial de la ruta y elegir cuál
 * promover a "preferida" desde la UI de comparación.
 *
 * Multi-tenant: filtra por la empresa del operador (Vehicle.companyId =
 * Route.companyId).
 */
import { NextRequest } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Route } from "@/models/Route";
import { FleetEntry } from "@/models/FleetEntry";
import { LocationPing } from "@/models/LocationPing";
import { Vehicle } from "@/models/Vehicle";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiNotFound,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";
import {
  calcPassScore,
  calcPassScoreBreakdown,
  maxGapSeconds,
  findBestPassId,
} from "@/lib/routing/passScoring";
import { rolesFor } from "@/lib/auth/roleMatrix";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 200;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [...rolesFor("rutas", "view")]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID de ruta inválido", 400);

  await connectDB();

  const route = await Route.findById(id)
    .select("municipalityId companyId preferredCaptureId preferredAt code name")
    .lean<{
      _id: Types.ObjectId;
      municipalityId: Types.ObjectId;
      companyId?: Types.ObjectId;
      preferredCaptureId?: Types.ObjectId;
      preferredAt?: Date;
      code?: string;
      name?: string;
    } | null>();
  if (!route) return apiNotFound("Ruta no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(route.municipalityId)))) {
    return apiForbidden();
  }

  // Operador: la ruta debe pertenecer a su empresa.
  if (auth.session.role === ROLES.OPERADOR) {
    const myCompanyId = await getOperatorCompanyId(auth.session.userId);
    if (!myCompanyId || !route.companyId || String(route.companyId) !== String(myCompanyId)) {
      return apiForbidden();
    }
  }

  const url = new URL(request.url);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT)),
  );

  const passes = await FleetEntry.find({
    routeId: route._id,
    status: { $in: ["cerrado", "auto_cierre"] },
  })
    .select(
      "_id vehicleId driverId date status departureTime returnTime " +
      "km routeCompliancePercentage durationSeconds distanceMeters",
    )
    .sort({ date: -1 })
    .limit(limit)
    .populate("vehicleId", "plate brand model")
    .populate("driverId", "name")
    .lean();

  // Para calcular el score real necesitamos numPings y maxGap por pasada.
  // Hacer 1 query agregada en LocationPing y mapearla al entryId.
  const passIds = passes.map((p) => p._id);
  const pingStats =
    passIds.length === 0
      ? []
      : await LocationPing.aggregate<{
          _id: Types.ObjectId;
          numPings: number;
          tsList: Date[];
        }>([
          { $match: { entryId: { $in: passIds } } },
          {
            $group: {
              _id: "$entryId",
              numPings: { $sum: 1 },
              tsList: { $push: "$ts" },
            },
          },
        ]);
  const pingMap = new Map<string, { numPings: number; maxGap: number }>();
  for (const s of pingStats) {
    const sortedTs = [...s.tsList].sort((a, b) => a.getTime() - b.getTime());
    pingMap.set(String(s._id), {
      numPings: s.numPings,
      maxGap: maxGapSeconds(sortedTs.map((ts) => ({ ts }))),
    });
  }

  const enriched = passes.map((p) => {
    const stats = pingMap.get(String(p._id)) ?? { numPings: 0, maxGap: Infinity };
    const score = calcPassScore({
      status: p.status,
      routeCompliancePercentage: p.routeCompliancePercentage,
      durationSeconds: p.durationSeconds,
      numPings: stats.numPings,
      maxGapSeconds: stats.maxGap,
    });
    const breakdown =
      score === null
        ? null
        : calcPassScoreBreakdown({
            status: p.status,
            routeCompliancePercentage: p.routeCompliancePercentage,
            durationSeconds: p.durationSeconds,
            numPings: stats.numPings,
            maxGapSeconds: stats.maxGap,
          });
    return {
      id: String(p._id),
      vehicle: p.vehicleId
        ? {
            id: String((p.vehicleId as { _id?: unknown })._id ?? p.vehicleId),
            plate: (p.vehicleId as { plate?: string }).plate,
            brand: (p.vehicleId as { brand?: string }).brand,
            model: (p.vehicleId as { model?: string }).model,
          }
        : null,
      driver: p.driverId
        ? {
            id: String((p.driverId as { _id?: unknown })._id ?? p.driverId),
            name: (p.driverId as { name?: string }).name,
          }
        : null,
      date: p.date,
      departureTime: p.departureTime,
      returnTime: p.returnTime,
      km: p.km,
      status: p.status,
      durationSeconds: p.durationSeconds,
      distanceMeters: p.distanceMeters,
      routeCompliancePercentage: p.routeCompliancePercentage,
      numPings: stats.numPings,
      maxGapSeconds: Number.isFinite(stats.maxGap) ? Math.round(stats.maxGap) : null,
      score,
      breakdown,
    };
  });

  const bestId = findBestPassId(enriched);
  const preferredId = route.preferredCaptureId
    ? String(route.preferredCaptureId)
    : null;
  const items = enriched.map((p) => ({
    ...p,
    isBest: p.id === bestId,
    isPreferred: p.id === preferredId,
  }));

  return apiResponse({
    route: {
      id: String(route._id),
      code: route.code,
      name: route.name,
      preferredCaptureId: preferredId,
      preferredAt: route.preferredAt ?? null,
    },
    items,
    total: items.length,
  });
}

// Mantenemos referencia a Vehicle para que tsc no marque como no usado en
// imports — el populate("vehicleId") indirectamente lo requiere registrado.
export const _vehicleRef = Vehicle;
