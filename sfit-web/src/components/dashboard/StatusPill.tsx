"use client";

import type { ReactNode } from "react";

export type StatusVariant =
  | "disponible"
  | "activo"
  | "en_ruta"
  | "pendiente"
  | "mantenimiento"
  | "riesgo"
  | "suspendido"
  | "inactivo"
  | "no_apto"
  | "rechazado"
  | "apto"
  | "fuera_servicio";

interface StatusDef {
  label: string;
  color: string;
  bg: string;
  dot: string;
}

const VARIANTS: Record<StatusVariant, StatusDef> = {
  // Verde apto
  disponible:    { label: "Disponible",     color: "#15803d", bg: "#ECFDF5", dot: "#15803d" },
  activo:        { label: "Activo",         color: "#15803d", bg: "#ECFDF5", dot: "#15803d" },
  apto:          { label: "Apto",           color: "#15803d", bg: "#ECFDF5", dot: "#15803d" },
  // Gold en ruta
  en_ruta:       { label: "En ruta",        color: "#B8860B", bg: "#FDF8EC", dot: "#D4A827" },
  // Naranja riesgo / pendiente / mantenimiento
  pendiente:     { label: "Pendiente",      color: "#B45309", bg: "#FFF7ED", dot: "#B45309" },
  riesgo:        { label: "Riesgo",         color: "#B45309", bg: "#FFF7ED", dot: "#B45309" },
  mantenimiento: { label: "Mantenimiento",  color: "#B45309", bg: "#FFF7ED", dot: "#B45309" },
  // Rojo
  suspendido:    { label: "Suspendido",     color: "#b91c1c", bg: "#FEF2F2", dot: "#b91c1c" },
  no_apto:       { label: "No apto",        color: "#b91c1c", bg: "#FEF2F2", dot: "#b91c1c" },
  rechazado:     { label: "Rechazado",      color: "#b91c1c", bg: "#FEF2F2", dot: "#b91c1c" },
  fuera_servicio:{ label: "Fuera servicio", color: "#b91c1c", bg: "#FEF2F2", dot: "#b91c1c" },
  // Neutro
  inactivo:      { label: "Inactivo",       color: "#52525b", bg: "#F4F4F5", dot: "#71717a" },
};

export interface StatusPillProps {
  variant: StatusVariant;
  children?: ReactNode;
}

/**
 * Pill de estado con dot + texto uppercase. Réplica del `EstadoDot` de `/flota`.
 * El label viene del variant o se sobre-escribe con `children`.
 */
export function StatusPill({ variant, children }: StatusPillProps) {
  const v = VARIANTS[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 999,
        background: v.bg,
        color: v.color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: v.dot,
        }}
      />
      {(children ?? v.label).toString().toUpperCase()}
    </span>
  );
}
