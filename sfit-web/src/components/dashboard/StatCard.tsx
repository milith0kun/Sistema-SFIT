"use client";

import type { LucideIcon } from "lucide-react";

type Accent = "gold" | "apto" | "riesgo" | "no_apto" | "ink";

type AccentPalette = {
  iconBg: string;
  iconBorder: string;
  iconFg: string;
  watermark: string;
};

const PALETTE: Record<Accent, AccentPalette> = {
  gold:    { iconBg: "#FBEAEA", iconBorder: "#D9B0B0", iconFg: "#4A0303", watermark: "#6C0606" },
  apto:    { iconBg: "#F0FDF4", iconBorder: "#86EFAC", iconFg: "#15803d", watermark: "#15803d" },
  riesgo:  { iconBg: "#FFFBEB", iconBorder: "#FCD34D", iconFg: "#b45309", watermark: "#b45309" },
  no_apto: { iconBg: "#FFF5F5", iconBorder: "#FCA5A5", iconFg: "#DC2626", watermark: "#DC2626" },
  ink:     { iconBg: "#F4F4F5", iconBorder: "#E4E4E7", iconFg: "#3F3F46", watermark: "#52525b" },
};

export type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: Accent;
  watermarkIcon?: LucideIcon;
};

export function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  accent = "gold",
  watermarkIcon: Watermark,
}: StatCardProps) {
  const c = PALETTE[accent];
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: "#ffffff",
        border: "1.5px solid #e4e4e7",
        borderRadius: 20,
        padding: 24,
        minHeight: 168,
        transition: "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: c.iconBg,
          border: `1px solid ${c.iconBorder}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: c.iconFg,
          marginBottom: 18,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Icon size={20} strokeWidth={1.8} />
      </div>

      <div
        style={{
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontWeight: 700,
          fontSize: "0.6875rem",
          color: "#52525b",
          marginBottom: 10,
          position: "relative",
          zIndex: 1,
        }}
      >
        {label}
      </div>

      <div className="num-hero" style={{ position: "relative", zIndex: 1 }}>
        {value}
      </div>

      {subtitle && (
        <div
          style={{
            color: "#71717a",
            fontSize: "0.8125rem",
            fontWeight: 500,
            marginTop: 8,
            position: "relative",
            zIndex: 1,
          }}
        >
          {subtitle}
        </div>
      )}

      {Watermark && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: -8,
            bottom: -12,
            color: c.watermark,
            opacity: 0.08,
            pointerEvents: "none",
            lineHeight: 0,
          }}
        >
          <Watermark size={120} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
