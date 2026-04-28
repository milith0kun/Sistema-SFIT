"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertTriangle, IdCard, Phone, KeyRound, Loader2, Search } from "lucide-react";

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
  | { state: "ok"; nombreCompleto: string; nombres: string; apellidoPaterno: string; apellidoMaterno: string }
  | { state: "not_found" }
  | { state: "error"; message: string };

const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a";
const INK6 = "#52525b"; const INK9 = "#18181b";
const G   = "#B8860B";
const GRN = "#15803d"; const GRN_BG = "#F0FDF4"; const GRN_BD = "#86EFAC";
const RED = "#b91c1c"; const RED_BG = "#FFF5F5"; const RED_BD = "#FCA5A5";
const INFO_BG = "#EFF6FF"; const INFO_C = "#1D4ED8"; const INFO_BD = "#BFDBFE";

const FIELD: React.CSSProperties = {
  width: "100%", height: 44, padding: "0 14px",
  border: `1.5px solid ${INK2}`, borderRadius: 10,
  fontSize: "0.9375rem", color: INK9, fontFamily: "inherit",
  outline: "none", background: "#fff", boxSizing: "border-box",
};
const LABEL: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 8,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  // RENIEC lookup
  const [dniLookup, setDniLookup] = useState<DniLookup>({ state: "idle" });
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced auto-lookup cuando el DNI tiene exactamente 8 dígitos
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
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
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
    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dni]);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as StoredUser;
    if (u.profileCompleted && !u.mustChangePassword) {
      router.replace("/dashboard");
      return;
    }
    setUser(u);
    if (typeof document !== "undefined") {
      document.cookie = "sfit_onboarding_pending=1; path=/; max-age=86400";
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errs: Record<string, string> = {};
    if (!/^\d{8}$/.test(dni.trim())) errs.dni = "DNI debe tener exactamente 8 dígitos";
    if (phone.trim().length < 7) errs.phone = "Teléfono requerido";
    if (user?.mustChangePassword) {
      if (newPassword.length < 8) errs.newPassword = "Mínimo 8 caracteres";
      if (newPassword !== confirmPassword) errs.confirmPassword = "Las contraseñas no coinciden";
    }
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }

    setLoading(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/auth/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({
          dni: dni.trim(),
          phone: phone.trim(),
          ...(user?.mustChangePassword ? { newPassword } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) mapped[k] = (v as string[])[0];
          setFieldErrors(mapped);
        } else {
          setError(data.error ?? "No se pudo completar el perfil.");
        }
        return;
      }
      // Update local
      const merged = { ...user, ...data.data, profileCompleted: true, mustChangePassword: false };
      localStorage.setItem("sfit_user", JSON.stringify(merged));
      if (typeof document !== "undefined") {
        document.cookie = "sfit_onboarding_pending=; path=/; max-age=0";
      }
      router.replace("/dashboard");
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  if (!user) return null;

  return (
    <div style={{
      minHeight: "100svh", background: "#FAFAFA",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, fontFamily: "var(--font-inter), system-ui",
    }}>
      <div style={{
        width: "100%", maxWidth: 540,
        background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 16,
        boxShadow: "0 18px 40px rgba(9,22,40,0.08)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "26px 28px 20px",
          borderBottom: `1px solid ${INK1}`,
          background: "linear-gradient(135deg, #0A1628 0%, #142a48 100%)",
          color: "#fff",
        }}>
          <div style={{
            fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase", color: "#D4A827", marginBottom: 8,
          }}>Primer ingreso · Onboarding</div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.015em" }}>
            Completa tu perfil
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "0.875rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
            Bienvenido <strong style={{ color: "#fff" }}>{user.name}</strong>. Antes de continuar necesitamos que verifiques tus datos personales{user.mustChangePassword ? " y cambies tu contraseña temporal" : ""}.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "22px 28px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
          {error && (
            <div style={{
              padding: "10px 14px", background: RED_BG, border: `1.5px solid ${RED_BD}`,
              borderRadius: 9, color: RED, fontSize: "0.8125rem", fontWeight: 500,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertTriangle size={14} />{error}
            </div>
          )}

          {/* DNI con verificación RENIEC */}
          <div>
            <label style={LABEL}>
              <IdCard size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              DNI <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(verificación automática RENIEC)</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="12345678"
                inputMode="numeric"
                autoFocus
                style={{ ...FIELD,
                         fontFamily: "ui-monospace,monospace",
                         paddingRight: 40,
                         borderColor: fieldErrors.dni ? RED
                                    : dniLookup.state === "ok" ? GRN : INK2 }}
              />
              <div style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                pointerEvents: "none",
              }}>
                {dniLookup.state === "loading" && (
                  <Loader2 size={16} color={INK5} style={{ animation: "spin 0.7s linear infinite" }} />
                )}
                {dniLookup.state === "ok" && <CheckCircle size={16} color={GRN} />}
                {dniLookup.state === "not_found" && <Search size={16} color={INK5} />}
                {dniLookup.state === "error" && <AlertTriangle size={16} color={RED} />}
              </div>
            </div>
            {fieldErrors.dni && (
              <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.dni}</p>
            )}

            {/* Resultado RENIEC */}
            {dniLookup.state === "ok" && (
              <div style={{
                marginTop: 8, padding: "10px 14px",
                background: GRN_BG, border: `1.5px solid ${GRN_BD}`, borderRadius: 9,
                display: "flex", alignItems: "flex-start", gap: 10,
              }}>
                <CheckCircle size={14} color={GRN} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: GRN, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Verificado en RENIEC
                  </div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9, marginTop: 2 }}>
                    {dniLookup.nombreCompleto}
                  </div>
                  {user && dniLookup.nombreCompleto.toLowerCase().trim() !== user.name.toLowerCase().trim() && (
                    <div style={{ fontSize: "0.75rem", color: "#92400E", marginTop: 4 }}>
                      No coincide con el nombre registrado en tu cuenta (<strong>{user.name}</strong>). Si el DNI es tuyo, contacta al administrador.
                    </div>
                  )}
                </div>
              </div>
            )}
            {dniLookup.state === "not_found" && (
              <div style={{
                marginTop: 8, padding: "10px 14px",
                background: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: 9,
                display: "flex", alignItems: "center", gap: 8,
                fontSize: "0.75rem", color: "#92400E",
              }}>
                <AlertTriangle size={13} />
                DNI no encontrado en RENIEC. Verifica que esté correcto.
              </div>
            )}
            {dniLookup.state === "error" && (
              <div style={{
                marginTop: 8, padding: "10px 14px",
                background: RED_BG, border: `1.5px solid ${RED_BD}`, borderRadius: 9,
                fontSize: "0.75rem", color: RED,
              }}>
                {dniLookup.message}
              </div>
            )}
          </div>

          {/* Teléfono */}
          <div>
            <label style={LABEL}>
              <Phone size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              Teléfono
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+51 999 999 999"
              style={{ ...FIELD, borderColor: fieldErrors.phone ? RED : INK2 }}
            />
            {fieldErrors.phone && (
              <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.phone}</p>
            )}
          </div>

          {/* Cambio de password (solo si mustChangePassword) */}
          {user.mustChangePassword && (
            <>
              <div style={{
                padding: "10px 14px", background: INFO_BG, border: `1.5px solid ${INFO_BD}`,
                borderRadius: 9, color: INFO_C, fontSize: "0.75rem", lineHeight: 1.5,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <KeyRound size={13} />
                <span>Tu contraseña actual fue asignada por el administrador. Define una nueva contraseña personal.</span>
              </div>

              <div>
                <label style={LABEL}>Nueva contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  style={{ ...FIELD, borderColor: fieldErrors.newPassword ? RED : INK2 }}
                />
                {fieldErrors.newPassword && (
                  <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.newPassword}</p>
                )}
              </div>

              <div>
                <label style={LABEL}>Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu nueva contraseña"
                  style={{ ...FIELD, borderColor: fieldErrors.confirmPassword ? RED : INK2 }}
                />
                {fieldErrors.confirmPassword && (
                  <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.confirmPassword}</p>
                )}
              </div>
            </>
          )}

          <div style={{
            padding: "10px 14px", background: GRN_BG, border: `1.5px solid ${GRN_BD}`,
            borderRadius: 9, color: GRN, fontSize: "0.75rem", lineHeight: 1.5,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <CheckCircle size={13} />
            <span>Tus datos quedan protegidos. El DNI debe coincidir con RENIEC y es único en el sistema.</span>
          </div>

          <button type="submit" disabled={loading} style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            height: 46, borderRadius: 10,
            border: `1.5px solid ${G}`, background: G, color: "#fff",
            fontSize: "0.9375rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit", opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "Guardando…" : "Completar perfil y continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}
