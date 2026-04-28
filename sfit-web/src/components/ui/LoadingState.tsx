import type { CSSProperties } from "react";

type Variant = "skeleton" | "spinner" | "inline";

interface LoadingStateProps {
  /**
   * - `skeleton`: bloques shimmer reservando layout (default — evita CLS)
   * - `spinner`: rueda centrada para acciones cortas
   * - `inline`: texto sutil para cargas en línea (e.g., dropdowns)
   */
  variant?: Variant;
  /** Mensaje opcional (se muestra debajo del spinner o como hint del skeleton). */
  label?: string;
  /** Cantidad de bloques skeleton (sólo `variant="skeleton"`, default 3). */
  rows?: number;
}

/**
 * Estado de carga estandarizado SFIT.
 * Reemplaza los `<div>Cargando…</div>` planos por un patrón consistente.
 */
export function LoadingState({
  variant = "skeleton",
  label,
  rows = 3,
}: LoadingStateProps) {
  if (variant === "spinner") {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "48px 24px",
        color: "#71717a",
      }}>
        <Spinner size={28} />
        {label && (
          <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
            {label}
          </span>
        )}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        color: "#71717a",
        fontSize: "0.8125rem",
      }}>
        <Spinner size={13} />
        {label ?? "Cargando…"}
      </span>
    );
  }

  // skeleton
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer"
          style={{
            height: i === 0 ? 18 : i === rows - 1 ? 64 : 14,
            width: i === 0 ? "40%" : i === rows - 1 ? "100%" : `${70 + (i * 5) % 25}%`,
            borderRadius: 8,
            background: "#f4f4f5",
          }}
        />
      ))}
      {label && (
        <span
          style={{
            fontSize: "0.75rem",
            color: "#a1a1aa",
            fontWeight: 500,
            marginTop: 4,
          }}
          aria-live="polite"
        >
          {label}
        </span>
      )}
    </div>
  );
}

function Spinner({ size = 20 }: { size?: number }) {
  const style: CSSProperties = {
    animation: "spin 0.65s linear infinite",
    color: "#6C0606",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.18" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
