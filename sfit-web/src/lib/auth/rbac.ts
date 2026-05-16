import { Municipality } from "@/models/Municipality";
import { ROLES } from "@/lib/constants";
import type { ServiceScope } from "@/models/Company";
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
 */
export async function canAccessMunicipality(
  session: JwtPayload,
  municipalityId: string,
): Promise<boolean> {
  if (!municipalityId) return false;
  if (session.role === ROLES.SUPER_ADMIN) return true;
  return !!session.municipalityId &&
    String(session.municipalityId) === String(municipalityId);
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
 * Forma reducida de Company que necesitan los helpers RBAC.
 * Recibido como parámetro para evitar import circular (Company → rbac → Company).
 */
export interface CompanyForRbac {
  serviceScope?: ServiceScope;
  municipalityId?: { toString(): string };
  coverage?: {
    departmentCodes?: string[];
    provinceCodes?: string[];
    districtCodes?: string[];
  };
}

/**
 * `true` si la sesión puede EDITAR la empresa indicada.
 *
 * Reglas (modelo 1 muni):
 *   - super_admin     : siempre.
 *   - admin_municipal : empresas urbano_distrital cuya cobertura incluya
 *                       el distrito de su municipalidad, O empresas sediadas
 *                       en su municipalidad (cualquier serviceScope).
 *   - otros           : nunca.
 */
export async function canEditCompany(
  session: JwtPayload,
  company: CompanyForRbac,
): Promise<boolean> {
  if (session.role === ROLES.SUPER_ADMIN) return true;

  if (session.role === ROLES.ADMIN_MUNICIPAL) {
    if (!session.municipalityId) return false;
    // Caso 1: la empresa está sediada en su municipalidad.
    if (
      company.municipalityId &&
      String(company.municipalityId) === String(session.municipalityId)
    ) {
      return true;
    }
    // Caso 2: empresa urbano_distrital cuya cobertura incluye su distrito.
    if (company.serviceScope !== "urbano_distrital") return false;
    const muni = await Municipality.findById(session.municipalityId)
      .select("ubigeoCode")
      .lean<{ ubigeoCode?: string } | null>();
    if (!muni?.ubigeoCode) return false;
    return company.coverage?.districtCodes?.includes(muni.ubigeoCode) ?? false;
  }

  return false;
}

/**
 * Filtro Mongoose para LISTAR empresas según el scope del rol.
 *
 *   super_admin       → {}                                 (todas)
 *   admin_municipal   → empresas sediadas en su muni OR empresas
 *                       urbano_distrital cuya coverage incluya su distrito.
 *
 * Si no hay scope válido devuelve filtro imposible para no leakear data.
 *
 * Asíncrono porque admin_municipal requiere resolver el UBIGEO de su distrito en BD.
 */
export async function scopedCompanyFilter(
  session: JwtPayload,
): Promise<Record<string, unknown>> {
  if (session.role === ROLES.SUPER_ADMIN) return {};

  if (session.role === ROLES.ADMIN_MUNICIPAL) {
    if (!session.municipalityId) return { _id: null };
    const muni = await Municipality.findById(session.municipalityId)
      .select("ubigeoCode")
      .lean<{ ubigeoCode?: string } | null>();
    const orClauses: Record<string, unknown>[] = [
      { municipalityId: session.municipalityId },
    ];
    if (muni?.ubigeoCode) {
      orClauses.push({
        serviceScope: "urbano_distrital",
        "coverage.districtCodes": muni.ubigeoCode,
      });
    }
    return { $or: orClauses };
  }

  return { _id: null };
}
