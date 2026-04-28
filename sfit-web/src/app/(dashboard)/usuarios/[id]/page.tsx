"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Save, UserCog, MapPin, Trash2,
  CheckCircle2, Activity, KeyRound,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

/* ── Types ── */
type UserDetail = {
  id: string; name: string; email: string;
  role: string; status: string;
  phone?: string | null; dni?: string | null;
  image?: string | null; provider?: string;
  provinceId?: string | null; provinceName?: string | null;
  municipalityId?: string | null; municipalityName?: string | null;
  createdAt: string;
};
type Province     = { id: string; name: string };
type Municipality = { id: string; name: string; provinceId: string };
type StoredUser   = { id: string; role: string };

/* ── Design tokens ── */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a";
const INK6 = "#52525b"; const INK9 = "#18181b";
const RED  = "#DC2626"; const REDBG = "#FFF5F5"; const REDBD = "#FCA5A5";
const GRN  = "#15803d"; const GRNBG = "#F0FDF4"; const GRNBD = "#86EFAC";

const ROLE_LABELS: Record<string, string> = {
  super_admin:      "Super Administrador",
  admin_provincial: "Administrador Provincial",
  admin_municipal:  "Administrador Municipal",
  fiscal:           "Fiscal / Inspector",
  operador:         "Operador",
  conductor:        "Conductor",
  ciudadano:        "Ciudadano",
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; bd: string }> = {
  activo:     { label: "Activo",     color: GRN,      bg: GRNBG,    bd: GRNBD    },
  pendiente:  { label: "Pendiente",  color: "#92400e", bg: "#FFFBEB", bd: "#FDE68A" },
  suspendido: { label: "Suspendido", color: RED,       bg: REDBG,    bd: REDBD    },
  rechazado:  { label: "Rechazado",  color: INK6,      bg: INK1,     bd: INK2     },
};

