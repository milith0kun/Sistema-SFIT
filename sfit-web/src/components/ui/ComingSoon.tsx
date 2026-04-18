"use client";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

interface ComingSoonProps {
  title: string;
  subtitle?: string;
  rf?: string;
}

/**
 * Placeholder para módulos aún no implementados.
 * Renderiza un PageHeader y una Card centrada que indica el requerimiento
 * funcional pendiente.
 */
export function ComingSoon({ title, subtitle, rf }: ComingSoonProps) {
  const defaultSubtitle =
    subtitle ??
    "Este módulo está planificado y se habilitará en una próxima entrega.";

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Próximamente"
        title={title}
        subtitle={defaultSubtitle}
      />

      <div
        className="animate-fade-up delay-100"
        style={{ display: "flex", justifyContent: "center", paddingTop: 24 }}
      >
        <Card
          style={{
            maxWidth: 520,
            width: "100%",
            background: "#fafafa",
            textAlign: "center",
            padding: "2.5rem 2rem",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(184,134,11,0.08)",
              border: "1.5px solid rgba(184,134,11,0.22)",
              marginBottom: 20,
            }}
            aria-hidden
          >
            <ShieldIcon />
          </div>
          <h3
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "1.25rem",
              fontWeight: 800,
              color: "#09090b",
              letterSpacing: "-0.02em",
              margin: 0,
              marginBottom: 8,
            }}
          >
            Módulo en desarrollo{rf ? ` — ${rf}` : ""}
          </h3>
          <p
            style={{
              color: "#52525b",
              fontSize: "0.9375rem",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {defaultSubtitle}
          </p>
        </Card>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#B8860B"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
