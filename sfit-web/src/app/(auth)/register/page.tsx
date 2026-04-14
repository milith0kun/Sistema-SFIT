"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const ROLES_OPCIONES = [
  { value: "ciudadano", label: "Ciudadano", desc: "Reportar anomalías y consultar estado de vehículos" },
  { value: "conductor", label: "Conductor", desc: "Ver rutas asignadas, viajes y estado de fatiga" },
  { value: "fiscal",    label: "Fiscal / Inspector", desc: "Realizar inspecciones y emitir actas" },
  { value: "operador",  label: "Operador de Empresa", desc: "Gestionar flota, salidas y conductores" },
] as const;

type RegisterStep = "datos" | "rol" | "exito";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<RegisterStep>("datos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "", email: "", password: "", municipalityId: "", requestedRole: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [e.target.name]: "" }));
  }

  function validateDatos() {
    const errs: Record<string, string> = {};
    if (!formData.name.trim() || formData.name.length < 2) errs.name = "Ingresa tu nombre completo";
    if (!formData.email.includes("@")) errs.email = "Correo inválido";
    if (formData.password.length < 8) errs.password = "Mínimo 8 caracteres";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!formData.requestedRole) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(data.errors)) {
            mapped[key] = (msgs as string[])[0];
          }
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

  if (step === "exito") {
    return (
      <div className="text-center animate-fade-up">
        <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)] mb-3" style={{ fontFamily: "var(--font-syne)" }}>
          Solicitud enviada
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-8 leading-relaxed">
          Tu registro fue recibido. El administrador municipal revisará tu solicitud y recibirás una notificación por correo cuando sea aprobada.
        </p>
        <Button variant="primary" size="lg" className="w-full" onClick={() => router.push("/login")}>
          Ir al inicio de sesión
        </Button>
      </div>
    );
  }

  const inputClass = (field: string) =>
    `w-full h-11 px-4 rounded-xl border text-sm bg-white dark:bg-[var(--color-dark-surface)] text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)] placeholder-[var(--color-text-muted)] outline-none transition-all duration-200 focus:ring-2 focus:ring-[var(--color-primary)] ${
      fieldErrors[field] ? "border-red-400" : "border-[var(--color-border)] dark:border-[var(--color-dark-border)] hover:border-[var(--color-text-muted)]"
    }`;

  return (
    <div className="animate-fade-in">
      <div className="mb-6 animate-fade-up">
        <h2 className="text-3xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)]" style={{ fontFamily: "var(--font-syne)" }}>
          Crear cuenta
        </h2>
        <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
          {step === "datos" ? "Paso 1 de 2 — Datos personales" : "Paso 2 de 2 — Selecciona tu rol"}
        </p>
        <div className="flex gap-2 mt-4">
          {(["datos", "rol"] as const).map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${step === s || (step === "rol" && s === "datos") ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)] dark:bg-[var(--color-dark-border)]"}`} />
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4">
          <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {step === "datos" && (
        <div className="space-y-4">
          <div className="animate-fade-up delay-100">
            <label htmlFor="name" className="block text-sm font-medium text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)] mb-1.5">Nombre completo</label>
            <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} placeholder="Juan Pérez García" className={inputClass("name")} />
            {fieldErrors.name && <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>}
          </div>

          <div className="animate-fade-up delay-200">
            <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)] mb-1.5">Correo electrónico</label>
            <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="nombre@correo.com" className={inputClass("email")} />
            {fieldErrors.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
          </div>

          <div className="animate-fade-up delay-300">
            <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)] mb-1.5">Contraseña</label>
            <div className="relative">
              <input id="password" name="password" type={showPassword ? "text" : "password"} value={formData.password} onChange={handleChange} placeholder="Mínimo 8 caracteres" className={`${inputClass("password")} pr-11`} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
                {showPassword
                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" /></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                }
              </button>
            </div>
            {fieldErrors.password && <p className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>}
          </div>

          <div className="animate-fade-up delay-400 pt-1">
            <Button type="button" variant="primary" size="lg" className="w-full" onClick={() => { if (validateDatos()) setStep("rol"); }}>
              Continuar
            </Button>
          </div>

          <div className="relative my-2 animate-fade-up delay-500">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--color-border)] dark:border-[var(--color-dark-border)]" /></div>
            <div className="relative flex justify-center text-xs"><span className="px-3 bg-[var(--color-surface-alt)] dark:bg-[var(--color-dark-bg)] text-[var(--color-text-muted)]">o</span></div>
          </div>

          <button type="button" className="w-full h-11 flex items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-white dark:bg-[var(--color-dark-surface)] text-sm font-medium text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)] hover:bg-[var(--color-surface-alt)] dark:hover:bg-white/5 transition-all duration-200 cursor-pointer animate-fade-up delay-500">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Registrarse con Google
          </button>
        </div>
      )}

      {step === "rol" && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)] mb-2 animate-fade-up">
            Selecciona el rol que deseas solicitar. El administrador municipal lo aprobará.
          </p>
          {ROLES_OPCIONES.map((rol, i) => (
            <button key={rol.value} type="button" onClick={() => setFormData((prev) => ({ ...prev, requestedRole: rol.value }))}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer animate-fade-up delay-${i + 1}00
                ${formData.requestedRole === rol.value
                  ? "border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950/30 ring-1 ring-[var(--color-primary)]"
                  : "border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-white dark:bg-[var(--color-dark-surface)] hover:border-[var(--color-text-muted)]"
                }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-all ${formData.requestedRole === rol.value ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-[var(--color-border)] dark:border-[var(--color-dark-border)]"}`}>
                  {formData.requestedRole === rol.value && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="font-semibold text-sm text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)]">{rol.label}</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{rol.desc}</div>
                </div>
              </div>
            </button>
          ))}

          <div className="flex gap-3 pt-2 animate-fade-up delay-500">
            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setStep("datos")}>Atrás</Button>
            <Button type="button" variant="primary" size="lg" className="flex-1" loading={loading} disabled={!formData.requestedRole} onClick={handleSubmit}>
              Solicitar acceso
            </Button>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
