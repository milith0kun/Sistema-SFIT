import { ROLES } from "@/lib/constants";
import type { JwtPayload } from "./jwt";

/**
 * Helpers RBAC centralizados. Modelo de 1 municipalidad:
 *   Super Admin       → todo
 *   Admin Municipal   → su municipalidad
 *   Operador/Fiscal/Conductor/Ciudadano → su municipalidad
 *
 * Aislamiento multi-tenant (RNF-02 / RNF-03): toda query se filtra por
 * `municipalityId = session.municipalityId` salvo super_admin.
 */

/**
 * `true` si la sesión puede operar sobre la municipalidad indicada.
 *
 * Modelo mono-muni: el sistema opera sobre UNA municipalidad institucional
 * (cleanup municipal). Cualquier admin_municipal autorizado por sesión
 * puede operar sobre recursos sin `municipalityId` asignada (cuentas
 * legacy del cleanup): se asumen suyos. Sin esta tolerancia, los GET de
 * detalle de usuarios/empresas/conductores legacy devolvían 403 y el UI
 * mostraba "no encontrado".
 */
export async function canAccessMunicipality(
  session: JwtPayload,
  municipalityId: string,
): Promise<boolean> {
  if (session.role === ROLES.SUPER_ADMIN) return true;
  // admin_municipal: en modelo mono-muni administrativo accede a cualquier
  // muni (los 6 distritos de Cotabambas son zonificación operativa, no
  // tenants separados). Sin esto, abrir el detalle de un usuario sembrado
  // en otro distrito devolvía 403 y la UI mostraba "no encontrado".
  if (session.role === ROLES.ADMIN_MUNICIPAL) return true;
  if (!session.municipalityId) return false;
  if (!municipalityId) return true;
  return String(session.municipalityId) === String(municipalityId);
}

/**
 * `true` si la sesión puede operar sobre la provincia indicada.
 * Solo super_admin tiene visibilidad cross-provincia en este modelo.
 */
export function canAccessProvince(
  session: JwtPayload,
  provinceId: string,
): boolean {
  if (!provinceId) return false;
  return session.role === ROLES.SUPER_ADMIN;
}

/**
 * Variante async retenida por compatibilidad de firma con callers que aún
 * la importan; en el modelo actual equivale a la versión síncrona.
 */
export async function canAccessProvinceAsync(
  session: JwtPayload,
  provinceId: string,
): Promise<boolean> {
  return canAccessProvince(session, provinceId);
}

/**
 * `true` si la sesión puede operar sobre la región indicada.
 * Solo super_admin.
 */
export function canAccessRegion(
  session: JwtPayload,
  regionId: string,
): boolean {
  if (!regionId) return false;
  return session.role === ROLES.SUPER_ADMIN;
}

/**
 * Filtro Mongoose para listar municipalidades según el rol de la sesión:
 *   Super Admin       → {}                                (todas)
 *   Admin Municipal + → { _id }                           (solo la suya)
 *   Sin scope válido  → filtro imposible { _id: null }    (sin resultados)
 */
export function scopedMunicipalityFilter(
  session: JwtPayload,
): Record<string, unknown> {
  if (session.role === ROLES.SUPER_ADMIN) return {};
  if (!session.municipalityId) return { _id: null };
  return { _id: session.municipalityId };
}

/**
 * Variante async retenida por compatibilidad. En el modelo actual ya no
 * requiere lookups a BD; equivale a la versión síncrona.
 */
export async function scopedMunicipalityFilterAsync(
  session: JwtPayload,
): Promise<Record<string, unknown>> {
  return scopedMunicipalityFilter(session);
}

/**
 * Filtro Mongoose para listar recursos por su campo `municipalityId`
 * (vehículos, conductores, viajes, sanciones, etc.). Distinto de
 * `scopedMunicipalityFilter`, que filtra la collection `municipalities`.
 *
 * Diseño:
 *   - super_admin: sin restricciones (devuelve {}). Si pasa `targetMuniId`,
 *     se aplica como filtro explícito.
 *   - admin_municipal: incluye recursos de su muni + recursos sin muni
 *     (cuentas/empresas/etc. legacy del cleanup municipal). El sistema
 *     opera sobre una sola muni institucional, así que los recursos
 *     sin `municipalityId` son implícitamente suyos.
 *   - otros roles sin scope válido: filtro imposible.
 *
 * Se aplica con spread sobre el filtro base:
 *   `const filter: Record<string, unknown> = { ...recordMuniScope(session) }`
 */
export function recordMuniScope(
  session: JwtPayload,
  targetMuniId?: string | null,
): Record<string, unknown> {
  if (session.role === ROLES.SUPER_ADMIN) {
    return targetMuniId ? { municipalityId: targetMuniId } : {};
  }
  // admin_municipal: en modelo mono-muni administrativo no filtra. Ve los
  // recursos de cualquier código UBIGEO porque la Municipalidad Provincial
  // de Cotabambas administra los 6 distritos como un solo tenant.
  if (session.role === ROLES.ADMIN_MUNICIPAL) {
    return {};
  }
  // Otros roles operativos: scope clásico por muni.
  const muniId = targetMuniId ?? session.municipalityId;
  if (!muniId) return { _id: null };
  return { municipalityId: muniId };
}

/**
 * Filtro Mongoose para LISTAR empresas según el scope del rol.
 *
 *   super_admin       → {}                                 (todas)
 *   admin_municipal   → empresas sediadas en su muni OR empresas `urbano`
 *                       cuya coverage incluya su distrito.
 *
 * Si no hay scope válido devuelve filtro imposible para no leakear data.
 *
 * Asíncrono porque admin_municipal requiere resolver el UBIGEO de su distrito en BD.
 */
export async function scopedCompanyFilter(
  session: JwtPayload,
): Promise<Record<string, unknown>> {
  if (session.role === ROLES.SUPER_ADMIN) return {};

  // admin_municipal: en modelo mono-muni administrativo ve TODAS las
  // empresas del sistema. Cotabambas como Provincial administra a todas
  // las empresas que operan en sus 6 distritos como un solo tenant.
  if (session.role === ROLES.ADMIN_MUNICIPAL) return {};

  return { _id: null };
}
