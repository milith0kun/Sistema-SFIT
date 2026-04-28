"use client";

import { use as usePromise, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, User, Phone, CreditCard, Award, Clock, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

// ── Paleta SFIT ───────────────────────────────────────────────────────────────
const G = "#6C0606"; const GBG = "#FBEAEA"; const GBR = "#D9B0B0";
const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const RIESGO = "#b45309"; const RIESGOBG = "#FFFBEB"; const RIESGOBD = "#FCD34D";
const NO = "#DC2626"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

const VIEW_ROLES = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const EDIT_ROLES = ["admin_municipal", "super_admin"];
const LICENSE_CATEGORIES = ["A-I", "A-IIa", "A-IIb", "A-IIIa", "A-IIIb", "A-IIIc"];

interface Conductor {
  id: string; name: string; dni: string; licenseNumber: string;
  licenseCategory: string; companyId?: string; companyName?: string;
  phone?: string; status: "apto" | "riesgo" | "no_apto";
  continuousHours: number; restHours: number; reputationScore: number;
  active: boolean; createdAt: string; updatedAt: string;
}
interface Empresa { id: string; razonSocial: string }
interface FormData { name: string; dni: string; licenseNumber: string; licenseCategory: string; companyId: string; phone: string }
interface FieldErrors { name?: string; dni?: string; licenseNumber?: string; licenseCategory?: string }

const STATUS_CFG = {
  apto:    { label: "Apto",     color: APTO,   bg: APTOBG,   border: APTOBD,   icon: CheckCircle },
  riesgo:  { label: "Riesgo",   color: RIESGO, bg: RIESGOBG, border: RIESGOBD, icon: AlertTriangle },
  no_apto: { label: "No apto",  color: NO,     bg: NOBG,     border: NOBD,     icon: AlertTriangle },
};

const fieldStyle: React.CSSProperties = {
  width: "100%", height: 42, padding: "0 14px", borderRadius: 10,
  border: `1.5px solid ${INK2}`, fontSize: "0.9375rem", color: INK9,
  background: "#fff", outline: "none", boxSizing: "border-box",
  fontFamily: "var(--font-inter), Inter, sans-serif", transition: "border-color 150ms",
};

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK6, marginBottom: 6, letterSpacing: "0.02em" }}>
        {label}{required && <span style={{ color: NO, marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {error && <p style={{ marginTop: 5, fontSize: "0.8rem", color: NO, fontWeight: 500 }}>{error}</p>}
    </div>
  );
}

function DeleteModal({ name, onClose, onConfirm, loading }: { name: string; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(9,9,11,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${INK2}` }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: NOBG, border: `1px solid ${NOBD}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <Trash2 size={20} color={NO} strokeWidth={1.8} />
          </div>
          <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: INK9 }}>Eliminar conductor</div>
          <div style={{ fontSize: "0.875rem", color: INK5, marginTop: 4 }}>Esta acción no se puede deshacer.</div>
        </div>
        <div style={{ padding: "16px 24px" }}>
          <p style={{ fontSize: "0.9rem", color: INK6, marginBottom: 20 }}>
            ¿Confirmas que deseas eliminar a <strong style={{ color: INK9 }}>{name}</strong> del sistema?
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} disabled={loading} style={{ flex: 1, height: 40, borderRadius: 9, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}>
              Cancelar
            </button>
            <button onClick={onConfirm} disabled={loading} style={{ flex: 1, height: 40, borderRadius: 9, border: "none", background: NO, color: "#fff", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Eliminando…" : "Sí, eliminar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Props { params: Promise<{ id: string }> }

export default function ConductorDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadingConductor, setLoadingConductor] = useState(true);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [form, setForm] = useState<FormData>({ name: "", dni: "", licenseNumber: "", licenseCategory: "", companyId: "", phone: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    const tk = localStorage.getItem("sfit_access_token");
    if (!raw || !tk) { router.replace("/login"); return; }
    let user: { role?: string } = {};
    try { user = JSON.parse(raw); } catch { router.replace("/login"); return; }
    if (!user.role || !VIEW_ROLES.includes(user.role)) { router.replace("/conductores"); return; }
    setAuthorized(true);
    setCanEdit(EDIT_ROLES.includes(user.role ?? ""));
    setToken(tk);
  }, [router]);

  useEffect(() => {
    if (!authorized || !token) return;
    setLoadingConductor(true);
    fetch(`/api/conductores/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        if (res.status === 404) { setNotFound(true); return; }
        const body = await res.json();
        const data: Conductor = body?.data ?? body;
        setConductor(data);
        setForm({ name: data.name ?? "", dni: data.dni ?? "", licenseNumber: data.licenseNumber ?? "", licenseCategory: data.licenseCategory ?? "", companyId: data.companyId ?? "", phone: data.phone ?? "" });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingConductor(false));
  }, [authorized, token, id]);

  useEffect(() => {
    if (!authorized || !token) return;
    fetch("/api/empresas?limit=100", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(body => setEmpresas(body?.data?.items ?? []))
      .catch(() => setEmpresas([]));
  }, [authorized, token]);

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!form.name.trim() || form.name.trim().length < 2) next.name = "El nombre es requerido (mínimo 2 caracteres).";
    else if (form.name.trim().length > 160) next.name = "Máximo 160 caracteres.";
    if (!form.dni.trim() || form.dni.trim().length < 6) next.dni = "El DNI es requerido (mínimo 6 dígitos).";
    if (!form.licenseNumber.trim() || form.licenseNumber.trim().length < 4) next.licenseNumber = "Licencia requerida (mínimo 4 caracteres).";
    if (!form.licenseCategory) next.licenseCategory = "Seleccione la categoría de licencia.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null); setSuccessMsg(null);
    if (!validate()) return;
    setSubmitting(true);
    const payload: Record<string, unknown> = { name: form.name.trim(), dni: form.dni.trim(), licenseNumber: form.licenseNumber.trim(), licenseCategory: form.licenseCategory };
    if (form.companyId) payload.companyId = form.companyId;
    payload.phone = form.phone.trim() || undefined;
    try {
      const res = await fetch(`/api/conductores/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      if (res.ok) { const body = await res.json(); setConductor(body?.data ?? body); setSuccessMsg("Cambios guardados correctamente."); return; }
      const body = await res.json().catch(() => ({}));
      setServerError((body as { message?: string; error?: string })?.message ?? (body as { error?: string })?.error ?? `Error ${res.status}`);
    } catch { setServerError("Error de conexión. Intente nuevamente."); }
    finally { setSubmitting(false); }
  }

  async function handleDelete() {
    setDeleting(true); setServerError(null);
    try {
      const res = await fetch(`/api/conductores/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { router.push("/conductores"); return; }
      const body = await res.json().catch(() => ({}));
      setServerError((body as { message?: string; error?: string })?.message ?? (body as { error?: string })?.error ?? `Error ${res.status}`);
      setShowDeleteModal(false);
    } catch { setServerError("Error de conexión."); setShowDeleteModal(false); }
    finally { setDeleting(false); }
  }

  function handleChange(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setSuccessMsg(null);
    if (errors[field as keyof FieldErrors]) setErrors(prev => ({ ...prev, [field]: undefined }));
  }

  if (!authorized) return null;

  if (loadingConductor) {
    return (
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(100deg,#0A1628,#1A2D4A)", borderRadius: 12, padding: "18px 22px", marginBottom: 16 }}>
          <div className="skeleton-shimmer" style={{ height: 14, width: 120, borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ height: 26, width: 220, borderRadius: 8 }} />
        </div>
        {[1, 2, 3].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 12, marginBottom: 12 }} />)}
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(100deg,#0A1628,#1A2D4A)", borderRadius: 12, padding: "18px 22px", marginBottom: 20 }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: G, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Conductores</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff" }}>Conductor no encontrado</div>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: 24 }}>
          <p style={{ color: INK5, marginBottom: 16 }}>El conductor solicitado no existe o fue eliminado.</p>
          <Link href="/conductores" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 16px", borderRadius: 9, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}>
            <ArrowLeft size={15} />Volver a conductores
          </Link>
        </div>
      </div>
    );
  }

  const st = conductor ? STATUS_CFG[conductor.status] : null;
  const StIcon = st?.icon;
  const rep = conductor?.reputationScore ?? 0;
  const repColor = rep >= 70 ? APTO : rep >= 40 ? RIESGO : NO;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }} className="animate-fade-in">
      {showDeleteModal && conductor && (
        <DeleteModal name={conductor.name} onClose={() => setShowDeleteModal(false)} onConfirm={handleDelete} loading={deleting} />
      )}

      {/* Header */}
      <div style={{ background: "linear-gradient(100deg,#0A1628 0%,#111F38 55%,#1A2D4A 100%)", borderRadius: 12, padding: "18px 22px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: G, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>
            Conductores · {canEdit ? "Editar" : "Detalle"}
          </div>
          <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>{conductor?.name ?? "Conductor"}</div>
          {conductor && (
            <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
              DNI {conductor.dni} · Lic. {conductor.licenseNumber} · {conductor.licenseCategory}
            </div>
          )}
        </div>
        <Link href="/conductores" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 14px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)", fontWeight: 600, fontSize: "0.8125rem", textDecoration: "none", flexShrink: 0 }}>
          <ArrowLeft size={14} />Volver
        </Link>
      </div>

      {/* KPI Cards */}
      {conductor && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
          {/* Status */}
          <div style={{ background: st?.bg, border: `1px solid ${st?.border}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {StIcon && <StIcon size={15} color={st?.color} strokeWidth={2} />}
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: st?.color }}>Estado</span>
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: st?.color }}>{st?.label}</div>
          </div>

          {/* Reputación */}
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <TrendingUp size={15} color={repColor} strokeWidth={2} />
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: INK5 }}>Reputación</span>
            </div>
            <div style={{ fontSize: "1.375rem", fontWeight: 800, color: repColor, fontVariantNumeric: "tabular-nums" }}>
              {rep}<span style={{ fontSize: "0.75rem", fontWeight: 500, color: INK5 }}>/100</span>
            </div>
            <div style={{ height: 4, background: INK1, borderRadius: 999, marginTop: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${rep}%`, background: repColor, borderRadius: 999 }} />
            </div>
          </div>

          {/* Horas continuas */}
          <div style={{ background: conductor.continuousHours >= 8 ? NOBG : conductor.continuousHours >= 5 ? RIESGOBG : "#fff", border: `1px solid ${conductor.continuousHours >= 8 ? NOBD : conductor.continuousHours >= 5 ? RIESGOBD : INK2}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Clock size={15} color={conductor.continuousHours >= 8 ? NO : conductor.continuousHours >= 5 ? RIESGO : INK5} strokeWidth={2} />
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: INK5 }}>Horas cont.</span>
            </div>
            <div style={{ fontSize: "1.375rem", fontWeight: 800, color: INK9, fontVariantNumeric: "tabular-nums" }}>
              {conductor.continuousHours}<span style={{ fontSize: "0.75rem", fontWeight: 500, color: INK5 }}> h</span>
            </div>
          </div>

          {/* Horas descanso */}
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Award size={15} color={G} strokeWidth={2} />
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: INK5 }}>Descanso</span>
            </div>
            <div style={{ fontSize: "1.375rem", fontWeight: 800, color: INK9, fontVariantNumeric: "tabular-nums" }}>
              {conductor.restHours}<span style={{ fontSize: "0.75rem", fontWeight: 500, color: INK5 }}> h</span>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} noValidate>
        {/* Información personal */}
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${INK1}`, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: INK1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={15} color={INK6} strokeWidth={1.8} />
            </span>
            <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9 }}>Información personal</div>
          </div>
          <div style={{ padding: "18px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Nombre completo" error={errors.name} required={canEdit}>
                <input
                  type="text" value={form.name} maxLength={160}
                  onChange={e => handleChange("name", e.target.value)}
                  style={{ ...fieldStyle, ...(errors.name ? { borderColor: NO } : {}) }}
                  placeholder="Ej. Juan Carlos Pérez Quispe"
                  disabled={submitting || !canEdit} readOnly={!canEdit}
                  onFocus={e => { if (canEdit && !errors.name) e.target.style.borderColor = G; }}
                  onBlur={e => { if (!errors.name) e.target.style.borderColor = INK2; }}
                />
              </Field>
            </div>
            <Field label="DNI" error={errors.dni} required={canEdit}>
              <input
                type="text" value={form.dni} maxLength={20}
                onChange={e => handleChange("dni", e.target.value)}
                style={{ ...fieldStyle, ...(errors.dni ? { borderColor: NO } : {}) }}
                placeholder="Ej. 12345678"
                disabled={submitting || !canEdit} readOnly={!canEdit}
                onFocus={e => { if (canEdit && !errors.dni) e.target.style.borderColor = G; }}
                onBlur={e => { if (!errors.dni) e.target.style.borderColor = INK2; }}
              />
            </Field>
            <Field label="Teléfono">
              <div style={{ position: "relative" }}>
                <Phone size={14} color={INK5} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  type="tel" value={form.phone}
                  onChange={e => handleChange("phone", e.target.value)}
                  style={{ ...fieldStyle, paddingLeft: 36 }}
                  placeholder="Ej. 987654321"
                  disabled={submitting || !canEdit} readOnly={!canEdit}
                  onFocus={e => { if (canEdit) e.target.style.borderColor = G; }}
                  onBlur={e => { e.target.style.borderColor = INK2; }}
                />
              </div>
            </Field>
          </div>
        </div>

        {/* Licencia */}
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${INK1}`, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: INK1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CreditCard size={15} color={INK6} strokeWidth={1.8} />
            </span>
            <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9 }}>Datos de licencia</div>
          </div>
          <div style={{ padding: "18px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Número de licencia" error={errors.licenseNumber} required={canEdit}>
              <input
                type="text" value={form.licenseNumber} maxLength={30}
                onChange={e => handleChange("licenseNumber", e.target.value)}
                style={{ ...fieldStyle, ...(errors.licenseNumber ? { borderColor: NO } : {}), fontFamily: "ui-monospace,monospace", letterSpacing: "0.04em" }}
                placeholder="Ej. Q12345678"
                disabled={submitting || !canEdit} readOnly={!canEdit}
                onFocus={e => { if (canEdit && !errors.licenseNumber) e.target.style.borderColor = G; }}
                onBlur={e => { if (!errors.licenseNumber) e.target.style.borderColor = INK2; }}
              />
            </Field>
            <Field label="Categoría de licencia" error={errors.licenseCategory} required={canEdit}>
              {canEdit ? (
                <select
                  value={form.licenseCategory}
                  onChange={e => handleChange("licenseCategory", e.target.value)}
                  style={{ ...fieldStyle, appearance: "none", cursor: "pointer", ...(errors.licenseCategory ? { borderColor: NO } : {}) }}
                  disabled={submitting}
                  onFocus={e => { if (!errors.licenseCategory) e.target.style.borderColor = G; }}
                  onBlur={e => { if (!errors.licenseCategory) e.target.style.borderColor = INK2; }}
                >
                  <option value="">Seleccionar categoría…</option>
                  {LICENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              ) : (
                <input type="text" style={{ ...fieldStyle, background: INK1 }} value={form.licenseCategory} readOnly disabled />
              )}
            </Field>
          </div>
        </div>

        {/* Empresa */}
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${INK1}` }}>
            <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9 }}>Empresa de transporte</div>
          </div>
          <div style={{ padding: "18px 20px" }}>
            {canEdit ? (
              <select
                value={form.companyId}
                onChange={e => handleChange("companyId", e.target.value)}
                style={{ ...fieldStyle, maxWidth: 400, appearance: "none", cursor: "pointer" }}
                disabled={submitting}
                onFocus={e => { e.target.style.borderColor = G; }}
                onBlur={e => { e.target.style.borderColor = INK2; }}
              >
                <option value="">Sin empresa asignada</option>
                {empresas.map(emp => <option key={emp.id} value={emp.id}>{emp.razonSocial}</option>)}
              </select>
            ) : (
              <input type="text" style={{ ...fieldStyle, maxWidth: 400, background: INK1 }} value={conductor?.companyName ?? "Sin empresa asignada"} readOnly disabled />
            )}
          </div>
        </div>

        {/* Feedback */}
        {serverError && (
          <div style={{ padding: "12px 16px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, color: NO, fontSize: "0.875rem", fontWeight: 500, marginBottom: 12 }}>
            {serverError}
          </div>
        )}
        {successMsg && (
          <div style={{ padding: "12px 16px", background: APTOBG, border: `1px solid ${APTOBD}`, borderRadius: 10, color: APTO, fontSize: "0.875rem", fontWeight: 500, marginBottom: 12 }}>
            {successMsg}
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", paddingTop: 4 }}>
          {canEdit ? (
            <>
              <button
                type="submit"
                disabled={submitting || deleting}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 20px", borderRadius: 10, border: "none", background: INK9, color: "#fff", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit", opacity: submitting ? 0.7 : 1 }}
              >
                <Save size={15} />
                {submitting ? "Guardando…" : "Guardar cambios"}
              </button>
              <Link href="/conductores" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 18px", borderRadius: 10, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}>
                Cancelar
              </Link>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                disabled={submitting || deleting}
                onClick={() => setShowDeleteModal(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 18px", borderRadius: 10, border: `1.5px solid ${NOBD}`, background: NOBG, color: NO, fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                <Trash2 size={14} />
                Eliminar conductor
              </button>
            </>
          ) : (
            <Link href="/conductores" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 18px", borderRadius: 10, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}>
              <ArrowLeft size={14} />Volver a conductores
            </Link>
          )}
        </div>
      </form>

      {conductor && (
        <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: INK1, border: `1px solid ${INK2}`, fontSize: "0.8rem", color: INK5 }}>
          Creado: {new Date(conductor.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}
          {conductor.updatedAt !== conductor.createdAt && ` · Actualizado: ${new Date(conductor.updatedAt).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}`}
        </div>
      )}
    </div>
  );
}
