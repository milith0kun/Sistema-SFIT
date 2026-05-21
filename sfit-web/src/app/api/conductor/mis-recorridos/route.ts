import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import { LocationPing } from "@/models/LocationPing";
import { Driver } from "@/models/Driver";
import { RouteCapture, type RouteCaptureStatus } from "@/models/RouteCapture";
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
import { calcPassScore, maxGapSeconds } from "@/lib/routing/passScoring";

/**
 * GET /api/conductor/mis-recorridos?limit=<n>&perRoute=<n>
 *
 * Devuelve los turnos del conductor agrupados por ruta. Por cada ruta
 * incluye sus pasadas (turnos) ordenadas desc por fecha y un cálculo
 * server-side de la "mejor pasada" (`bestPassId`).
 *
 * Forma de la respuesta:
 *   {
 *     routes: [{
 *       routeId, code, name, waypoints, totalPasses, bestPassId,
 *       passes: [{ id, date, status, ..., score, isBest, track? }]
 *     }],
 *     activeEntry: { id, ..., track } | null,
 *   }
 *
 * Notas:
 *   - Para mantener el payload chico, solo se devuelve `track` (sample 30pts)
 *     en el `activeEntry` y en la "mejor pasada" de cada ruta. El resto de
 *     pasadas trae solo métricas; el detalle full-screen carga el trazo a
 *     demanda con /flota/:id/location.
 *   - Pasadas sin `routeId` se agrupan bajo un seudo-grupo "Sin ruta asignada".
 */

const SAMPLE_LIMIT = 30;
const PAGE_LIMIT_DEFAULT = 60;
const PAGE_LIMIT_MAX = 1000;
const PER_ROUTE_DEFAULT = 50;
const PER_ROUTE_MAX = 500;

