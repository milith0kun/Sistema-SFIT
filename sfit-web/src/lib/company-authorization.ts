/**
 * Vigencia de autorizaciones de empresa de transporte.
 *
 * El modelo Company.authorizations[] guarda permisos para operar cada
 * modalidad (urbano/interprov). Cada una tiene `expiresAt?: Date`. Aquí
 * centralizamos la lógica de "¿la empresa puede operar hoy?" para que
 * UI, endpoints de rutas/viajes y KPIs den el mismo veredicto.
 *
 * Las funciones son genéricas sobre `{ expiresAt?: Date | string }` para que
 * la misma lógica corra en el servidor (donde IAuthorization tiene Date) y
 * en el cliente (donde llega como string ISO desde el JSON).
 */

export type AuthorizationLike = { expiresAt?: Date | string | null };

export type CompanyAuthorizationState =
  | "valid"
  | "expiring_soon"
  | "expired"
  | "none";

export interface CompanyAuthorizationStatus<T extends AuthorizationLike = AuthorizationLike> {
  state: CompanyAuthorizationState;
  /**
   * La autorización válida con vencimiento más cercano. null si state=none o
   * si no hay autorización con fecha (caso edge: autorización indefinida).
   */
  nextExpiringAuth: T | null;
  /** Días hasta el vencimiento más cercano. Negativo si ya venció. null si state=none. */
  daysToExpiry: number | null;
}

export const AUTHORIZATION_WARN_DAYS = 30;

/**
 * Veredicto rápido: ¿la empresa tiene al menos una autorización vigente
 * (no expirada)? Las autorizaciones sin `expiresAt` se consideran vigentes
 * indefinidamente (caso de licencias municipales sin caducidad explícita).
 */
export function isCompanyAuthorizationValid(
  authorizations: AuthorizationLike[] | undefined | null,
  now: Date = new Date(),
): boolean {
  if (!authorizations || authorizations.length === 0) return false;
  return authorizations.some((a) => {
    if (!a.expiresAt) return true;
    const exp = a.expiresAt instanceof Date ? a.expiresAt : new Date(a.expiresAt);
    return exp.getTime() > now.getTime();
  });
}

/**
 * Estado detallado de las autorizaciones. Toma la autorización vigente con
 * vencimiento más próximo y reporta días restantes. Si todas vencieron,
 * devuelve "expired" sobre la última en vencer.
 */
export function getCompanyAuthorizationStatus<T extends AuthorizationLike>(
  authorizations: T[] | undefined | null,
  now: Date = new Date(),
): CompanyAuthorizationStatus<T> {
  if (!authorizations || authorizations.length === 0) {
    return { state: "none", nextExpiringAuth: null, daysToExpiry: null };
  }

  const withDates = authorizations
    .filter((a) => !!a.expiresAt)
    .map((a) => ({
      auth: a,
      exp: a.expiresAt instanceof Date ? a.expiresAt : new Date(a.expiresAt!),
    }));

  // Caso: hay autorizaciones pero ninguna con fecha → vigente indefinida.
  if (withDates.length === 0) {
    return { state: "valid", nextExpiringAuth: authorizations[0]!, daysToExpiry: null };
  }

  const active = withDates.filter((x) => x.exp.getTime() > now.getTime());
  if (active.length > 0) {
    // La más cercana a vencer.
    active.sort((a, b) => a.exp.getTime() - b.exp.getTime());
    const next = active[0]!;
    const days = Math.ceil((next.exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      state: days <= AUTHORIZATION_WARN_DAYS ? "expiring_soon" : "valid",
      nextExpiringAuth: next.auth,
      daysToExpiry: days,
    };
  }

  // Todas vencidas. Reporta la última en vencer.
  withDates.sort((a, b) => b.exp.getTime() - a.exp.getTime());
  const last = withDates[0]!;
  const days = Math.ceil((last.exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return {
    state: "expired",
    nextExpiringAuth: last.auth,
    daysToExpiry: days, // negativo
  };
}

export function companyAuthorizationLabel(state: CompanyAuthorizationState): string {
  switch (state) {
    case "valid":          return "Vigente";
    case "expiring_soon":  return "Por vencer";
    case "expired":        return "Vencida";
    case "none":           return "Sin autorización";
  }
}
