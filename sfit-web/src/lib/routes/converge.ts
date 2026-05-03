/**
 * Algoritmo de convergencia de trazados GPS — RF Conductor.
 *
 * Toma N capturas GPS del mismo recorrido y produce una polilínea
 * promedio robusta para reemplazar los waypoints "oficiales" de una
 * Route. El objetivo es que con cada recorrido del conductor el modelo
 * mejore.
 *
 * Pipeline:
 *   1. Filtrar capturas con qualityScore >= MIN_QUALITY.
 *   2. Para cada captura: simplificar con Ramer-Douglas-Peucker (RDP)
 *      con epsilon ~5m para eliminar jitter y conservar la forma.
 *   3. Re-samplear cada captura a N puntos equidistantes (resampleEvenly)
 *      para alinearlas índice-a-índice.
 *   4. Para cada índice i: calcular el centroide (promedio simple) de
 *      los puntos i de todas las capturas. Si la dispersión > 30m,
 *      conservar el waypoint actual (probable intersección/desvío).
 *   5. Devolver array de waypoints promediados.
 *
 * Sin dependencias: solo geometría plana (haversine) + estadística básica.
 */

export interface GpsPoint {
  lat: number;
  lng: number;
}

export interface ConvergeOptions {
  /** Umbral mínimo de calidad para considerar una captura. 0-100. */
  minQuality?: number;
  /** Tolerancia RDP en metros (cuánto se permite desviar al simplificar). */
  rdpEpsilonMeters?: number;
  /** Cantidad de puntos a resamplear de cada captura para alinearlas. */
  resampleCount?: number;
  /** Si la desviación estándar de un segmento supera esto, se conserva el waypoint actual. */
  outlierThresholdMeters?: number;
}

export interface ConvergeInput {
  /** Cada captura es una lista de puntos GPS en orden temporal. */
  captures: Array<{ points: GpsPoint[]; qualityScore: number; id?: string }>;
  /** Waypoints oficiales actuales (fallback para outliers). */
  currentWaypoints: GpsPoint[];
  options?: ConvergeOptions;
}

export interface ConvergeResult {
  waypoints: GpsPoint[];
  /** Capturas usadas (filtradas por minQuality). IDs si se proveyeron. */
  usedCaptureIds: string[];
  /** Capturas descartadas y por qué. */
  discarded: Array<{ id?: string; reason: string }>;
  /** Para cada índice i del resultado, cuánto se desviaron las capturas. */
  segmentStats: Array<{ index: number; stdDevMeters: number; isOutlier: boolean }>;
}

const DEFAULTS: Required<ConvergeOptions> = {
  minQuality: 60,
  rdpEpsilonMeters: 5,
  resampleCount: 50,
  outlierThresholdMeters: 30,
};

const EARTH_RADIUS_M = 6_371_000;

/** Distancia haversine en metros entre dos puntos lat/lng. */
export function haversineMeters(a: GpsPoint, b: GpsPoint): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distancia perpendicular en metros desde el punto `p` al segmento `a-b`.
 * Aproximada con proyección plana local (válida para distancias <1km).
 */
function perpendicularDistance(p: GpsPoint, a: GpsPoint, b: GpsPoint): number {
  // Proyectar a metros locales centrados en `a`.
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((a.lat * Math.PI) / 180);
  const ax = 0, ay = 0;
  const bx = (b.lng - a.lng) * mPerDegLng;
  const by = (b.lat - a.lat) * mPerDegLat;
  const px = (p.lng - a.lng) * mPerDegLng;
  const py = (p.lat - a.lat) * mPerDegLat;

  const segLenSq = (bx - ax) ** 2 + (by - ay) ** 2;
  if (segLenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / segLenSq));
  const projX = ax + t * (bx - ax);
  const projY = ay + t * (by - ay);
  return Math.hypot(px - projX, py - projY);
}

/**
 * Simplificación Ramer-Douglas-Peucker. Conserva los puntos críticos
 * (extremos y vértices con mayor desviación) y descarta los redundantes.
 * Iterativa para evitar stack overflow en trazados largos.
 */
export function rdpSimplify(points: GpsPoint[], epsilonMeters: number): GpsPoint[] {
  if (points.length < 3) return [...points];
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let maxIdx = -1;
    const a = points[start];
    const b = points[end];
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i], a, b);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxIdx !== -1 && maxDist > epsilonMeters) {
      keep[maxIdx] = true;
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }

  const out: GpsPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) out.push(points[i]);
  }
  return out;
}

/**
 * Re-samplea una polilínea a `n` puntos equidistantes a lo largo del
 * recorrido total. Útil para alinear capturas de distinta longitud
 * antes de promediar índice-a-índice.
 */
