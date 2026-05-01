"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Lock, ArrowRight } from "lucide-react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

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
  const [capsLock, setCapsLock] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [gisReady, setGisReady] = useState(false);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  // Inicialización de Google robusta — re-renderiza al cambiar tamaño del
  // contenedor (cambio de orientación, resize de ventana, etc.)
  useEffect(() => {
    const renderGoogleButton = () => {
      if (!GOOGLE_CLIENT_ID || !window.google || !googleBtnRef.current) return;

      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          use_fedcm_for_prompt: false,
          auto_select: false,
          ux_mode: "popup",
        });

        // Google Sign-In requiere width entre 200 y 400. Si el contenedor
        // mide < 200 (mobile pequeño con padding) tomamos 280 como fallback.
        // Si mide > 400 lo capeamos al máximo permitido por Google.
        const containerWidth = googleBtnRef.current.offsetWidth;
        const safeWidth = Math.max(
          200,
          Math.min(400, containerWidth > 0 ? containerWidth : 320),
        );

        googleBtnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: safeWidth,
        });
      } catch (err) {
        console.error("Error al inicializar Google Sign-In:", err);
      }
    };

    if (!gisReady) return;

    // Render inicial
    renderGoogleButton();

    // Re-render cuando cambia el tamaño del contenedor (responsive)
    const target = googleBtnRef.current;
    if (!target || typeof ResizeObserver === "undefined") return;

    let lastWidth = target.offsetWidth;
    const observer = new ResizeObserver((entries) => {
      const newWidth = entries[0]?.contentRect.width ?? 0;
      // Solo re-render si el cambio es significativo (>20px) para evitar
      // re-renders constantes durante animaciones de fade-in.
      if (Math.abs(newWidth - lastWidth) > 20) {
        lastWidth = newWidth;
        renderGoogleButton();
      }
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [gisReady, GOOGLE_CLIENT_ID]);

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
      document.cookie = `sfit_access_token=${data.data.accessToken}; path=/; max-age=7200; SameSite=Lax`;
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
      document.cookie = `sfit_access_token=${data.data.accessToken}; path=/; max-age=7200; SameSite=Lax`;
      router.push(destForStatus(data.data.user.status));
    } catch {
      setError("Error de conexión. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in w-full">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGisReady(true)}
      />

      {/* Header del Formulario */}
      <div className="mb-8 sm:mb-10">
        <h1 className="text-[#0A1628] text-2xl sm:text-3xl font-bold tracking-tight mb-2 sm:mb-3 text-balance">
          Bienvenido de nuevo
        </h1>
        <p className="text-[#52525B] text-sm sm:text-base font-medium leading-relaxed">
          Inicie sesión con sus credenciales institucionales para acceder al sistema.
        </p>
      </div>

      {/* Alerta de Error Global */}
      {error && (
        <div
          ref={errorRef}
          role="alert"
          className="mb-6 sm:mb-8 flex items-start gap-3 rounded-2xl p-4 bg-[#FFF5F5] border border-[#FCA5A5] animate-fade-up outline-none"
          tabIndex={-1}
        >
          <AlertCircle className="mt-0.5 shrink-0 text-[#EF4444]" size={18} />
          <p className="text-[14px] text-[#DC2626] font-semibold leading-snug">
            {error}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5 sm:space-y-7">
        {/* Email */}
        <div className="animate-fade-up delay-100">
          <label htmlFor="email" className="block text-sm font-bold text-[#0A1628] mb-2 uppercase tracking-widest opacity-70">
            Correo Institucional
          </label>
          <input
            ref={emailInputRef}
            id="email"
            name="email"
            type="email"
            placeholder="usuario@municipalidad.gob.pe"
            required
            className={`field transition-all ${fieldErrors.email ? "border-[#EF4444] bg-[#FFF5F5]" : "focus:border-[#0A1628] focus:ring-4 focus:ring-[#0A1628]/5"}`}
          />
          {fieldErrors.email && (
            <p className="mt-2 text-xs font-bold text-[#DC2626] uppercase tracking-wider">{fieldErrors.email}</p>
          )}
        </div>

        {/* Password */}
        <div className="animate-fade-up delay-150">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="text-sm font-bold text-[#0A1628] uppercase tracking-widest opacity-70">
              Contraseña
            </label>
            <Link href="/reset-password" 
                  className="text-xs font-bold text-[#8B1414] hover:underline tracking-wide">
              ¿Olvidó su contraseña?
            </Link>
          </div>
          <div className="relative group">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••••••"
              required
              onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
              className={`field pr-12 transition-all ${fieldErrors.password ? "border-[#EF4444] bg-[#FFF5F5]" : "focus:border-[#0A1628] focus:ring-4 focus:ring-[#0A1628]/5"}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#0A1628] transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {capsLock && (
            <p className="mt-2 text-[10px] font-bold text-[#B45309] uppercase tracking-widest flex items-center gap-1.5">
              <Lock size={10} /> Bloq Mayús Activado
            </p>
          )}
          {fieldErrors.password && (
            <p className="mt-2 text-xs font-bold text-[#DC2626] uppercase tracking-wider">{fieldErrors.password}</p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-3 sm:pt-4 animate-fade-up delay-200">
          <button
            type="submit"
            disabled={loading}
            className="w-full h-13 sm:h-14 bg-[#0A1628] text-white rounded-2xl font-bold text-base sm:text-lg hover:bg-[#111F38] active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#0A1628]/10 group"
            style={{ minHeight: 52 }}
          >
            {loading ? (
              <span className="flex h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Entrar al Sistema
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Divider */}
      <div className="relative my-8 sm:my-10 animate-fade-up delay-300">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#E4E4E7]" />
        </div>
        <div className="relative flex justify-center text-xs sm:text-sm font-bold uppercase tracking-[0.2em]">
          <span className="bg-[#fafafa] px-3 sm:px-4 text-[#A1A1AA]">o continuar con</span>
        </div>
      </div>

      {/* Google Login Container */}
      <div className="flex flex-col items-center gap-4 animate-fade-up delay-400 min-h-[44px]">
        {GOOGLE_CLIENT_ID ? (
          // Sin overflow-hidden ni rounded-xl: el iframe del botón de Google
          // tiene su propio styling. Recortarlo bloqueaba los clicks en mobile.
          // min-w para garantizar que Google Sign-In tenga un width válido (≥200px).
          <div
            id="google-btn-parent"
            className="w-full max-w-[400px] min-w-[200px] flex justify-center"
            ref={googleBtnRef}
          />
        ) : (
          <p className="text-[10px] font-bold text-[#B45309] uppercase tracking-widest text-center px-4 py-2 bg-amber-50 rounded-lg border border-amber-200">
            Configuración de Google Pendiente (NEXT_PUBLIC_GOOGLE_CLIENT_ID)
          </p>
        )}
        {googleLoading && <p className="text-[10px] font-bold text-[#52525B] animate-pulse uppercase tracking-widest">Verificando cuenta...</p>}
      </div>

      {/* Footer del Formulario */}
      <div className="mt-12 text-center animate-fade-up delay-500">
        <p className="text-[#71717A] font-medium text-sm">
          ¿Aún no tiene acceso institucional?
        </p>
        <Link href="/register" 
              className="mt-2 inline-block text-[#8B1414] font-bold hover:underline">
          Solicitar Usuario Autorizado
        </Link>
      </div>
    </div>
  );
}

