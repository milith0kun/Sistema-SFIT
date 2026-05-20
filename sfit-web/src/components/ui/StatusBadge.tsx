"use client";

export interface StatusMeta {
  label: string;
  color: string;
  bg: string;
  bd: string;
}

interface StatusBadgeProps {
  status: string;
  statusMap: Record<string, StatusMeta>;
  fallback?: string;
}

export function StatusBadge({ status, statusMap, fallback = "pendiente" }: StatusBadgeProps) {
  const m = statusMap[status] ?? statusMap[fallback] ?? {
    label: status,
    color: "#52525b",
    bg: "#f4f4f5",
    bd: "#e4e4e7",
  };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 6,
      fontSize: "0.6875rem", fontWeight: 700,
      background: m.bg, color: m.color, border: `1px solid ${m.bd}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}
