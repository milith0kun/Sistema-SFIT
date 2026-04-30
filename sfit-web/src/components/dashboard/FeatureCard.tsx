"use client";

import Link from "next/link";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";

export type FeatureCardProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
};

export function FeatureCard({
  icon: Icon,
  title,
  subtitle,
  href,
  badge,
}: FeatureCardProps) {
  const [hover, setHover] = useState(false);

  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "block",
        background: hover ? "#FDFAF2" : "#ffffff",
        border: `1.5px solid ${hover ? "#D9B0B0" : "#e4e4e7"}`,
        borderRadius: 12,
        padding: "14px 16px",
        minHeight: 88,
        textDecoration: "none",
        transition:
          "border-color 180ms ease, background 180ms ease, box-shadow 180ms ease, transform 180ms ease",
        boxShadow: hover
          ? "0 6px 18px rgba(108, 6, 6, 0.08)"
          : "0 0 0 rgba(0,0,0,0)",
        transform: hover ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      {badge && (
        <span
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "#FBEAEA",
            color: "#4A0303",
            border: "1px solid #D9B0B0",
            borderRadius: 999,
            minWidth: 22,
            height: 22,
            padding: "0 7px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.02em",
            lineHeight: 1,
            zIndex: 2,
          }}
        >
          {badge}
        </span>
      )}

      <div
        style={{
          fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "#09090b",
          letterSpacing: "-0.005em",
          lineHeight: 1.3,
          marginBottom: 6,
          position: "relative",
          zIndex: 1,
          paddingRight: badge ? 64 : 0,
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: "#71717a",
          fontSize: "0.8125rem",
          lineHeight: 1.5,
          fontWeight: 500,
          position: "relative",
          zIndex: 1,
        }}
      >
        {subtitle}
      </div>

      {/* Ícono watermark — paleta institucional unificada con la card de acción principal */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: -10,
          bottom: -14,
          color: "#6C0606",
          opacity: hover ? 0.16 : 0.09,
          pointerEvents: "none",
          lineHeight: 0,
          transition: "opacity 180ms ease",
        }}
      >
        <Icon size={92} strokeWidth={1.5} absoluteStrokeWidth />
      </div>
    </Link>
  );
}