/** Sample uniforme reduciendo a SAMPLE_LIMIT puntos como máximo. */
function samplePings(
  all: Array<{ lat: number; lng: number; ts: Date }>,
): Array<{ lat: number; lng: number }> {
  if (all.length <= SAMPLE_LIMIT) {
    return all.map((p) => ({ lat: p.lat, lng: p.lng }));
  }
  const step = Math.floor(all.length / SAMPLE_LIMIT);
  const sampled: Array<{ lat: number; lng: number; ts: Date }> = [];
  for (let i = 0; i < all.length; i += step) sampled.push(all[i]);
  if (sampled[sampled.length - 1] !== all[all.length - 1]) {
    sampled.push(all[all.length - 1]);
  }
  return sampled.map((p) => ({ lat: p.lat, lng: p.lng }));
}

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
  const perRoute = Math.min(
    PER_ROUTE_MAX,
    Math.max(1, Number(url.searchParams.get("perRoute") ?? PER_ROUTE_DEFAULT)),
  );

  await connectDB();

  // 1. Resolver Driver por userId.
  const driver = await Driver.findOne({ userId: auth.session.userId, active: true })
    .select("_id")
    .lean();
  if (!driver) {
    return apiNotFound("Sin registro de conductor asociado a tu cuenta");
  }

  // 2. Turnos del conductor (recientes primero), trayendo Route con modalidad
  //    y estructura (paraderos u origen/destino) para que app/web muestren
  //    correctamente urbano vs interprovincial.
  const entries = await FleetEntry.find({ driverId: driver._id })
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .populate("vehicleId", "plate vehicleTypeKey")
    .populate("routeId", "code name waypoints serviceScope originDistrictCode destinationDistrictCode")
    .select(
      "vehicleId routeId date status departureTime returnTime km distanceMeters durationSeconds routeCompliancePercentage visitedStops startLocation endLocation currentLocation",
    )
    .lean();

  if (entries.length === 0) {
    return apiResponse({ routes: [], activeEntry: null, total: 0 });
  }

  // 3. Agregación de pings por entry (necesitamos total + maxGap + sample).
  const entryIds = entries.map((e) => e._id);
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

  const groupedById = new Map<string, { points: Array<{ lat: number; lng: number; ts: Date }>; total: number }>();
  for (const g of grouped) {
    groupedById.set(String(g._id), { points: g.points, total: g.total });
  }

  // 3b. RouteCaptures asociadas a estos turnos (para mostrar al conductor
  //     si su trazo se promovió a una candidata, ya quedó como raw alimentando
  //     una ruta oficial, o aún no califica).
  const captures = await RouteCapture.find({ fleetEntryId: { $in: entryIds } })
    .select("fleetEntryId status qualityScore")
    .lean();
  const captureByEntryId = new Map<string, { id: string; status: RouteCaptureStatus; qualityScore: number }>();
  for (const c of captures) {
    if (!c.fleetEntryId) continue;
    captureByEntryId.set(String(c.fleetEntryId), {
      id: String(c._id),
      status: c.status,
      qualityScore: c.qualityScore ?? 0,
    });
  }

  // 4. Enriquecer cada entry con métricas + score.
  type Pass = {
    id: string;
    date: Date | null;
    status: string;
    departureTime: string | null;
    returnTime: string | null;
    vehiclePlate: string;
    routeName: string | null;
    routeCode: string | null;
    km: number;
    distanceMeters: number | null;
    durationSeconds: number | null;
    routeCompliancePercentage: number | null;
    visitedStopsCount: number;
    startLocation: unknown;
    endLocation: unknown;
    currentLocation: unknown;
    trackPointsTotal: number;
    score: number | null;
    isBest: boolean;
    /** Captura GPS asociada (RouteCapture). null si el turno no generó captura
     *  (p.ej. <20 pings o todavía está en_ruta). */
    captureId: string | null;
    captureStatus: RouteCaptureStatus | null;
    captureQualityScore: number | null;
    track?: Array<{ lat: number; lng: number }>;
  };

  type RouteGroup = {
    routeId: string | null;
    code: string | null;
    name: string | null;
    serviceScope: string | null;
    originDistrictCode: string | null;
    destinationDistrictCode: string | null;
    waypoints: Array<{ order: number; lat: number; lng: number; label?: string }> | null;
    passes: Pass[];
    bestPassId: string | null;
    totalPasses: number;
  };

  const routeGroups = new Map<string, RouteGroup>();
  let activeEntry: (Pass & { track?: Array<{ lat: number; lng: number }> }) | null = null;

  for (const e of entries) {
    const vehicle = e.vehicleId as { plate?: string } | null;
    const route = e.routeId as
      | {
          _id?: unknown;
          code?: string;
          name?: string;
          serviceScope?: string;
          originDistrictCode?: string;
          destinationDistrictCode?: string;
          waypoints?: Array<{ order: number; lat: number; lng: number; label?: string }>;
        }
      | null;

    const g = groupedById.get(String(e._id));
    const numPings = g?.total ?? 0;
    const points = g?.points ?? [];
    const gap = maxGapSeconds(points);

    const score = calcPassScore({
      status: e.status,
      routeCompliancePercentage: e.routeCompliancePercentage,
      durationSeconds: e.durationSeconds,
      numPings,
      maxGapSeconds: gap,
    });

    const cap = captureByEntryId.get(String(e._id));
    // Sample chico (max 30 pts) para mostrar mini-mapa en cada fila sin
    // inflar el payload. Si la pasada no tiene pings (turno fantasma),
    // intentamos al menos start+end para que el mapa no quede vacío.
    let trackSample: Array<{ lat: number; lng: number }> | undefined;
    if (points.length > 0) {
      trackSample = samplePings(points);
    } else {
      const sl = e.startLocation as { lat?: number; lng?: number } | null;
      const el = e.endLocation as { lat?: number; lng?: number } | null;
      const fallback: Array<{ lat: number; lng: number }> = [];
      if (sl?.lat != null && sl?.lng != null) fallback.push({ lat: sl.lat, lng: sl.lng });
      if (el?.lat != null && el?.lng != null) fallback.push({ lat: el.lat, lng: el.lng });
      if (fallback.length > 0) trackSample = fallback;
    }

    const pass: Pass = {
      id: String(e._id),
      date: e.date ?? null,
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
      trackPointsTotal: numPings,
      score,
      isBest: false,
      captureId: cap?.id ?? null,
      captureStatus: cap?.status ?? null,
      captureQualityScore: cap?.qualityScore ?? null,
      track: trackSample,
    };

    // Detectar el turno activo (en_ruta). El track ya viene poblado arriba.
    if (e.status === "en_ruta") {
      activeEntry = pass;
    }

    const routeKey = route?._id ? String(route._id) : "__no_route__";
    if (!routeGroups.has(routeKey)) {
        routeGroups.set(routeKey, {
          routeId: route?._id ? String(route._id) : null,
          code: route?.code ?? null,
          name: route?.name ?? null,
          serviceScope: route?.serviceScope ?? null,
          originDistrictCode: route?.originDistrictCode ?? null,
          destinationDistrictCode: route?.destinationDistrictCode ?? null,
          waypoints: route?.waypoints
          ? route.waypoints.map((w) => ({
              order: w.order,
              lat: w.lat,
              lng: w.lng,
              label: w.label,
            }))
          : null,
        passes: [],
        bestPassId: null,
        totalPasses: 0,
      });
    }
    routeGroups.get(routeKey)!.passes.push(pass);
  }

  // 5. Por cada grupo: elegir mejor pasada, marcarla, recortar a perRoute,
  //    y poblar `track` solo en la mejor pasada (para el preview).
  const routesArray: RouteGroup[] = [];
  for (const group of routeGroups.values()) {
    group.totalPasses = group.passes.length;

    let bestId: string | null = null;
    let bestScore = -1;
    for (const p of group.passes) {
      if (p.score !== null && p.score > bestScore) {
        bestScore = p.score;
        bestId = p.id;
      }
    }
    group.bestPassId = bestId;
    if (bestId) {
      const best = group.passes.find((p) => p.id === bestId);
      if (best) best.isBest = true;
    }

    // Las pasadas ya vienen ordenadas desc por fecha (entries lo está).
    // Recortar al perRoute (la mejor siempre se conserva si está dentro
    // de las primeras `perRoute`; si quedara fuera, la promovemos al tope).
    if (group.passes.length > perRoute) {
      const head = group.passes.slice(0, perRoute);
      if (bestId && !head.some((p) => p.id === bestId)) {
        const bestPass = group.passes.find((p) => p.id === bestId);
        if (bestPass) head[head.length - 1] = bestPass;
      }
      group.passes = head;
    }

    routesArray.push(group);
  }

  // 6. Ordenar grupos: el de pasadas más recientes primero, y "sin ruta" al
  //    final si existe.
  routesArray.sort((a, b) => {
    if (a.routeId === null && b.routeId !== null) return 1;
    if (b.routeId === null && a.routeId !== null) return -1;
    const ad = a.passes[0]?.date?.getTime() ?? 0;
    const bd = b.passes[0]?.date?.getTime() ?? 0;
    return bd - ad;
  });

  return apiResponse({
    routes: routesArray,
    activeEntry,
    total: entries.length,
  });
}
