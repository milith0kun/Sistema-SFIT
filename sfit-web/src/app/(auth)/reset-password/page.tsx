"use client";

import { useState } from "react";
import Link from "next/link";

/** RF-01-09: Recuperación de contraseña por correo. */
export default function ResetPasswordPage() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) { setError("Correo inválido"); return; }
    setError(null);
    setLoading(true);
    try {
      await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Siempre mostramos éxito para no revelar si el email existe
      setSent(true);
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center animate-fade-up">
        <div
          className="mx-auto mb-6 w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "#FDF8EC", border: "1.5px solid #E8D090" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B8860B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h2
          className="font-extrabold text-[#09090b] mb-3"
          style={{ fontFamily: "var(--font-syne)", fontSize: "1.75rem", lineHeight: 1.1 }}
        >
          Revisa tu correo
        </h2>
        <p className="text-[15px] text-[#52525b] mb-8 leading-relaxed max-w-[300px] mx-auto">
          Si existe una cuenta con ese correo, recibirás un enlace de recuperación en los próximos minutos.
        </p>
        <p className="text-[13px] text-[#A1A1AA]">
          ¿No llegó?{" "}
          <button
            onClick={() => setSent(false)}
            className="font-semibold transition-colors"
            style={{ color: "#B8860B" }}
          >
            Reintentar
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <p className="kicker animate-fade-up">
          Recuperar acceso
        </p>
        <h1
          className="mt-5 font-black text-[#09090b] animate-fade-up delay-50"
          style={{
            fontFamily: "var(--font-syne)",
            fontSize: "2.5rem",
            lineHeight: 0.95,
            letterSpacing: "-0.035em",
          }}
        >
          ¿Olvidaste tu<br />contraseña?
        </h1>
        <p
          className="mt-4 animate-fade-up delay-100"
          style={{
            color: "#52525b",
            fontSize: "1.0625rem",
            lineHeight: 1.55,
            fontWeight: 400,
          }}
        >
          Ingresa tu correo y te enviaremos un enlace de recuperación.
        </p>
        <p
          className="mt-3 animate-fade-up delay-150"
          style={{ color: "#71717A", fontSize: "0.875rem", fontWeight: 500 }}
        >
          No aplica para cuentas de Google.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mb-5 flex items-start gap-2.5 rounded-lg p-3.5 animate-fade-up"
          style={{ background: "#FFF5F5", border: "1.5px solid #FCA5A5" }}
        >
          <p className="text-[14px] text-[#DC2626] leading-snug">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-5 animate-fade-up delay-150">
          <label htmlFor="email" className="block text-[15px] font-semibold text-[#09090b] mb-2">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="nombre@municipalidad.gob.pe"
            className="field"
            required
          />
        </div>

        <div className="animate-fade-up delay-200">
          <button type="submit" disabled={loading} className="btn-primary w-full">
            <span className="shine" aria-hidden />
            {loading ? (
              <>
                <span className="spinner" />
                <span>Enviando…</span>
              </>
            ) : (
              "Enviar enlace de recuperación"
            )}
          </button>
        </div>
      </form>

      <p className="mt-7 text-center text-[14px] text-[#52525B] animate-fade-up delay-300">
        <Link
          href="/login"
          className="font-semibold transition-colors"
          style={{ color: "#B8860B" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#926A09")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#B8860B")}
        >
          ← Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
