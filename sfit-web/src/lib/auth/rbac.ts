import { Municipality } from "@/models/Municipality";
import { ROLES } from "@/lib/constants";
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
