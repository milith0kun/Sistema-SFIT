import type { ReactNode } from "react";

interface PageHeaderProps {
  kicker?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

/**
 * Encabezado compacto de página interior — mismo estilo navy que DashboardHero.
 * Reemplaza el h1 de 2.5rem por un título de 20px consistente con el sistema.
 */
export function PageHeader({ kicker, title, subtitle, action }: PageHeaderProps) {
  return (
    <div
      className="animate-fade-up"
      style={{
        background: "linear-gradient(100deg, #0A1628 0%, #111F38 55%, #1A2D4A 100%)",
        borderRadius: 12,
        padding: "14px 18px",
        position: "relative",
        overflow: "hidden",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      {/* Dot pattern */}
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
      {/* Gold glow */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 180,
          height: 180,
          background: "radial-gradient(circle, rgba(184,134,11,0.18) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ minWidth: 0, position: "relative", flex: 1 }}>
        {kicker && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "#D4A827",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {kicker}
          </div>
        )}
        <h1
          style={{
            fontFamily: "var(--font-syne), Syne, system-ui, sans-serif",
            fontSize: 20,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.65)",
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {action && (
        <div style={{ position: "relative", flexShrink: 0 }}>{action}</div>
      )}
    </div>
  );
}
