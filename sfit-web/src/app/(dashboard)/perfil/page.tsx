"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  User as UserIcon, Save, KeyRound, CheckCircle2, AlertTriangle,
  Mail, MapPin, Building2, Eye, EyeOff, ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type Profile = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  provider?: string;
  phone: string | null;
  dni: string | null;
  image: string | null;
  municipalityId: string | null;
  municipalityName: string | null;
  provinceId: string | null;
  provinceName: string | null;
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  super_admin:      "Super Admin",
  admin_provincial: "Admin Provincial",
  admin_municipal:  "Admin Municipal",
  fiscal:           "Fiscal / Inspector",
  operador:         "Operador",
  conductor:        "Conductor",
  ciudadano:        "Ciudadano",
};

const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a";
const INK6 = "#52525b"; const INK9 = "#18181b";
const RED  = "#b91c1c"; const REDBG = "#FFF5F5"; const REDBD = "#FCA5A5";
const GRN  = "#15803d"; const GRNBG = "#F0FDF4"; const GRNBD = "#86EFAC";
const GOLD = "#926A09"; const GOLD_BG = "#FDF8EC"; const GOLD_BD = "#E8D090";

const FIELD: React.CSSProperties = {
  width: "100%", height: 44, padding: "0 14px",
  border: `1.5px solid ${INK2}`, borderRadius: 10,
  fontSize: "0.9375rem", color: INK9, fontFamily: "inherit",
  outline: "none", background: "#fff", transition: "border-color 0.15s",
  boxSizing: "border-box",
};
const LABEL: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 8,
};
const BTN_PRIMARY: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7,
  height: 42, padding: "0 22px", borderRadius: 10,
  border: "none", background: INK9, color: "#fff",
  fontSize: "0.875rem", fontWeight: 700, cursor: "pointer",
  fontFamily: "inherit", transition: "opacity 0.15s",
};

function getToken(): string {
  return typeof window === "undefined" ? "" : (localStorage.getItem("sfit_access_token") ?? "");
}

function SectionCard({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${INK1}`, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: INK1, border: `1.5px solid ${INK2}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9 }}>{title}</div>
          {subtitle && <div style={{ fontSize: "0.75rem", color: INK5 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ padding: "22px 24px" }}>{children}</div>
    </div>
  );
}

