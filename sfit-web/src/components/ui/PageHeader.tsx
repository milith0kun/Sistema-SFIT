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
      className="animate-fade-up"
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        {kicker && <p className="kicker" style={{ marginBottom: 12 }}>{kicker}</p>}
        <h1
          style={{
            fontFamily: "var(--font-inter)",
            fontSize: "2.5rem",
            fontWeight: 900,
            color: "#09090b",
            lineHeight: 0.95,
            letterSpacing: "-0.035em",
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              marginTop: 12,
              color: "#52525b",
              fontSize: "1.0625rem",
              lineHeight: 1.55,
              maxWidth: 720,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ flex: "0 0 auto" }}>{action}</div>}
    </div>
  );
}
