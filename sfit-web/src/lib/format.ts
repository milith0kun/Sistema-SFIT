/**
 * Funciones de formato centralizadas.
 *
 * Reemplaza las ~15 definiciones dispersas de fmtDate, fmtDateShort,
 * fmtAgo, timeAgo, fmtRelative, fmtKm, fmtDuration.
 */

const LOCALE = "es-PE";

/** Fecha corta: "15 may 2026" */
export function fmtDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Fecha + hora: "15 may 2026, 14:30" */
export function fmtDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Solo hora: "14:30" */
export function fmtTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
}

/** Fecha muy corta: "15/05/2026" */
export function fmtDateShort(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Tiempo relativo: "hace 3 min", "hace 2 h", "hace 5 d" */
export function fmtAgo(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "ahora";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `hace ${diffD} d`;
  return fmtDate(d);
}

/** Alias: mismo comportamiento que fmtAgo. */
export const timeAgo = fmtAgo;

/** Alias: mismo comportamiento que fmtAgo. */
export const relativeTime = fmtAgo;

/** Distancia en km: "12.3 km" */
export function fmtKm(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Duración legible: "2h 15min" */
export function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

/** Día de la semana + fecha: "lunes, 15 de mayo" */
export function fmtFullDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
