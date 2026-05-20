"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { INK1, INK2, INK5, INK6, INK9, GRN } from "@/lib/design-tokens";

interface KeyValueRowProps {
  k: string;
  v: string;
  mono?: boolean;
}

export function KeyValueRow({ k, v, mono }: KeyValueRowProps) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      gap: 8, padding: "6px 0",
    }}>
      <span style={{ fontSize: "0.75rem", color: INK5, fontWeight: 500, flexShrink: 0 }}>{k}</span>
      <span style={{
        fontSize: "0.8125rem", fontWeight: 600, color: INK9,
        textAlign: "right", wordBreak: "break-word",
        fontFamily: mono ? "ui-monospace, monospace" : undefined,
      }}>
        {v || "—"}
      </span>
    </div>
  );
}

interface SystemIdRowProps {
  id: string;
}

export function SystemIdRow({ id }: SystemIdRowProps) {
  const [copied, setCopied] = useState(false);
  const shortId = id.slice(-8).toUpperCase();
  return (
    <div>
      <div style={{ fontSize: "0.6875rem", color: INK5, marginBottom: 4 }}>ID del sistema</div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
        background: INK1, padding: "6px 10px", borderRadius: 7,
      }}>
        <code title={id} style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: "0.75rem", color: INK9, fontWeight: 600,
          letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums",
        }}>
          {shortId}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(id);
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            } catch { /* clipboard blocked */ }
          }}
          title="Copiar ID completo"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            height: 24, padding: "0 8px", borderRadius: 6,
            border: `1px solid ${INK2}`, background: "#fff", color: INK6,
            fontSize: "0.6875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {copied ? <Check size={11} color={GRN} /> : <Copy size={11} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
