"use client";

import type { ReactNode } from "react";

export interface HeroPill {
  label: string;
  value: ReactNode;
  warn?: boolean;
}

export interface DashboardHeroProps {
  kicker: string;
  title: string;
  rfCode?: string;
  subtitle?: string;
  pills?: HeroPill[];
  children?: ReactNode;
}

export function DashboardHero({ kicker, title, subtitle, pills, children }: DashboardHeroProps) {
  return (
    <div
      className="animate-fade-in"
      style={{
        background: "linear-gradient(100deg, #0A1628 0%, #111F38 60%, #172440 100%)",
        borderRadius: 14,
        padding: "20px 24px",
        position: "relative",
        overflow: "hidden",
        color: "#fff",
        border: "1px solid rgba(212, 168, 39, 0.10)",
      }}
    >
      {/* Acento dorado tenue — esquina superior derecha */}
      <div aria-hidden style={{
        position: "absolute", top: -40, right: -40, width: 180, height: 180,
        background: "radial-gradient(circle, rgba(184,134,11,0.12) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <div style={{
            fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.16em",
            color: "#D4A827", textTransform: "uppercase", marginBottom: 6,
          }}>
            {kicker}
          </div>
          <h1 style={{
            margin: 0, fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.02em",
            lineHeight: 1.15, color: "#fff",
            fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
          }}>
            {title}
          </h1>
          {subtitle && (
            <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.6)", marginTop: 4, lineHeight: 1.4 }}>
              {subtitle}
            </div>
          )}
        </div>

        {(pills || children) && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {pills?.map(p => <QuickStatPill key={p.label} label={p.label} value={p.value} warn={p.warn} />)}
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickStatPill({ label, value, warn }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div
      style={{
        background: warn ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.05)",
        borderLeft: `2px solid ${warn ? "#FCA5A5" : "rgba(212,168,39,0.45)"}`,
        borderRadius: 0,
        padding: "4px 14px",
        minWidth: 78,
      }}
    >
      <div
        style={{
          fontSize: "0.625rem",
          fontWeight: 700,
          letterSpacing: "0.13em",
          textTransform: "uppercase",
          color: warn ? "#FCA5A5" : "rgba(255,255,255,0.55)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.125rem",
          fontWeight: 800,
          color: "#fff",
          letterSpacing: "-0.02em",
          marginTop: 2,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}
