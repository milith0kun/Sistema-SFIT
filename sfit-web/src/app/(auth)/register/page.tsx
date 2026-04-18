"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ROLES = [
  { value: "ciudadano", label: "Ciudadano",           desc: "Reportar anomalías y consultar estado de vehículos" },
  { value: "conductor", label: "Conductor",           desc: "Ver rutas asignadas, viajes y estado de fatiga" },
  { value: "fiscal",    label: "Fiscal / Inspector",  desc: "Realizar inspecciones y emitir actas" },
  { value: "operador",  label: "Operador de Empresa", desc: "Gestionar flota, salidas y conductores" },
] as const;

type Step = "datos" | "rol" | "exito";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep]             = useState<Step>("datos");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", password: "", municipalityId: "", requestedRole: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setFieldErrors((p) => ({ ...p, [e.target.name]: "" }));
  }

  function validateDatos() {
    const errs: Record<string, string> = {};
    if (!form.name.trim() || form.name.length < 2) errs.name     = "Ingresa tu nombre completo";
    if (!form.email.includes("@"))                  errs.email    = "Correo inválido";
    if (form.password.length < 8)                   errs.password = "Mínimo 8 caracteres";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!form.requestedRole) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/auth/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, msgs] of Object.entries(data.errors))
            mapped[k] = (msgs as string[])[0];
          setFieldErrors(mapped);
          setStep("datos");
        } else {
          setError(data.error ?? "Error al registrarse");
        }
        return;
      }
      setStep("exito");
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  /* ── Success screen ── */
  if (step === "exito") {
    return (
      <div className="text-center animate-fade-up">
        <div
          className="mx-auto mb-6 w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2
          className="font-black text-[#18181b] mb-3"
          style={{ fontFamily: "var(--font-syne)", fontSize: "1.75rem" }}
        >
          Solicitud enviada
        </h2>
        <p className="text-sm text-[#71717A] mb-8 leading-relaxed max-w-[320px] mx-auto">
          Tu registro fue recibido. El administrador municipal revisará tu solicitud y recibirás una notificación por correo cuando sea aprobada.
        </p>
        <button className="btn-primary w-full" onClick={() => router.push("/login")}>
          <span className="shine" aria-hidden />
          Ir al inicio de sesión
        </button>
      </div>
    );
  }

  const fc = (f: string) => `field${fieldErrors[f] ? " field-error" : ""}`;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <p
          className="text-[11px] font-semibold tracking-[0.22em] uppercase mb-3 animate-fade-up"
          style={{ color: "#B8860B" }}
        >
          Nuevo acceso
        </p>
        <h2
          className="font-black text-[#18181b] leading-tight animate-fade-up delay-50"
          style={{ fontFamily: "var(--font-syne)", fontSize: "1.75rem" }}
        >
          Crear cuenta
        </h2>
        <p className="mt-2.5 text-[15px] text-[#52525b] leading-relaxed animate-fade-up delay-100">
          {step === "datos" ? "Paso 1 de 2 — Datos personales" : "Paso 2 de 2 — Rol solicitado"}
        </p>
        {/* Progress bar */}
        <div className="flex gap-1.5 mt-4 animate-fade-up delay-150">
          <div className="h-0.5 flex-1 rounded-full" style={{ background: "#18181b" }} />
          <div
            className="h-0.5 flex-1 rounded-full transition-all duration-300"
            style={{ background: step === "rol" ? "#18181b" : "#E4E4E7" }}
          />
        </div>
      </div>

      {/* Global error */}
      {error && (
        <div
          className="mb-5 flex items-start gap-2.5 rounded-lg p-3.5 animate-fade-up"
          style={{ background: "#FFF5F5", border: "1.5px solid #FCA5A5" }}
        >
          <AlertCircle className="mt-0.5 shrink-0 text-[#EF4444]" />
          <p className="text-sm text-[#DC2626] leading-snug">{error}</p>
        </div>
      )}

      {/* ── Step 1: datos ── */}
      {step === "datos" && (
        <div className="space-y-4">
          <div className="animate-fade-up delay-100">
            <label htmlFor="name" className="block text-[15px] font-semibold text-[#09090b] mb-1.5">
              Nombre completo
            </label>
            <input
              id="name" name="name" type="text"
              value={form.name} onChange={handleChange}
              placeholder="Juan Pérez García"
              className={fc("name")}
            />
            {fieldErrors.name && <p className="mt-1.5 text-[13px] text-[#DC2626]">{fieldErrors.name}</p>}
          </div>

          <div className="animate-fade-up delay-200">
            <label htmlFor="email" className="block text-[15px] font-semibold text-[#09090b] mb-1.5">
              Correo electrónico
            </label>
            <input
              id="email" name="email" type="email"
              value={form.email} onChange={handleChange}
              placeholder="nombre@correo.com"
              className={fc("email")}
            />
            {fieldErrors.email && <p className="mt-1.5 text-[13px] text-[#DC2626]">{fieldErrors.email}</p>}
          </div>

          <div className="animate-fade-up delay-300">
            <label htmlFor="password" className="block text-[15px] font-semibold text-[#09090b] mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password" name="password"
                type={showPassword ? "text" : "password"}
                value={form.password} onChange={handleChange}
                placeholder="Mínimo 8 caracteres"
                className={`${fc("password")} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#52525B] transition-colors"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
            {fieldErrors.password && <p className="mt-1.5 text-[13px] text-[#DC2626]">{fieldErrors.password}</p>}
          </div>

          <div className="animate-fade-up delay-400 pt-1">
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => { if (validateDatos()) setStep("rol"); }}
            >
              <span className="shine" aria-hidden />
              Continuar
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-2 animate-fade-up delay-500">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ height: "1px", background: "#E4E4E7" }} />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-[#fafafa] text-[12px] text-[#A1A1AA]">o</span>
            </div>
          </div>

          <button
            type="button"
            className="w-full h-[44px] flex items-center justify-center gap-3 rounded-lg bg-white text-[14px] font-medium text-[#27272A] hover:bg-[#F4F4F5] transition-all duration-150 cursor-pointer animate-fade-up delay-600"
            style={{ border: "1.5px solid #E4E4E7" }}
          >
            <GoogleMark />
            Registrarse con Google
          </button>
        </div>
      )}

      {/* ── Step 2: rol ── */}
      {step === "rol" && (
        <div className="space-y-2.5">
          <p className="text-[13px] text-[#71717A] mb-3 animate-fade-up">
            Selecciona el rol que deseas solicitar. El administrador lo aprobará.
          </p>
          {ROLES.map((rol, i) => {
            const selected = form.requestedRole === rol.value;
            return (
              <button
                key={rol.value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, requestedRole: rol.value }))}
                className="w-full text-left rounded-lg p-4 transition-all duration-150 cursor-pointer animate-fade-up"
                style={{
                  animationDelay: `${i * 60}ms`,
                  border: `1.5px solid ${selected ? "#B8860B" : "#E4E4E7"}`,
                  background: selected ? "#FDF8EC" : "#ffffff",
                  boxShadow: selected ? "inset 3px 0 0 #B8860B" : "none",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all"
                    style={{ borderColor: selected ? "#B8860B" : "#D4D4D8" }}
                  >
                    {selected && (
                      <div className="w-2 h-2 rounded-full" style={{ background: "#B8860B" }} />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-[13px] text-[#18181B]">{rol.label}</div>
                    <div className="text-[12px] text-[#71717A] mt-0.5">{rol.desc}</div>
                  </div>
                </div>
              </button>
            );
          })}

          <div className="flex gap-3 pt-2 animate-fade-up delay-400">
            <button
              type="button"
              className="btn-outline"
              style={{ flex: 1 }}
              onClick={() => setStep("datos")}
            >
              Atrás
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ flex: 1 }}
              disabled={!form.requestedRole || loading}
              onClick={handleSubmit}
            >
              <span className="shine" aria-hidden />
              {loading ? (
                <>
                  <span className="spinner" />
                  <span>Enviando…</span>
                </>
              ) : (
                "Solicitar acceso"
              )}
            </button>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-[13px] text-[#71717A]">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/login"
          className="font-semibold transition-colors"
          style={{ color: "#B8860B" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#926A09")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#B8860B")}
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}

/* ── Micro icons ── */
function Eye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
    </svg>
  );
}

function AlertCircle({ className = "" }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={className}>
      <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7.5 4.5v3M7.5 10h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
