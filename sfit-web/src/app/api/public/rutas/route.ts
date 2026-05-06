import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Route } from "@/models/Route";
import { FleetEntry } from "@/models/FleetEntry";
import { apiResponse } from "@/lib/api/response";
import { haversineMeters } from "@/lib/geo/haversine";

const STALE_LOCATION_THRESHOLD_MS = 2 * 60_000; // 2 min — coincide con /flota/activas

type WaypointLite = { order: number; lat: number; lng: number; label?: string };

/**
 * GET /api/public/rutas?municipalityId=<id>&lat=<n>&lng=<n>&limit=<n>
 *
 * Endpoint público (sin auth) que lista TODAS las rutas activas del municipio
 * — con o sin buses transmitiendo en este momento. Pensado para que el
 * ciudadano pueda navegar el catálogo completo de rutas y verlas en el mapa
 * aún cuando no haya buses activos a esa hora.
 *
 * Para cada ruta retorna:
 *   - waypoints + polylineCoords (dibujar el recorrido)
 *   - activeBusCount (cuántos buses están transmitiendo ahora mismo)
 *   - nearestStop al ciudadano si vinieron lat/lng
 *   - distanceFromUserMeters al paradero más cercano (sort cuando hay GPS)
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const municipalityId = url.searchParams.get("municipalityId");
  const userLatStr = url.searchParams.get("lat");
  const userLngStr = url.searchParams.get("lng");
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

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

  // Catálogo completo de rutas activas del municipio.
  const routes = await Route.find({ municipalityId, status: "activa" })
    .select("name code waypoints polylineGeometry direction vehicleTypeKey serviceScope")
    .lean();

  if (routes.length === 0) {
    return apiResponse({ items: [], total: 0 });
  }

  // Buses transmitiendo agrupados por ruta — usado solo para el contador.
  const activeEntries = await FleetEntry.find({
    status: "en_ruta",
    municipalityId,
    routeId: { $in: routes.map((r) => r._id) },
    "currentLocation.updatedAt": { $gte: new Date(Date.now() - STALE_LOCATION_THRESHOLD_MS) },
  })
    .select("routeId")
    .lean();

  const activeCountByRoute = new Map<string, number>();
  for (const e of activeEntries) {
    const rid = String(e.routeId);
    activeCountByRoute.set(rid, (activeCountByRoute.get(rid) ?? 0) + 1);
  }

  const items = routes.map((r) => {
    const waypoints = ((r.waypoints ?? []) as WaypointLite[])
      .slice()
      .sort((a, b) => a.order - b.order);

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

    return {
      routeId: String(r._id),
      name: r.name,
      code: r.code ?? null,
      direction: r.direction ?? null,
      vehicleTypeKey: r.vehicleTypeKey ?? null,
      activeBusCount: activeCountByRoute.get(String(r._id)) ?? 0,
      waypoints: waypoints.map((w) => ({
        lat: w.lat,
        lng: w.lng,
        label: w.label,
        order: w.order,
      })),
      polylineCoords: r.polylineGeometry?.coords ?? null,
      nearestStop,
    };
  });

  // Orden: si hay GPS → paradero más cercano primero; si no → rutas con buses
  // activos primero, luego alfabético por código/nombre.
  if (hasUserCoords) {
    items.sort((a, b) => {
      const da = a.nearestStop?.distanceFromUserMeters ?? Number.POSITIVE_INFINITY;
      const db = b.nearestStop?.distanceFromUserMeters ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
  } else {
    items.sort((a, b) => {
      if (a.activeBusCount !== b.activeBusCount) return b.activeBusCount - a.activeBusCount;
      return (a.code ?? a.name).localeCompare(b.code ?? b.name);
    });
  }

  const limited = items.slice(0, limit);
  return apiResponse({ items: limited, total: items.length });
}
