"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface KPIItem {
  label: string;
  value: string | number;
  subtitle?: string;
  /** Semantic accent — solo para estados (green, amber, red). Omitir para neutros. */
  accent?: string;
  icon: LucideIcon;
  trend?: { value: number; label?: string };
}

export interface KPIStripProps {
  items: KPIItem[];
  cols?: 2 | 3 | 4 | 5 | 6;
}

export function KPIStrip({ items, cols = 6 }: KPIStripProps) {
  // El responsive lo manejan las reglas en globals.css `.sfit-kpi-grid`:
  //   ≤768px → 3 cols, ≤640px → 2 cols (con !important sobrescriben este inline).
  return (
    <div
      className="sfit-kpi-grid"
      style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 10 }}
    >
      {items.map((it, i) => {
        const trendUp = it.trend && it.trend.value >= 0;
        const hasAccent = Boolean(it.accent);
        const Icon = it.icon;
        return (
          <div
            key={`${it.label}-${i}`}
            className="sfit-kpi-card"
            style={{
              position: "relative",
              overflow: "hidden",
              background: "#fff",
              borderTop:    "1.5px solid #e4e4e7",
              borderRight:  "1.5px solid #e4e4e7",
              borderBottom: "1.5px solid #e4e4e7",
              borderLeft:   hasAccent ? `3px solid ${it.accent}` : "1.5px solid #e4e4e7",
              borderRadius: 12,
              padding: "14px 16px 13px",
              minWidth: 0,
              minHeight: 100,
            }}
          >
            {/* Label */}
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#71717a",
                textTransform: "uppercase",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: 10,
                position: "relative",
                zIndex: 1,
                paddingRight: 36,
              }}
            >
              {it.label}
            </div>

            {/* Value */}
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 800,
                color: it.accent ?? "#09090b",
                lineHeight: 1,
                letterSpacing: "-0.03em",
                fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
                fontVariantNumeric: "tabular-nums",
                position: "relative",
                zIndex: 1,
              }}
            >
              {it.value}
            </div>

            {/* Trend + subtitle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginTop: 6,
                position: "relative",
                zIndex: 1,
              }}
            >
              {it.trend !== undefined && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    color: trendUp ? "#15803d" : "#DC2626",
                    background: trendUp ? "#F0FDF4" : "#FFF5F5",
                    border: `1px solid ${trendUp ? "#86EFAC" : "#FCA5A5"}`,
                    borderRadius: 5,
                    padding: "1px 5px",
                  }}
                >
                  {trendUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                  {it.trend.value > 0 ? "+" : ""}{it.trend.value}%
                </span>
              )}
              {it.subtitle && (
                <span style={{ fontSize: "0.75rem", color: "#a1a1aa", fontWeight: 500 }}>
                  {it.subtitle}
                </span>
              )}
            </div>

            {/* Ícono watermark — esquina inferior derecha */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                right: -12,
                bottom: -12,
                color: "#6C0606",
                opacity: 0.10,
                pointerEvents: "none",
                lineHeight: 0,
                transition: "opacity 200ms ease",
              }}
            >
              <Icon size={88} strokeWidth={1.2} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
