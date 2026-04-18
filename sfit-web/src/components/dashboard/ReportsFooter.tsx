"use client";

import { Download, type LucideIcon } from "lucide-react";

export interface ReportItem {
  title: string;
  desc: string;
  rf: string;
  icon: LucideIcon;
  accent: string;
  onClick?: () => void;
}

export interface ReportsFooterProps {
  title?: string;
  reports: ReportItem[];
}

/**
 * Grilla de 4 tarjetas de reportes operacionales con ícono en color
 * accent, título, descripción, código RF y flechita download.
 * Extraído del `ReportesFooter` de `/flota`.
 */
export function ReportsFooter({
  title = "Reportes operacionales",
  reports,
}: ReportsFooterProps) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span
          aria-hidden
          style={{ width: 3, height: 14, background: "#0A1628", borderRadius: 2 }}
        />
        <h3
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#09090b",
          }}
        >
          {title}
        </h3>
        <div aria-hidden style={{ flex: 1, height: 1, background: "#e4e4e7" }} />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {reports.map((r) => (
          <div
            key={r.rf}
            onClick={r.onClick}
            role={r.onClick ? "button" : undefined}
            tabIndex={r.onClick ? 0 : undefined}
            onKeyDown={(e) => {
              if (r.onClick && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                r.onClick();
              }
            }}
            style={{
              background: "#fff",
              border: "1px solid #e4e4e7",
              borderRadius: 10,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              cursor: r.onClick ? "pointer" : "default",
              transition: "all 180ms",
              minHeight: 130,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = r.accent;
              e.currentTarget.style.boxShadow = `0 4px 16px ${r.accent}15`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e4e4e7";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `${r.accent}15`,
                color: r.accent,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <r.icon size={16} strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#09090b", lineHeight: 1.2 }}>
              {r.title}
            </div>
            <div style={{ fontSize: 11.5, color: "#71717a", lineHeight: 1.4, flex: 1 }}>
              {r.desc}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#a1a1aa",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {r.rf}
              <span style={{ color: r.accent, display: "inline-flex" }}>
                <Download size={14} strokeWidth={1.8} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
