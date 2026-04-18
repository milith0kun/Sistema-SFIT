import type { HTMLAttributes, CSSProperties } from "react";

export type BadgeVariant =
  | "activo"
  | "inactivo"
  | "pendiente"
  | "suspendido"
  | "info"
  | "gold";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANTS: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  activo:     { bg: "#F0FDF4", color: "#15803d", border: "#86EFAC" },
  inactivo:   { bg: "#F4F4F5", color: "#52525b", border: "#E4E4E7" },
  pendiente:  { bg: "#FFFBEB", color: "#b45309", border: "#FCD34D" },
  suspendido: { bg: "#FFF5F5", color: "#b91c1c", border: "#FCA5A5" },
  info:       { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  gold:       { bg: "#FDF8EC", color: "#926A09", border: "#E8D090" },
};

export function Badge({
  variant = "inactivo",
  className = "",
  style,
  children,
  ...props
}: BadgeProps) {
  const v = VARIANTS[variant];
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: 999,
    background: v.bg,
    color: v.color,
    border: `1px solid ${v.border}`,
    fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif",
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "0.01em",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
    ...style,
  };
  return (
    <span className={className} style={base} {...props}>
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: v.color,
          display: "inline-block",
        }}
      />
      {children}
    </span>
  );
}
