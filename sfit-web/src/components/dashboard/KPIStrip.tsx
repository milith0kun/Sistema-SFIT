"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface KPIItem {
  label: string;
  value: string | number;
  subtitle?: string;
  accent: string;
  icon: LucideIcon;
  trend?: { value: number; label?: string }; // +12 = +12%, -5 = -5%
}

export interface KPIStripProps {
  items: KPIItem[];
  cols?: 2 | 3 | 4 | 5 | 6;
}

export function KPIStrip({ items, cols = 6 }: KPIStripProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: 12,
      }}
    >
      {items.map((it, i) => {
        const trendUp = it.trend && it.trend.value >= 0;
        return (
          <div
            key={`${it.label}-${i}`}
            style={{
              background: "#fff",
              border: "1px solid #e4e4e7",
              borderRadius: 12,
              padding: "16px 16px 14px",
              position: "relative",
              overflow: "hidden",
              minWidth: 0,
            }}
          >
            {/* Watermark */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                right: -10,
                bottom: -10,
                color: it.accent,
                opacity: 0.15,
                pointerEvents: "none",
                lineHeight: 1,
              }}
            >
              <it.icon size={76} strokeWidth={1.2} />
            </div>

            {/* Icon chip */}
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: `${it.accent}18`,
              color: it.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}>
              <it.icon size={18} strokeWidth={2} />
            </div>

            {/* Label */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginBottom: 5,
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.13em",
              color: "#71717a",
              textTransform: "uppercase",
            }}>
              <span
                aria-hidden
                style={{ width: 4, height: 4, borderRadius: "50%", background: it.accent, flexShrink: 0 }}
              />
              {it.label}
            </div>

            {/* Value */}
            <div
              className="num"
              style={{
                fontSize: "1.875rem",
                fontWeight: 800,
                color: "#09090b",
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
              }}
            >
              {it.value}
            </div>

            {/* Trend + subtitle row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
              {it.trend !== undefined && (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: trendUp ? "#15803d" : "#b91c1c",
                  background: trendUp ? "#F0FDF4" : "#FFF5F5",
                  border: `1px solid ${trendUp ? "#86EFAC" : "#FCA5A5"}`,
                  borderRadius: 5,
                  padding: "1px 6px",
                }}>
                  {trendUp
                    ? <TrendingUp size={10} />
                    : <TrendingDown size={10} />}
                  {it.trend.value > 0 ? "+" : ""}{it.trend.value}%
                </span>
              )}
              {it.subtitle && (
                <span style={{ fontSize: "0.75rem", color: "#71717a", fontWeight: 500 }}>
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
