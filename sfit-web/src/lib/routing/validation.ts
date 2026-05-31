/**
 * Recolecta todos los códigos UBIGEO (6 dígitos) tocados por una ruta —
 * waypoints para urbanas, origen+destino para interprovinciales. Útil para
 * validar contra la cobertura geográfica declarada por la empresa.
 */
export function collectRouteDistrictCodes(data: {
  waypoints?: { districtCode?: string }[];
  originDistrictCode?: string;
  destinationDistrictCode?: string;
}): string[] {
  const codes = new Set<string>();
  for (const w of data.waypoints ?? []) {
    if (w.districtCode && /^\d{6}$/.test(w.districtCode)) codes.add(w.districtCode);
  }
  if (data.originDistrictCode && /^\d{6}$/.test(data.originDistrictCode)) {
    codes.add(data.originDistrictCode);
  }
  if (data.destinationDistrictCode && /^\d{6}$/.test(data.destinationDistrictCode)) {
    codes.add(data.destinationDistrictCode);
  }
  return Array.from(codes);
}

/**
 * Reglas semánticas adicionales según `serviceScope`:
 *  - `urbano`: exige al menos 2 waypoints (la ruta se traza por calles).
 *  - `interprovincial`: exige `originDistrictCode` y `destinationDistrictCode`
 *    (UBIGEO 6). Los waypoints quedan opcionales (carretera lineal).
 *
 * Devuelve un mapa de errores compatible con `apiValidationError` o `null`
 * cuando todo es válido.
 */
export function validateRouteByScope(
  scope: string | undefined,
  data: {
    waypoints?: { order: number; lat: number; lng: number }[];
    originDistrictCode?: string;
    destinationDistrictCode?: string;
  },
): Record<string, string[]> | null {
  if (!scope) return null;
  const errors: Record<string, string[]> = {};

  if (scope === "urbano") {
    if (!data.waypoints || data.waypoints.length < 2) {
      errors.waypoints = ["Las rutas urbanas requieren al menos 2 waypoints"];
    }
  }

  if (scope === "interprovincial") {
    if (!data.originDistrictCode) {
      errors.originDistrictCode = [
        "Las rutas interprovinciales requieren el distrito de origen (UBIGEO)",
      ];
    }
    if (!data.destinationDistrictCode) {
      errors.destinationDistrictCode = [
        "Las rutas interprovinciales requieren el distrito de destino (UBIGEO)",
      ];
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
