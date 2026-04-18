"use client";

export interface TypeChipProps {
  color: string;
  label: string;
}

/**
 * Chip institucional con color hexadecimal. bg: `${color}15`,
 * border `${color}30`, texto uppercase y letter-spacing 0.08em.
 * Extraído del `TipoChip` de `/flota`.
 */
export function TypeChip({ color, label }: TypeChipProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color,
        background: `${color}15`,
        border: `1px solid ${color}30`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
