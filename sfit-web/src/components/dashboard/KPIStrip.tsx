"use client";

import type { LucideIcon } from "lucide-react";

export interface KPIItem {
  label: string;
  value: string | number;
  subtitle?: string;
  accent: string;
  icon: LucideIcon;
}

export interface KPIStripProps {
  items: KPIItem[];
  cols?: 3 | 4 | 5 | 6;
}

/**
 * Strip horizontal de tarjetas KPI con ícono watermark abajo-derecha,
 * kicker con dot de color accent, número grande tabular y subtítulo.
 * Patrón canónico extraído de `/flota` (RF-07).
 */
export function KPIStrip({ items, cols = 6 }: KPIStripProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: 10,
      }}
    >
      {items.map((it, i) => (
        <div
          key={`${it.label}-${i}`}
          style={{
            background: "#fff",
            border: "1px solid #e4e4e7",
            borderRadius: 10,
            padding: "14px 14px 12px",
            position: "relative",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: -8,
              bottom: -8,
              color: `${it.accent}10`,
              pointerEvents: "none",
              lineHeight: 1,
            }}
          >
            <it.icon size={64} strokeWidth={1.6} />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.16em",
              color: "#71717a",
              textTransform: "uppercase",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: it.accent,
              }}
            />
            {it.label}
          </div>
          <div
            className="num"
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#09090b",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
            }}
          >
            {it.value}
          </div>
          {it.subtitle && (
            <div
              style={{
                fontSize: 11.5,
                color: "#71717a",
                marginTop: 4,
                fontWeight: 500,
              }}
            >
              {it.subtitle}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
