import { haversineMeters } from "./haversine";

/**
 * Distancia mínima entre un punto y una polyline (en metros).
 *
 * Para cada par de vértices consecutivos calcula la distancia del punto al
 * segmento (proyección sobre la línea, capped a los extremos), y devuelve
 * el mínimo. Usado para detectar si un bus se desvió de su ruta planeada.
 *
 * Para distancias cortas (cientos de metros, escala de manzana urbana) es
 * suficiente trabajar en coordenadas locales planas alrededor del punto
 * de query — el error de proyección es <0.5% en latitudes ecuatoriales-medias.
 */

type Pt = { lat: number; lng: number };

const METERS_PER_DEG_LAT = 111_320;

function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

/**
 * Proyecta lat/lng a metros locales relativos a un punto de referencia.
 * Solo válido para distancias cortas (< 10km).
 */
function toLocalMeters(p: Pt, ref: Pt): { x: number; y: number } {
  const mx = metersPerDegLng(ref.lat);
  return {
    x: (p.lng - ref.lng) * mx,
    y: (p.lat - ref.lat) * METERS_PER_DEG_LAT,
  };
}

function distancePointToSegment(
  point: Pt,
  a: Pt,
  b: Pt,
): number {
  // Si los extremos coinciden, la distancia es la haversine al punto
  if (a.lat === b.lat && a.lng === b.lng) {
    return haversineMeters(point, a);
  }
  // Sistema local centrado en `a`
  const P = toLocalMeters(point, a);
  const B = toLocalMeters(b, a);
  // Proyectar P sobre vector AB, capped a [0, |AB|]
  const lenSq = B.x * B.x + B.y * B.y;
  const t = Math.max(0, Math.min(1, (P.x * B.x + P.y * B.y) / lenSq));
  const projX = B.x * t;
  const projY = B.y * t;
  const dx = P.x - projX;
  const dy = P.y - projY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distancePointToPolyline(
  point: Pt,
  polyline: Pt[],
): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) return haversineMeters(point, polyline[0]);
  let min = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = distancePointToSegment(point, polyline[i], polyline[i + 1]);
    if (d < min) min = d;
  }
  return min;
}
