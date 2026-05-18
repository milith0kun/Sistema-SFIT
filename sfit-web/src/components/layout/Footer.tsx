"use client";

import Link from "next/link";
import { Mail, Shield, FileText, Building2 } from "lucide-react";
import { ACTIVE_MUNICIPALITY_FULL_NAME, ACTIVE_DEPARTMENT_NAME } from "@/lib/scope";

type FooterUser = { role: string; name?: string; email?: string };

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "soporte@sfit.gob.pe";

/**
 * Pie de página común del dashboard. Muestra branding institucional,
 * versión del sistema, enlaces a documentos legales y datos específicos
 * según el rol del usuario.
 *
 * - super_admin: ve el entorno (dev/prod) y versión completa.
 * - admin_municipal: ve la jurisdicción operativa y el correo de soporte.
 * - demás roles: ven la versión mínima (en práctica, sólo se renderiza para
 *   roles web; los móviles no llegan al dashboard).
 */
export function Footer({ user }: { user: FooterUser | null }) {
  const year = new Date().getFullYear();
  const env = process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV ?? "dev";
  const isSuperAdmin = user?.role === "super_admin";
  const isMunicipal = user?.role === "admin_municipal";

  return (
    <footer
      role="contentinfo"
      style={{
        marginTop: 24,
        borderTop: "1px solid #e4e4e7",
        background: "#fff",
        padding: "16px 20px",
        fontSize: "0.75rem",
        color: "#52525b",
        fontFamily: "var(--font-inter), Inter, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {/* Branding + jurisdicción */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <div
            aria-hidden
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: "#FBEAEA",
              color: "#6C0606",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "0.8125rem",
              letterSpacing: "0.04em",
              flexShrink: 0,
            }}
          >
            SFIT
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: "#18181b", fontSize: "0.8125rem" }}>
              Sistema de Fiscalización Integrado de Transporte
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 3,
                color: "#52525b",
              }}
            >
              <Building2 size={11} strokeWidth={1.8} />
              <span>{ACTIVE_MUNICIPALITY_FULL_NAME} · {ACTIVE_DEPARTMENT_NAME}, Perú</span>
            </div>
          </div>
        </div>

        {/* Centro: enlaces legales / soporte */}
        <nav aria-label="Enlaces del sistema" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <Link
            href="/privacidad"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#52525b", textDecoration: "none", fontWeight: 600 }}
          >
            <Shield size={12} strokeWidth={1.8} />
            Privacidad
          </Link>
          <Link
            href="/terminos"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#52525b", textDecoration: "none", fontWeight: 600 }}
          >
            <FileText size={12} strokeWidth={1.8} />
            Términos
          </Link>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#52525b", textDecoration: "none", fontWeight: 600 }}
          >
            <Mail size={12} strokeWidth={1.8} />
            Soporte
          </a>
        </nav>

        {/* Derecha: versión + metadata por rol */}
        <div style={{ textAlign: "right", color: "#71717a", fontVariantNumeric: "tabular-nums" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
            <span>© {year} SFIT</span>
            <span aria-hidden style={{ color: "#d4d4d8" }}>·</span>
            <span>v{APP_VERSION}</span>
            {isSuperAdmin && (
              <>
                <span aria-hidden style={{ color: "#d4d4d8" }}>·</span>
                <span
                  style={{
                    padding: "1px 7px",
                    borderRadius: 4,
                    background: env === "production" ? "#F0FDF4" : "#FFFBEB",
                    color: env === "production" ? "#15803D" : "#B45309",
                    border: `1px solid ${env === "production" ? "#86EFAC" : "#FDE68A"}`,
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {env}
                </span>
              </>
            )}
          </div>
          {isMunicipal && (
            <div style={{ marginTop: 3, fontSize: "0.6875rem" }}>
              Soporte técnico: <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#52525b", fontWeight: 600 }}>{SUPPORT_EMAIL}</a>
            </div>
          )}
          {isSuperAdmin && user?.email && (
            <div style={{ marginTop: 3, fontSize: "0.6875rem" }}>
              Sesión: <span style={{ fontFamily: "ui-monospace, monospace", color: "#52525b" }}>{user.email}</span>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
