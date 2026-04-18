"use client";

import type { ReactNode } from "react";

export interface GroupedSectionProps {
  color: string;
  title: string;
  count: number;
  children: ReactNode;
}

/**
 * Header de grupo con barra vertical de color + título uppercase
 * + count pill + línea divisoria horizontal. Réplica del patrón
 * usado en `FleetGrid` de `/flota`.
 */
export function GroupedSection({ color, title, count, children }: GroupedSectionProps) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 3,
            height: 14,
            background: color,
            borderRadius: 2,
          }}
        />
        <h3
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#09090b",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          {title}
        </h3>
        <span
          style={{
            fontSize: 11,
            color: "#71717a",
            fontWeight: 600,
            padding: "1px 8px",
            background: "#F4F4F5",
            borderRadius: 999,
          }}
        >
          {count}
        </span>
        <div
          aria-hidden
          style={{ flex: 1, height: 1, background: "#e4e4e7" }}
        />
      </div>
      {children}
    </div>
  );
}
