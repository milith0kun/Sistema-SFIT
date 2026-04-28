import type { ReactNode } from "react";

interface PageHeaderProps {
  kicker?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ kicker, title, subtitle, action }: PageHeaderProps) {
  return (
    <div
      className="animate-fade-up sfit-page-header"
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        paddingBottom: 18,
        borderBottom: "1.5px solid #e4e4e7",
        marginBottom: 4,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0, flex: "1 1 280px" }}>
        {kicker && (
          <div style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: "#6C0606",
            textTransform: "uppercase",
            marginBottom: 5,
          }}>
            {kicker}
          </div>
        )}
        <h1 style={{
          fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
          fontSize: "1.375rem",
          fontWeight: 800,
          color: "#09090b",
          letterSpacing: "-0.025em",
          lineHeight: 1.15,
          margin: 0,
        }}>
          {title}
        </h1>
        {subtitle && (
          <div style={{
            fontSize: "0.875rem",
            color: "#71717a",
            marginTop: 5,
            lineHeight: 1.45,
          }}>
            {subtitle}
          </div>
        )}
      </div>

      {action && (
        <div style={{ flexShrink: 0, paddingBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
          {action}
        </div>
      )}
    </div>
  );
}
