"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  IdCard,
  Phone,
  KeyRound,
  Loader2,
  Search,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { ACTIVE_MUNICIPALITY_FULL_NAME } from "@/lib/scope";
import "./onboarding.css";

/**
 * Onboarding del primer login.
 *
 * Para admin_municipal el sistema solo opera una municipalidad (Cotabambas /
 * Tambobamba), por lo que los datos institucionales (razón social, RUC) los
 * siembra `scripts/activate-cotabambas.ts` y NO se piden aquí. Este formulario
 * cubre únicamente los datos personales del usuario:
 *
 *  1. DNI (con verificación automática contra RENIEC vía /api/validar/dni)
 *  2. Teléfono
 *  3. [opcional] Cambio de contraseña temporal (cuando user.mustChangePassword)
 *
 * Para otros roles (operador/conductor) la app móvil maneja sus propios
 * bloques (company/driver) — la web solo expone este flujo simplificado.
 */

type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  profileCompleted?: boolean;
  mustChangePassword?: boolean;
};

type DniLookup =
  | { state: "idle" }
  | { state: "loading" }
  | {
      state: "ok";
      nombreCompleto: string;
      nombres: string;
      apellidoPaterno: string;
      apellidoMaterno: string;
    }
  | { state: "not_found" }
  | { state: "error"; message: string };

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [mounted, setMounted] = useState(false);

  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const [dniLookup, setDniLookup] = useState<DniLookup>({ state: "idle" });
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Limpia un error específico cuando el usuario corrige el campo, así el
   *  rojo de validación no persiste hasta el siguiente submit. */
  function clearError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) {
      router.replace("/login");
      return;
    }
    const u = JSON.parse(raw) as StoredUser;
    setUser(u);
    if (typeof document !== "undefined") {
      document.cookie = "sfit_onboarding_pending=1; path=/; max-age=86400; SameSite=Strict; Secure";
    }
    // Si ya está todo completo, ir directo al dashboard.
    if (u.profileCompleted && !u.mustChangePassword) {
      router.replace("/dashboard");
      return;
    }
    requestAnimationFrame(() => setMounted(true));
  }, [router]);

  // Debounced auto-lookup cuando el DNI tiene exactamente 8 dígitos.
  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!/^\d{8}$/.test(dni)) {
      if (dniLookup.state !== "idle") setDniLookup({ state: "idle" });
      return;
    }
    setDniLookup({ state: "loading" });
    lookupTimer.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem("sfit_access_token");
        const res = await fetch("/api/validar/dni", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token ?? ""}`,
          },
          body: JSON.stringify({ dni }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setDniLookup({ state: "not_found" });
          return;
        }
        const d = data.data;
        setDniLookup({
          state: "ok",
          nombreCompleto: d.nombre_completo,
          nombres: d.nombres,
          apellidoPaterno: d.apellido_paterno,
          apellidoMaterno: d.apellido_materno,
        });
      } catch {
        setDniLookup({ state: "error", message: "No se pudo verificar el DNI." });
      }
    }, 350);
    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dni]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errs: Record<string, string> = {};
    if (!/^\d{8}$/.test(dni.trim())) errs.dni = "El DNI debe tener 8 dígitos.";
    if (phone.trim().length < 7) errs.phone = "Ingresa un teléfono válido.";
    if (user?.mustChangePassword) {
      if (newPassword.length < 8) errs.newPassword = "Mínimo 8 caracteres.";
      if (newPassword !== confirmPassword)
        errs.confirmPassword = "Las contraseñas no coinciden.";
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      // Si RENIEC confirmó, enviamos los datos para que el backend pueda
      // actualizar User.name si Google traía algo incompleto.
      const reniec =
        dniLookup.state === "ok"
          ? {
              nombres: dniLookup.nombres,
              apellidoPaterno: dniLookup.apellidoPaterno,
              apellidoMaterno: dniLookup.apellidoMaterno,
            }
          : undefined;

      const res = await fetch("/api/auth/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({
          dni: dni.trim(),
          phone: phone.trim(),
          ...(reniec ? { reniec } : {}),
          ...(user?.mustChangePassword ? { newPassword } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors))
            mapped[k] = (v as string[])[0];
          setFieldErrors(mapped);
        } else {
          setError(data.error ?? "No se pudo completar el perfil.");
        }
        return;
      }
      const merged = {
        ...user,
        ...data.data,
        profileCompleted: true,
        mustChangePassword: false,
      };
      localStorage.setItem("sfit_user", JSON.stringify(merged));
      if (typeof document !== "undefined") {
        document.cookie = "sfit_onboarding_pending=; path=/; max-age=0; SameSite=Strict; Secure";
      }
      router.replace("/dashboard");
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  const firstName = user.name.split(" ")[0] ?? user.name;
  const initials = user.name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const requiresPassword = !!user.mustChangePassword;
  const nameMismatch =
    dniLookup.state === "ok" &&
    dniLookup.nombreCompleto.toLowerCase().trim() !==
      user.name.toLowerCase().trim();

  return (
    <div className="onb">
      <div className={`onb__card${mounted ? " is-mounted" : ""}`}>
        {/* Header institucional */}
        <header className="onb__header">
          <div className="onb__wordmark">
            <span className="onb__wordmark-dot" />
            <span className="onb__wordmark-text">SFIT</span>
            <span className="onb__wordmark-sep">·</span>
            <span className="onb__wordmark-sub">Cotabambas</span>
          </div>

          <h1 className="onb__title">
            Bienvenido, <span>{firstName}</span>.
          </h1>
          <p className="onb__subtitle">
            Completa tus datos personales para acceder al panel
            {requiresPassword
              ? " y define una contraseña personal en lugar de la temporal."
              : "."}
          </p>

          <div className="onb__badge">
            <div className="onb__badge-chip">{initials || "—"}</div>
            <div className="onb__badge-meta">
              <div className="onb__badge-role">Administrador Municipal</div>
              <div className="onb__badge-muni">
                {ACTIVE_MUNICIPALITY_FULL_NAME}
              </div>
            </div>
            <ShieldCheck size={16} className="onb__badge-icon" />
          </div>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="onb__form">
          {error && (
            <div className="onb__alert">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* DNI con verificación RENIEC */}
          <div className="onb__field" data-stagger="1">
            <label className="onb__label" htmlFor="dni">
              <IdCard size={12} />
              <span>DNI</span>
              <span className="onb__label-hint">Verificación RENIEC</span>
            </label>

            <div className="onb__input-wrap">
              <input
                id="dni"
                value={dni}
                onChange={(e) => {
                  setDni(e.target.value.replace(/\D/g, "").slice(0, 8));
                  clearError("dni");
                }}
                placeholder="12345678"
                inputMode="numeric"
                autoFocus
                className={`onb__input onb__input--mono${
                  fieldErrors.dni
                    ? " is-error"
                    : dniLookup.state === "ok"
                      ? " is-ok"
                      : ""
                }`}
              />
              <div className="onb__input-icon" aria-hidden>
                {dniLookup.state === "loading" && (
                  <Loader2 size={16} className="onb__spin" />
                )}
                {dniLookup.state === "ok" && (
                  <CheckCircle2 size={16} color="#15803d" />
                )}
                {dniLookup.state === "not_found" && (
                  <Search size={16} color="#71717a" />
                )}
                {dniLookup.state === "error" && (
                  <AlertTriangle size={16} color="#b91c1c" />
                )}
              </div>
            </div>

            {fieldErrors.dni && (
              <p className="onb__field-error">{fieldErrors.dni}</p>
            )}

            {dniLookup.state === "ok" && (
              <div className="onb__reniec">
                <div className="onb__reniec-head">
                  <CheckCircle2 size={13} />
                  <span>Verificado en RENIEC</span>
                </div>
                <div className="onb__reniec-name">
                  {dniLookup.nombreCompleto}
                </div>
                {nameMismatch && (
                  <div className="onb__reniec-warn">
                    No coincide con el nombre registrado en tu cuenta (
                    <strong>{user.name}</strong>). Si el DNI es tuyo, contacta al
                    administrador.
                  </div>
                )}
              </div>
            )}
            {dniLookup.state === "not_found" && (
              <div className="onb__hint onb__hint--warn">
                <AlertTriangle size={12} />
                <span>DNI no encontrado en RENIEC. Verifica el número.</span>
              </div>
            )}
            {dniLookup.state === "error" && (
              <div className="onb__hint onb__hint--err">
                <AlertTriangle size={12} />
                <span>{dniLookup.message}</span>
              </div>
            )}
          </div>

          {/* Teléfono */}
          <div className="onb__field" data-stagger="2">
            <label className="onb__label" htmlFor="phone">
              <Phone size={12} />
              <span>Teléfono</span>
            </label>
            <div className="onb__input-wrap">
              <input
                id="phone"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearError("phone");
                }}
                placeholder="999 999 999"
                inputMode="tel"
                className={`onb__input${
                  fieldErrors.phone ? " is-error" : ""
                }`}
              />
            </div>
            {fieldErrors.phone && (
              <p className="onb__field-error">{fieldErrors.phone}</p>
            )}
          </div>

          {/* Contraseña — solo cuando es temporal */}
          {requiresPassword && (
            <>
              <div className="onb__divider">
                <span>Contraseña personal</span>
              </div>

              <div className="onb__passnote">
                <KeyRound size={13} />
                <span>
                  Tu contraseña actual fue asignada por el administrador.
                  Defínela ahora para que solo tú la conozcas.
                </span>
              </div>

              <div className="onb__field" data-stagger="3">
                <label className="onb__label" htmlFor="newPassword">
                  <span>Nueva contraseña</span>
                  <span className="onb__label-hint">Mínimo 8 caracteres</span>
                </label>
                <div className="onb__input-wrap">
                  <input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      clearError("newPassword");
                    }}
                    placeholder="••••••••"
                    className={`onb__input${
                      fieldErrors.newPassword ? " is-error" : ""
                    }`}
                    style={{ paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="onb__input-toggle"
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {fieldErrors.newPassword && (
                  <p className="onb__field-error">{fieldErrors.newPassword}</p>
                )}
              </div>

              <div className="onb__field" data-stagger="4">
                <label className="onb__label" htmlFor="confirmPassword">
                  <span>Confirmar contraseña</span>
                </label>
                <div className="onb__input-wrap">
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      clearError("confirmPassword");
                    }}
                    placeholder="••••••••"
                    className={`onb__input${
                      fieldErrors.confirmPassword ? " is-error" : ""
                    }`}
                  />
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="onb__field-error">
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="onb__submit"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="onb__spin" />
                <span>Guardando…</span>
              </>
            ) : (
              <span>Acceder al panel</span>
            )}
          </button>

          <p className="onb__footer">
            Tus datos quedan protegidos. El DNI debe coincidir con RENIEC y es
            único en el sistema.
          </p>
        </form>
      </div>
    </div>
  );
}
