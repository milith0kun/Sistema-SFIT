/**
 * Ámbito geográfico activo del sistema SFIT.
 *
 * El despliegue actual opera exclusivamente en la provincia de Cotabambas
 * (departamento de Apurímac, Perú). Esta constante es la fuente única de
 * verdad: endpoints públicos, endpoints admin (para roles no super_admin),
 * selectores de UI y validaciones de formularios la consultan para mostrar
 * o aceptar únicamente datos dentro del scope.
 *
 * Si en el futuro se agrega otra provincia, este archivo es el único punto
 * a tocar — el resto del código lee de aquí.
 */

export const ACTIVE_DEPARTMENT_CODE = "03";       // Apurímac (UBIGEO 2 dígitos)
export const ACTIVE_DEPARTMENT_NAME = "Apurímac";

export const ACTIVE_PROVINCE_CODE = "0305";       // Cotabambas (UBIGEO 4 dígitos)
export const ACTIVE_PROVINCE_NAME = "Cotabambas";

/**
 * Municipalidad provincial sede (capital de Cotabambas). El admin_municipal
 * opera sobre esta muni. Los datos institucionales (razón social, RUC) viven
 * en la collection `municipalities` y los siembra `scripts/activate-cotabambas.ts`,
 * por lo que el onboarding NO los pide al primer login.
 */
export const ACTIVE_MUNICIPALITY_CODE = "030501";  // Tambobamba (UBIGEO 6 dígitos)
export const ACTIVE_MUNICIPALITY_NAME = "Tambobamba";
export const ACTIVE_MUNICIPALITY_FULL_NAME = "Municipalidad Provincial de Cotabambas — Tambobamba";

/**
 * 6 distritos operativos de la provincia de Cotabambas. UBIGEO 6 dígitos.
 * Tambobamba es la capital provincial.
 */
export const ACTIVE_DISTRICTS = [
  { code: "030501", name: "Tambobamba" },
  { code: "030502", name: "Cotabambas" },
  { code: "030503", name: "Coyllurqui" },
  { code: "030504", name: "Haquira" },
  { code: "030505", name: "Mara" },
  { code: "030506", name: "Challhuahuacho" },
] as const;

export const ACTIVE_DISTRICT_CODES: readonly string[] = ACTIVE_DISTRICTS.map((d) => d.code);

/**
 * Destinos válidos para rutas interprovinciales. El origen siempre debe ser
 * un distrito de Cotabambas; el destino es una de estas tres ciudades.
 */
export const INTERPROV_DESTINATIONS = [
  { code: "030101", name: "Abancay",  province: "Abancay"  },
  { code: "080101", name: "Cusco",    province: "Cusco"    },
  { code: "040101", name: "Arequipa", province: "Arequipa" },
] as const;

export const INTERPROV_DESTINATION_CODES: readonly string[] =
  INTERPROV_DESTINATIONS.map((d) => d.code);

/** `true` si el código UBIGEO 6d pertenece a un distrito operativo de Cotabambas. */
export function isActiveDistrict(districtCode: string | null | undefined): boolean {
  if (!districtCode) return false;
  return ACTIVE_DISTRICT_CODES.includes(districtCode);
}

/** `true` si el código UBIGEO 6d es un destino interprovincial válido. */
export function isInterprovDestination(districtCode: string | null | undefined): boolean {
  if (!districtCode) return false;
  return INTERPROV_DESTINATION_CODES.includes(districtCode);
}
