"use client";

import Link from "next/link";
import { Smartphone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.sfit.sfit_app";

export function MobileOnlyScreen() {
  return (
    <div
      style={{
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-paper, #fafafa)",
        padding: "24px",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      <div
        role="status"
        aria-live="polite"
        style={{
          maxWidth: 480,
          width: "100%",
          background: "#ffffff",
          border: "1px solid var(--color-ink-2, #e4e4e7)",
          borderRadius: 16,
          padding: "40px 32px",
          boxShadow:
            "0 1px 2px rgba(9, 9, 11, 0.04), 0 8px 24px rgba(9, 9, 11, 0.06)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            margin: "0 auto 24px",
            borderRadius: 18,
            background: "var(--color-primary-bg, #FBEAEA)",
            border: "1px solid var(--color-primary-border, #D9B0B0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-primary, #6C0606)",
          }}
        >
          <Smartphone size={36} strokeWidth={1.75} aria-hidden />
        </div>

        <h1
          style={{
            margin: "0 0 12px",
            fontSize: "1.5rem",
            fontWeight: 700,
            letterSpacing: "-0.015em",
            color: "var(--color-ink-9, #18181b)",
          }}
        >
          SFIT funciona en tu celular
        </h1>

        <p
          style={{
            margin: "0 0 28px",
            fontSize: "0.9375rem",
            lineHeight: 1.55,
            color: "var(--color-ink-6, #52525b)",
          }}
        >
          Tu cuenta opera desde la app móvil. Inicia sesión ahí para ver tu
          dashboard, viajes y notificaciones.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 28,
          }}
        >
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            <Button variant="primary" size="md" type="button">
              Descargar para Android
            </Button>
          </a>

          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            aria-disabled
            title="Próximamente"
            style={{ textDecoration: "none" }}
          >
            <Button variant="outline" size="md" type="button">
              Descargar para iOS
            </Button>
          </a>
        </div>

        <div
          style={{
            paddingTop: 20,
            borderTop: "1px solid var(--color-ink-2, #e4e4e7)",
            fontSize: "0.875rem",
            color: "var(--color-ink-6, #52525b)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <span>¿Necesitas ver tu perfil?</span>
          <Link
            href="/perfil"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: "var(--color-primary, #6C0606)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <UserRound size={14} aria-hidden />
            Ir a perfil
          </Link>
        </div>
      </div>
    </div>
  );
}

export default MobileOnlyScreen;
