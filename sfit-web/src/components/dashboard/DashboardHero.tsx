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
  subtitle?: string;
  pills?: HeroPill[];
  rfCode?: string;
  children?: ReactNode;
}

/**
 * Navy gradient greeting card with radial gold glow + dot pattern.
 * Patrón canónico extraído de `/flota` (RF-07).
 */
export function DashboardHero({
  kicker,
  title,
  subtitle,
  pills,
  rfCode,
  children,
}: DashboardHeroProps) {
  return (
    <div
      className="animate-fade-in"
      style={{
        background: "linear-gradient(100deg, #0A1628 0%, #111F38 55%, #1A2D4A 100%)",
        borderRadius: 14,
        padding: "16px 20px",
        position: "relative",
        overflow: "hidden",
        color: "#fff",
      }}
    >
      <style jsx global>{`
        @keyframes sfitHeroPulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.35;
          }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 240,
          height: 240,
          background:
            "radial-gradient(circle, rgba(184,134,11,0.25) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 280px" }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "#D4A827",
              textTransform: "uppercase",
              marginBottom: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#D4A827",
                animation: "sfitHeroPulse 2s infinite",
              }}
            />
            {kicker}
            {rfCode && (
              <span style={{ color: "rgba(212,168,39,0.55)", marginLeft: 4 }}>
                · {rfCode}
              </span>
            )}
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-syne), Syne, system-ui, sans-serif",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              color: "#fff",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.75)",
                marginTop: 6,
                lineHeight: 1.45,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {(pills || children) && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {pills?.map((p) => (
              <QuickStatPill key={p.label} label={p.label} value={p.value} warn={p.warn} />
            ))}
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickStatPill({
  label,
  value,
  warn,
}: {
  label: string;
  value: ReactNode;
  warn?: boolean;
}) {
  return (
    <div
      style={{
        background: warn ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.08)",
        border: `1px solid ${warn ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.12)"}`,
        borderRadius: 9,
        padding: "8px 12px",
        minWidth: 76,
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
          fontSize: 17,
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
