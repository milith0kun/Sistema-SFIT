import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404 — Página no encontrada · SFIT",
};

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A1628",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
        padding: "24px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Dot grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
          backgroundSize: "24px 24px",
          pointerEvents: "none",
        }}
      />

      {/* Gold glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "600px",
          background: "radial-gradient(circle, rgba(184,134,11,0.07) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 10, maxWidth: "480px" }}>

        {/* Logo */}
        <div style={{
          width: "64px",
          height: "64px",
          margin: "0 auto 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "16px",
          border: "1.5px solid rgba(184,134,11,0.4)",
          background: "rgba(184,134,11,0.07)",
        }}>
          <img src="/logo.svg" alt="SFIT" width={36} height={36} style={{ objectFit: "contain" }} />
        </div>

        {/* 404 number */}
        <div style={{
          fontSize: "clamp(5rem, 15vw, 8rem)",
          fontWeight: 900,
          color: "#B8860B",
          lineHeight: 1,
          letterSpacing: "-0.06em",
          fontFamily: "var(--font-syne)",
          marginBottom: "8px",
          opacity: 0.9,
        }}>
          404
        </div>

        {/* Divider */}
        <div style={{ width: "40px", height: "2px", background: "#B8860B", borderRadius: "1px", margin: "0 auto 24px" }} />

        {/* Title */}
        <h1 style={{
          color: "#ffffff",
          fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          fontFamily: "var(--font-syne)",
          marginBottom: "12px",
        }}>
          Página no encontrada
        </h1>

        {/* Description */}
        <p style={{
          color: "#71717a",
          fontSize: "1rem",
          lineHeight: 1.65,
          marginBottom: "36px",
          maxWidth: "360px",
          margin: "0 auto 36px",
        }}>
          La página que buscas no existe o fue movida. Verifica la URL o regresa al inicio.
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{
              height: "48px",
              padding: "0 28px",
              borderRadius: "10px",
              background: "linear-gradient(180deg, #D4A827 0%, #B8860B 100%)",
              color: "#09090b",
              fontWeight: 700,
              fontSize: "0.9375rem",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              border: "1px solid #E8D090",
              boxShadow: "0 4px 16px rgba(184,134,11,0.3)",
            }}
          >
            Volver al inicio
          </Link>
          <Link
            href="/login"
            style={{
              height: "48px",
              padding: "0 28px",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.06)",
              color: "#F4F4F5",
              fontWeight: 500,
              fontSize: "0.9375rem",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              border: "1.5px solid rgba(255,255,255,0.18)",
            }}
          >
            Ir al panel
          </Link>
        </div>

        {/* Additional links */}
        <div style={{ marginTop: "32px", display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/consulta-publica" style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8125rem", textDecoration: "none", fontWeight: 500 }}>
            Consulta pública
          </Link>
          <Link href="/privacidad" style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8125rem", textDecoration: "none", fontWeight: 500 }}>
            Privacidad
          </Link>
          <Link href="/terminos" style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8125rem", textDecoration: "none", fontWeight: 500 }}>
            Términos
          </Link>
        </div>
      </div>
    </div>
  );
}
