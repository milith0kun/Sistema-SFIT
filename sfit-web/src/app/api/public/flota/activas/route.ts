import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import { Route } from "@/models/Route";
import "@/models/Vehicle";
import { apiResponse } from "@/lib/api/response";
import { haversineMeters } from "@/lib/geo/haversine";
import type { ICurrentLocation, IVisitedStop } from "@/models/FleetEntry";

/**
 * GET /api/public/flota/activas?municipalityId=<id>&lat=<n>&lng=<n>&limit=<n>
 *
 * Endpoint público (sin auth) para ciudadanos: lista los buses con turno
 * activo (en_ruta) con su posición GPS, ruta y ETA por cada paradero.
 * No expone datos del conductor (anonimizado).
 *
 * Si vienen `lat`/`lng` del ciudadano:
 *   - Cada item incluye `distanceFromUserMeters` (haversine al bus).
 *   - Resultado ordenado ascendente por esa distancia (los más cercanos primero).
 * Si no vienen, mantiene orden de inserción de Mongo y omite el campo.
 *
 * `etaByStop[]`: para cada paradero NO visitado, calcula ETA acumulado
 * encadenado (bus → wp1 → wp2 → ... → wpN). El último elemento es el
 * paradero terminal de la ruta.
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

  const entries = await FleetEntry.find({
    status: "en_ruta",
    municipalityId,
    "currentLocation.lat": { $exists: true },
    "currentLocation.lng": { $exists: true },
  })
    .populate("vehicleId", "plate brand model vehicleTypeKey status")
    .populate("routeId")
    .select("vehicleId routeId currentLocation visitedStops departureTime")
    .lean();

  const items = entries
    .filter((e) => {
      const loc = e.currentLocation as ICurrentLocation | undefined;
      return loc?.lat != null && loc?.lng != null;
    })
    .map((e) => {
      const loc = e.currentLocation as ICurrentLocation;
      const vehicle = e.vehicleId as {
        plate?: string;
        brand?: string;
        model?: string;
        vehicleTypeKey?: string;
        status?: string;
      } | null;
      const route = e.routeId as {
        _id?: unknown;
        name?: string;
        code?: string;
        waypoints?: Array<{ lat: number; lng: number; label?: string; order: number }>;
      } | null;

      // ── Calcular ETA encadenada por cada paradero pendiente ──
      const waypoints = (route?.waypoints ?? []).sort((a, b) => a.order - b.order);
      const visited = (e.visitedStops ?? []) as IVisitedStop[];
      const visitedSet = new Set(visited.map((s) => s.stopIndex));
      const maxVisitedOrder = visited.length > 0
        ? Math.max(...visited.map((s) => s.stopIndex))
        : -1;

      // Velocidad: speed real si >0.5 m/s, sino 4.17 m/s (15 km/h urbano).
      const speed = (loc.speed ?? 0) > 0.5 ? loc.speed! : 4.17;

      // ETA acumulado: bus → wp1 → wp2 → ... siguiendo el orden de la ruta.
      const pending = waypoints.filter((w) => w.order > maxVisitedOrder);
      const etaByStop: Array<{
        stopIndex: number;
        label: string;
        lat: number;
        lng: number;
        distanceFromBusMeters: number;
        etaSeconds: number;
        visited: boolean;
      }> = [];

      let cumulativeMeters = 0;
      let prev: { lat: number; lng: number } = { lat: loc.lat, lng: loc.lng };
      for (const wp of pending) {
        const segment = haversineMeters(prev, { lat: wp.lat, lng: wp.lng });
        cumulativeMeters += segment;
        etaByStop.push({
          stopIndex: wp.order,
          label: wp.label ?? `Paradero ${wp.order + 1}`,
          lat: wp.lat,
          lng: wp.lng,
          distanceFromBusMeters: Math.round(cumulativeMeters),
          etaSeconds: Math.round(cumulativeMeters / speed),
          visited: visitedSet.has(wp.order),
        });
        prev = { lat: wp.lat, lng: wp.lng };
      }

      // `nextStop` se conserva como compat para clientes viejos que usan el ETA
      // del próximo paradero. Coincide con `etaByStop[0]` cuando hay pendientes.
      const nextStop = etaByStop[0]
        ? {
            label: etaByStop[0].label,
            lat: etaByStop[0].lat,
            lng: etaByStop[0].lng,
            etaSeconds: etaByStop[0].etaSeconds,
          }
        : null;

      // Distancia ciudadano → bus para sort y badge "a Xm".
      const distanceFromUserMeters = hasUserCoords
        ? Math.round(haversineMeters({ lat: userLat, lng: userLng }, { lat: loc.lat, lng: loc.lng }))
        : null;

      return {
        id: String(e._id),
        plate: vehicle?.plate ?? "—",
        vehicleType: vehicle?.vehicleTypeKey ?? "omnibus",
        vehicleStatus: vehicle?.status ?? "apto",
        route: route
          ? {
              id: String(route._id),
              name: route.name ?? "—",
              code: route.code ?? null,
              waypoints: waypoints.map((w) => ({
                lat: w.lat,
                lng: w.lng,
                label: w.label,
                order: w.order,
              })),
            }
          : null,
        currentLocation: {
          lat: loc.lat,
          lng: loc.lng,
          updatedAt: loc.updatedAt,
          speed: loc.speed ?? null,
        },
        nextStop,
        etaByStop,
        distanceFromUserMeters,
      };
    });

  // Orden por proximidad al ciudadano si tiene coords.
  if (hasUserCoords) {
    items.sort((a, b) => {
      const da = a.distanceFromUserMeters ?? Number.POSITIVE_INFINITY;
      const db = b.distanceFromUserMeters ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
  }

  const limited = items.slice(0, limit);
  return apiResponse({ items: limited, total: items.length });
}
