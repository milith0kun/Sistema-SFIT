export type DocStatus = "vigente" | "por_vencer" | "vencido" | "sin_registro" | "exento";

/**
 * Calcula el estado de un documento (SOAT o CITV) según su fecha de vencimiento.
 *
 * Para CITV, se considera la exención por antigüedad (D.S. N° 025-2008-MTC):
 * los vehículos nuevos no requieren revisión técnica durante los primeros 3 años
 * desde su año de fabricación. Si no hay fecha de vencimiento y el vehículo tiene
 * menos de 3 años, se retorna "exento".
 */
export function computeDocStatus(
  expiryDate: Date | string | null | undefined,
  vehicleYear?: number,
): DocStatus {
  if (!expiryDate) {
    if (vehicleYear != null) {
      const currentYear = new Date().getFullYear();
      if (currentYear - vehicleYear < 3) return "exento";
    }
    return "sin_registro";
  }
  const d = new Date(expiryDate);
  if (isNaN(d.getTime())) return "sin_registro";

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((d.getTime() - now.getTime()) / 86400000);

  if (diffDays < 0) return "vencido";
  if (diffDays <= 30) return "por_vencer";
  return "vigente";
}

export const DOC_STATUS_META: Record<DocStatus, { label: string; color: string; bg: string; bd: string }> = {
  vigente:      { label: "Vigente",      color: "#15803d", bg: "#f0fdf4", bd: "#bbf7d0" },
  por_vencer:   { label: "Por vencer",   color: "#92400E", bg: "#FEFCE8", bd: "#FDE68A" },
  vencido:      { label: "Vencido",      color: "#DC2626", bg: "#FEF2F2", bd: "#FECACA" },
  sin_registro: { label: "Sin registro", color: "#6B7280", bg: "#F9FAFB", bd: "#E5E7EB" },
  exento:       { label: "Exento",       color: "#0369A1", bg: "#F0F9FF", bd: "#BAE6FD" },
};
