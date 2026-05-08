import { ROLES, type Role } from "@/lib/constants";

/**
 * Matriz centralizada de permisos por recurso. Es la fuente única de verdad
 * para qué rol puede ver/crear/editar/borrar cada recurso del sistema. Tanto
 * las páginas web (`(dashboard)/.../page.tsx`) como los handlers de API
 * (`api/.../route.ts`) deben consumirla mediante `rolesFor(resource, action)`.
 *
 * Convención: los listados están ordenados por jerarquía descendente
 * (super_admin → admins → fiscal → operador → conductor) para que la
 * lectura refleje la cadena de mando.
 *
 * Cuando un recurso tiene acciones especiales (ej. fatigue para conductores,
 * suspender para vehículos), se exponen aparte como constantes nombradas
 * al final del archivo.
 */

export type Resource =
  | "conductores"
  | "vehiculos"
  | "flota"
  | "viajes"
  | "rutas"
  | "empresas"
  | "inspecciones"
  | "sanciones"
  | "apelaciones"
  | "reportes"
  | "recompensas"
  | "usuarios"
  | "municipalidades"
  | "provincias"
  | "regiones"
  | "aprobaciones";

export type Action = "view" | "create" | "edit" | "delete";

const A = ROLES;

export const ROLE_MATRIX: Record<Resource, Record<Action, Role[]>> = {
  conductores: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR],
    create: [A.SUPER_ADMIN, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.OPERADOR],
    edit: [A.SUPER_ADMIN, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR],
    delete: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL],
  },
  vehiculos: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR, A.CONDUCTOR],
    create: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.OPERADOR],
    edit: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.OPERADOR],
    delete: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL],
  },
  flota: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR, A.CONDUCTOR],
    create: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.OPERADOR, A.CONDUCTOR],
    edit: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.OPERADOR, A.CONDUCTOR],
    delete: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL],
  },
  viajes: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR, A.CONDUCTOR],
    create: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.OPERADOR],
    edit: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.OPERADOR, A.CONDUCTOR],
    delete: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL],
  },
  rutas: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR, A.CONDUCTOR],
    create: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.OPERADOR],
    edit: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.OPERADOR],
    delete: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL],
  },
  empresas: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR],
    create: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL],
    edit: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.OPERADOR],
    delete: [A.SUPER_ADMIN],
  },
  inspecciones: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR],
    create: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.FISCAL],
    edit: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.FISCAL],
    delete: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL],
  },
  sanciones: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR, A.CONDUCTOR],
    create: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.FISCAL],
    edit: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.FISCAL],
    delete: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL],
  },
  apelaciones: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.CONDUCTOR],
    create: [A.CONDUCTOR],
    edit: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.FISCAL],
    delete: [A.SUPER_ADMIN],
  },
  reportes: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.CIUDADANO],
    create: [A.CIUDADANO],
    edit: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.FISCAL],
    delete: [A.SUPER_ADMIN],
  },
  recompensas: {
    view: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.CIUDADANO],
    create: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL],
    edit: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL],
    delete: [A.SUPER_ADMIN],
  },
  usuarios: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL],
    create: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL],
    edit: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL],
    delete: [A.SUPER_ADMIN],
  },
  municipalidades: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL],
    create: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL],
    edit: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL],
    delete: [A.SUPER_ADMIN],
  },
  provincias: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL],
    create: [A.SUPER_ADMIN, A.ADMIN_REGIONAL],
    edit: [A.SUPER_ADMIN, A.ADMIN_REGIONAL],
    delete: [A.SUPER_ADMIN],
  },
  regiones: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL],
    create: [A.SUPER_ADMIN],
    edit: [A.SUPER_ADMIN],
    delete: [A.SUPER_ADMIN],
  },
  aprobaciones: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL],
    create: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL],
    edit: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL],
    delete: [A.SUPER_ADMIN],
  },
};

/**
 * Devuelve los roles permitidos para una acción sobre un recurso. Inmutable.
 */
export function rolesFor(resource: Resource, action: Action): readonly Role[] {
  return ROLE_MATRIX[resource][action];
}

/**
 * Helper de chequeo client-side. Útil en `if (!hasPermission(role, ...)) router.replace(...)`.
 */
export function hasPermission(
  role: Role | null | undefined,
  resource: Resource,
  action: Action,
): boolean {
  if (!role) return false;
  return (rolesFor(resource, action) as Role[]).includes(role);
}

/**
 * Variante para páginas web. Excluye los roles `MOBILE_ONLY_ROLES`
 * (conductor/ciudadano) — esos roles consumen la API desde el app móvil pero
 * son redirigidos a `MobileOnlyScreen` en la web. Sin este filtro, las pages
 * heredarían permisos pensados para el app y mostrarían UI inalcanzable.
 */
export function pageRolesFor(resource: Resource, action: Action): readonly Role[] {
  return rolesFor(resource, action).filter(
    (r) => !(MOBILE_ONLY_ROLES as readonly Role[]).includes(r),
  );
}

export function hasWebPermission(
  role: Role | null | undefined,
  resource: Resource,
  action: Action,
): boolean {
  if (!role) return false;
  return (pageRolesFor(resource, action) as Role[]).includes(role);
}

// ── Acciones especiales con su propio listado ───────────────────────────────

/**
 * Quién puede modificar el estado de fatiga de un conductor (apto / riesgo /
 * no_apto). Se aplica como gate adicional en `PATCH /api/conductores/[id]`
 * cuando el body incluye `status`.
 */
export const FATIGUE_ROLES: readonly Role[] = [
  A.SUPER_ADMIN,
  A.ADMIN_MUNICIPAL,
  A.FISCAL,
];

/**
 * Quién puede suspender un vehículo (PATCH /api/vehiculos/[id]/suspender).
 */
export const SUSPEND_ROLES: readonly Role[] = [
  A.SUPER_ADMIN,
  A.ADMIN_MUNICIPAL,
  A.FISCAL,
];

/**
 * Roles cuya empresa está fija (no pueden cambiarla al crear conductor o
 * vehículo: el formulario muestra la empresa del operador en read-only).
 */
export const FIXED_COMPANY_ROLES: readonly Role[] = [A.OPERADOR];

/**
 * Roles que ven la app web (excluye conductor y ciudadano, que tienen su
 * dashboard en la app móvil — el layout web los redirige a MobileOnlyScreen).
 */
export const WEB_ALLOWED_ROLES: readonly Role[] = [
  A.SUPER_ADMIN,
  A.ADMIN_REGIONAL,
  A.ADMIN_PROVINCIAL,
  A.ADMIN_MUNICIPAL,
  A.FISCAL,
  A.OPERADOR,
];

/**
 * Roles que SIEMPRE deben usar la app móvil. Bloqueados por
 * `(dashboard)/layout.tsx` excepto para `/perfil`.
 */
export const MOBILE_ONLY_ROLES: readonly Role[] = [A.CONDUCTOR, A.CIUDADANO];
