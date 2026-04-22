"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

/* ── Design tokens ── */
const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const GOLD = "#B8860B"; const GOLDDARK = "#926A09"; const GOLDBG = "#FDF8EC"; const GOLDBORDER = "#E8D090";
const RED  = "#b91c1c"; const REDBG   = "#FFF5F5"; const REDBD   = "#FCA5A5";
const GRN  = "#15803d"; const GRNBG   = "#F0FDF4"; const GRNBD   = "#86EFAC";

const FIELD: React.CSSProperties = {
  width: "100%", height: 46, padding: "0 14px", borderRadius: 10,
  border: `1.5px solid ${INK2}`, fontSize: "0.9375rem",
  color: INK9, fontFamily: "inherit", outline: "none",
  background: "#fff", transition: "border-color 0.15s", boxSizing: "border-box",
};

/* ── Formulario de email ── */
function RequestForm() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) { setError("Correo inválido"); return; }
    setError(null); setLoading(true);
    try {
      await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      setSent(true);
    } catch { setError("Error de conexión. Intenta nuevamente."); }
    finally { setLoading(false); }
  }

  if (sent) return (
    <div className="text-center animate-fade-up">
      <div className="mx-auto mb-6 w-14 h-14 rounded-full flex items-center justify-center"
        style={{ background: GOLDBG, border: `1.5px solid ${GOLDBORDER}` }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      </div>
      <h2 className="font-extrabold mb-3" style={{ fontFamily: "var(--font-syne)", fontSize: "1.75rem", lineHeight: 1.1, color: INK9 }}>
        Revisa tu correo
      </h2>
      <p className="mb-8 leading-relaxed max-w-[300px] mx-auto" style={{ fontSize: "15px", color: INK6 }}>
        Si existe una cuenta con ese correo, recibirás un enlace de recuperación en los próximos minutos.
      </p>
      <p style={{ fontSize: "13px", color: "#A1A1AA" }}>
        ¿No llegó?{" "}
        <button onClick={() => setSent(false)} className="font-semibold transition-colors" style={{ color: GOLD }}>
          Reintentar
        </button>
      </p>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-10">
        <p className="kicker animate-fade-up">Recuperar acceso</p>
        <h1 className="mt-5 font-black animate-fade-up delay-50"
          style={{ fontFamily: "var(--font-syne)", fontSize: "2.5rem", lineHeight: 0.95, letterSpacing: "-0.035em", color: INK9 }}>
          ¿Olvidaste tu<br/>contraseña?
        </h1>
        <p className="mt-4 animate-fade-up delay-100" style={{ color: INK6, fontSize: "1.0625rem", lineHeight: 1.55 }}>
          Ingresa tu correo y te enviaremos un enlace de recuperación.
        </p>
        <p className="mt-3 animate-fade-up delay-150" style={{ color: INK5, fontSize: "0.875rem", fontWeight: 500 }}>
          No aplica para cuentas de Google.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg p-3.5 animate-fade-up" style={{ background: REDBG, border: `1.5px solid ${REDBD}` }}>
          <p style={{ fontSize: "14px", color: RED }}>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-5 animate-fade-up delay-150">
          <label htmlFor="email" className="block font-semibold mb-2" style={{ fontSize: "15px", color: INK9 }}>
            Correo electrónico
          </label>
          <input
            id="email" type="email" value={email}
            onChange={e => { setEmail(e.target.value); setError(null); }}
            placeholder="nombre@municipalidad.gob.pe"
            style={FIELD}
            onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
            onBlur={e  => { e.currentTarget.style.borderColor = INK2; }}
            required
          />
        </div>
        <div className="animate-fade-up delay-200">
          <button type="submit" disabled={loading} className="btn-primary w-full">
            <span className="shine" aria-hidden/>
            {loading ? (<><span className="spinner"/><span>Enviando…</span></>) : "Enviar enlace de recuperación"}
          </button>
        </div>
      </form>

      <p className="mt-7 text-center animate-fade-up delay-300" style={{ fontSize: "14px", color: INK6 }}>
        <Link href="/login" className="font-semibold transition-colors"
          style={{ color: GOLD }}
          onMouseEnter={e => (e.currentTarget.style.color = GOLDDARK)}
          onMouseLeave={e => (e.currentTarget.style.color = GOLD)}>
          ← Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}

/* ── Formulario de nueva contraseña ── */
function ConfirmForm({ token }: { token: string }) {
  const [newPass,     setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [done,        setDone]        = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPass.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (newPass !== confirmPass) { setError("Las contraseñas no coinciden."); return; }
    setError(null); setLoading(true);
    try {
      const res  = await fetch("/api/auth/reset-password/confirm", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, newPassword: newPass }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (!res.ok || !data.success) { setError(data.error ?? "Error al restablecer."); return; }
      setDone(true);
    } catch { setError("Error de conexión. Intenta nuevamente."); }
    finally { setLoading(false); }
  }

  if (done) return (
    <div className="text-center animate-fade-up">
      <div className="mx-auto mb-6 w-14 h-14 rounded-full flex items-center justify-center"
        style={{ background: GRNBG, border: `1.5px solid ${GRNBD}` }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <h2 className="font-extrabold mb-3" style={{ fontFamily: "var(--font-syne)", fontSize: "1.75rem", lineHeight: 1.1, color: INK9 }}>
        Contraseña actualizada
      </h2>
      <p className="mb-8 leading-relaxed max-w-[300px] mx-auto" style={{ fontSize: "15px", color: INK6 }}>
        Tu contraseña fue restablecida correctamente. Ya puedes iniciar sesión.
      </p>
      <Link href="/login">
        <button className="btn-primary">
          <span className="shine" aria-hidden/>
          Ir al inicio de sesión
        </button>
      </Link>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-10">
        <p className="kicker animate-fade-up">Recuperar acceso</p>
        <h1 className="mt-5 font-black animate-fade-up delay-50"
          style={{ fontFamily: "var(--font-syne)", fontSize: "2.5rem", lineHeight: 0.95, letterSpacing: "-0.035em", color: INK9 }}>
          Nueva<br/>contraseña
        </h1>
        <p className="mt-4 animate-fade-up delay-100" style={{ color: INK6, fontSize: "1.0625rem", lineHeight: 1.55 }}>
          Elige una contraseña segura de al menos 8 caracteres.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg p-3.5 animate-fade-up" style={{ background: REDBG, border: `1.5px solid ${REDBD}` }}>
          <p style={{ fontSize: "14px", color: RED }}>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-4 animate-fade-up delay-100">
          <label className="block font-semibold mb-2" style={{ fontSize: "15px", color: INK9 }}>
            Nueva contraseña <span style={{ color: RED }}>*</span>
          </label>
          <input
            type={showPass ? "text" : "password"}
            value={newPass} onChange={e => setNewPass(e.target.value)}
            placeholder="Mínimo 8 caracteres" style={FIELD}
            onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
            onBlur={e  => { e.currentTarget.style.borderColor = INK2; }}
            required
          />
        </div>
        <div className="mb-4 animate-fade-up delay-150">
          <label className="block font-semibold mb-2" style={{ fontSize: "15px", color: INK9 }}>
            Confirmar contraseña <span style={{ color: RED }}>*</span>
          </label>
          <input
            type={showPass ? "text" : "password"}
            value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
            placeholder="Repite la contraseña" style={FIELD}
            onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
            onBlur={e  => { e.currentTarget.style.borderColor = INK2; }}
            required
          />
        </div>
        <div className="mb-6 animate-fade-up delay-150">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "13px", color: INK5, cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={showPass} onChange={e => setShowPass(e.target.checked)} style={{ width: 14, height: 14 }}/>
            Mostrar contraseñas
          </label>
        </div>
        <div className="animate-fade-up delay-200">
          <button type="submit" disabled={loading} className="btn-primary w-full">
            <span className="shine" aria-hidden/>
            {loading ? (<><span className="spinner"/><span>Restableciendo…</span></>) : "Restablecer contraseña"}
          </button>
        </div>
      </form>

      <p className="mt-7 text-center animate-fade-up delay-300" style={{ fontSize: "14px", color: INK6 }}>
        <Link href="/login" className="font-semibold transition-colors"
          style={{ color: GOLD }}
          onMouseEnter={e => (e.currentTarget.style.color = GOLDDARK)}
          onMouseLeave={e => (e.currentTarget.style.color = GOLD)}>
          ← Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}

/* ── Inner component that reads search params ── */
function ResetPasswordInner() {
  const params = useSearchParams();
  const token  = params.get("token");
  return token ? <ConfirmForm token={token}/> : <RequestForm/>;
}

/* ── Page export ── */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<RequestForm/>}>
      <ResetPasswordInner/>
    </Suspense>
  );
}
