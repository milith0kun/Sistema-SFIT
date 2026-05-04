import { Municipality } from "@/models/Municipality";
import { Province } from "@/models/Province";
import { ROLES } from "@/lib/constants";
import type { ServiceScope } from "@/models/Company";
import type { JwtPayload } from "./jwt";

/**
 * Helpers RBAC centralizados. Implementan el aislamiento multi-tenant de
 * RNF-02 / RNF-03 y la jerarquía:
 *   Super Admin       → todo
 *   Admin Regional    → su región (todas las provincias y munis dentro)
 *   Admin Provincial  → su provincia (todas las munis dentro)
 *   Admin Municipal   → su municipalidad
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

  if (session.role === ROLES.ADMIN_REGIONAL) {
    if (!session.regionId) return false;
    // Resolver muni → province → region y comparar.
    const muni = await Municipality.findById(municipalityId)
      .select("provinceId")
      .lean<{ provinceId?: unknown } | null>();
    if (!muni?.provinceId) return false;
    const prov = await Province.findById(String(muni.provinceId))
      .select("regionId")
      .lean<{ regionId?: unknown } | null>();
    if (!prov?.regionId) return false;
    return String(prov.regionId) === String(session.regionId);
  }

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
  // admin_regional sync requiere lookup; usar canAccessProvinceAsync.
  return false;
}

/**
 * Versión async que resuelve la región de la provincia para el caso
 * `admin_regional`. Usar cuando se necesita comparar provincia con la
 * región de la sesión (que requiere ir a BD).
 */
export async function canAccessProvinceAsync(
  session: JwtPayload,
  provinceId: string,
): Promise<boolean> {
  if (!provinceId) return false;
  if (session.role === ROLES.SUPER_ADMIN) return true;

  if (session.role === ROLES.ADMIN_REGIONAL) {
    if (!session.regionId) return false;
    const prov = await Province.findById(provinceId)
      .select("regionId")
      .lean<{ regionId?: unknown } | null>();
    return !!prov?.regionId && String(prov.regionId) === String(session.regionId);
  }

  if (session.role === ROLES.ADMIN_PROVINCIAL) {
    return !!session.provinceId &&
      String(session.provinceId) === String(provinceId);
  }
  return false;
}

/**
 * `true` si la sesión puede operar sobre la región indicada.
 * Solo super_admin y admin_regional (sobre la suya).
 */
export function canAccessRegion(
  session: JwtPayload,
  regionId: string,
): boolean {
  if (!regionId) return false;
  if (session.role === ROLES.SUPER_ADMIN) return true;
  if (session.role === ROLES.ADMIN_REGIONAL) {
    return !!session.regionId && String(session.regionId) === String(regionId);
  }
  return false;
}

/**
 * Filtro Mongoose para listar municipalidades según el rol de la sesión:
 *   Super Admin       → {}                                (todas)
 *   Admin Regional    → { provinceId IN provs-de-region } (todas las munis de su región)
 *   Admin Provincial  → { provinceId }                    (las de su provincia)
 *   Admin Municipal + → { _id }                           (solo la suya)
 *   Sin scope válido  → filtro imposible { _id: null }    (sin resultados)
 *
 * Para admin_regional el filtro es async porque requiere resolver las
 * provincias de la región en BD; usar `scopedMunicipalityFilterAsync`.
 */
export function scopedMunicipalityFilter(
  session: JwtPayload,
): Record<string, unknown> {
  if (session.role === ROLES.SUPER_ADMIN) return {};

  if (session.role === ROLES.ADMIN_PROVINCIAL) {
    if (!session.provinceId) return { _id: null };
    return { provinceId: session.provinceId };
  }

  // admin_regional usar la versión async; aquí devolvemos filtro imposible
  // para forzar al caller a usar `scopedMunicipalityFilterAsync`.
  if (session.role === ROLES.ADMIN_REGIONAL) {
    return { _id: null };
  }

  if (!session.municipalityId) return { _id: null };
  return { _id: session.municipalityId };
}

/**
 * Versión async — única que cubre admin_regional resolviendo provincias
 * de su región en BD. Para los demás roles devuelve lo mismo que la
 * versión síncrona.
 */
export async function scopedMunicipalityFilterAsync(
  session: JwtPayload,
): Promise<Record<string, unknown>> {
  if (session.role === ROLES.ADMIN_REGIONAL) {
    if (!session.regionId) return { _id: null };
    const provs = await Province.find({ regionId: session.regionId })
      .select("_id")
      .lean<Array<{ _id: unknown }>>();
    if (provs.length === 0) return { _id: null };
    return { provinceId: { $in: provs.map((p) => p._id) } };
  }
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
