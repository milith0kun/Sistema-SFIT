"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

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

      if (typeof window !== "undefined") {
        localStorage.setItem("sfit_access_token",  data.data.accessToken);
        localStorage.setItem("sfit_refresh_token", data.data.refreshToken);
        localStorage.setItem("sfit_user",          JSON.stringify(data.data.user));
      }
      document.cookie = `sfit_access_token=${data.data.accessToken}; path=/; max-age=900; SameSite=Lax`;
      router.push("/dashboard");
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <p
          className="text-[11px] font-semibold tracking-[0.22em] uppercase mb-4 animate-fade-up"
          style={{ color: "#B8860B" }}
        >
          Acceso al sistema
        </p>
        <h2
          className="font-extrabold text-[#09090b] leading-[1.1] animate-fade-up delay-50"
          style={{ fontFamily: "var(--font-syne)", fontSize: "2.1rem" }}
        >
          Ingresar
        </h2>
        <p
          className="mt-2.5 text-[15px] text-[#52525b] leading-relaxed animate-fade-up delay-100"
        >
          Credenciales institucionales requeridas
        </p>
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

      <form onSubmit={handleSubmit} noValidate>
        {/* Email */}
        <div className="mb-4 animate-fade-up delay-150">
          <label htmlFor="email" className="block text-[15px] font-semibold text-[#09090b] mb-2">
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
            <p className="mt-1.5 text-[13px] text-[#DC2626]">{fieldErrors.email}</p>
          )}
        </div>

        {/* Password */}
        <div className="mb-5 animate-fade-up delay-200">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="text-[15px] font-semibold text-[#09090b]">
              Contraseña
            </label>
            <Link
              href="/reset-password"
              className="text-[13px] transition-colors"
              style={{ color: "#B8860B" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#926A09")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#B8860B")}
            >
              ¿Olvidaste tu contraseña?
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
              className={`field pr-11${fieldErrors.password ? " field-error" : ""}`}
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
          {fieldErrors.password && (
            <p className="mt-1.5 text-[13px] text-[#DC2626]">{fieldErrors.password}</p>
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
              "Ingresar al sistema"
            )}
          </button>
        </div>
      </form>

      {/* Divider */}
      <div className="relative my-6 animate-fade-up delay-400">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full" style={{ height: "1px", background: "#E4E4E7" }} />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 bg-[#fafafa] text-[13px] text-[#A1A1AA]">
            o continúa con
          </span>
        </div>
      </div>

      {/* Google */}
      <div className="animate-fade-up delay-500">
        <button
          type="button"
          className="w-full h-[44px] flex items-center justify-center gap-3 rounded-lg bg-white text-[14px] font-medium text-[#27272A] hover:bg-[#F4F4F5] transition-all duration-150 cursor-pointer"
          style={{ border: "1.5px solid #E4E4E7" }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#D4D4D8")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E4E4E7")}
        >
          <GoogleMark />
          Continuar con Google
        </button>
      </div>

      {/* Register link */}
      <p className="mt-7 text-center text-[14px] text-[#52525B] animate-fade-up delay-500">
        ¿No tienes cuenta?{" "}
        <Link
          href="/register"
          className="font-semibold transition-colors"
          style={{ color: "#B8860B" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#926A09")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#B8860B")}
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
