import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import { Route } from "@/models/Route";
import "@/models/Vehicle";
import "@/models/Municipality";
import { apiResponse } from "@/lib/api/response";
import { haversineMeters } from "@/lib/geo/haversine";
import { routeBetween } from "@/lib/routing/routingService";
import type { ICurrentLocation, IVisitedStop } from "@/models/FleetEntry";

// Factor empírico de fallback para convertir distancia haversine a tiempo
// realista en Cusco urbano (calles + tráfico + paradas). 1.35 viene de
// medir varios trayectos contra Google Maps.
const URBAN_FALLBACK_FACTOR = 1.35;
const FALLBACK_SPEED_MS = 4.17; // 15 km/h promedio bus urbano Cusco

// Ventana de "frescura" para considerar a un bus como vivo en el mapa
// público. Si su última actualización GPS es más vieja que esto, lo ocultamos
// — evita buses fantasma cuando un conductor olvida hacer checkout.
const STALE_LOCATION_THRESHOLD_MS = 2 * 60_000; // 2 minutos

// Bounding box de búsqueda cuando hay GPS del ciudadano. ±0.3° ≈ 33 km a la
// latitud de Cusco. Cubre toda la ciudad y los distritos vecinos.
const BBOX_DELTA_DEG = 0.3;

/**
 * GET /api/public/flota/activas?lat=<n>&lng=<n>&municipalityId=<id>&limit=<n>
 *
 * Endpoint público (sin auth) para ciudadanos: lista los buses con turno
 * activo (en_ruta) con su posición GPS, ruta y ETA por cada paradero.
 * No expone datos del conductor (anonimizado).
 *
 * Filtros:
 *   - `lat`/`lng` del ciudadano (opcional): aplica bounding box ±0.3° (~33km)
 *     y ordena por cercanía. Cada item trae `distanceFromUserMeters`.
 *   - `municipalityId` (opcional, mantenido por compat): si viene restringe
 *     al tenant; si no, devuelve buses de cualquier municipio.
 *
 * Cada item trae `municipalityName` para que la app muestre la jurisdicción.
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
  const limit = Math.min(150, Math.max(1, Number(url.searchParams.get("limit") ?? 60)));

  const userLat = userLatStr != null && userLatStr !== "" ? Number(userLatStr) : null;
  const userLng = userLngStr != null && userLngStr !== "" ? Number(userLngStr) : null;
  const hasUserCoords =
    userLat != null && userLng != null &&
    !Number.isNaN(userLat) && !Number.isNaN(userLng) &&
    userLat >= -90 && userLat <= 90 &&
    userLng >= -180 && userLng <= 180;

  await connectDB();

  const filter: Record<string, unknown> = {
    status: "en_ruta",
    "currentLocation.lat": { $exists: true },
    "currentLocation.lng": { $exists: true },
    "currentLocation.updatedAt": { $gte: new Date(Date.now() - STALE_LOCATION_THRESHOLD_MS) },
  };
  if (municipalityId && isValidObjectId(municipalityId)) {
    filter.municipalityId = municipalityId;
  }
  if (hasUserCoords) {
    // Bounding box rápido contra la posición actual del bus. No es perfecto
    // (rutas largas siempre estarán cerca aunque el bus esté lejos), pero
    // mantiene el response chico cuando crece la flota nacional.
    filter["currentLocation.lat"] = {
      $gte: userLat - BBOX_DELTA_DEG,
      $lte: userLat + BBOX_DELTA_DEG,
    };
    filter["currentLocation.lng"] = {
      $gte: userLng - BBOX_DELTA_DEG,
      $lte: userLng + BBOX_DELTA_DEG,
    };
  }

  const entries = await FleetEntry.find(filter)
    .populate("vehicleId", "plate brand model vehicleTypeKey status")
    .populate("routeId")
    .populate("municipalityId", "name ubigeoCode")
    .select("vehicleId routeId municipalityId currentLocation visitedStops departureTime offRouteSince")
    .lean();

  // Procesamos en paralelo — Google Routes para el primer hop de cada bus.
  // Para 50 buses son 50 requests, pero el cache LRU del routing service
  // los agrupa cuando hay coordenadas similares.
  const items = await Promise.all(entries
    .filter((e) => {
      const loc = e.currentLocation as ICurrentLocation | undefined;
      return loc?.lat != null && loc?.lng != null;
    })
    .map(async (e) => {
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
        polylineGeometry?: {
          coords?: [number, number][];
          distanceMeters?: number;
        } | null;
      } | null;
      const muni = e.municipalityId as { _id?: unknown; name?: string } | null;

      // ── Calcular ETA encadenada por cada paradero pendiente ──
      const waypoints = (route?.waypoints ?? []).sort((a, b) => a.order - b.order);
      const visited = (e.visitedStops ?? []) as IVisitedStop[];
      const visitedSet = new Set(visited.map((s) => s.stopIndex));
      const maxVisitedOrder = visited.length > 0
        ? Math.max(...visited.map((s) => s.stopIndex))
        : -1;

      // Velocidad de fallback: speed real del bus si >0.5 m/s, sino default urbano.
      const speedFallback = (loc.speed ?? 0) > 0.5 ? loc.speed! : FALLBACK_SPEED_MS;

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

      // Hop 1 (bus → próximo paradero): pegamos a Google Routes con tráfico
      // real para tener distancia + duración precisas. Si falla caemos al
      // haversine x 1.35 con la velocidad del bus (o 15 km/h default).
      let cumulativeMeters = 0;
      let cumulativeSeconds = 0;
      if (pending.length > 0) {
        const firstStop = pending[0];
        const googleHop = await routeBetween(
          { lat: loc.lat, lng: loc.lng },
          { lat: firstStop.lat, lng: firstStop.lng },
        );
        if (googleHop) {
          cumulativeMeters = googleHop.distanceMeters;
          cumulativeSeconds = googleHop.durationSeconds;
        } else {
          const distHaversine = haversineMeters(
            { lat: loc.lat, lng: loc.lng },
            { lat: firstStop.lat, lng: firstStop.lng },
          );
          cumulativeMeters = distHaversine * URBAN_FALLBACK_FACTOR;
          cumulativeSeconds = cumulativeMeters / speedFallback;
        }
        etaByStop.push({
          stopIndex: firstStop.order,
          label: firstStop.label ?? `Paradero ${firstStop.order + 1}`,
          lat: firstStop.lat,
          lng: firstStop.lng,
          distanceFromBusMeters: Math.round(cumulativeMeters),
          etaSeconds: Math.round(cumulativeSeconds),
          visited: visitedSet.has(firstStop.order),
        });
      }

      // Hops siguientes: usamos haversine entre waypoints consecutivos
      // multiplicado por el factor urbano. Es una aproximación rápida que no
      // gasta cuota de Google. La geometría real de la ruta cacheada en
      // `route.polylineGeometry` se usa solo para el dibujo, no para ETA aquí.
      for (let i = 1; i < pending.length; i++) {
        const prev = pending[i - 1];
        const wp = pending[i];
        const segHaversine = haversineMeters(
          { lat: prev.lat, lng: prev.lng },
          { lat: wp.lat, lng: wp.lng },
        );
        const segMeters = segHaversine * URBAN_FALLBACK_FACTOR;
        const segSeconds = segMeters / speedFallback;
        cumulativeMeters += segMeters;
        cumulativeSeconds += segSeconds;
        etaByStop.push({
          stopIndex: wp.order,
          label: wp.label ?? `Paradero ${wp.order + 1}`,
          lat: wp.lat,
          lng: wp.lng,
          distanceFromBusMeters: Math.round(cumulativeMeters),
          etaSeconds: Math.round(cumulativeSeconds),
          visited: visitedSet.has(wp.order),
        });
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
        municipalityId: muni?._id ? String(muni._id) : null,
        municipalityName: muni?.name ?? null,
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
              // Geometría real siguiendo calles si está cacheada. La app la
              // usa para dibujar la polyline en lugar de líneas rectas.
              polylineCoords: route.polylineGeometry?.coords ?? null,
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
        // Marcador anonimizado: indica si el bus está fuera de la ruta
        // planeada. No exponemos el `offRouteSince` exacto.
        isOffRoute: Boolean((e as { offRouteSince?: Date | null }).offRouteSince),
      };
    }));

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
