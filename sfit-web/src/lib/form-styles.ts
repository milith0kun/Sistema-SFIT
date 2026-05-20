/**
 * Estilos de formulario centralizados.
 *
 * Reemplaza las ~12 redefiniciones de FIELD, READ, LABEL, BTN_PRIMARY
 * que aparecen en cada archivo de detalle.
 *
 * Uso:
 *   import { FIELD, READ, LABEL, BTN_PRIMARY, BTN_OUTLINE } from "@/lib/form-styles";
 *   <input style={FIELD} />
 *   <span style={READ}>valor</span>
 */

import { INK1, INK2, INK5, INK6, INK9, GRN, RED } from "./design-tokens";

/** Input de formulario estándar. */
export const FIELD: React.CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 10px",
  borderRadius: 7,
  border: `1px solid ${INK2}`,
  background: "#fff",
  fontSize: "0.8125rem",
  color: INK9,
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 120ms",
};

/** Valor de solo lectura. */
export const READ: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: INK9,
  lineHeight: 1.5,
};

/** Label de campo. */
export const LABEL: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: INK5,
  marginBottom: 4,
};

/** Botón primario (fondo oscuro). */
export const BTN_PRIMARY: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 36,
  padding: "0 16px",
  borderRadius: 9,
  border: "none",
  background: INK9,
  color: "#fff",
  fontSize: "0.8125rem",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
  transition: "all 120ms",
};

/** Botón secundario (borde). */
export const BTN_OUTLINE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 36,
  padding: "0 16px",
  borderRadius: 9,
  border: `1.5px solid ${INK2}`,
  background: "#fff",
  color: INK6,
  fontSize: "0.8125rem",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
  transition: "all 120ms",
};

/** Botón pequeño. */
export const BTN_SM: React.CSSProperties = {
  ...BTN_PRIMARY,
  height: 30,
  padding: "0 12px",
  fontSize: "0.75rem",
};

/** Botón de peligro. */
export const BTN_DANGER: React.CSSProperties = {
  ...BTN_PRIMARY,
  background: RED,
};

/** Botón de éxito. */
export const BTN_SUCCESS: React.CSSProperties = {
  ...BTN_PRIMARY,
  background: GRN,
};

/** Select de formulario. */
export const SELECT: React.CSSProperties = {
  ...FIELD,
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 28,
};
