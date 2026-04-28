import { Municipality } from "@/models/Municipality";
import { ROLES } from "@/lib/constants";
import type { ServiceScope } from "@/models/Company";
import type { JwtPayload } from "./jwt";

/**
 * Helpers RBAC centralizados. Implementan el aislamiento multi-tenant de
 * RNF-02 / RNF-03 y la jerarquía de la sección 4 del Readme:
 *   Super Admin  → todo
 *   Admin Provincial → su provincia
 *   Admin Municipal  → su municipalidad
 *   Operador/Fiscal/Conductor/Ciudadano → su municipalidad
 */

/**
 * `true` si la sesión puede operar sobre la municipalidad indicada.
 * Para el Admin Provincial resuelve la provincia de la municipalidad en BD.
 * Requiere conexión activa a MongoDB (`connectDB()` antes).
 */
export async function canAccessMunicipality(
  session: JwtPayload,
  municipalityId: string,
): Promise<boolean> {
  if (!municipalityId) return false;

  if (session.role === ROLES.SUPER_ADMIN) return true;

  if (session.role === ROLES.ADMIN_PROVINCIAL) {
    if (!session.provinceId) return false;
    const muni = await Municipality.findById(municipalityId)
      .select("provinceId")
      .lean<{ provinceId?: unknown } | null>();
    if (!muni?.provinceId) return false;
    return String(muni.provinceId) === String(session.provinceId);
  }

  // Admin Municipal, Fiscal, Operador, Conductor y Ciudadano: solo la propia.
  return !!session.municipalityId &&
    String(session.municipalityId) === String(municipalityId);
}

/**
 * `true` si la sesión puede operar sobre la provincia indicada.
 * Los roles por debajo de la provincia no tienen visibilidad a ese nivel.
 */
export function canAccessProvince(
  session: JwtPayload,
  provinceId: string,
): boolean {
  if (!provinceId) return false;
  if (session.role === ROLES.SUPER_ADMIN) return true;
  if (session.role === ROLES.ADMIN_PROVINCIAL) {
    return (
      !!session.provinceId &&
      String(session.provinceId) === String(provinceId)
    );
  }
  return false;
}

/**
 * Filtro Mongoose para listar municipalidades según el rol de la sesión:
 *   Super Admin       → {}               (todas)
 *   Admin Provincial  → { provinceId }   (las de su provincia)
 *   Admin Municipal + → { _id }          (solo la suya)
 *   Sin scope válido  → filtro imposible { _id: null } (sin resultados)
 */
export function scopedMunicipalityFilter(
  session: JwtPayload,
): Record<string, unknown> {
  if (session.role === ROLES.SUPER_ADMIN) return {};

  if (session.role === ROLES.ADMIN_PROVINCIAL) {
    if (!session.provinceId) return { _id: null };
    return { provinceId: session.provinceId };
  }

  if (!session.municipalityId) return { _id: null };
  return { _id: session.municipalityId };
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
 * Reglas:
 *   - super_admin                : siempre.
 *   - admin_provincial           : si la empresa está sediada en su provincia
 *                                  o su scope es urbano_distrital/urbano_provincial
 *                                  cubriendo al menos un distrito de su provincia.
 *   - admin_municipal            : solo empresas urbano_distrital cuya cobertura
 *                                  incluya su distrito.
 *   - otros                      : nunca.
 *
 * Para chequeos por provincia/distrito a partir de `municipalityId` se usa
 * `Municipality.findById(...).provinceCode` resuelto en BD (ya cargada).
 */
export async function canEditCompany(
  session: JwtPayload,
  company: CompanyForRbac,
): Promise<boolean> {
  if (session.role === ROLES.SUPER_ADMIN) return true;

  if (session.role === ROLES.ADMIN_PROVINCIAL) {
    if (!session.provinceId) return false;
    // Caso 1: la empresa está sediada en su provincia.
    if (company.municipalityId) {
      const muni = await Municipality.findById(company.municipalityId)
        .select("provinceId")
        .lean<{ provinceId?: unknown } | null>();
      if (muni?.provinceId && String(muni.provinceId) === String(session.provinceId)) {
        return true;
      }
    }
    // Caso 2: la empresa cubre al menos una provincia del depto del admin.
    // Para validar esto necesitaríamos el provinceCode de la sesión; por ahora
    // resolvemos via la provincia en BD.
    const sessionProvince = await Municipality.db
      .collection("provinces")
      .findOne({ _id: session.provinceId as unknown as object }, { projection: { ubigeoCode: 1 } });
    const provCode = (sessionProvince as { ubigeoCode?: string } | null)?.ubigeoCode;
    if (provCode && company.coverage?.provinceCodes?.includes(provCode)) {
      return true;
    }
    return false;
  }

  if (session.role === ROLES.ADMIN_MUNICIPAL) {
    if (!session.municipalityId) return false;
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
 *   admin_provincial  → empresas sediadas en su provincia OR cuyo coverage
 *                       incluya el provinceCode de su provincia.
 *   admin_municipal   → empresas urbano_distrital cuya coverage incluya su
 *                       distrito (UBIGEO 6 dígitos).
 *
 * Si no hay scope válido devuelve filtro imposible para no leakear data.
 *
 * Asíncrono porque admin_provincial / admin_municipal requieren resolver el
 * UBIGEO de su provincia/distrito en BD.
 */
export async function scopedCompanyFilter(
  session: JwtPayload,
): Promise<Record<string, unknown>> {
  if (session.role === ROLES.SUPER_ADMIN) return {};

  if (session.role === ROLES.ADMIN_PROVINCIAL) {
    if (!session.provinceId) return { _id: null };
    // Resolver muni's de su provincia (para sede) y el provinceCode (para coverage).
    const munis = await Municipality.find({ provinceId: session.provinceId })
      .select("_id")
      .lean<Array<{ _id: unknown }>>();
    const muniIds = munis.map((m) => m._id);
    const provDoc = await Municipality.db
      .collection("provinces")
      .findOne({ _id: session.provinceId as unknown as object }, { projection: { ubigeoCode: 1 } });
    const provCode = (provDoc as { ubigeoCode?: string } | null)?.ubigeoCode;

    const orClauses: Record<string, unknown>[] = [
      { municipalityId: { $in: muniIds } },
    ];
    if (provCode) orClauses.push({ "coverage.provinceCodes": provCode });
    return { $or: orClauses };
  }

  if (session.role === ROLES.ADMIN_MUNICIPAL) {
    if (!session.municipalityId) return { _id: null };
    const muni = await Municipality.findById(session.municipalityId)
      .select("ubigeoCode")
      .lean<{ ubigeoCode?: string } | null>();
    if (!muni?.ubigeoCode) return { _id: null };
    return {
      serviceScope: "urbano_distrital",
      "coverage.districtCodes": muni.ubigeoCode,
    };
  }

  return { _id: null };
}
