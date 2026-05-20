"use client";

import { INK1, INK5, INK9 } from "@/lib/design-tokens";

interface MetaRowProps {
  label: string;
  value: React.ReactNode;
}

export function MetaRow({ label, value }: MetaRowProps) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12, padding: "9px 14px", borderTop: `1px solid ${INK1}`,
    }}>
      <span style={{ fontSize: "0.75rem", color: INK5, fontWeight: 500 }}>{label}</span>
      <span style={{
        fontSize: "0.8125rem", fontWeight: 600, color: INK9,
        textAlign: "right", wordBreak: "break-word",
      }}>
        {value}
      </span>
    </div>
  );
}
