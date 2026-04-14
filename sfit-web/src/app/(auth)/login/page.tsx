"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface LoginState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(data.errors)) {
            mapped[key] = (msgs as string[])[0];
          }
          setFieldErrors(mapped);
        } else {
          setError(data.error ?? "Error al iniciar sesión");
        }
        return;
      }

      // Guardar tokens y redirigir al dashboard
      if (typeof window !== "undefined") {
        localStorage.setItem("sfit_access_token", data.data.accessToken);
        localStorage.setItem("sfit_refresh_token", data.data.refreshToken);
        localStorage.setItem("sfit_user", JSON.stringify(data.data.user));
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
      {/* Encabezado */}
      <div className="mb-8 animate-fade-up">
        <h2
          className="text-3xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)]"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          Ingresar al sistema
        </h2>
        <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
          Ingresa con tu correo institucional
        </p>
      </div>

      {/* Error global */}
      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 animate-fade-up">
          <svg
            className="w-4 h-4 text-red-500 mt-0.5 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="animate-fade-up delay-100">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)] mb-1.5"
          >
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="nombre@municipalidad.gob"
            className={`w-full h-11 px-4 rounded-xl border text-sm bg-white dark:bg-[var(--color-dark-surface)] text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)] placeholder-[var(--color-text-muted)] outline-none transition-all duration-200
              focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-0
              ${fieldErrors.email
                ? "border-red-400 focus:ring-red-400"
                : "border-[var(--color-border)] dark:border-[var(--color-dark-border)] hover:border-[var(--color-text-muted)]"
              }`}
          />
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>
          )}
        </div>

        {/* Contraseña */}
        <div className="animate-fade-up delay-200">
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)]"
            >
              Contraseña
            </label>
            <Link
              href="/reset-password"
              className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
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
              placeholder="••••••••"
              className={`w-full h-11 px-4 pr-11 rounded-xl border text-sm bg-white dark:bg-[var(--color-dark-surface)] text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)] placeholder-[var(--color-text-muted)] outline-none transition-all duration-200
                focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-0
                ${fieldErrors.password
                  ? "border-red-400 focus:ring-red-400"
                  : "border-[var(--color-border)] dark:border-[var(--color-dark-border)] hover:border-[var(--color-text-muted)]"
                }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>
          )}
        </div>

        {/* Botón principal */}
        <div className="animate-fade-up delay-300 pt-1">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full"
          >
            Ingresar
          </Button>
        </div>
      </form>

      {/* Divider */}
      <div className="relative my-6 animate-fade-up delay-400">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--color-border)] dark:border-[var(--color-dark-border)]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-[var(--color-surface-alt)] dark:bg-[var(--color-dark-bg)] text-[var(--color-text-muted)]">
            o continúa con
          </span>
        </div>
      </div>

      {/* Google OAuth */}
      <div className="animate-fade-up delay-500">
        <button
          type="button"
          className="w-full h-11 flex items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-white dark:bg-[var(--color-dark-surface)] text-sm font-medium text-[var(--color-text-primary)] dark:text-[var(--color-dark-text)] hover:bg-[var(--color-surface-alt)] dark:hover:bg-white/5 transition-all duration-200 cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continuar con Google
        </button>
      </div>

      {/* Link a registro */}
      <p className="mt-8 text-center text-sm text-[var(--color-text-secondary)] animate-fade-up delay-500">
        ¿No tienes cuenta?{" "}
        <Link
          href="/register"
          className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
        >
          Regístrate
        </Link>
      </p>
    </div>
  );
}
