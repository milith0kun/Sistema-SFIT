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
        border: `1.5px solid ${hover ? "#E8D090" : "#e4e4e7"}`,
        borderRadius: 12,
        padding: "14px 16px",
        minHeight: 88,
        textDecoration: "none",
        transition:
          "border-color 180ms ease, background 180ms ease, box-shadow 180ms ease, transform 180ms ease",
        boxShadow: hover
          ? "0 6px 18px rgba(184, 134, 11, 0.08)"
          : "0 0 0 rgba(0,0,0,0)",
        transform: hover ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      {badge && (
        <span
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "#FDF8EC",
            color: "#926A09",
            border: "1px solid #E8D090",
            borderRadius: 999,
            padding: "3px 9px",
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
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

      {/* Ícono watermark — grande para llenar el card, overflow:hidden lo adapta */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: -12,
          bottom: -12,
          color: hover ? "#B8860B" : "#C8971A",
          opacity: hover ? 0.28 : 0.16,
          pointerEvents: "none",
          lineHeight: 0,
          transition: "opacity 180ms ease, color 180ms ease",
        }}
      >
        <Icon size={88} strokeWidth={1.2} />
      </div>
    </Link>
  );
}