export function resampleEvenly(points: GpsPoint[], n: number): GpsPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1 || n <= 1) return [points[0]];

  // Distancia acumulada en cada punto del trazado original.
  const cum = new Array<number>(points.length).fill(0);
  for (let i = 1; i < points.length; i++) {
    cum[i] = cum[i - 1] + haversineMeters(points[i - 1], points[i]);
  }
  const total = cum[points.length - 1];
  if (total === 0) return Array.from({ length: n }, () => points[0]);

  const step = total / (n - 1);
  const out: GpsPoint[] = [points[0]];
  let j = 1;
  for (let i = 1; i < n - 1; i++) {
    const target = step * i;
    while (j < points.length - 1 && cum[j] < target) j++;
    // Interpolar lineal entre points[j-1] y points[j].
    const segLen = cum[j] - cum[j - 1];
    const t = segLen === 0 ? 0 : (target - cum[j - 1]) / segLen;
    out.push({
      lat: points[j - 1].lat + t * (points[j].lat - points[j - 1].lat),
      lng: points[j - 1].lng + t * (points[j].lng - points[j - 1].lng),
    });
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Largo total del trazado en metros. */
export function polylineLengthMeters(points: GpsPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineMeters(points[i - 1], points[i]);
  return total;
}

/** Centroide de un conjunto de puntos (promedio simple). */
function centroid(points: GpsPoint[]): GpsPoint {
  let lat = 0, lng = 0;
  for (const p of points) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}

/** Desviación estándar (en metros) de la distancia de cada punto al centroide. */
function dispersionMeters(points: GpsPoint[]): number {
  if (points.length < 2) return 0;
  const c = centroid(points);
  let sumSq = 0;
  for (const p of points) {
    const d = haversineMeters(c, p);
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / points.length);
}

/**
 * Convergencia principal. Devuelve los waypoints promediados + estadísticas.
 *
 * Si no hay capturas válidas (todas bajo el umbral de calidad), devuelve
 * los waypoints actuales sin cambios.
 */
export function convergeCaptures(input: ConvergeInput): ConvergeResult {
  const opts = { ...DEFAULTS, ...(input.options ?? {}) };

  const usable: Array<{ id?: string; simplified: GpsPoint[]; resampled: GpsPoint[] }> = [];
  const discarded: ConvergeResult["discarded"] = [];

  for (const c of input.captures) {
    if (c.qualityScore < opts.minQuality) {
      discarded.push({ id: c.id, reason: `qualityScore ${c.qualityScore} < ${opts.minQuality}` });
      continue;
    }
    if (!c.points || c.points.length < 4) {
      discarded.push({ id: c.id, reason: "menos de 4 puntos GPS" });
      continue;
    }
    const simplified = rdpSimplify(c.points, opts.rdpEpsilonMeters);
    if (simplified.length < 2) {
      discarded.push({ id: c.id, reason: "RDP colapsó el trazado" });
      continue;
    }
    const resampled = resampleEvenly(simplified, opts.resampleCount);
    usable.push({ id: c.id, simplified, resampled });
  }

  // Sin capturas válidas → conservar waypoints actuales.
  if (usable.length === 0) {
    return {
      waypoints: input.currentWaypoints,
      usedCaptureIds: [],
      discarded,
      segmentStats: [],
    };
  }

  // Para cada índice de muestra, agrupar el punto i de cada captura.
  const N = opts.resampleCount;
  const waypoints: GpsPoint[] = [];
  const segmentStats: ConvergeResult["segmentStats"] = [];
  const currentResampled = input.currentWaypoints.length >= 2
    ? resampleEvenly(input.currentWaypoints, N)
    : null;

  for (let i = 0; i < N; i++) {
    const samples = usable.map((u) => u.resampled[i]);
    const std = dispersionMeters(samples);
    const isOutlier = std > opts.outlierThresholdMeters;
    let point: GpsPoint;
    if (isOutlier && currentResampled) {
      // Demasiada dispersión: probable intersección o desvío individual.
      // Conservar el waypoint actual interpolado en este segmento.
      point = currentResampled[i];
    } else {
      point = centroid(samples);
    }
    waypoints.push(point);
    segmentStats.push({ index: i, stdDevMeters: std, isOutlier });
  }

  return {
    waypoints,
    usedCaptureIds: usable.map((u) => u.id).filter((x): x is string => !!x),
    discarded,
    segmentStats,
  };
}

/**
 * Calcula el qualityScore de una captura recién creada (0-100).
 *
 * Componentes:
 *   - 50 pts máximos por precisión: 50 si avgAccuracy <= 5m, 0 si >= 50m.
 *   - 30 pts máximos por densidad temporal: 30 si los puntos están a
 *     intervalos consistentes (sin huecos largos).
 *   - 20 pts máximos por longitud razonable (entre 100m y 100km).
 *
 * Esta función no requiere comparar contra una ruta oficial; eso lo
 * incorpora el llamador si tiene la Route. Se puede sumar bonus por
 * cobertura de paraderos visitados.
 */
export function computeQualityScore(input: {
  avgAccuracy?: number;
  pointCount: number;
  durationSeconds?: number;
  distanceMeters?: number;
}): number {
  let score = 0;

  // Precisión (0-50 pts): mejor cuanto menor el accuracy promedio.
  const acc = input.avgAccuracy ?? 30;
  const accScore = Math.max(0, Math.min(50, 50 - (acc - 5) * (50 / 45)));
  score += accScore;

  // Densidad temporal (0-30 pts): puntos por minuto.
  if (input.durationSeconds && input.durationSeconds > 0 && input.pointCount > 0) {
    const ppm = (input.pointCount / input.durationSeconds) * 60;
    // Ideal: 6-30 puntos por minuto (~cada 2-10 segundos). Linear.
    if (ppm >= 6 && ppm <= 30) score += 30;
    else if (ppm > 30) score += Math.max(0, 30 - (ppm - 30) * 0.5);
    else score += Math.max(0, ppm * 5);
  } else if (input.pointCount >= 30) {
    score += 15; // sin duration, premio mínimo si hay densidad de puntos
  }

  // Longitud razonable (0-20 pts): entre 100m y 100km.
  const dist = input.distanceMeters ?? 0;
  if (dist >= 100 && dist <= 100_000) score += 20;
  else if (dist > 100_000) score += Math.max(0, 20 - ((dist - 100_000) / 10_000));
  // Si dist < 100m, 0 pts (recorrido demasiado corto).

  return Math.round(Math.max(0, Math.min(100, score)));
}
