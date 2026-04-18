import type { ReactNode, CSSProperties } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  cta?: ReactNode;
}

export function EmptyState({ icon, title, subtitle, cta }: EmptyStateProps) {
  const wrapper: CSSProperties = {
    background: "#ffffff",
    border: "1.5px dashed #e4e4e7",
    borderRadius: 16,
    padding: "48px 24px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  };

  return (
    <div style={wrapper}>
      {icon && (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "#f4f4f5",
            color: "#52525b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
      )}
      <h3
        style={{
          fontFamily: "var(--font-inter)",
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "#09090b",
          letterSpacing: "-0.02em",
          margin: 0,
        }}
      >
        {title}
      </h3>
      {subtitle && (
        <p
          style={{
            color: "#52525b",
            fontSize: "0.9375rem",
            lineHeight: 1.55,
            maxWidth: 420,
            margin: 0,
          }}
        >
          {subtitle}
        </p>
      )}
      {cta && <div style={{ marginTop: 8 }}>{cta}</div>}
    </div>
  );
}
