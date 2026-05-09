/**
 * Score de calidad para una pasada (FleetEntry cerrada) o una captura GPS.
 *
 * Usado para identificar la "mejor" pasada de cada ruta. Se reusa en:
 *   - GET /api/conductor/mis-recorridos    (vista del conductor)
 *   - GET /api/rutas/candidatas            (vista del operador para auditar)
 *
 * Ponderación:
 *   - 50% cumplimiento de paraderos
 *   - 30% cobertura GPS (pings por minuto, baseline 60ppm = 1.0)
 *   - 20% continuidad (sin huecos largos: <30s = 1.0, >=120s = 0)
 *
 * Devuelve `null` cuando la pasada no califica (no está cerrada o tiene
 * <3 pings) — la UI esconde el badge MEJOR para esos casos.
 */
export interface PassScoreInput {
  status?: string;
  routeCompliancePercentage?: number | null;
  durationSeconds?: number | null;
  numPings: number;
  maxGapSeconds: number;
}

export interface PassScoreBreakdown {
  total: number;       // 0-1
  compliance: number;  // 0-1
  coverage: number;    // 0-1
  continuity: number;  // 0-1
}

export function calcPassScore(p: PassScoreInput): number | null {
  if (p.status !== "cerrado" && p.status !== "auto_cierre") return null;
  if (p.numPings < 3) return null;
  const b = calcPassScoreBreakdown(p);
  return b.total;
}

export function calcPassScoreBreakdown(p: PassScoreInput): PassScoreBreakdown {
  const compliance = Math.max(
    0,
    Math.min(1, (p.routeCompliancePercentage ?? 0) / 100),
  );

  let coverage = 0;
  if (p.durationSeconds && p.durationSeconds > 0) {
    const ppm = (p.numPings / p.durationSeconds) * 60;
    coverage = Math.max(0, Math.min(1, ppm / 60));
  }

  let continuity = 0;
  if (p.maxGapSeconds <= 30) continuity = 1;
  else if (p.maxGapSeconds >= 120) continuity = 0;
  else continuity = 1 - (p.maxGapSeconds - 30) / 90;

  const total = compliance * 0.5 + coverage * 0.3 + continuity * 0.2;
  return { total, compliance, coverage, continuity };
}

/** Calcula el gap máximo (segundos) entre pings consecutivos. Infinity si <2. */
export function maxGapSeconds(points: Array<{ ts: Date }>): number {
  if (points.length < 2) return Infinity;
  let max = 0;
  for (let i = 1; i < points.length; i++) {
    const dt = (points[i].ts.getTime() - points[i - 1].ts.getTime()) / 1000;
    if (dt > max) max = dt;
  }
  return max;
}

/**
 * Identifica el id de la pasada con mejor score dentro de un grupo. Devuelve
 * `null` si ninguna pasada califica (todas devolvieron score=null).
 */
export function findBestPassId<T extends { id: string; score: number | null }>(
  passes: T[],
): string | null {
  let bestId: string | null = null;
  let bestScore = -Infinity;
  for (const p of passes) {
    if (p.score === null) continue;
    if (p.score > bestScore) {
      bestScore = p.score;
      bestId = p.id;
    }
  }
  return bestId;
}
