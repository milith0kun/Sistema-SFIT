"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

const ROLES_OPERATIVO = [
  { value: "conductor", label: "Conductor",           desc: "Consulta de rutas asignadas, viajes y estado de aptitud" },
  { value: "fiscal",    label: "Fiscal / Inspector",  desc: "Realización de inspecciones y emisión de actas" },
  { value: "operador",  label: "Operador de Empresa", desc: "Administración de flota, salidas y conductores" },
] as const;

type Step     = "tipo" | "datos" | "ubicacion" | "exito";
type PathType = "ciudadano" | "operativo";

interface Provincia     { id: string; name: string; }
interface Municipalidad { id: string; name: string; }

function destForStatus(status: string): string {
  if (status === "pendiente") return "/pending";
  if (status === "rechazado") return "/rejected";
  return "/dashboard";
}

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep]   = useState<Step>("tipo");
  const [path, setPath]   = useState<PathType | null>(null);
  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", password: "",
    provinceId: "", municipalityId: "", requestedRole: "",
  });

  const [provincias,      setProvincias]      = useState<Provincia[]>([]);
  const [municipalidades, setMunicipalidades] = useState<Municipalidad[]>([]);
  const [loadingProv,     setLoadingProv]     = useState(false);
  const [loadingMunis,    setLoadingMunis]    = useState(false);

  const googleBtnRef   = useRef<HTMLDivElement>(null);
  const gisInitialized = useRef(false);
  const [gisReady, setGisReady] = useState(false);

  /* ── Google Identity Services ── */
  useEffect(() => {
    if (!gisReady || !GOOGLE_CLIENT_ID || !window.google) return;
    if (gisInitialized.current) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      use_fedcm_for_prompt: false,
      auto_select: false,
      ux_mode: "popup",
    });
    gisInitialized.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gisReady]);

  useEffect(() => {
    if (!gisReady || !gisInitialized.current || !googleBtnRef.current) return;
    if (step !== "datos" || path !== "ciudadano") return;
    googleBtnRef.current.innerHTML = "";
    window.google!.accounts.id.renderButton(googleBtnRef.current, {
      type: "standard", theme: "outline", size: "large",
      text: "signup_with", shape: "rectangular",
      logo_alignment: "left", width: 376,
    });
  }, [gisReady, step, path]);

  /* ── Cargar provincias al entrar a ubicacion ── */
  useEffect(() => {
    if (step !== "ubicacion") return;
    setLoadingProv(true);
    fetch("/api/public/provincias")
      .then((r) => r.json())
      .then((d) => setProvincias(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingProv(false));
  }, [step]);

  /* ── Cargar municipalidades al cambiar provincia ── */
  useEffect(() => {
    if (!form.provinceId) { setMunicipalidades([]); return; }
    setLoadingMunis(true);
    setForm((p) => ({ ...p, municipalityId: "" }));
    fetch(`/api/public/municipalidades?provinceId=${form.provinceId}`)
      .then((r) => r.json())
      .then((d) => setMunicipalidades(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingMunis(false));
  }, [form.provinceId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setFieldErrors((p) => ({ ...p, [name]: "" }));
  }

  function validateDatos() {
    const errs: Record<string, string> = {};
    if (!form.name.trim() || form.name.length < 2) errs.name     = "Ingrese su nombre completo";
    if (!form.email.includes("@"))                  errs.email    = "Correo electrónico inválido";
    if (form.password.length < 8)                   errs.password = "Mínimo 8 caracteres";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function selectPath(p: PathType) {
    setPath(p);
    setStep("datos");
    setError(null);
  }

  function storeSession(data: { accessToken: string; refreshToken: string; user: object }) {
    localStorage.setItem("sfit_access_token",  data.accessToken);
    localStorage.setItem("sfit_refresh_token", data.refreshToken);
    localStorage.setItem("sfit_user",          JSON.stringify(data.user));
    document.cookie = `sfit_access_token=${data.accessToken}; path=/; max-age=7200; SameSite=Lax`;
  }

  async function handleGoogleCredential(response: { credential: string }) {
    setGoogleLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al registrarse con Google"); return; }
      storeSession(data.data);
      router.push("/dashboard");
    } catch {
      setError("Error de conexión con Google.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function submitRegister(requestedRole: string, municipalityId?: string) {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/auth/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, email: form.email, password: form.password,
          requestedRole, municipalityId,
        }),
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
      storeSession(data.data);
      router.push(destForStatus(data.data.user.status));
    } catch {
      setError("Error de conexión. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDatosNext() {
    if (!validateDatos()) return;
    if (path === "ciudadano") {
      await submitRegister("ciudadano");
    } else {
      setStep("ubicacion");
    }
  }

  async function handleUbicacionSubmit() {
    if (!form.municipalityId || !form.requestedRole) return;
    await submitRegister(form.requestedRole, form.municipalityId);
  }

  /* ── Progress bar ── */
  const totalSteps  = path === "ciudadano" ? 1 : 2;
  const currentStep = step === "datos" ? 1 : 2;

  /* ───────── RENDER ───────── */

  /* ── Step: tipo ── */
  if (step === "tipo") {
    return (
      <div className="animate-fade-in">
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onReady={() => setGisReady(true)}
        />

        <div className="mb-8">
          <p className="kicker animate-fade-up text-center w-full">Solicitud de acceso</p>
          <h1
            className="mt-3 font-bold text-[#09090b] animate-fade-up delay-50 text-center w-full"
            style={{ fontSize: "clamp(1.625rem, 3.5vw, 2rem)", lineHeight: 1.15, letterSpacing: "-0.02em" }}
          >
            Tipo de usuario
          </h1>
          <p className="mt-3 animate-fade-up delay-100 text-center w-full" style={{ color: "#52525b", fontSize: "0.9375rem", lineHeight: 1.55 }}>
            Seleccione la modalidad de acceso al sistema según su perfil.
          </p>
        </div>

        <div className="space-y-3 animate-fade-up delay-200">
          {/* Ciudadano */}
          <button
            type="button"
            onClick={() => selectPath("ciudadano")}
            className="w-full text-left rounded-xl p-5 transition-all duration-150 cursor-pointer group"
            style={{ border: "1.5px solid #E4E4E7", background: "#ffffff" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.border = "1.5px solid #6C0606";
              (e.currentTarget as HTMLElement).style.background = "#FDFBF4";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.border = "1.5px solid #E4E4E7";
              (e.currentTarget as HTMLElement).style.background = "#ffffff";
            }}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#F0F9FF" }}>
                <IconCiudadano />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-[#09090b]" style={{ fontSize: "1rem" }}>Ciudadano</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ background: "#F0FDF4", color: "#16A34A", border: "1px solid #86EFAC" }}
                  >
                    Acceso inmediato
                  </span>
                </div>
                <p style={{ color: "#52525B", fontSize: "0.875rem", lineHeight: 1.55 }}>
                  Presentación de reportes ciudadanos, consulta del estado de vehículos y seguimiento de denuncias.
                </p>
              </div>
              <ChevronRight />
            </div>
          </button>

          {/* Operativo */}
          <button
            type="button"
            onClick={() => selectPath("operativo")}
            className="w-full text-left rounded-xl p-5 transition-all duration-150 cursor-pointer"
            style={{ border: "1.5px solid #E4E4E7", background: "#ffffff" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.border = "1.5px solid #6C0606";
              (e.currentTarget as HTMLElement).style.background = "#FDFBF4";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.border = "1.5px solid #E4E4E7";
              (e.currentTarget as HTMLElement).style.background = "#ffffff";
            }}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#FFF7ED" }}>
                <IconOperativo />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-[#09090b]" style={{ fontSize: "1rem" }}>Personal operativo</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ background: "#FBEAEA", color: "#92400E", border: "1px solid #FCD34D" }}
                  >
                    Requiere aprobación
                  </span>
                </div>
                <p style={{ color: "#52525B", fontSize: "0.875rem", lineHeight: 1.55 }}>
                  Conductor, fiscal/inspector u operador de empresa de transporte.
                </p>
              </div>
              <ChevronRight />
            </div>
          </button>
        </div>

        <p className="mt-7 text-center text-[13px] text-[#71717A] animate-fade-up delay-300">
          ¿Cuenta con un usuario?{" "}
          <Link
            href="/login"
            className="font-semibold transition-colors"
            style={{ color: "#6C0606" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#4A0303")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6C0606")}
          >
            Acceso al sistema
          </Link>
        </p>
      </div>
    );
  }

  /* ── Step: datos ── */
  if (step === "datos") {
    const isCiudadano = path === "ciudadano";
    return (
      <div className="animate-fade-in">
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onReady={() => setGisReady(true)}
        />

        <div className="mb-7">
          {/* Back + path badge */}
          <div className="flex items-center gap-3 mb-5 animate-fade-up">
            <button
              type="button"
              onClick={() => { setStep("tipo"); setError(null); setFieldErrors({}); }}
              className="flex items-center gap-1.5 text-[13px] font-medium text-[#71717A] hover:text-[#18181B] transition-colors"
            >
              <ChevronLeft />
              Volver
            </button>
            <span
              className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
              style={
                isCiudadano
                  ? { background: "#F0FDF4", color: "#16A34A", border: "1px solid #86EFAC" }
                  : { background: "#FBEAEA", color: "#92400E", border: "1px solid #FCD34D" }
              }
            >
              {isCiudadano ? "Ciudadano" : "Personal operativo"}
            </span>
          </div>

          <h1
            className="font-bold text-[#09090b] animate-fade-up delay-50"
            style={{ fontSize: "clamp(1.625rem, 3.5vw, 2rem)", lineHeight: 1.15, letterSpacing: "-0.02em" }}
          >
            Datos personales
          </h1>
          <p className="mt-3 animate-fade-up delay-100" style={{ color: "#52525b", fontSize: "0.9375rem", lineHeight: 1.55 }}>
            {isCiudadano
              ? "Creación de cuenta para acceso inmediato al sistema."
              : "Paso 1 de 2 — Información del usuario"}
          </p>

          {/* Progress bar */}
          <div className="flex gap-2 mt-5 animate-fade-up delay-150">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className="h-[3px] flex-1 rounded-full transition-all duration-300"
                style={{ background: i < currentStep ? "#09090b" : "#E4E4E7" }}
              />
            ))}
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        {/* Google (solo ciudadano) */}
        {isCiudadano && GOOGLE_CLIENT_ID && (
          <div className="mb-5 animate-fade-up delay-100">
            <div className="w-full flex justify-center">
              <div ref={googleBtnRef} />
            </div>
            {googleLoading && (
              <p className="mt-2 text-center text-[13px] text-[#52525B]">
                Verificando con Google…
              </p>
            )}
            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full" style={{ height: "1px", background: "#E4E4E7" }} />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-[#fafafa]" style={{ fontSize: "0.8125rem", color: "#A1A1AA" }}>
                  o con correo y contraseña
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="animate-fade-up delay-200">
            <label className="block mb-2.5" style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#09090b" }}>
              Nombre completo
            </label>
            <input
              name="name" type="text" value={form.name} onChange={handleChange}
              placeholder="Juan Pérez García"
              className={`field${fieldErrors.name ? " field-error" : ""}`}
            />
            {fieldErrors.name && <FieldError msg={fieldErrors.name} />}
          </div>

          <div className="animate-fade-up delay-250">
            <label className="block mb-2.5" style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#09090b" }}>
              Correo electrónico
            </label>
            <input
              name="email" type="email" value={form.email} onChange={handleChange}
              placeholder="nombre@correo.com"
              className={`field${fieldErrors.email ? " field-error" : ""}`}
            />
            {fieldErrors.email && <FieldError msg={fieldErrors.email} />}
          </div>

          <div className="animate-fade-up delay-300">
            <label className="block mb-2.5" style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#09090b" }}>
              Contraseña
            </label>
            <div className="relative">
              <input
                name="password" type={showPassword ? "text" : "password"}
                value={form.password} onChange={handleChange}
                placeholder="Mínimo 8 caracteres"
                className={`field pr-11${fieldErrors.password ? " field-error" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#52525B] transition-colors"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
            {fieldErrors.password && <FieldError msg={fieldErrors.password} />}
          </div>

          <div className="pt-1 animate-fade-up delay-400">
            <button
              type="button"
              className="btn-primary w-full"
              disabled={loading}
              onClick={handleDatosNext}
            >
              <span className="shine" aria-hidden />
              {loading ? (
                <><span className="spinner" /><span>Procesando solicitud…</span></>
              ) : isCiudadano ? (
                "Crear cuenta"
              ) : (
                "Continuar"
              )}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] text-[#71717A]">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-semibold transition-colors"
            style={{ color: "#6C0606" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#4A0303")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6C0606")}
          >
            Iniciar sesión
          </Link>
        </p>
      </div>
    );
  }

  /* ── Step: ubicacion (solo operativo) ── */
  if (step === "ubicacion") {
    const canSubmit = !!form.municipalityId && !!form.requestedRole;
    return (
      <div className="animate-fade-in">
        <div className="mb-7">
          <div className="flex items-center gap-3 mb-5 animate-fade-up">
            <button
              type="button"
              onClick={() => { setStep("datos"); setError(null); }}
              className="flex items-center gap-1.5 text-[13px] font-medium text-[#71717A] hover:text-[#18181B] transition-colors"
            >
              <ChevronLeft />
              Volver
            </button>
            <span
              className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: "#FBEAEA", color: "#92400E", border: "1px solid #FCD34D" }}
            >
              Personal operativo
            </span>
          </div>

          <h1
            className="font-bold text-[#09090b] animate-fade-up delay-50"
            style={{ fontSize: "clamp(1.625rem, 3.5vw, 2rem)", lineHeight: 1.15, letterSpacing: "-0.02em" }}
          >
            Ubicación institucional
          </h1>
          <p className="mt-3 animate-fade-up delay-100" style={{ color: "#52525b", fontSize: "0.9375rem", lineHeight: 1.55 }}>
            Paso 2 de 2 — Municipalidad y rol institucional
          </p>

          <div className="flex gap-2 mt-5 animate-fade-up delay-150">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-[3px] flex-1 rounded-full transition-all duration-300"
                style={{ background: i < 2 ? "#09090b" : "#E4E4E7" }}
              />
            ))}
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="space-y-4">
          {/* Provincia */}
          <div className="animate-fade-up delay-100">
            <label className="block mb-2.5" style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#09090b" }}>
              Provincia
            </label>
            <select
              name="provinceId"
              value={form.provinceId}
              onChange={handleChange}
              className="field"
              disabled={loadingProv}
            >
              <option value="">
                {loadingProv ? "Cargando provincias…" : "Seleccione una provincia"}
              </option>
              {provincias.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Municipalidad */}
          <div className="animate-fade-up delay-150">
            <label className="block mb-2.5" style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#09090b" }}>
              Municipalidad
            </label>
            <select
              name="municipalityId"
              value={form.municipalityId}
              onChange={handleChange}
              className="field"
              disabled={!form.provinceId || loadingMunis}
            >
              <option value="">
                {!form.provinceId
                  ? "Seleccione primero una provincia"
                  : loadingMunis
                  ? "Cargando municipalidades…"
                  : municipalidades.length === 0
                  ? "Sin municipalidades disponibles"
                  : "Seleccione una municipalidad"}
              </option>
              {municipalidades.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Rol */}
          <div className="animate-fade-up delay-200">
            <label className="block mb-2.5" style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#09090b" }}>
              Rol solicitado
            </label>
            <p className="mb-3 text-[13px]" style={{ color: "#71717A", lineHeight: 1.55 }}>
              La administración municipal evaluará la solicitud y notificará la resolución correspondiente.
            </p>
            <div className="space-y-2">
              {ROLES_OPERATIVO.map((rol, i) => {
                const selected = form.requestedRole === rol.value;
                return (
                  <button
                    key={rol.value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, requestedRole: rol.value }))}
                    className="w-full text-left rounded-lg p-4 transition-all duration-150 cursor-pointer animate-fade-up"
                    style={{
                      animationDelay: `${200 + i * 60}ms`,
                      border: `1.5px solid ${selected ? "#6C0606" : "#E4E4E7"}`,
                      background: selected ? "#FBEAEA" : "#ffffff",
                      boxShadow: selected ? "inset 3px 0 0 #6C0606" : "none",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                        style={{ borderColor: selected ? "#6C0606" : "#D4D4D8" }}
                      >
                        {selected && <div className="w-2 h-2 rounded-full" style={{ background: "#6C0606" }} />}
                      </div>
                      <div>
                        <div className="font-semibold text-[13px] text-[#18181B]">{rol.label}</div>
                        <div className="text-[12px] text-[#71717A] mt-0.5">{rol.desc}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-1 animate-fade-up delay-500">
            <button
              type="button"
              className="btn-primary w-full"
              disabled={!canSubmit || loading}
              onClick={handleUbicacionSubmit}
            >
              <span className="shine" aria-hidden />
              {loading ? (
                <><span className="spinner" /><span>Enviando solicitud…</span></>
              ) : (
                "Enviar solicitud"
              )}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] text-[#71717A]">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-semibold transition-colors"
            style={{ color: "#6C0606" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#4A0303")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6C0606")}
          >
            Iniciar sesión
          </Link>
        </p>
      </div>
    );
  }

  return null;
}

/* ── Micro-componentes ── */

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="mb-5 flex items-start gap-2.5 rounded-lg p-3.5 animate-fade-up"
      style={{ background: "#FFF5F5", border: "1.5px solid #FCA5A5" }}
    >
      <AlertCircle className="mt-0.5 shrink-0 text-[#EF4444]" />
      <p className="text-sm text-[#DC2626] leading-snug">{message}</p>
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <p className="mt-2" style={{ fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>{msg}</p>;
}

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

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function IconCiudadano() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconOperativo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  );
}
