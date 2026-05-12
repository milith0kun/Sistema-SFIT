/**
 * Extrae los puntos GPS de un FleetEntry cerrado y los convierte en una
 * lista de waypoints lista para reemplazar `Route.waypoints`.
 *
 * Usado cuando se marca una pasada como "preferida": en vez de promediar
 * varias capturas (lo que hace `convergeCaptures`), se da peso 100% a la
 * elegida. Los puntos vienen de la colección `LocationPing` indexada por
 * `entryId`.
 *
 * Pipeline:
 *   1. Leer LocationPings de la entrada ordenados por `ts`.
 *   2. Filtrar puntos con `accuracy` peor que el umbral (default 50 m).
 *   3. Simplificar con Ramer-Douglas-Peucker (eps 5 m por default) para
 *      eliminar jitter y conservar la forma del trazado.
 *   4. Resamplear a N puntos equidistantes (default 50) para mantener
 *      consistencia con el formato que `recalcular` produce.
 */
import type { Types } from "mongoose";
import { LocationPing } from "@/models/LocationPing";
import {
  type GpsPoint,
  rdpSimplify,
  resampleEvenly,
} from "@/lib/routes/converge";

export interface ExtractFleetEntryOptions {
  /** Descartar LocationPings con `accuracy` peor que este valor (m). */
  accuracyMaxMeters?: number;
  /** Tolerancia de simplificación Ramer-Douglas-Peucker (m). */
  rdpEpsilonMeters?: number;
  /** Cantidad de waypoints a producir tras resamplear. */
  resampleCount?: number;
}

export interface ExtractFleetEntryResult {
  /** Waypoints listos para asignar a `Route.waypoints`. */
  waypoints: GpsPoint[];
  /** Total de LocationPings leídos antes de filtrar. */
  totalPings: number;
  /** LocationPings filtrados por `accuracy`. */
  filteredByAccuracy: number;
  /** Puntos tras RDP, antes de resamplear. */
  simplifiedCount: number;
}

const DEFAULTS: Required<ExtractFleetEntryOptions> = {
  accuracyMaxMeters: 50,
  rdpEpsilonMeters: 5,
  resampleCount: 50,
};

export async function extractFleetEntryAsWaypoints(
  entryId: Types.ObjectId | string,
  options: ExtractFleetEntryOptions = {},
): Promise<ExtractFleetEntryResult> {
  const opts = { ...DEFAULTS, ...options };

  const pings = await LocationPing.find({ entryId })
    .sort({ ts: 1 })
    .select("lat lng accuracy")
    .lean<Array<{ lat: number; lng: number; accuracy?: number }>>();

  const totalPings = pings.length;
  // Filtro de accuracy: solo descartamos los con accuracy explícitamente
  // peor que el umbral. Si el ping no trae accuracy lo dejamos pasar para
  // no perder datos en dispositivos que no reportan el campo.
  const filtered: GpsPoint[] = [];
  for (const p of pings) {
    if (p.accuracy !== undefined && p.accuracy > opts.accuracyMaxMeters) continue;
    filtered.push({ lat: p.lat, lng: p.lng });
  }
  const filteredByAccuracy = totalPings - filtered.length;

  if (filtered.length < 2) {
    return {
      waypoints: filtered,
      totalPings,
      filteredByAccuracy,
      simplifiedCount: filtered.length,
    };
  }

  const simplified = rdpSimplify(filtered, opts.rdpEpsilonMeters);
  const waypoints =
    simplified.length <= opts.resampleCount
      ? simplified
      : resampleEvenly(simplified, opts.resampleCount);

  return {
    waypoints,
    totalPings,
    filteredByAccuracy,
    simplifiedCount: simplified.length,
  };
}
