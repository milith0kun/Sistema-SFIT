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
  /** Bloque de acciones a la derecha (botones, enlaces). Se renderiza junto a los pills. */
  action?: ReactNode;
  children?: ReactNode;
}

export function DashboardHero({ kicker, title, subtitle, pills, action, children }: DashboardHeroProps) {
  return (
    <div
      className="animate-fade-in sfit-hero"
      style={{
        background: "linear-gradient(115deg, #0A1628 0%, #0F1D35 40%, #152642 70%, #1A2D4A 100%)",
        borderRadius: 16,
        padding: "22px 26px",
        position: "relative",
        overflow: "hidden",
        color: "#fff",
        border: "1px solid rgba(139, 20, 20, 0.12)",
        boxShadow: "0 4px 20px rgba(10, 22, 40, 0.18), 0 1px 3px rgba(10, 22, 40, 0.10)",
      }}
    >
      {/* ── Patrón de puntos sutil ── */}
      <div aria-hidden style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(rgba(139, 20, 20, 0.08) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        pointerEvents: "none",
        opacity: 0.6,
      }} />

      {/* ── Acento rojo premium — esquina superior derecha ── */}
      <div aria-hidden style={{
        position: "absolute", top: -50, right: -50, width: 220, height: 220,
        background: "radial-gradient(circle, rgba(108,6,6,0.16) 0%, rgba(139,20,20,0.06) 40%, transparent 65%)",
        pointerEvents: "none",
      }} />

      {/* ── Acento inferior izquierdo ── */}
      <div aria-hidden style={{
        position: "absolute", bottom: -30, left: -20, width: 160, height: 160,
        background: "radial-gradient(circle, rgba(108,6,6,0.08) 0%, transparent 55%)",
        pointerEvents: "none",
      }} />

      {/* ── Logo SFIT watermark ── */}
      <div aria-hidden style={{
        position: "absolute",
        right: 18,
        bottom: -6,
        width: 80,
        height: 80,
        opacity: 0.06,
        pointerEvents: "none",
        backgroundImage: "url(/logo-mark.svg)",
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        filter: "brightness(2)",
      }} />

      {/* ── Shimmer line ── */}
      <div aria-hidden className="sfit-hero-shimmer" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent 0%, rgba(139,20,20,0.25) 30%, rgba(255,255,255,0.08) 50%, rgba(139,20,20,0.25) 70%, transparent 100%)",
        pointerEvents: "none",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          {/* Kicker con logo inline */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 8,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-mark.svg"
              alt=""
              aria-hidden
              style={{
                width: 18, height: 18,
                objectFit: "contain",
                opacity: 0.7,
                filter: "brightness(1.8) saturate(0.7)",
              }}
            />
            <span style={{
              fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.16em",
              color: "rgba(139,20,20,0.85)", textTransform: "uppercase",
            }}>
              {kicker}
            </span>
          </div>

          <h1 style={{
            margin: 0, fontSize: "1.375rem", fontWeight: 800, letterSpacing: "-0.025em",
            lineHeight: 1.15, color: "#fff",
            fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
          }}>
            {title}
          </h1>
          {subtitle && (
            <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.55)", marginTop: 5, lineHeight: 1.45 }}>
              {subtitle}
            </div>
          )}
        </div>

        {(pills || action || children) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {pills?.map(p => <QuickStatPill key={p.label} label={p.label} value={p.value} warn={p.warn} />)}
            {action}
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
        background: warn ? "rgba(239,68,68,0.10)" : "rgba(255,255,255,0.04)",
        borderLeft: `2.5px solid ${warn ? "#FCA5A5" : "rgba(139,20,20,0.50)"}`,
        borderRadius: 0,
        padding: "5px 14px",
        minWidth: 82,
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        transition: "background 160ms ease",
      }}
    >
      <div
        style={{
          fontSize: "0.625rem",
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: warn ? "#FCA5A5" : "rgba(255,255,255,0.50)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.1875rem",
          fontWeight: 800,
          color: "#fff",
          letterSpacing: "-0.025em",
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
