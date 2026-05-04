import { decodeGooglePolyline } from "./decodePolyline";

/**
 * Wrapper sobre Google Routes API v2 (computeRoutes). Usa una sola API key
 * server-side configurada en `GOOGLE_ROUTES_API_KEY`. Si la key no está, los
 * llamadores deben caer al fallback haversine — el servicio devuelve null.
 *
 * Cache LRU en memoria (TTL 30s) sobre las consultas más comunes (bus → próximo
 * paradero) para evitar pegarle a Google en cada poll de 8s × N buses.
 */

export type LatLng = { lat: number; lng: number };
export type RoutePolyline = {
  coords: [number, number][];        // [lat, lng] en orden
  distanceMeters: number;
  durationSeconds: number;            // duración con tráfico cuando aplica
};

const ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
const FIELD_MASK =
  "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline";
const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 1000;
// Key precision — 4 decimales ≈ 11m, suficiente para reusar la cache
// cuando el bus se mueve dentro del mismo bloque
const KEY_PRECISION = 4;

/**
 * Resuelve la API key. Preferimos `GOOGLE_ROUTES_API_KEY` (server-side,
 * restringida por IP en producción), pero caemos a `NEXT_PUBLIC_GOOGLE_MAPS_KEY`
 * si no hay una específica — ya está configurada para Maps tiles y aplica
 * para Routes API si tiene esa API habilitada en Google Cloud Console.
 *
 * Nota: usar la public key en server-side está OK; el riesgo de
 * `NEXT_PUBLIC_*` es que se expone al cliente. Si en producción quieres
 * restringir Routes API por IP, configura un `GOOGLE_ROUTES_API_KEY`
 * dedicada y este wrapper la preferirá.
 */
function getApiKey(): string | null {
  return (
    process.env.GOOGLE_ROUTES_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ||
    null
  );
}

type CacheEntry = { value: RoutePolyline | null; expiresAt: number };

class LruCache {
  private map = new Map<string, CacheEntry>();
  get(key: string): CacheEntry | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return null;
    }
    // Refrescar orden LRU
    this.map.delete(key);
    this.map.set(key, entry);
    return entry;
  }
  set(key: string, value: RoutePolyline | null) {
    if (this.map.size >= CACHE_MAX) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }
}

const cache = new LruCache();

// Métricas básicas — visible vía endpoint admin futuro
const metrics = { ok: 0, fail: 0, cacheHit: 0 };
export function getRoutingMetrics() {
  return { ...metrics, cacheSize: cache["map"].size };
}

function roundCoord(v: number): number {
  return Math.round(v * 10 ** KEY_PRECISION) / 10 ** KEY_PRECISION;
}

function cacheKey(from: LatLng, to: LatLng, intermediates?: LatLng[]): string {
  const parts = [
    `${roundCoord(from.lat)},${roundCoord(from.lng)}`,
    `${roundCoord(to.lat)},${roundCoord(to.lng)}`,
  ];
  if (intermediates?.length) {
    parts.push(intermediates.map(p => `${roundCoord(p.lat)},${roundCoord(p.lng)}`).join("|"));
  }
  return parts.join("→");
}

function locationLatLng(p: LatLng) {
  return { location: { latLng: { latitude: p.lat, longitude: p.lng } } };
}

interface ComputeRoutesBody {
  origin: ReturnType<typeof locationLatLng>;
  destination: ReturnType<typeof locationLatLng>;
  intermediates?: ReturnType<typeof locationLatLng>[];
  travelMode: "DRIVE";
  routingPreference: "TRAFFIC_AWARE" | "TRAFFIC_UNAWARE";
}

interface ComputeRoutesResponse {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;          // formato "453s"
    polyline?: { encodedPolyline?: string };
  }>;
}

/**
 * Calcula una ruta entre dos puntos con tráfico real (TRAFFIC_AWARE).
 * Devuelve null si la API falla, key falta, o no hay rutas.
 */
export async function routeBetween(
  from: LatLng,
  to: LatLng,
): Promise<RoutePolyline | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const key = cacheKey(from, to);
  const cached = cache.get(key);
  if (cached) { metrics.cacheHit++; return cached.value; }

  const body: ComputeRoutesBody = {
    origin: locationLatLng(from),
    destination: locationLatLng(to),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      metrics.fail++;
      cache.set(key, null);  // cachea el fail durante TTL para no martillar
      return null;
    }
    const data = (await res.json()) as ComputeRoutesResponse;
    const route = data.routes?.[0];
    if (!route?.polyline?.encodedPolyline) {
      metrics.fail++;
      cache.set(key, null);
      return null;
    }
    const result: RoutePolyline = {
      coords: decodeGooglePolyline(route.polyline.encodedPolyline),
      distanceMeters: route.distanceMeters ?? 0,
      durationSeconds: parseDurationSeconds(route.duration),
    };
    metrics.ok++;
    cache.set(key, result);
    return result;
  } catch (err) {
    metrics.fail++;
    console.warn("[routingService] routeBetween error", err);
    return null;
  }
}

/**
 * Calcula una ruta a lo largo de waypoints en orden (origin = primero,
 * destination = último, resto como intermediates). Útil para cachear la
 * geometría completa de una Route al editarla. Sin tráfico (la geometría
 * de las calles no cambia con la hora del día).
 */
export async function routeAlongWaypoints(
  waypoints: LatLng[],
): Promise<RoutePolyline | null> {
  if (waypoints.length < 2) return null;
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const origin = waypoints[0];
  const destination = waypoints[waypoints.length - 1];
  const intermediates = waypoints.slice(1, -1);

  // No usamos cache aquí — esto se llama solo al editar la ruta
  const body: ComputeRoutesBody = {
    origin: locationLatLng(origin),
    destination: locationLatLng(destination),
    intermediates: intermediates.length ? intermediates.map(locationLatLng) : undefined,
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_UNAWARE",
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) { metrics.fail++; return null; }
    const data = (await res.json()) as ComputeRoutesResponse;
    const route = data.routes?.[0];
    if (!route?.polyline?.encodedPolyline) { metrics.fail++; return null; }
    metrics.ok++;
    return {
      coords: decodeGooglePolyline(route.polyline.encodedPolyline),
      distanceMeters: route.distanceMeters ?? 0,
      durationSeconds: parseDurationSeconds(route.duration),
    };
  } catch (err) {
    metrics.fail++;
    console.warn("[routingService] routeAlongWaypoints error", err);
    return null;
  }
}

function parseDurationSeconds(duration: string | undefined): number {
  if (!duration) return 0;
  // Google devuelve "453s" o "453.123s"
  const match = /^([\d.]+)s$/.exec(duration);
  return match ? Math.round(parseFloat(match[1])) : 0;
}
