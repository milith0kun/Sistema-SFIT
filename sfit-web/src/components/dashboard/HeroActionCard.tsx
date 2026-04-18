"use client";

import Link from "next/link";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

type Accent = "gold" | "navy";

export type HeroActionCardProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  href: string;
  accent?: Accent;
};

export function HeroActionCard({
  icon: Icon,
  title,
  subtitle,
  href,
  accent = "gold",
}: HeroActionCardProps) {
  const [hover, setHover] = useState(false);

  const bg = accent === "gold" ? "#B8860B" : "#0A1628";
  const bgHover = accent === "gold" ? "#926A09" : "#111F38";

  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: 24,
        padding: 28,
        borderRadius: 20,
        background: hover ? bgHover : bg,
        color: "#ffffff",
        textDecoration: "none",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hover
          ? "0 16px 32px rgba(10, 22, 40, 0.18)"
          : "0 4px 12px rgba(10, 22, 40, 0.06)",
        transition:
          "background 180ms ease, transform 180ms ease, box-shadow 180ms ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ minWidth: 0, position: "relative", zIndex: 1 }}>
        <h3
          style={{
            fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
            fontSize: "1.375rem",
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.015em",
            lineHeight: 1.2,
            margin: 0,
            marginBottom: 6,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: "0.9375rem",
            lineHeight: 1.45,
            margin: 0,
            color: "rgba(255, 255, 255, 0.82)",
            fontWeight: 500,
          }}
        >
          {subtitle}
        </p>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 14,
            fontSize: "0.8125rem",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.92)",
          }}
        >
          Abrir módulo
          <ArrowUpRight size={14} strokeWidth={2.2} />
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: "relative",
          zIndex: 1,
          color: "#ffffff",
          opacity: 0.22,
          lineHeight: 0,
        }}
      >
        <Icon size={80} strokeWidth={1.6} />
      </div>
    </Link>
  );
}
