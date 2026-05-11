import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import { LocationPing } from "@/models/LocationPing";
import { Route } from "@/models/Route";
import { Vehicle } from "@/models/Vehicle";
import "@/models/Municipality";
import { apiResponse } from "@/lib/api/response";
import { haversineMeters } from "@/lib/geo/haversine";
import { routeBetween } from "@/lib/routing/routingService";
import type { ICurrentLocation, IVisitedStop } from "@/models/FleetEntry";

/**
 * Cantidad máxima de puntos del trazo en vivo que devolvemos por bus.
 * 50 puntos a 5s de muestreo = ~4 minutos de recorrido visible. Suficiente
 * para que el ciudadano vea la dirección en la que va el bus aún cuando la
 * ruta no esté predefinida.
 */
// Hasta 500 pings (≈83 min con ping cada 10s) para que la "línea trazada"
// del bus en el mapa del ciudadano se vea completa desde que arrancó el
// turno y no aparente desvanecerse cuando el bus avanza más lejos. Se
// envía como `liveTrack` ya en orden cronológico ascendente.
const LIVE_TRACK_POINTS_LIMIT = 500;

/**
 * Detección de paradas aprendidas a partir del trazo. Una parada existe
 * cuando el bus permanece en un radio < `LEARNED_STOP_RADIUS` durante más
 * que `LEARNED_STOP_MIN_DURATION`. Esto permite "aprender" paraderos sin
 * que el conductor los marque manualmente — el sistema los infiere del
 * comportamiento real.
 */
const LEARNED_STOP_RADIUS_M = 15;
const LEARNED_STOP_MIN_DURATION_MS = 30_000;
const LEARNED_STOP_MERGE_RADIUS_M = 30;

function detectLearnedStops(
  pings: Array<{ lat: number; lng: number; ts: Date }>,
): Array<{ lat: number; lng: number; durationSeconds: number }> {
  if (pings.length < 2) return [];
  const stops: Array<{ lat: number; lng: number; durationSeconds: number }> = [];

  let clusterStart = 0;
  for (let i = 1; i < pings.length; i++) {
    const head = pings[clusterStart];
    const cur = pings[i];
    const dist = haversineMeters(head, cur);
    if (dist <= LEARNED_STOP_RADIUS_M) continue;
    // Cerramos cluster anterior si duró suficiente.
    const dur = pings[i - 1].ts.getTime() - head.ts.getTime();
    if (dur >= LEARNED_STOP_MIN_DURATION_MS) {
      // Centroide simple del cluster.
      const cluster = pings.slice(clusterStart, i);
      const cLat = cluster.reduce((s, p) => s + p.lat, 0) / cluster.length;
      const cLng = cluster.reduce((s, p) => s + p.lng, 0) / cluster.length;
      // Mergear si está cerca de uno ya detectado (mismo paradero visitado dos veces).
      const existing = stops.find((s) => haversineMeters(s, { lat: cLat, lng: cLng }) <= LEARNED_STOP_MERGE_RADIUS_M);
      if (existing) {
        existing.durationSeconds += Math.round(dur / 1000);
      } else {
        stops.push({ lat: cLat, lng: cLng, durationSeconds: Math.round(dur / 1000) });
      }
    }
    clusterStart = i;
  }
  return stops;
}

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
  const companyId = url.searchParams.get("companyId");
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
  // Filtro por empresa: el operador consume este endpoint pasando su
  // `companyId` para ver SOLO la flota de su empresa en el mapa en vivo.
  // FleetEntry no tiene companyId directo, así que resolvemos los vehículos
  // de la empresa y filtramos por `vehicleId ∈ {...}`.
  if (companyId && isValidObjectId(companyId)) {
    const vehiclesOfCompany = await Vehicle.find({ companyId })
      .select("_id")
      .lean<Array<{ _id: unknown }>>();
    filter.vehicleId = { $in: vehiclesOfCompany.map((v) => v._id) };
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

  // Trazo en vivo (últimos N pings) por cada turno activo + paradas
  // aprendidas (clusters de puntos donde el bus se quedó >30s).
  const trackPointsByEntry = new Map<string, Array<{ lat: number; lng: number }>>();
  const learnedStopsByEntry = new Map<
    string,
    Array<{ lat: number; lng: number; durationSeconds: number }>
  >();
  if (entries.length > 0) {
    const entryIds = entries.map((e) => e._id);
    const ranked = await LocationPing.aggregate<{
      _id: unknown;
      points: Array<{ lat: number; lng: number; ts: Date }>;
    }>([
      { $match: { entryId: { $in: entryIds } } },
      { $sort: { entryId: 1, ts: -1 } },
      { $group: { _id: "$entryId", points: { $push: { lat: "$lat", lng: "$lng", ts: "$ts" } } } },
      { $project: { points: { $slice: ["$points", LIVE_TRACK_POINTS_LIMIT] } } },
    ]);
    for (const r of ranked) {
      // Reordenar a cronológico ascendente: necesario tanto para dibujar la
      // polyline en la dirección correcta como para la detección de paradas.
      const ascending = [...r.points].reverse();
      const id = String(r._id);
      trackPointsByEntry.set(id, ascending.map((p) => ({ lat: p.lat, lng: p.lng })));
      learnedStopsByEntry.set(id, detectLearnedStops(ascending));
    }
  }

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

      const liveTrack = trackPointsByEntry.get(String(e._id)) ?? [];
      const learnedStops = learnedStopsByEntry.get(String(e._id)) ?? [];
      return {
        id: String(e._id),
        plate: vehicle?.plate ?? "—",
        vehicleType: vehicle?.vehicleTypeKey ?? "omnibus",
        vehicleStatus: vehicle?.status ?? "apto",
        municipalityId: muni?._id ? String(muni._id) : null,
        municipalityName: muni?.name ?? null,
        liveTrack,
        learnedStops,
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
