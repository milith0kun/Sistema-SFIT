/**
 * Helpers de muestreo de trazados GPS para previsualización rápida.
 *
 * `samplePolyline` no preserva la geometría como RDP — sólo muestrea
 * uniformemente para enviar al cliente sin saturar el payload. Para
 * convergencia / análisis usar `rdpSimplify` de `./converge`.
 */

/**
 * Devuelve hasta `n` puntos uniformemente muestreados del array, incluyendo
 * primer y último (si `points.length >= 2`). Si la lista ya es ≤ n, devuelve
 * todos los puntos.
 *
 * Output: `[[lat, lng], ...]` listo para enviar como JSON al cliente.
 */
export function samplePolyline(
  points: Array<{ lat: number; lng: number }>,
  n: number,
): Array<[number, number]> {
  if (points.length === 0) return [];
  if (points.length <= n) return points.map((p) => [p.lat, p.lng]);
  const out: Array<[number, number]> = [];
  const step = (points.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) {
    const idx = Math.min(points.length - 1, Math.round(i * step));
    out.push([points[idx].lat, points[idx].lng]);
  }
  return out;
}
