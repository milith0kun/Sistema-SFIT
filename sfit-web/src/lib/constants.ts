/**
 * Constantes de roles del sistema SFIT.
 * Coinciden con los roles definidos en el Readme (sección 5).
 *
 * NOTA: `ADMIN_REGIONAL` está DEPRECADO. El rol fue identificado como
 * "fantasma" en `graphify-out/role_drift_report.md`: aparecía en VIEW_ROLES
 * de la web pero la API lo rechazaba con 403. Lo dejamos en la constante
 * para no romper los `requireRole([...])` repartidos por la API durante la
 * limpieza incremental, pero ya no es asignable: el enum de Mongoose no
 * lo acepta y `ROLES_ASSIGNABLE_BY` ya no lo expone. Ningún usuario nuevo
 * puede crearse con este rol; usar `admin_provincial` en su lugar.
 */
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  /** @deprecated Usar ADMIN_PROVINCIAL. Ver migración en scripts/migrate-admin-regional.ts */
  ADMIN_REGIONAL: "admin_regional",
  ADMIN_PROVINCIAL: "admin_provincial",
  ADMIN_MUNICIPAL: "admin_municipal",
  FISCAL: "fiscal",
  OPERADOR: "operador",
  CONDUCTOR: "conductor",
  CIUDADANO: "ciudadano",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Estados del usuario en el flujo de aprobación.
 */
export const USER_STATUS = {
  PENDIENTE: "pendiente",
  ACTIVO: "activo",
  RECHAZADO: "rechazado",
  SUSPENDIDO: "suspendido",
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

/**
 * Estados del conductor según FatigueEngine.
 */
export const DRIVER_STATUS = {
  APTO: "apto",
  RIESGO: "riesgo",
  NO_APTO: "no_apto",
} as const;

export type DriverStatus = (typeof DRIVER_STATUS)[keyof typeof DRIVER_STATUS];

/**
 * Estados de disponibilidad del vehículo.
 */
export const VEHICLE_STATUS = {
  DISPONIBLE: "disponible",
  EN_RUTA: "en_ruta",
  EN_MANTENIMIENTO: "en_mantenimiento",
  FUERA_DE_SERVICIO: "fuera_de_servicio",
} as const;

export type VehicleStatus =
  (typeof VEHICLE_STATUS)[keyof typeof VEHICLE_STATUS];

/**
 * Tipos de vehículo predefinidos del sistema.
 */
export const VEHICLE_TYPES = {
  TRANSPORTE_PUBLICO: "transporte_publico",
  LIMPIEZA_RESIDUOS: "limpieza_residuos",
  EMERGENCIA: "emergencia",
  MAQUINARIA: "maquinaria",
  MUNICIPAL_GENERAL: "municipal_general",
} as const;

export type VehicleType =
  (typeof VEHICLE_TYPES)[keyof typeof VEHICLE_TYPES];
