"use client";

import { useSyncExternalStore } from "react";
import { CalendarDays } from "lucide-react";

export type GreetingHeaderProps = {
  name: string;
  role: string;
};

function greetingFor(hour: number): string {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Cacheamos el Date en memoria del módulo para que `getSnapshot` sea
// idempotente; si retornara `new Date()` cada llamada, React detectaría
// cambio de referencia en cada render y entraría en bucle infinito.
let clientDateCache: Date | null = null;
const EMPTY_UNSUBSCRIBE = () => () => {};
const getClientDate = (): Date => {
  if (clientDateCache === null) clientDateCache = new Date();
  return clientDateCache;
};
const getServerDate = (): Date | null => null;

function useClientDate(): Date | null {
  return useSyncExternalStore(EMPTY_UNSUBSCRIBE, getClientDate, getServerDate);
}

export function GreetingHeader({ name, role }: GreetingHeaderProps) {
  const now = useClientDate();

  const greeting = now ? greetingFor(now.getHours()) : "Buenos días";
  const dateLabel = now
    ? capitalize(
        now.toLocaleDateString("es-PE", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      )
    : "";

  const firstName = name.split(" ")[0] ?? name;

  return (
    <header className="animate-fade-up">
      <p
        style={{
          fontSize: "0.9375rem",
          fontWeight: 500,
          color: "#52525b",
          margin: 0,
          marginBottom: 6,
        }}
      >
        {greeting},
      </p>
      <h1
        style={{
          fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
          fontSize: "clamp(1.75rem, 3vw, 2.25rem)",
          fontWeight: 700,
          color: "#09090b",
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          margin: 0,
        }}
      >
        {firstName}
      </h1>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          marginTop: 14,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#FBEAEA",
            color: "#4A0303",
            border: "1px solid #D9B0B0",
            borderRadius: 999,
            padding: "4px 10px",
            fontSize: "0.6875rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {role}
        </span>
        {dateLabel && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#52525b",
              fontSize: "0.8125rem",
              fontWeight: 500,
            }}
          >
            <CalendarDays size={14} strokeWidth={1.8} />
            {dateLabel}
          </span>
        )}
      </div>
    </header>
  );
}
