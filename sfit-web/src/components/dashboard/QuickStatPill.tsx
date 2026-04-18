"use client";

import type { ReactNode } from "react";

export interface QuickStatPillProps {
  label: string;
  value: ReactNode;
  warn?: boolean;
}

/**
 * Pill oscura para usar dentro del `<DashboardHero>` (fondo navy).
 * Extraído del `QuickStat` de `/flota`.
 */
export function QuickStatPill({ label, value, warn }: QuickStatPillProps) {
  return (
    <div
      style={{
        background: warn ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.08)",
        border: `1px solid ${warn ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.12)"}`,
        borderRadius: 10,
        padding: "10px 14px",
        minWidth: 110,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: warn ? "#FCA5A5" : "rgba(255,255,255,0.55)",
        }}
      >
        {label}
      </div>
      <div
        className="num"
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: "#fff",
          letterSpacing: "-0.02em",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