export default function PerfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Datos editables
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [dni,   setDni]   = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Cambio de password
  const [currentPass, setCurrentPass] = useState("");
  const [newPass,     setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [savingPass,  setSavingPass]  = useState(false);
  const [passError,   setPassError]   = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/auth/perfil", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json() as { success: boolean; data?: Profile; error?: string };
      if (!res.ok || !data.success || !data.data) {
        setError(data.error ?? "No se pudo cargar el perfil"); return;
      }
      setProfile(data.data);
      setName(data.data.name ?? "");
      setPhone(data.data.phone ?? "");
      setDni(data.data.dni ?? "");
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  function flashSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3500);
  }

  async function saveProfile() {
    if (!name.trim()) { setError("El nombre es requerido"); return; }
    setSavingProfile(true); setError(null); setSuccess(null);
    try {
      const res = await fetch("/api/auth/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          name:  name.trim(),
          phone: phone.trim() || null,
          dni:   dni.trim()   || null,
        }),
      });
      const data = await res.json() as { success: boolean; data?: Profile; error?: string; errors?: Record<string, string[]> };
      if (!res.ok || !data.success) {
        const firstErr = data.errors ? Object.values(data.errors)[0]?.[0] : null;
        setError(firstErr ?? data.error ?? "No se pudo guardar"); return;
      }
      flashSuccess("Datos personales actualizados");

      // Sincronizar localStorage para que el avatar/topbar muestre el nuevo nombre
      try {
        const raw = localStorage.getItem("sfit_user");
        if (raw) {
          const stored = JSON.parse(raw) as Record<string, unknown>;
          stored.name  = name.trim();
          stored.phone = phone.trim() || null;
          stored.dni   = dni.trim()   || null;
          localStorage.setItem("sfit_user", JSON.stringify(stored));
        }
      } catch { /* silent */ }

      await load();
    } catch { setError("Error de conexión"); }
    finally { setSavingProfile(false); }
  }

  async function changePassword() {
    setPassError(null); setPassSuccess(null);
    if (newPass.length < 8)        { setPassError("La nueva contraseña debe tener al menos 8 caracteres"); return; }
    if (newPass !== confirmPass)   { setPassError("Las contraseñas no coinciden"); return; }
    if (currentPass.length === 0)  { setPassError("Ingresa tu contraseña actual"); return; }

    setSavingPass(true);
    try {
      const res = await fetch("/api/auth/cambiar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (!res.ok || !data.success) {
        setPassError(data.error ?? "No se pudo cambiar la contraseña"); return;
      }
      setPassSuccess("Contraseña actualizada correctamente");
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
      setTimeout(() => setPassSuccess(null), 4000);
    } catch { setPassError("Error de conexión"); }
    finally { setSavingPass(false); }
  }

  if (loading) {
    return (
      <div className="animate-fade-in flex flex-col gap-4">
        <PageHeader kicker="Mi cuenta" title="Cargando perfil…" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 18 }}>
          <div style={{ height: 400, borderRadius: 14, background: INK1, position: "relative", overflow: "hidden" }}>
            <div className="skeleton-shimmer" style={{ position: "absolute", inset: 0 }} />
          </div>
          <div style={{ height: 280, borderRadius: 14, background: INK1, position: "relative", overflow: "hidden" }}>
            <div className="skeleton-shimmer" style={{ position: "absolute", inset: 0 }} />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="animate-fade-in flex flex-col gap-4">
        <PageHeader kicker="Mi cuenta" title="No se pudo cargar el perfil" />
        <p style={{ color: INK5 }}>{error ?? "Vuelve a intentarlo más tarde."}</p>
      </div>
    );
  }

  const isGoogle = profile.provider === "google";
  const initials = profile.name.split(" ").map(w => w[0] ?? "").slice(0, 2).join("").toUpperCase();

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      <PageHeader
        kicker="Mi cuenta"
        title="Mi perfil"
        subtitle="Administra tus datos personales y tu contraseña"
      />

      {error && (
        <div style={{ padding: "11px 16px", background: REDBG, border: `1.5px solid ${REDBD}`, borderRadius: 10, color: RED, fontSize: "0.875rem", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={15} />{error}
        </div>
      )}
      {success && (
        <div style={{ padding: "11px 16px", background: GRNBG, border: `1.5px solid ${GRNBD}`, borderRadius: 10, color: GRN, fontSize: "0.875rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={15} />{success}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 18, alignItems: "start" }}>

        {/* ── Columna principal ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Datos personales */}
          <SectionCard icon={<UserIcon size={16} color={INK6} />} title="Datos personales" subtitle="Tu nombre, teléfono y documento de identidad">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ gridColumn: "span 2" }}>
                <label style={LABEL}>Nombre completo <span style={{ color: RED }}>*</span></label>
                <input value={name} onChange={e => setName(e.target.value)} style={FIELD}
                  onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                  onBlur={e => { e.currentTarget.style.borderColor = INK2; }}
                />
              </div>
              <div>
                <label style={LABEL}>Teléfono</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="987 654 321" style={FIELD}
                  onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                  onBlur={e => { e.currentTarget.style.borderColor = INK2; }}
                />
              </div>
              <div>
                <label style={LABEL}>DNI</label>
                <input
                  value={dni} onChange={e => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="12345678" inputMode="numeric" maxLength={8}
                  style={FIELD}
                  onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                  onBlur={e => { e.currentTarget.style.borderColor = INK2; }}
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={() => { void saveProfile(); }} disabled={savingProfile}
                style={{ ...BTN_PRIMARY, opacity: savingProfile ? 0.6 : 1, cursor: savingProfile ? "not-allowed" : "pointer" }}>
                <Save size={14} />{savingProfile ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </SectionCard>

          {/* Cambio de contraseña */}
          <SectionCard
            icon={<KeyRound size={16} color={INK6} />}
            title="Contraseña"
            subtitle={isGoogle
              ? "Tu cuenta usa Google — gestiona tu contraseña desde Google"
              : "Cambia tu contraseña periódicamente para mantener tu cuenta segura"}
          >
            {isGoogle ? (
              <div style={{ padding: "14px 16px", background: GOLD_BG, border: `1.5px solid ${GOLD_BD}`, borderRadius: 10, color: GOLD, fontSize: "0.875rem", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  Inicias sesión con Google. La contraseña se gestiona desde tu cuenta de Google,
                  no desde SFIT.
                </div>
              </div>
            ) : (
              <>
                {passError && (
                  <div style={{ padding: "10px 14px", marginBottom: 14, background: REDBG, border: `1.5px solid ${REDBD}`, borderRadius: 10, color: RED, fontSize: "0.8125rem", fontWeight: 500 }}>
                    {passError}
                  </div>
                )}
                {passSuccess && (
                  <div style={{ padding: "10px 14px", marginBottom: 14, background: GRNBG, border: `1.5px solid ${GRNBD}`, borderRadius: 10, color: GRN, fontSize: "0.8125rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                    <CheckCircle2 size={14} />{passSuccess}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <div style={{ gridColumn: "span 3" }}>
                    <label style={LABEL}>Contraseña actual <span style={{ color: RED }}>*</span></label>
                    <input
                      type={showPass ? "text" : "password"}
                      value={currentPass} onChange={e => setCurrentPass(e.target.value)}
                      placeholder="Tu contraseña actual" style={FIELD}
                      onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                      onBlur={e => { e.currentTarget.style.borderColor = INK2; }}
                    />
                  </div>
                  <div>
                    <label style={LABEL}>Nueva contraseña <span style={{ color: RED }}>*</span></label>
                    <input
                      type={showPass ? "text" : "password"}
                      value={newPass} onChange={e => setNewPass(e.target.value)}
                      placeholder="Mínimo 8 caracteres" style={FIELD}
                      onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                      onBlur={e => { e.currentTarget.style.borderColor = INK2; }}
                    />
                  </div>
                  <div>
                    <label style={LABEL}>Confirmar nueva <span style={{ color: RED }}>*</span></label>
                    <input
                      type={showPass ? "text" : "password"}
                      value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                      placeholder="Repite la contraseña" style={FIELD}
                      onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                      onBlur={e => { e.currentTarget.style.borderColor = INK2; }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.8125rem", color: INK5, cursor: "pointer", userSelect: "none" }}>
                    <input type="checkbox" checked={showPass} onChange={e => setShowPass(e.target.checked)}
                      style={{ width: 14, height: 14, cursor: "pointer" }} />
                    {showPass ? <Eye size={13} /> : <EyeOff size={13} />}
                    Mostrar contraseñas
                  </label>
                  <button onClick={() => { void changePassword(); }} disabled={savingPass || !currentPass || !newPass || !confirmPass}
                    style={{ ...BTN_PRIMARY, opacity: savingPass || !currentPass || !newPass || !confirmPass ? 0.4 : 1, cursor: savingPass || !currentPass || !newPass || !confirmPass ? "not-allowed" : "pointer" }}>
                    <KeyRound size={14} />{savingPass ? "Cambiando…" : "Cambiar contraseña"}
                  </button>
                </div>
              </>
            )}
          </SectionCard>
        </div>

        {/* ── Barra lateral ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Identidad */}
          <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "20px 20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, borderBottom: `1px solid ${INK1}` }}>
              {profile.image ? (
                <Image src={profile.image} alt={profile.name} width={72} height={72}
                  style={{ borderRadius: "50%", objectFit: "cover" }} unoptimized />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: GOLD_BG, border: `2px solid ${GOLD_BD}`, display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontWeight: 800, fontSize: "1.5rem" }}>
                  {initials || "?"}
                </div>
              )}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9, lineHeight: 1.3 }}>{profile.name}</div>
                <div style={{ marginTop: 6 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 10px", borderRadius: 6,
                    background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BD}`,
                    fontSize: "0.6875rem", fontWeight: 700,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: GOLD }} />
                    {ROLE_LABELS[profile.role] ?? profile.role}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: INK1, borderRadius: 8 }}>
                <Mail size={13} color={INK5} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: "0.75rem", color: INK6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={profile.email}>
                  {profile.email}
                </span>
              </div>
              {profile.provinceName && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: INK1, borderRadius: 8 }}>
                  <MapPin size={13} color={INK5} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: "0.75rem", color: INK6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={profile.provinceName}>
                    {profile.provinceName}
                  </span>
                </div>
              )}
              {profile.municipalityName && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: INK1, borderRadius: 8 }}>
                  <Building2 size={13} color={INK5} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: "0.75rem", color: INK6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={profile.municipalityName}>
                    {profile.municipalityName}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: INK1, borderRadius: 8 }}>
                <span style={{ fontSize: "0.75rem", color: INK5 }}>Acceso</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: INK9, textTransform: "capitalize" }}>{profile.provider ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: INK1, borderRadius: 8 }}>
                <span style={{ fontSize: "0.75rem", color: INK5 }}>Miembro desde</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: INK9 }}>
                  {new Date(profile.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>

          {/* Tip */}
          <div style={{ padding: "14px 16px", background: GOLD_BG, border: `1.5px solid ${GOLD_BD}`, borderRadius: 12, fontSize: "0.8125rem", color: INK6, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, color: GOLD, marginBottom: 6 }}>Tu cuenta es solo tuya</div>
            Si necesitas cambiar tu rol, municipio o eliminar tu cuenta, contacta a un administrador del sistema.
          </div>
        </div>
      </div>
    </div>
  );
}
