"use client";

import { Clock } from "lucide-react";

export type EventType = "salida" | "alerta" | "retorno" | "sistema" | "info";

export interface EventLogItem {
  id: string;
  hora: string;
  tipo: EventType;
  texto: string;
}

export interface EventsLogProps {
  events: EventLogItem[];
  title?: string;
  maxHeight?: number;
}

/**
 * Log cronológico con dots de color por tipo, texto y hora tabular.
 * Extraído del `EventsLog` de `/flota`.
 */
export function EventsLog({
  events,
  title = "Actividad del día",
  maxHeight = 260,
}: EventsLogProps) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e4e4e7",
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid #f4f4f5",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Clock size={14} strokeWidth={1.8} color="#09090b" />
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#09090b" }}>
          {title}
        </h3>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10.5,
            color: "#71717a",
            fontWeight: 600,
          }}
        >
          {events.length} eventos
        </span>
      </div>
      <div style={{ maxHeight, overflowY: "auto" }}>
        {events.length === 0 && (
          <div
            style={{
              padding: "24px 14px",
              textAlign: "center",
              color: "#a1a1aa",
              fontSize: 12,
            }}
          >
            Sin eventos registrados
          </div>
        )}
        {events.map((e, i) => {
          const color =
            e.tipo === "salida"
              ? "#15803d"
              : e.tipo === "alerta"
                ? "#DC2626"
                : e.tipo === "retorno"
                  ? "#6C0606"
                  : e.tipo === "info"
                    ? "#1D4ED8"
                    : "#71717a";
          return (
            <div
              key={e.id}
              style={{
                padding: "10px 14px",
                borderBottom: i === events.length - 1 ? "none" : "1px solid #f4f4f5",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: color,
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, color: "#27272a", lineHeight: 1.45 }}>
                  {e.texto}
                </div>
              </div>
              <div
                className="num"
                style={{
                  fontSize: 10.5,
                  color: "#a1a1aa",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {e.hora}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
