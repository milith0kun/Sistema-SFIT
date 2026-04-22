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
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 10 }}>
      {items.map((it, i) => {
        const trendUp = it.trend && it.trend.value >= 0;
        const hasAccent = Boolean(it.accent);
        return (
          <div
            key={`${it.label}-${i}`}
            style={{
              background: "#fff",
              border: "1.5px solid #e4e4e7",
              borderLeft: hasAccent ? `3px solid ${it.accent}` : "1.5px solid #e4e4e7",
              borderRadius: 12,
              padding: "14px 16px 13px",
              minWidth: 0,
            }}
          >
            {/* Icon + label row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: "#f4f4f5",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <it.icon size={14} color="#71717a" strokeWidth={2} />
              </div>
              <span style={{
                fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em",
                color: "#71717a", textTransform: "uppercase", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {it.label}
              </span>
            </div>

            {/* Value */}
            <div style={{
              fontSize: "1.75rem", fontWeight: 800, color: it.accent ?? "#09090b",
              lineHeight: 1, letterSpacing: "-0.03em",
              fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
              fontVariantNumeric: "tabular-nums",
            }}>
              {it.value}
            </div>

            {/* Trend + subtitle */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6 }}>
              {it.trend !== undefined && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  fontSize: "0.6875rem", fontWeight: 700,
                  color: trendUp ? "#15803d" : "#b91c1c",
                  background: trendUp ? "#F0FDF4" : "#FFF5F5",
                  border: `1px solid ${trendUp ? "#86EFAC" : "#FCA5A5"}`,
                  borderRadius: 5, padding: "1px 5px",
                }}>
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
          </div>
        );
      })}
    </div>
  );
}