const FIELD: React.CSSProperties = {
  width: "100%", height: 44, padding: "0 14px", borderRadius: 10,
  border: `1.5px solid ${INK2}`, fontSize: "0.9375rem",
  color: INK9, fontFamily: "inherit", outline: "none",
  background: "#fff", transition: "border-color 0.15s", boxSizing: "border-box",
};
const LABEL_S: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 8,
};
const BTN_PRIMARY: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7,
  height: 40, padding: "0 20px", borderRadius: 10,
  border: "none", background: INK9, color: "#fff",
  fontSize: "0.875rem", fontWeight: 700, cursor: "pointer",
  fontFamily: "inherit", transition: "opacity 0.15s",
};
const SELECT_ARROW = (
  <svg viewBox="0 0 10 6" width="10" height="10"
    style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
    fill="none">
    <path d="M1 1l4 4 4-4" stroke={INK5} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function getToken() {
  return typeof window === "undefined" ? "" : (localStorage.getItem("sfit_access_token") ?? "");
}

function assignableRoles(actorRole: string): string[] {
  if (actorRole === "super_admin")      return ["super_admin", "admin_provincial", "admin_municipal", "fiscal", "operador", "conductor", "ciudadano"];
  if (actorRole === "admin_provincial") return ["admin_municipal", "fiscal", "operador", "conductor", "ciudadano"];
  if (actorRole === "admin_municipal")  return ["fiscal", "operador", "conductor", "ciudadano"];
  return [];
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

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.pendiente;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 6,
      fontSize: "0.6875rem", fontWeight: 700,
      background: m.bg, color: m.color, border: `1px solid ${m.bd}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

export default function UsuarioDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id     = params?.id;

  const [actor,          setActor]          = useState<StoredUser | null>(null);
  const [target,         setTarget]         = useState<UserDetail | null>(null);
  const [provinces,      setProvinces]      = useState<Province[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);

  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  /* Edit state */
  const [name,        setName]        = useState("");
  const [phone,       setPhone]       = useState("");
  const [dni,         setDni]         = useState("");
  const [selRole,     setSelRole]     = useState("");
  const [selProv,     setSelProv]     = useState("");
  const [selMuni,     setSelMuni]     = useState("");
  const [selStatus,   setSelStatus]   = useState("");
  const [newPass,     setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass,    setShowPass]    = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!["super_admin", "admin_provincial", "admin_municipal"].includes(u.role)) {
      router.replace("/dashboard"); return;
    }
    setActor(u);
  }, [router]);

  const fetchTarget = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/usuarios/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json() as { success: boolean; data?: UserDetail; error?: string };
      if (!res.ok || !data.success || !data.data) {
        setError(data.error ?? "No se pudo cargar el usuario."); return;
      }
      const u = data.data;
      setTarget(u);
      setName(u.name ?? "");
      setPhone(u.phone ?? "");
      setDni(u.dni ?? "");
      setSelRole(u.role);
      setSelProv(u.provinceId ?? "");
      setSelMuni(u.municipalityId ?? "");
      setSelStatus(u.status);
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }, [id, router]);

  const fetchRefs = useCallback(async () => {
    try {
      const [pr, mr] = await Promise.all([
        fetch("/api/provincias",      { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch("/api/municipalidades", { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      if (pr.ok) {
        const d = await pr.json() as { success: boolean; data?: { items: Province[] } };
        if (d.success) setProvinces(d.data?.items ?? []);
      }
      if (mr.ok) {
        const d = await mr.json() as { success: boolean; data?: { items: Municipality[] } };
        if (d.success) setMunicipalities(d.data?.items ?? []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { if (actor) { void fetchTarget(); void fetchRefs(); } }, [actor, fetchTarget, fetchRefs]);

  const filteredMunis = useMemo(() =>
    selProv ? municipalities.filter(m => m.provinceId === selProv) : municipalities,
  [municipalities, selProv]);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3500);
  }

  async function patch(body: Record<string, unknown>, msg: string) {
    if (!target) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const res = await fetch(`/api/admin/usuarios/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { success: boolean; data?: UserDetail; error?: string };
      if (!res.ok || !data.success) { setError(data.error ?? "Error al guardar."); return; }
      showSuccess(msg);
      await fetchTarget();
    } catch { setError("Error de conexión."); }
    finally { setSaving(false); }
  }

  async function saveProfile()  { await patch({ name: name.trim(), phone: phone.trim() || null, dni: dni.trim() || null }, "Datos personales actualizados."); }
  async function saveRole()     { await patch({ role: selRole }, "Rol actualizado correctamente."); }
  async function saveLocation() { await patch({ provinceId: selProv || null, municipalityId: selMuni || null }, "Ubicación actualizada correctamente."); }
  async function saveStatus()   { await patch({ status: selStatus }, "Estado actualizado correctamente."); }

  async function savePassword() {
    if (newPass.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (newPass !== confirmPass) { setError("Las contraseñas no coinciden."); return; }
    await patch({ password: newPass }, "Contraseña restablecida correctamente.");
    setNewPass(""); setConfirmPass("");
  }

  async function deleteUser() {
    if (!target) return;
    setDeleting(true); setError(null);
    try {
      const res = await fetch(`/api/admin/usuarios/${target.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (!res.ok || !data.success) { setError(data.error ?? "No se pudo eliminar."); setDeleting(false); return; }
      router.replace("/usuarios");
    } catch { setError("Error de conexión."); setDeleting(false); }
  }

  if (!actor) return null;

  const roles     = assignableRoles(actor.role);
  const isSA      = actor.role === "super_admin";
  const canDelete = isSA && target?.id !== actor.id;
  const canPass   = isSA;

  const backBtn = (
    <Link href="/usuarios">
      <button style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 9, border: "1.5px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
        <ArrowLeft size={15} />Volver
      </button>
    </Link>
  );

  /* ── Skeleton ── */
  if (loading) return (
    <div className="animate-fade-in flex flex-col gap-4">
      <PageHeader kicker="Usuarios · RF-01" title="Cargando usuario…" action={backBtn} />
      <div className="sfit-aside-layout">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[160, 140, 120].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 14, background: "#fff", border: `1px solid ${INK2}`, overflow: "hidden", position: "relative" }}>
              <div className="skeleton-shimmer" style={{ position: "absolute", inset: 0 }} />
            </div>
          ))}
        </div>
        <div style={{ height: 260, borderRadius: 14, background: "#fff", border: `1px solid ${INK2}`, overflow: "hidden", position: "relative" }}>
          <div className="skeleton-shimmer" style={{ position: "absolute", inset: 0 }} />
        </div>
      </div>
    </div>
  );

  /* ── Not found ── */
  if (!target) return (
    <div className="animate-fade-in flex flex-col gap-4">
      <PageHeader kicker="Usuarios · RF-01" title="Usuario no encontrado" action={backBtn} />
      <p style={{ color: INK5, marginTop: 8 }}>{error ?? "No se encontró el usuario solicitado."}</p>
    </div>
  );

  const initials = target.name.split(" ").map(w => w[0] ?? "").slice(0, 2).join("").toUpperCase();

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      <PageHeader
        kicker="Usuarios · RF-01"
        title={target.name}
        subtitle={target.email}
        action={backBtn}
      />

      {/* ── Banners ── */}
      {error && (
        <div style={{ padding: "11px 16px", background: REDBG, border: `1.5px solid ${REDBD}`, borderRadius: 10, color: RED, fontSize: "0.875rem", fontWeight: 500 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: "11px 16px", background: GRNBG, border: `1.5px solid ${GRNBD}`, borderRadius: 10, color: GRN, fontSize: "0.875rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={15} />{success}
        </div>
      )}

      {/* ── Two-column grid ── */}
      <div className="sfit-aside-layout">

        {/* ─── Columna principal ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Datos personales */}
          <SectionCard icon={<Save size={16} color={INK6} />} title="Datos personales" subtitle="Nombre, teléfono y documento de identidad">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ gridColumn: "span 2" }}>
                <label style={LABEL_S}>Nombre completo <span style={{ color: RED }}>*</span></label>
                <input value={name} onChange={e => setName(e.target.value)} style={FIELD}
                  onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                  onBlur={e => { e.currentTarget.style.borderColor = INK2; }}
                />
              </div>
              <div>
                <label style={LABEL_S}>Teléfono</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="987 654 321" style={FIELD}
                  onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                  onBlur={e => { e.currentTarget.style.borderColor = INK2; }}
                />
              </div>
              <div>
                <label style={LABEL_S}>DNI / Documento</label>
                <input value={dni} onChange={e => setDni(e.target.value)} placeholder="12345678" style={FIELD}
                  onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                  onBlur={e => { e.currentTarget.style.borderColor = INK2; }}
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={() => { void saveProfile(); }} disabled={saving}
                style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
                <Save size={14} />{saving ? "Guardando…" : "Guardar datos"}
              </button>
            </div>
          </SectionCard>

          {/* Estado de la cuenta */}
          <SectionCard icon={<Activity size={16} color={INK6} />} title="Estado de la cuenta" subtitle="Activa, suspende o rechaza el acceso del usuario">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
              {(["activo", "pendiente", "suspendido", "rechazado"] as const).map(s => {
                const m = STATUS_META[s];
                const isSelected = selStatus === s;
                return (
                  <button key={s} onClick={() => setSelStatus(s)} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
                    fontSize: "0.8125rem", fontWeight: isSelected ? 700 : 500,
                    border: isSelected ? `2px solid ${m.color}` : `1.5px solid ${INK2}`,
                    background: isSelected ? m.bg : "#fff",
                    color: isSelected ? m.color : INK6,
                    transition: "all 0.15s",
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: isSelected ? m.color : INK2, flexShrink: 0 }} />
                    {m.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => { void saveStatus(); }} disabled={saving || selStatus === target.status}
                style={{ ...BTN_PRIMARY, opacity: saving || selStatus === target.status ? 0.4 : 1, cursor: saving || selStatus === target.status ? "not-allowed" : "pointer" }}>
                <Activity size={14} />{saving ? "Guardando…" : "Aplicar estado"}
              </button>
            </div>
          </SectionCard>

          {/* Contraseña — solo super_admin */}
          {canPass && (
            <SectionCard
              icon={<KeyRound size={16} color={INK6} />}
              title="Restablecer contraseña"
              subtitle={target.provider === "google"
                ? "Este usuario usa Google — se establecerá una contraseña adicional"
                : "Establece una nueva contraseña para este usuario"}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={LABEL_S}>Nueva contraseña <span style={{ color: RED }}>*</span></label>
                  <input
                    type={showPass ? "text" : "password"}
                    value={newPass} onChange={e => setNewPass(e.target.value)}
                    placeholder="Mínimo 8 caracteres" style={FIELD}
                    onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                    onBlur={e => { e.currentTarget.style.borderColor = INK2; }}
                  />
                </div>
                <div>
                  <label style={LABEL_S}>Confirmar contraseña <span style={{ color: RED }}>*</span></label>
                  <input
                    type={showPass ? "text" : "password"}
                    value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                    placeholder="Repite la contraseña" style={FIELD}
                    onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                    onBlur={e => { e.currentTarget.style.borderColor = INK2; }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.8125rem", color: INK5, cursor: "pointer", userSelect: "none" }}>
                  <input type="checkbox" checked={showPass} onChange={e => setShowPass(e.target.checked)}
                    style={{ width: 14, height: 14, cursor: "pointer" }} />
                  Mostrar contraseñas
                </label>
                <button onClick={() => { void savePassword(); }} disabled={saving || !newPass || !confirmPass}
                  style={{ ...BTN_PRIMARY, opacity: saving || !newPass || !confirmPass ? 0.4 : 1, cursor: saving || !newPass || !confirmPass ? "not-allowed" : "pointer" }}>
                  <KeyRound size={14} />{saving ? "Guardando…" : "Restablecer"}
                </button>
              </div>
            </SectionCard>
          )}

          {/* Rol */}
          {roles.length > 0 && (
            <SectionCard icon={<UserCog size={16} color={INK6} />} title="Rol del usuario" subtitle="Define los permisos de acceso al sistema">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                {roles.map(r => (
                  <button key={r} onClick={() => setSelRole(r)} style={{
                    padding: "8px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
                    fontSize: "0.8125rem", fontWeight: selRole === r ? 700 : 500,
                    border: selRole === r ? `2px solid ${INK9}` : `1.5px solid ${INK2}`,
                    background: selRole === r ? INK1 : "#fff",
                    color: selRole === r ? INK9 : INK6,
                    transition: "all 0.15s",
                  }}>
                    {ROLE_LABELS[r] ?? r}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => { void saveRole(); }} disabled={saving || selRole === target.role}
                  style={{ ...BTN_PRIMARY, opacity: saving || selRole === target.role ? 0.4 : 1, cursor: saving || selRole === target.role ? "not-allowed" : "pointer" }}>
                  <UserCog size={14} />{saving ? "Guardando…" : "Cambiar rol"}
                </button>
              </div>
            </SectionCard>
          )}

          {/* Ubicación */}
          <SectionCard
            icon={<MapPin size={16} color={INK6} />}
            title="Provincia y municipalidad"
            subtitle={isSA ? "Reasigna el ámbito de trabajo del usuario" : "Scope asignado al usuario"}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: isSA ? 18 : 0 }}>
              <div>
                <label style={LABEL_S}>Provincia</label>
                <div style={{ position: "relative" }}>
                  <select value={selProv} onChange={e => { setSelProv(e.target.value); setSelMuni(""); }}
                    disabled={!isSA}
                    style={{ ...FIELD, appearance: "none", paddingRight: 36, cursor: isSA ? "pointer" : "default", opacity: isSA ? 1 : 0.5 }}>
                    <option value="">— Sin provincia —</option>
                    {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {SELECT_ARROW}
                </div>
              </div>
              <div>
                <label style={LABEL_S}>Municipalidad</label>
                <div style={{ position: "relative" }}>
                  <select value={selMuni} onChange={e => setSelMuni(e.target.value)}
                    disabled={!isSA || !selProv}
                    style={{ ...FIELD, appearance: "none", paddingRight: 36, cursor: isSA && selProv ? "pointer" : "default", opacity: isSA && selProv ? 1 : 0.5 }}>
                    <option value="">— Sin municipalidad —</option>
                    {filteredMunis.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  {SELECT_ARROW}
                </div>
              </div>
            </div>
            {isSA && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => { void saveLocation(); }} disabled={saving}
                  style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
                  <MapPin size={14} />{saving ? "Guardando…" : "Guardar ubicación"}
                </button>
              </div>
            )}
          </SectionCard>

          {/* Zona de peligro */}
          {canDelete && (
            <div style={{ background: "#fff", border: `1.5px solid ${REDBD}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "14px 24px", borderBottom: `1px solid ${REDBG}`, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: REDBG, border: `1.5px solid ${REDBD}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Trash2 size={15} color={RED} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: RED }}>Zona de peligro</div>
                  <div style={{ fontSize: "0.75rem", color: INK5 }}>Esta acción es permanente e irreversible</div>
                </div>
              </div>
              <div style={{ padding: "20px 24px" }}>
                {!confirmDel ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem", color: INK9, marginBottom: 3 }}>Eliminar usuario permanentemente</div>
                      <div style={{ fontSize: "0.8125rem", color: INK5 }}>Se borrarán todos los datos del usuario. No hay vuelta atrás.</div>
                    </div>
                    <button onClick={() => setConfirmDel(true)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 40, padding: "0 18px", borderRadius: 10, border: `1.5px solid ${REDBD}`, background: REDBG, color: RED, fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      <Trash2 size={14} />Eliminar usuario
                    </button>
                  </div>
                ) : (
                  <div style={{ background: REDBG, border: `1.5px solid ${REDBD}`, borderRadius: 10, padding: "16px 20px" }}>
                    <div style={{ fontWeight: 700, color: RED, marginBottom: 6, fontSize: "0.9375rem" }}>¿Confirmar eliminación?</div>
                    <p style={{ fontSize: "0.875rem", color: INK6, marginBottom: 16, lineHeight: 1.5 }}>
                      Estás a punto de eliminar a <strong>{target.name}</strong> ({target.email}). Esta operación no se puede deshacer.
                    </p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => { void deleteUser(); }} disabled={deleting}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 40, padding: "0 20px", borderRadius: 10, border: "none", background: RED, color: "#fff", fontSize: "0.875rem", fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: deleting ? 0.7 : 1 }}>
                        <Trash2 size={14} />{deleting ? "Eliminando…" : "Sí, eliminar"}
                      </button>
                      <button onClick={() => setConfirmDel(false)}
                        style={{ display: "inline-flex", alignItems: "center", height: 40, padding: "0 18px", borderRadius: 10, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Barra lateral ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Identidad */}
          <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "20px 20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, borderBottom: `1px solid ${INK1}` }}>
              {target.image ? (
                <Image src={target.image} alt={target.name} width={64} height={64}
                  style={{ borderRadius: "50%", objectFit: "cover" }} unoptimized />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: INK1, border: `2px solid ${INK2}`, display: "flex", alignItems: "center", justifyContent: "center", color: INK6, fontWeight: 800, fontSize: "1.375rem" }}>
                  {initials || "?"}
                </div>
              )}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9, lineHeight: 1.3 }}>{target.name}</div>
                <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 3 }}>{target.email}</div>
                <div style={{ marginTop: 8 }}><StatusBadge status={target.status} /></div>
              </div>
            </div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Rol",       value: ROLE_LABELS[target.role] ?? target.role },
                { label: "Provincia", value: target.provinceName     ?? "—"          },
                { label: "Municipio", value: target.municipalityName ?? "—"          },
                { label: "Acceso",    value: target.provider         ?? "—"          },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "7px 10px", background: INK1, borderRadius: 8 }}>
                  <span style={{ fontSize: "0.8125rem", color: INK5, flexShrink: 0 }}>{row.label}</span>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9, textAlign: "right", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 10 }}>
              Información del registro
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <div style={{ fontSize: "0.6875rem", color: INK5, marginBottom: 4 }}>ID del sistema</div>
                <div style={{ fontFamily: "monospace", fontSize: "0.7rem", color: INK6, background: INK1, padding: "6px 10px", borderRadius: 7, wordBreak: "break-all", letterSpacing: "0.01em", lineHeight: 1.5 }}>
                  {target.id}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: INK1, borderRadius: 8 }}>
                <span style={{ fontSize: "0.8125rem", color: INK5 }}>Registrado</span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9 }}>
                  {new Date(target.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
