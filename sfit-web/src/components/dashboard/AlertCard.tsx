"use client";

import { TriangleAlert, X } from "lucide-react";

export interface AlertItem {
  id: string;
  mensaje: string;
  hora: string;
}

export interface AlertCardProps {
  alerts: AlertItem[];
  title?: string;
  onClose?: () => void;
  tone?: "danger" | "warning";
}

/**
 * Card de alertas con tono rojo/ámbar, lista de mensajes y hora.
 * Extraído del `AlertsCard` de `/flota`.
 */
export function AlertCard({
  alerts,
  title = "Alertas activas",
  onClose,
  tone = "danger",
}: AlertCardProps) {
  const t =
    tone === "warning"
      ? { bg: "#FFFBEB", border: "#FDE68A", text: "#854D0E", icon: "#B45309", item: "rgba(253,230,138,0.5)" }
      : { bg: "#FEF2F2", border: "#FCA5A5", text: "#991B1B", icon: "#DC2626", item: "rgba(252,165,165,0.5)" };

  return (
    <div
      className="animate-fade-up"
      style={{
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <TriangleAlert size={16} strokeWidth={1.8} color={t.icon} />
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: t.text }}>
          {title}
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: t.text,
              cursor: "pointer",
              display: "inline-flex",
            }}
            aria-label="Cerrar alertas"
            type="button"
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        )}
      </div>
      {alerts.length === 0 ? (
        <div style={{ fontSize: 12, color: t.text, opacity: 0.7 }}>
          Sin alertas activas.
        </div>
      ) : (
        alerts.map((a) => (
          <div
            key={a.id}
            style={{
              padding: "8px 10px",
              marginBottom: 6,
              borderRadius: 8,
              background: "#fff",
              border: `1px solid ${t.item}`,
              fontSize: 12,
            }}
          >
            <div style={{ color: "#27272a", lineHeight: 1.45 }}>{a.mensaje}</div>
            <div style={{ color: "#a1a1aa", fontSize: 10.5, marginTop: 3 }}>
              {a.hora}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
