"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Save, UserCog, MapPin, Trash2,
  CheckCircle2, Activity, KeyRound,
  Loader2, CheckCircle, AlertTriangle, Search, Copy, Check,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSetBreadcrumbTitle } from "@/hooks/useBreadcrumbTitle";

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
type DniLookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; nombreCompleto: string }
  | { state: "not_found" }
  | { state: "error"; message: string };

/* ── Design tokens ── */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK3 = "#d4d4d8";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
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
  width: "100%", height: 38, padding: "0 12px", borderRadius: 8,
  border: `1px solid ${INK2}`, fontSize: "0.875rem",
  color: INK9, fontFamily: "inherit", outline: "none",
  background: "#fff", transition: "border-color 0.15s", boxSizing: "border-box",
};
const LABEL_S: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase", color: INK5, marginBottom: 6,
};
const BTN_PRIMARY: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  height: 32, padding: "0 14px", borderRadius: 7,
  border: "none", background: INK9, color: "#fff",
  fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
  fontFamily: "inherit", transition: "opacity 0.15s",
};
// Botón de selección uniforme — usado en grids de Estado y Rol
const PILL_BTN_BASE: React.CSSProperties = {
  height: 34, padding: "0 10px", borderRadius: 7,
  fontSize: "0.8125rem", fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit",
  transition: "all 0.12s", textAlign: "center",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
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

function SectionCard({ icon, title, subtitle, children, action }: {
  icon: React.ReactNode; title: string; subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${INK1}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: INK1, border: `1px solid ${INK2}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9, lineHeight: 1.25 }}>{title}</div>
          {subtitle && <div style={{ fontSize: "0.75rem", color: INK5, lineHeight: 1.3, marginTop: 1 }}>{subtitle}</div>}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
      <div style={{ padding: "16px 18px" }}>{children}</div>
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

  /* RENIEC lookup */
  const [dniLookup, setDniLookup] = useState<DniLookup>({ state: "idle" });
  const [dniHover, setDniHover] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Reemplaza el ID crudo del breadcrumb por el nombre real del usuario.
  // Mientras carga, el Topbar muestra el fallback estático "Detalle de usuario".
  useSetBreadcrumbTitle(target?.name);

  // Auto-lookup RENIEC al tipear los 8 dígitos del DNI.
  // Si el DNI está vacío o incompleto, se vuelve a "idle".
  // Si no aparece en RENIEC se permite igual completar los datos manualmente.
  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!/^\d{8}$/.test(dni)) {
      if (dniLookup.state !== "idle") setDniLookup({ state: "idle" });
      return;
    }
    setDniLookup({ state: "loading" });
    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/validar/dni", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ dni }),
        });
        const data = await res.json();
        // 404 → DNI realmente no existe en RENIEC.
        if (res.status === 404) { setDniLookup({ state: "not_found" }); return; }
        // 5xx → token o dominio no autorizado en apiperu.dev (problema de servicio).
        if (!res.ok || !data.success) {
          setDniLookup({ state: "error", message: data.error ?? "El servicio RENIEC no está disponible." });
          return;
        }
        const nombre = (data.data?.nombre_completo ?? "").toString().trim();
        setDniLookup({ state: "ok", nombreCompleto: nombre });
        // Auto-aplica el nombre SIEMPRE al verificar RENIEC.
        setName(nombre);
      } catch {
        setDniLookup({ state: "error", message: "No se pudo verificar el DNI." });
      }
    }, 350);
    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dni]);

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

          {/* Datos personales — DNI con verificación RENIEC, nombre y teléfono */}
          <SectionCard
            icon={<Save size={14} color={INK6} />}
            title="Datos personales"
            subtitle="Documento de identidad, nombre y teléfono"
            action={
              <button onClick={() => { void saveProfile(); }} disabled={saving}
                style={{ ...BTN_PRIMARY, height: 28, padding: "0 10px", fontSize: "0.75rem",
                  opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer",
                }}>
                <Save size={11} />{saving ? "…" : "Guardar"}
              </button>
            }
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* DNI primero — al validar autocompleta nombre */}
              <div>
                <label style={LABEL_S}>
                  DNI / Documento
                  <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>
                    (verificación RENIEC)
                  </span>
                </label>
                <div
                  style={{ position: "relative" }}
                  onMouseEnter={() => setDniHover(true)}
                  onMouseLeave={() => setDniHover(false)}
                >
                  <input
                    value={dni}
                    onChange={e => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="12345678"
                    inputMode="numeric"
                    aria-describedby={dniLookup.state !== "idle" ? "dni-status" : undefined}
                    style={{
                      ...FIELD,
                      fontFamily: "ui-monospace, monospace",
                      paddingRight: 38,
                      borderColor: dniLookup.state === "ok" ? GRN
                        : dniLookup.state === "not_found" ? "#F59E0B"
                        : dniLookup.state === "error" ? RED
                        : INK2,
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = dniLookup.state === "ok" ? GRN
                        : dniLookup.state === "not_found" ? "#F59E0B"
                        : dniLookup.state === "error" ? RED
                        : INK2;
                    }}
                  />
                  <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    {dniLookup.state === "loading"   && <Loader2 size={15} color={INK5} style={{ animation: "spin 0.7s linear infinite" }} />}
                    {dniLookup.state === "ok"        && <CheckCircle size={15} color={GRN} />}
                    {dniLookup.state === "not_found" && <AlertTriangle size={15} color="#F59E0B" />}
                    {dniLookup.state === "error"     && <AlertTriangle size={15} color={RED} />}
                  </div>

                  {/* Popover de estado RENIEC — aparece al hover sobre el campo */}
                  {dniHover && dniLookup.state !== "idle" && (
                    <div
                      id="dni-status"
                      role="status"
                      aria-live="polite"
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        background: "#fff",
                        border: `1px solid ${
                          dniLookup.state === "ok" ? GRNBD
                          : dniLookup.state === "not_found" ? "#FDE68A"
                          : dniLookup.state === "error" ? REDBD
                          : INK2
                        }`,
                        borderRadius: 8,
                        padding: "10px 12px",
                        boxShadow: "0 8px 24px rgba(9,9,11,0.10), 0 1px 2px rgba(9,9,11,0.06)",
                        animation: "fadeIn 120ms ease",
                      }}
                    >
                      {dniLookup.state === "loading" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Loader2 size={13} color={INK5} style={{ animation: "spin 0.7s linear infinite" }} />
                          <span style={{ fontSize: "0.8125rem", color: INK6 }}>Consultando RENIEC…</span>
                        </div>
                      )}

                      {dniLookup.state === "ok" && (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <CheckCircle size={12} color={GRN} />
                            <span style={{ fontSize: "0.625rem", fontWeight: 800, color: GRN, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                              RENIEC verificado
                            </span>
                          </div>
                          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9, lineHeight: 1.35, wordBreak: "break-word" }}>
                            {dniLookup.nombreCompleto}
                          </div>
                          {name.trim().toLowerCase() !== dniLookup.nombreCompleto.toLowerCase() && (
                            <button
                              type="button"
                              onClick={() => setName(dniLookup.nombreCompleto)}
                              style={{
                                marginTop: 8, width: "100%",
                                height: 28, borderRadius: 6,
                                border: `1px solid ${GRN}`, background: GRNBG, color: GRN,
                                fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                              }}
                            >
                              Usar este nombre
                            </button>
                          )}
                        </>
                      )}

                      {dniLookup.state === "not_found" && (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <AlertTriangle size={12} color="#92400E" />
                            <span style={{ fontSize: "0.625rem", fontWeight: 800, color: "#92400E", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                              No registrado
                            </span>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: INK6, lineHeight: 1.5 }}>
                            DNI no encontrado en RENIEC. Puedes completar el nombre manualmente.
                          </div>
                        </>
                      )}

                      {dniLookup.state === "error" && (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <AlertTriangle size={12} color={RED} />
                            <span style={{ fontSize: "0.625rem", fontWeight: 800, color: RED, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                              Servicio no disponible
                            </span>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: INK6, lineHeight: 1.5 }}>
                            {dniLookup.message} Ingresa el nombre manualmente.
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={LABEL_S}>Teléfono</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="987 654 321" style={FIELD}
                  onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                  onBlur={e => { e.currentTarget.style.borderColor = INK2; }}
                />
              </div>

              <div style={{ gridColumn: "span 2" }}>
                <label style={LABEL_S}>Nombre completo <span style={{ color: RED }}>*</span></label>
                <input value={name} onChange={e => setName(e.target.value)} style={FIELD}
                  onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                  onBlur={e => { e.currentTarget.style.borderColor = INK2; }}
                />
              </div>
            </div>

          </SectionCard>

          {/* Estado + Rol — agrupados en 2 columnas, botones de acción en el header */}
          <div
            className={roles.length > 0 ? "grid grid-cols-1 md:grid-cols-2 gap-4" : ""}
            style={roles.length > 0 ? undefined : { display: "block" }}
          >
            <SectionCard
              icon={<Activity size={14} color={INK6} />}
              title="Estado de la cuenta"
              subtitle="Activa, suspende o rechaza el acceso"
              action={
                <button onClick={() => { void saveStatus(); }} disabled={saving || selStatus === target.status}
                  style={{ ...BTN_PRIMARY, height: 28, padding: "0 10px", fontSize: "0.75rem",
                    opacity: saving || selStatus === target.status ? 0.4 : 1,
                    cursor: saving || selStatus === target.status ? "not-allowed" : "pointer",
                  }}>
                  {saving ? "…" : "Aplicar"}
                </button>
              }
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                {(["activo", "pendiente", "suspendido", "rechazado"] as const).map(s => {
                  const m = STATUS_META[s];
                  const isSelected = selStatus === s;
                  return (
                    <button key={s} onClick={() => setSelStatus(s)} style={{
                      ...PILL_BTN_BASE,
                      border: `1px solid ${isSelected ? m.color : INK2}`,
                      background: isSelected ? m.bg : "#fff",
                      color: isSelected ? m.color : INK6,
                      fontWeight: isSelected ? 600 : 500,
                      boxShadow: isSelected ? `inset 0 0 0 1px ${m.color}` : "none",
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: isSelected ? m.color : INK3, flexShrink: 0 }} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {/* Rol — solo si el actor puede asignar roles a este usuario */}
            {roles.length > 0 && (
              <SectionCard
                icon={<UserCog size={14} color={INK6} />}
                title="Rol del usuario"
                subtitle="Define los permisos de acceso"
                action={
                  <button onClick={() => { void saveRole(); }} disabled={saving || selRole === target.role}
                    style={{ ...BTN_PRIMARY, height: 28, padding: "0 10px", fontSize: "0.75rem",
                      opacity: saving || selRole === target.role ? 0.4 : 1,
                      cursor: saving || selRole === target.role ? "not-allowed" : "pointer",
                    }}>
                    {saving ? "…" : "Cambiar"}
                  </button>
                }
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                  {roles.map(r => {
                    const isSelected = selRole === r;
                    return (
                      <button key={r} onClick={() => setSelRole(r)} style={{
                        ...PILL_BTN_BASE,
                        border: `1px solid ${isSelected ? INK9 : INK2}`,
                        background: isSelected ? INK1 : "#fff",
                        color: isSelected ? INK9 : INK6,
                        fontWeight: isSelected ? 600 : 500,
                        boxShadow: isSelected ? `inset 0 0 0 1px ${INK9}` : "none",
                      }}>
                        {ROLE_LABELS[r] ?? r}
                      </button>
                    );
                  })}
                </div>
              </SectionCard>
            )}
          </div>

          {/* Contraseña — solo super_admin */}
          {canPass && (
            <SectionCard
              icon={<KeyRound size={14} color={INK6} />}
              title="Restablecer contraseña"
              subtitle={target.provider === "google"
                ? "Este usuario usa Google — se establecerá una contraseña adicional"
                : "Establece una nueva contraseña para este usuario"}
              action={
                <button onClick={() => { void savePassword(); }} disabled={saving || !newPass || !confirmPass}
                  style={{ ...BTN_PRIMARY, height: 28, padding: "0 10px", fontSize: "0.75rem",
                    opacity: saving || !newPass || !confirmPass ? 0.4 : 1,
                    cursor: saving || !newPass || !confirmPass ? "not-allowed" : "pointer",
                  }}>
                  {saving ? "…" : "Restablecer"}
                </button>
              }
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
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
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: INK5, cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={showPass} onChange={e => setShowPass(e.target.checked)}
                  style={{ width: 13, height: 13, cursor: "pointer" }} />
                Mostrar contraseñas
              </label>
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
              <SystemIdRow id={target.id} />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: INK1, borderRadius: 8 }}>
                <span style={{ fontSize: "0.8125rem", color: INK5 }}>Registrado</span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9 }}>
                  {new Date(target.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>

          {/* Acciones rápidas — eliminación al pie del sidebar */}
          {canDelete && (
            <DangerZoneSidebar
              targetName={target.name}
              targetEmail={target.email}
              onDelete={() => { void deleteUser(); }}
              deleting={deleting}
              confirmDel={confirmDel}
              setConfirmDel={setConfirmDel}
            />
          )}

        </div>
      </div>
    </div>
  );
}

/* ── ID del sistema con copy-to-clipboard (legible y compacto) ── */
function SystemIdRow({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const shortId = id.slice(-8).toUpperCase();
  return (
    <div>
      <div style={{ fontSize: "0.6875rem", color: INK5, marginBottom: 4 }}>ID del sistema</div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
        background: INK1, padding: "6px 10px", borderRadius: 7,
      }}>
        <code title={id} style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: "0.75rem",
          color: INK9,
          fontWeight: 600,
          letterSpacing: "0.04em",
          fontVariantNumeric: "tabular-nums",
        }}>
          {shortId}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(id);
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            } catch { /* clipboard may be blocked */ }
          }}
          title="Copiar ID completo"
          aria-label="Copiar ID completo"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            height: 24, padding: "0 8px", borderRadius: 6,
            border: `1px solid ${INK2}`, background: "#fff", color: INK6,
            fontSize: "0.6875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            transition: "all 120ms",
          }}
        >
          {copied ? <Check size={11} color={GRN} /> : <Copy size={11} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

/* ── Zona de peligro compacta para el sidebar ── */
function DangerZoneSidebar({
  targetName, targetEmail, onDelete, deleting, confirmDel, setConfirmDel,
}: {
  targetName: string; targetEmail: string;
  onDelete: () => void; deleting: boolean;
  confirmDel: boolean; setConfirmDel: (v: boolean) => void;
}) {
  return (
    <div style={{
      background: "#fff", border: `1.5px solid ${REDBD}`, borderRadius: 14,
      padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Trash2 size={13} color={RED} />
        <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: RED }}>
          Zona de peligro
        </div>
      </div>

      {!confirmDel ? (
        <>
          <p style={{ fontSize: "0.75rem", color: INK5, lineHeight: 1.5, margin: 0 }}>
            Eliminar este usuario es permanente. Se borrarán todos sus datos.
          </p>
          <button
            onClick={() => setConfirmDel(true)}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              height: 34, padding: "0 12px", borderRadius: 8,
              border: `1.5px solid ${REDBD}`, background: REDBG, color: RED,
              fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Trash2 size={13} />Eliminar usuario
          </button>
        </>
      ) : (
        <div style={{ background: REDBG, border: `1.5px solid ${REDBD}`, borderRadius: 9, padding: "12px 14px" }}>
          <div style={{ fontWeight: 700, color: RED, marginBottom: 4, fontSize: "0.8125rem" }}>¿Confirmar?</div>
          <p style={{ fontSize: "0.75rem", color: INK6, marginBottom: 12, lineHeight: 1.5 }}>
            Eliminarás a <strong>{targetName}</strong> ({targetEmail}). No hay vuelta atrás.
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onDelete} disabled={deleting}
              style={{
                flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                height: 32, borderRadius: 7, border: "none", background: RED, color: "#fff",
                fontSize: "0.75rem", fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer",
                fontFamily: "inherit", opacity: deleting ? 0.7 : 1,
              }}>
              <Trash2 size={11} />{deleting ? "…" : "Sí, eliminar"}
            </button>
            <button onClick={() => setConfirmDel(false)}
              style={{
                flex: 1, height: 32, borderRadius: 7,
                border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
                fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
