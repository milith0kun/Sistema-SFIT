/**
 * Estado de vigencia de la licencia de un conductor. Centraliza la lógica
 * que comparten UI, listados, KPIs y validaciones de runtime (asignación
 * de viajes, fiscalización).
 *
 * Convención:
 *   - "missing": no se capturó la fecha → estado neutral, no bloquea pero
 *     debería capturarse cuanto antes.
 *   - "valid":   vence en >30 días.
 *   - "expiring_soon": vence entre hoy y hoy+30 días.
 *   - "expired": ya venció.
 */

export type LicenseValidityState =
  | "missing"
  | "valid"
  | "expiring_soon"
  | "expired";

export interface LicenseValidity {
  state: LicenseValidityState;
  /** Días restantes hasta el vencimiento. Negativo si ya venció. null si missing. */
  daysToExpiry: number | null;
  /** Fecha de vencimiento normalizada. null si missing. */
  expiresAt: Date | null;
}

export const LICENSE_EXPIRY_WARN_DAYS = 30;

export function getLicenseValidity(
  expiryDate: Date | string | null | undefined,
  now: Date = new Date(),
): LicenseValidity {
  if (!expiryDate) {
    return { state: "missing", daysToExpiry: null, expiresAt: null };
  }
  const exp = expiryDate instanceof Date ? expiryDate : new Date(expiryDate);
  if (Number.isNaN(exp.getTime())) {
    return { state: "missing", daysToExpiry: null, expiresAt: null };
  }
  const diffMs = exp.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) {
    return { state: "expired", daysToExpiry: days, expiresAt: exp };
  }
  if (days <= LICENSE_EXPIRY_WARN_DAYS) {
    return { state: "expiring_soon", daysToExpiry: days, expiresAt: exp };
  }
  return { state: "valid", daysToExpiry: days, expiresAt: exp };
}

/**
 * Filtros de Mongo para listar conductores según vigencia. Se pasa al
 * endpoint `/api/conductores?validity=...` y al KPI del centro de
 * aprobaciones. `now` debe ser ISO o Date.
 */
export function buildLicenseValidityFilter(
  validity: LicenseValidityState | "all",
  now: Date = new Date(),
): Record<string, unknown> {
  if (validity === "all") return {};
  const warnLimit = new Date(now);
  warnLimit.setDate(warnLimit.getDate() + LICENSE_EXPIRY_WARN_DAYS);
  switch (validity) {
    case "missing":
      return {
        $or: [
          { licenseExpiryDate: { $exists: false } },
          { licenseExpiryDate: null },
        ],
      };
    case "valid":
      return { licenseExpiryDate: { $gt: warnLimit } };
    case "expiring_soon":
      return { licenseExpiryDate: { $gte: now, $lte: warnLimit } };
    case "expired":
      return { licenseExpiryDate: { $lt: now } };
  }
}

export function licenseValidityLabel(state: LicenseValidityState): string {
  switch (state) {
    case "missing":
      return "Sin fecha";
    case "valid":
      return "Vigente";
    case "expiring_soon":
      return "Por vencer";
    case "expired":
      return "Vencida";
  }
}
