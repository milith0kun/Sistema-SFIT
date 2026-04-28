"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/** RF-01-03/04: enruta según estado del usuario */
function destForStatus(status: string): string {
  switch (status) {
    case "pendiente": return "/pending";
    case "rechazado": return "/rejected";
    case "activo":
    default:           return "/dashboard";
  }
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            use_fedcm_for_prompt?: boolean;
            auto_select?: boolean;
            ux_mode?: "popup" | "redirect";
          }) => void;
          prompt: () => void;
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [gisReady, setGisReady] = useState(false);

  // Inicializa Google Identity Services cuando el script carga
  useEffect(() => {
    if (initializedRef.current) return;
    if (!gisReady || !GOOGLE_CLIENT_ID || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      use_fedcm_for_prompt: false,
      auto_select: false,
      ux_mode: "popup",
    });

    if (googleBtnRef.current) {
      googleBtnRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: 376,
      });
    }

    initializedRef.current = true;
  }, [gisReady]);

  async function handleGoogleCredential(response: { credential: string }) {
    setGoogleLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al iniciar sesión con Google");
        return;
      }
      localStorage.setItem("sfit_access_token", data.data.accessToken);
      localStorage.setItem("sfit_refresh_token", data.data.refreshToken);
      localStorage.setItem("sfit_user", JSON.stringify(data.data.user));
      document.cookie = `sfit_access_token=${data.data.accessToken}; path=/; max-age=900; SameSite=Lax`;
      router.push(destForStatus(data.data.user.status));
    } catch {
      setError("Error de conexión con Google. Intente nuevamente.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const form     = new FormData(e.currentTarget);
    const email    = form.get("email") as string;
    const password = form.get("password") as string;

    try {
      const res  = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(data.errors))
            mapped[key] = (msgs as string[])[0];
          setFieldErrors(mapped);
        } else {
          setError(data.error ?? "Error al iniciar sesión");
        }
        return;
      }

      localStorage.setItem("sfit_access_token",  data.data.accessToken);
      localStorage.setItem("sfit_refresh_token", data.data.refreshToken);
      localStorage.setItem("sfit_user",          JSON.stringify(data.data.user));
      document.cookie = `sfit_access_token=${data.data.accessToken}; path=/; max-age=900; SameSite=Lax`;
      router.push(destForStatus(data.data.user.status));
    } catch {
      setError("Error de conexión. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-6 animate-fade-in flex justify-center w-full">
          <img src="/logo-vertical.svg" alt="SFIT Logo" className="w-[140px] sm:w-[170px] h-auto object-contain" />
        </div>
        <p className="kicker animate-fade-up text-center w-full">
          Acceso al sistema
        </p>
        <h1
          className="mt-5 font-bold text-[#09090b] animate-fade-up delay-50 text-center w-full"
          style={{
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
          }}
        >
          Ingreso al sistema
        </h1>
        <p
          className="mt-4 animate-fade-up delay-100 text-center w-full"
          style={{
            color: "#52525b",
            fontSize: "1rem",
            lineHeight: 1.6,
            fontWeight: 400,
          }}
        >
          Acceso restringido al personal autorizado mediante credenciales institucionales.
        </p>
      </div>

      {/* Global error */}
      {error && (
        <div
          className="mb-6 flex items-start gap-3 rounded-xl p-4 animate-fade-up"
          style={{ background: "#FFF5F5", border: "1.5px solid #FCA5A5" }}
        >
          <AlertCircle className="mt-0.5 shrink-0 text-[#EF4444]" />
          <p style={{ fontSize: "0.9375rem", color: "#DC2626", lineHeight: 1.45, fontWeight: 500 }}>
            {error}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Email */}
        <div className="mb-5 animate-fade-up delay-150">
          <label
            htmlFor="email"
            className="block mb-2.5"
            style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#09090b", letterSpacing: "-0.005em" }}
          >
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="nombre@municipalidad.gob.pe"
            className={`field${fieldErrors.email ? " field-error" : ""}`}
          />
          {fieldErrors.email && (
            <p className="mt-2" style={{ fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="mb-6 animate-fade-up delay-200">
          <div className="flex items-center justify-between mb-2.5">
            <label
              htmlFor="password"
              style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#09090b", letterSpacing: "-0.005em" }}
            >
              Contraseña
            </label>
            <Link
              href="/reset-password"
              className="transition-colors"
              style={{ color: "#6C0606", fontSize: "0.8125rem", fontWeight: 600 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#4A0303")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#6C0606")}
            >
              ¿Olvidó su contraseña?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••••"
              className={`field pr-12${fieldErrors.password ? " field-error" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#52525B] transition-colors"
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-2" style={{ fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="animate-fade-up delay-300">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            <span className="shine" aria-hidden />
            {loading ? (
              <>
                <span className="spinner" />
                <span>Verificando…</span>
              </>
            ) : (
              "Acceso al sistema"
            )}
          </button>
        </div>
      </form>

      {/* Divider */}
      <div className="relative my-7 animate-fade-up delay-400">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full" style={{ height: "1px", background: "#E4E4E7" }} />
        </div>
        <div className="relative flex justify-center">
          <span
            className="px-4 bg-[#fafafa]"
            style={{ fontSize: "0.8125rem", color: "#71717A", fontWeight: 500, letterSpacing: "0.02em" }}
          >
            o continúa con
          </span>
        </div>
      </div>

      {/* Google Sign-In (Google Identity Services) */}
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setGisReady(true)}
      />
      <div className="animate-fade-up delay-500">
        {!GOOGLE_CLIENT_ID && (
          <div
            className="rounded-[10px] px-4 py-3 text-center"
            style={{ background: "#FFFBEB", border: "1.5px solid #FCD34D", fontSize: "0.875rem", color: "#92400E" }}
          >
            Google OAuth no está configurado. Define <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>.
          </div>
        )}
        {GOOGLE_CLIENT_ID && (
          <div className="w-full flex justify-center">
            <div ref={googleBtnRef} />
          </div>
        )}
        {googleLoading && (
          <p className="mt-2 text-center" style={{ fontSize: "0.8125rem", color: "#52525B" }}>
            Verificando con Google…
          </p>
        )}
      </div>

      {/* Register link */}
      <p
        className="mt-9 text-center animate-fade-up delay-500"
        style={{ fontSize: "0.9375rem", color: "#52525B", fontWeight: 400 }}
      >
        ¿No cuenta con un usuario?{" "}
        <Link
          href="/register"
          className="transition-colors"
          style={{ color: "#6C0606", fontWeight: 600 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#4A0303")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6C0606")}
        >
          Solicitar acceso
        </Link>
      </p>
    </div>
  );
}

/* ── Micro icons ── */
function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
    </svg>
  );
}

function AlertCircle({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 15 15" fill="none" className={className}>
      <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7.5 4.5v3M7.5 10h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
