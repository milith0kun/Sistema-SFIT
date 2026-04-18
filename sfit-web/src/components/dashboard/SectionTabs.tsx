"use client";

export type SectionTab = { key: string; label: string };

export type SectionTabsProps = {
  tabs: SectionTab[];
  value: string;
  onChange: (key: string) => void;
};

export function SectionTabs({ tabs, value, onChange }: SectionTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Secciones"
      style={{
        display: "inline-flex",
        background: "#f4f4f5",
        padding: 4,
        borderRadius: 12,
        gap: 2,
        border: "1px solid #e4e4e7",
      }}
    >
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "8px 14px",
              borderRadius: 8,
              background: active ? "#ffffff" : "transparent",
              color: active ? "#09090b" : "#52525b",
              fontSize: "0.9375rem",
              fontWeight: 600,
              letterSpacing: "-0.005em",
              fontFamily: "var(--font-inter), Inter, sans-serif",
              boxShadow: active
                ? "0 1px 2px rgba(9, 9, 11, 0.06), 0 0 0 1px rgba(9, 9, 11, 0.04)"
                : "none",
              transition: "background 150ms ease, color 150ms ease, box-shadow 150ms ease",
              outlineOffset: 2,
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = "#09090b";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = "#52525b";
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
