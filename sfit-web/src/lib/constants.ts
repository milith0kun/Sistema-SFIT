/**
 * Constantes de roles del sistema SFIT (modelo de 1 municipalidad).
 *
 * Jerarquía web (solo 2 niveles):
 *   super_admin → admin_municipal
 *
 * Roles operativos móviles (no acceden a la web; ven MobileOnlyScreen):
 *   fiscal, operador, conductor, ciudadano
 */
export const ROLES = {
  SUPER_ADMIN: "super_admin",
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
 * Tipos de vehículo predefinidos del sistema. Cotabambas fiscaliza dos
 * segmentos de transporte público:
 *
 *   - urbano: combis/colectivos que circulan dentro de los 6 distritos
 *     operativos. Rutas con paraderos.
 *   - interprovincial: buses que salen de la provincia hacia Cusco,
 *     Abancay o Arequipa. Rutas origen-destino sin paraderos intermedios.
 *
 * Otros segmentos (limpieza, emergencia, maquinaria, municipal general)
 * fueron retirados en el cleanup municipal — no son competencia del
 * sistema de fiscalización SFIT.
 */
export const VEHICLE_TYPES = {
  TRANSPORTE_URBANO: "transporte_urbano",
  TRANSPORTE_INTERPROVINCIAL: "transporte_interprovincial",
} as const;

export type VehicleType =
  (typeof VEHICLE_TYPES)[keyof typeof VEHICLE_TYPES];
