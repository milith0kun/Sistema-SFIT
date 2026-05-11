import { ROLES, type Role } from "@/lib/constants";

/**
 * Matriz centralizada de permisos por recurso. Es la fuente única de verdad
 * para qué rol puede ver/crear/editar/borrar cada recurso del sistema. Tanto
 * las páginas web (`(dashboard)/.../page.tsx`) como los handlers de API
 * (`api/.../route.ts`) deben consumirla mediante `rolesFor(resource, action)`.
 *
 * Separación web/móvil:
 *   - WEB_ALLOWED_ROLES = los 4 admins jerárquicos (SA → AR → AP → AM).
 *   - MOBILE_ONLY_ROLES = fiscal, operador, conductor, ciudadano. El layout
 *     `(dashboard)/layout.tsx` los redirige a MobileOnlyScreen.
 *
 * Aunque fiscal y operador aparezcan en la matriz como permitidos para algunos
 * recursos, esos permisos solo aplican vía la app móvil (que consume la misma
 * API). En la web no se renderizan.
 *
 * Cuando un recurso tiene acciones especiales (ej. fatigue para conductores,
 * suspender para vehículos, anular sanciones), se exponen aparte como
 * constantes nombradas al final del archivo.
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
    create: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.OPERADOR],
    edit: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR],
    delete: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL],
  },
  vehiculos: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR, A.CONDUCTOR],
    create: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.OPERADOR],
    edit: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.OPERADOR],
    delete: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL],
  },
  flota: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR, A.CONDUCTOR],
    create: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.OPERADOR, A.CONDUCTOR],
    edit: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.OPERADOR, A.CONDUCTOR],
    delete: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL],
  },
  viajes: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR, A.CONDUCTOR],
    create: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.OPERADOR],
    edit: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.OPERADOR, A.CONDUCTOR],
    delete: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL],
  },
  rutas: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR, A.CONDUCTOR],
    create: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.OPERADOR],
    edit: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.OPERADOR],
    delete: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL],
  },
  empresas: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR],
    create: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL],
    edit: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.OPERADOR],
    delete: [A.SUPER_ADMIN],
  },
  inspecciones: {
    // View: admins consultan/auditan en web (read-only). Fiscal trabaja en móvil.
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR],
    // Create/Edit: solo fiscal desde la app móvil.
    create: [A.FISCAL],
    edit: [A.FISCAL],
    delete: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL],
  },
  sanciones: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR, A.CONDUCTOR],
    // Create/Edit: solo fiscal desde la app móvil. Anular tiene su propio
    // listado SANCION_ANULAR_ROLES porque admins también pueden anular.
    create: [A.FISCAL],
    edit: [A.FISCAL],
    delete: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL],
  },
  apelaciones: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.CONDUCTOR],
    // Conductor apela su propia sanción desde la app; operador apela en
    // nombre de su flota desde la app móvil. Ambos casos pasan por el mismo POST.
    create: [A.CONDUCTOR, A.OPERADOR],
    // Resolver apelaciones: los 4 admins desde web + fiscal desde móvil
    // (escalamiento administrativo). Scope geográfico se valida en el handler.
    edit: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL],
    delete: [A.SUPER_ADMIN],
  },
  reportes: {
    // El operador ve los reportes que mencionan vehículos de su flota
    // (filtrado por companyId en el handler GET).
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.FISCAL, A.OPERADOR, A.CIUDADANO],
    create: [A.CIUDADANO],
    edit: [A.SUPER_ADMIN, A.ADMIN_MUNICIPAL, A.FISCAL],
    delete: [A.SUPER_ADMIN],
  },
  recompensas: {
    view: [A.SUPER_ADMIN, A.ADMIN_REGIONAL, A.ADMIN_PROVINCIAL, A.ADMIN_MUNICIPAL, A.CIUDADANO],
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
 * (fiscal/operador/conductor/ciudadano) — esos roles consumen la API desde el
 * app móvil pero son redirigidos a `MobileOnlyScreen` en la web. Sin este
 * filtro, las pages heredarían permisos pensados para el app y mostrarían UI
 * inalcanzable o errores de RBAC silenciosos.
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
 * cuando el body incluye `status`. Fiscal actúa desde la app móvil.
 */
export const FATIGUE_ROLES: readonly Role[] = [
  A.SUPER_ADMIN,
  A.ADMIN_MUNICIPAL,
  A.FISCAL,
];

/**
 * Quién puede suspender un vehículo (PATCH /api/vehiculos/[id]/suspender).
 * Fiscal actúa desde la app móvil.
 */
export const SUSPEND_ROLES: readonly Role[] = [
  A.SUPER_ADMIN,
  A.ADMIN_MUNICIPAL,
  A.FISCAL,
];

/**
 * Quién puede anular una sanción ya emitida (POST /api/sanciones/[id]/anular).
 * Fiscal anula desde la app; super_admin y admin_municipal anulan desde web
 * como acción administrativa (escalamiento). Difiere del CREATE/EDIT regular
 * que es móvil-exclusivo del fiscal.
 */
export const SANCION_ANULAR_ROLES: readonly Role[] = [
  A.SUPER_ADMIN,
  A.ADMIN_MUNICIPAL,
  A.FISCAL,
];

/**
 * Roles cuya empresa está fija (no pueden cambiarla al crear conductor o
 * vehículo: el formulario muestra la empresa del operador en read-only).
 * Solo operador aplica; los admins eligen empresa destino dentro de su scope
 * geográfico filtrado por `scopedCompanyFilter`.
 */
export const FIXED_COMPANY_ROLES: readonly Role[] = [A.OPERADOR];

/**
 * Roles que pueden navegar la app web. Son los 4 admins jerárquicos:
 *   super_admin → admin_regional → admin_provincial → admin_municipal
 *
 * Cualquier otro rol autenticado en la web es redirigido a `MobileOnlyScreen`
 * por `(dashboard)/layout.tsx` (excepto la ruta `/perfil`).
 */
export const WEB_ALLOWED_ROLES: readonly Role[] = [
  A.SUPER_ADMIN,
  A.ADMIN_REGIONAL,
  A.ADMIN_PROVINCIAL,
  A.ADMIN_MUNICIPAL,
];

/**
 * Roles que SIEMPRE deben usar la app móvil. Bloqueados por
 * `(dashboard)/layout.tsx` excepto para `/perfil`. Incluye:
 *   - fiscal: inspecciones y sanciones se levantan en campo desde el app.
 *   - operador: gestiona su flota (conductores, vehículos, rutas, viajes,
 *     apelaciones) desde el app.
 *   - conductor: app del conductor (rutas, fatiga, viajes en curso).
 *   - ciudadano: app de reportes y recompensas.
 */
export const MOBILE_ONLY_ROLES: readonly Role[] = [
  A.FISCAL,
  A.OPERADOR,
  A.CONDUCTOR,
  A.CIUDADANO,
];
