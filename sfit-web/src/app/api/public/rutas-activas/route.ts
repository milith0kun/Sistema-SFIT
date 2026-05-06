import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import "@/models/Vehicle";
import { Route } from "@/models/Route";
import { apiResponse } from "@/lib/api/response";
import { haversineMeters } from "@/lib/geo/haversine";
import type { ICurrentLocation } from "@/models/FleetEntry";

const URBAN_FALLBACK_FACTOR = 1.35;
const FALLBACK_SPEED_MS = 4.17; // 15 km/h

type WaypointLite = { order: number; lat: number; lng: number; label?: string };

/**
 * GET /api/public/rutas-activas?municipalityId=<id>&lat=<n>&lng=<n>&limit=<n>
 *
 * Endpoint público (sin auth) para la vista del ciudadano "Rutas en vivo":
 * agrupa los `FleetEntry` con `status=en_ruta` (y `currentLocation` válida)
 * por `routeId`, devolviendo por cada ruta:
 *   - count de buses activos
 *   - waypoints + polylineCoords (para dibujar)
 *   - el bus más próximo al ciudadano (si vienen lat/lng)
 *   - paradero más cercano al ciudadano y ETA del bus más próximo a ese paradero
 *
 * Pensado para que la app móvil construya un listado tipo "estas son las rutas
 * con bus en vivo ahora" y permita al ciudadano filtrar el mapa con un tap.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const municipalityId = url.searchParams.get("municipalityId");
  const userLatStr = url.searchParams.get("lat");
  const userLngStr = url.searchParams.get("lng");
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));

  if (!municipalityId || !isValidObjectId(municipalityId)) {
    return apiResponse({ items: [], total: 0 });
  }

  const userLat = userLatStr != null && userLatStr !== "" ? Number(userLatStr) : null;
  const userLng = userLngStr != null && userLngStr !== "" ? Number(userLngStr) : null;
  const hasUserCoords =
    userLat != null && userLng != null &&
    !Number.isNaN(userLat) && !Number.isNaN(userLng) &&
    userLat >= -90 && userLat <= 90 &&
    userLng >= -180 && userLng <= 180;

  await connectDB();

  // Traemos todos los buses transmitiendo y los agrupamos en memoria por ruta.
  // El volumen esperado es bajo (decenas), no justifica un $group de Mongo.
  const entries = await FleetEntry.find({
    status: "en_ruta",
    municipalityId,
    "currentLocation.lat": { $exists: true },
    "currentLocation.lng": { $exists: true },
    routeId: { $exists: true, $ne: null },
  })
    .populate("vehicleId", "plate vehicleTypeKey status")
    .select("vehicleId routeId currentLocation visitedStops")
    .lean();

  if (entries.length === 0) {
    return apiResponse({ items: [], total: 0 });
  }

  const routeIds = Array.from(
    new Set(entries.map((e) => String(e.routeId)).filter(Boolean)),
  );
  const routes = await Route.find({ _id: { $in: routeIds } })
    .select("name code waypoints polylineGeometry status direction vehicleTypeKey")
    .lean();

  type RouteLite = {
    _id: unknown;
    name?: string;
    code?: string;
    status?: string;
    direction?: string;
    vehicleTypeKey?: string;
    waypoints?: WaypointLite[];
    polylineGeometry?: { coords?: [number, number][] } | null;
  };

  const routesById = new Map<string, RouteLite>(
    routes.map((r) => [String(r._id), r as RouteLite]),
  );

  // Agrupar entries por routeId
  const byRoute = new Map<string, typeof entries>();
  for (const e of entries) {
    const rid = String(e.routeId);
    if (!byRoute.has(rid)) byRoute.set(rid, []);
    byRoute.get(rid)!.push(e);
  }

  type ActiveBusLite = {
    id: string;
    plate: string;
    lat: number;
    lng: number;
    distanceFromUserMeters: number | null;
  };

  const items = Array.from(byRoute.entries()).map(([rid, buses]) => {
    const route = routesById.get(rid);
    const waypoints = ((route?.waypoints ?? []) as WaypointLite[])
      .slice()
      .sort((a, b) => a.order - b.order);

    // Mapeo ligero por bus + distancia al usuario.
    const busesLite: ActiveBusLite[] = buses
      .map((b) => {
        const loc = b.currentLocation as ICurrentLocation;
        const veh = b.vehicleId as { plate?: string } | null;
        return {
          id: String(b._id),
          plate: veh?.plate ?? "—",
          lat: loc.lat,
          lng: loc.lng,
          distanceFromUserMeters: hasUserCoords
            ? Math.round(haversineMeters({ lat: userLat, lng: userLng }, { lat: loc.lat, lng: loc.lng }))
            : null,
        };
      })
      .sort((a, b) => {
        const da = a.distanceFromUserMeters ?? Number.POSITIVE_INFINITY;
        const db = b.distanceFromUserMeters ?? Number.POSITIVE_INFINITY;
        return da - db;
      });

    const closestBus = busesLite[0] ?? null;

    // ── Paradero más cercano al usuario (si tenemos sus coords) ──
    let nearestStop: {
      stopIndex: number;
      label: string;
      lat: number;
      lng: number;
      distanceFromUserMeters: number;
    } | null = null;

    if (hasUserCoords && waypoints.length > 0) {
      let bestDist = Number.POSITIVE_INFINITY;
      let bestWp: WaypointLite | null = null;
      for (const wp of waypoints) {
        const d = haversineMeters(
          { lat: userLat, lng: userLng },
          { lat: wp.lat, lng: wp.lng },
        );
        if (d < bestDist) {
          bestDist = d;
          bestWp = wp;
        }
      }
      if (bestWp) {
        nearestStop = {
          stopIndex: bestWp.order,
          label: bestWp.label ?? `Paradero ${bestWp.order + 1}`,
          lat: bestWp.lat,
          lng: bestWp.lng,
          distanceFromUserMeters: Math.round(bestDist),
        };
      }
    }

    // ── ETA del bus más próximo al paradero del usuario ──
    // Estimación rápida (sin Google Routes para no saturar): suma de tramos
    // haversine × factor urbano entre la posición actual del bus y el paradero.
    let etaToUserStopSeconds: number | null = null;
    if (nearestStop && closestBus) {
      // Encontrar el bus que tiene a este paradero pendiente y más cerca
      // (en término de tramos restantes en la ruta).
      let bestBusEta: number | null = null;
      for (const b of buses) {
        const loc = b.currentLocation as ICurrentLocation;
        const visited = (b.visitedStops as { stopIndex: number }[] | undefined) ?? [];
        const maxVisitedOrder = visited.length > 0
          ? Math.max(...visited.map((s) => s.stopIndex))
          : -1;
        if (nearestStop.stopIndex <= maxVisitedOrder) continue; // ya pasó

        const speed = (loc.speed ?? 0) > 0.5 ? loc.speed! : FALLBACK_SPEED_MS;

        // Cadena bus → wp(maxVisited+1) → ... → wp(nearestStop.stopIndex)
        let d = 0;
        let prev = { lat: loc.lat, lng: loc.lng };
        for (const wp of waypoints) {
          if (wp.order <= maxVisitedOrder) continue;
          d += haversineMeters(prev, { lat: wp.lat, lng: wp.lng }) * URBAN_FALLBACK_FACTOR;
          if (wp.order >= nearestStop.stopIndex) break;
          prev = { lat: wp.lat, lng: wp.lng };
        }
        const seconds = d / speed;
        if (bestBusEta == null || seconds < bestBusEta) bestBusEta = seconds;
      }
      if (bestBusEta != null) etaToUserStopSeconds = Math.round(bestBusEta);
    }

    return {
      routeId: rid,
      name: route?.name ?? "—",
      code: route?.code ?? null,
      direction: route?.direction ?? null,
      vehicleTypeKey: route?.vehicleTypeKey ?? null,
      activeBusCount: buses.length,
      waypoints: waypoints.map((w) => ({
        lat: w.lat,
        lng: w.lng,
        label: w.label,
        order: w.order,
      })),
      polylineCoords: route?.polylineGeometry?.coords ?? null,
      buses: busesLite,
      closestBus,
      nearestStop,
      etaToUserStopSeconds,
    };
  });

  // Orden: rutas con bus más cercano primero (si hay coords); por count si no.
  if (hasUserCoords) {
    items.sort((a, b) => {
      const da = a.closestBus?.distanceFromUserMeters ?? Number.POSITIVE_INFINITY;
      const db = b.closestBus?.distanceFromUserMeters ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
  } else {
    items.sort((a, b) => b.activeBusCount - a.activeBusCount);
  }

  const limited = items.slice(0, limit);
  return apiResponse({ items: limited, total: items.length });
}
