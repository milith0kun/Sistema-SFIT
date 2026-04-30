"use client";

import { use as usePromise, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Trash2, User, Phone, CreditCard, Award, Clock, TrendingUp,
  AlertTriangle, CheckCircle, Loader2, Hash, Copy, Check, Building2, Pencil,
} from "lucide-react";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSetBreadcrumbTitle } from "@/hooks/useBreadcrumbTitle";

/* Paleta sobria */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d"; const APTO_BG = "#F0FDF4"; const APTO_BD = "#86EFAC";
const RIESGO = "#B45309"; const RIESGO_BG = "#FFFBEB"; const RIESGO_BD = "#FDE68A";
const NO = "#DC2626"; const NO_BG = "#FFF5F5"; const NO_BD = "#FCA5A5";

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
interface FormData {
  name: string; dni: string; licenseNumber: string;
  licenseCategory: string; companyId: string; phone: string;
}
interface FieldErrors {
  name?: string; dni?: string; licenseNumber?: string; licenseCategory?: string;
}
type DniLookup =
  | { state: "idle" } | { state: "loading" }
  | { state: "ok"; nombreCompleto: string }
  | { state: "not_found" } | { state: "error"; message: string };

type LicenciaLookup =
  | { state: "idle" } | { state: "loading" }
  | { state: "ok"; numero: string; categoria: string; fechaVencimiento?: string; estado?: string }
  | { state: "not_found" } | { state: "error"; message: string };

const STATUS_META = {
  apto:    { label: "Apto",    color: APTO,   bg: APTO_BG,   bd: APTO_BD,   icon: CheckCircle },
  riesgo:  { label: "Riesgo",  color: RIESGO, bg: RIESGO_BG, bd: RIESGO_BD, icon: AlertTriangle },
  no_apto: { label: "No apto", color: NO,     bg: NO_BG,     bd: NO_BD,     icon: AlertTriangle },
};

const FIELD: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 12px", borderRadius: 8,
  border: `1px solid ${INK2}`, fontSize: "0.875rem", color: INK9,
  background: "#fff", outline: "none", boxSizing: "border-box",
  fontFamily: "var(--font-inter), Inter, sans-serif",
  transition: "border-color 150ms",
};
const READ: React.CSSProperties = { ...FIELD, background: INK1, color: INK6 };
const LABEL: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 6,
};

function Field({ label, error, required, hint, children }: {
  label: string; error?: string; required?: boolean; hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={LABEL}>
        {label}{required && <span style={{ color: NO, marginLeft: 3 }}>*</span>}
        {hint && (
          <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>
            {hint}
          </span>
        )}
      </label>
      {children}
      {error && <p style={{ marginTop: 5, fontSize: "0.75rem", color: NO, fontWeight: 500 }}>{error}</p>}
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
  const [form, setForm] = useState<FormData>({
    name: "", dni: "", licenseNumber: "", licenseCategory: "", companyId: "", phone: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Validación DNI con RENIEC
  const [dniLookup, setDniLookup] = useState<DniLookup>({ state: "idle" });
  const [dniHover, setDniHover] = useState(false);
  const dniTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Validación licencia con MTC (se dispara cuando DNI verifica OK)
  const [licLookup, setLicLookup] = useState<LicenciaLookup>({ state: "idle" });

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
        setForm({
          name: data.name ?? "", dni: data.dni ?? "",
          licenseNumber: data.licenseNumber ?? "",
          licenseCategory: data.licenseCategory ?? "",
          companyId: data.companyId ?? "", phone: data.phone ?? "",
        });
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

  // Breadcrumb dinámico
  useSetBreadcrumbTitle(conductor?.name);

  // Normaliza la categoría devuelta por MTC (ej. "A IIa") al formato local ("A-IIa").
  function normalizeCategoria(c: string): string {
    const trimmed = c.trim().toUpperCase();
    // Reemplaza espacios entre A y números por guión: "A IIa" → "A-IIa"
    const m = trimmed.match(/^A\s+([IVX]+[a-z]*)$/i);
    if (m) return `A-${m[1]}`;
    return c.trim();
  }

  // Auto-lookup MTC para la licencia, usando el DNI.
  // Se dispara automáticamente cuando el DNI verifica con RENIEC.
  const lookupLicencia = useCallback(async (dniValue: string) => {
    if (!/^\d{8}$/.test(dniValue) || !token) return;
    setLicLookup({ state: "loading" });
    try {
      const res = await fetch("/api/validar/licencia", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dni: dniValue }),
      });
      const data = await res.json();
      if (res.status === 404) { setLicLookup({ state: "not_found" }); return; }
      if (!res.ok || !data.success) {
        setLicLookup({ state: "error", message: data.error ?? "El servicio MTC no está disponible." });
        return;
      }
      const lic = data.data?.licencia ?? {};
      const numero = (lic.numero ?? "").toString().trim();
      const categoria = normalizeCategoria((lic.categoria ?? "").toString());
      const fechaVencimiento = (lic.fecha_vencimiento ?? "").toString().trim() || undefined;
      const estado = (lic.estado ?? "").toString().trim() || undefined;

      if (!numero) { setLicLookup({ state: "not_found" }); return; }

      setLicLookup({ state: "ok", numero, categoria, fechaVencimiento, estado });

      // Auto-aplica número y categoría siempre que verifique.
      setForm(prev => ({
        ...prev,
        licenseNumber: numero,
        licenseCategory: categoria || prev.licenseCategory,
      }));
    } catch {
      setLicLookup({ state: "error", message: "No se pudo verificar la licencia." });
    }
  }, [token]);

  // Auto-lookup RENIEC al tipear los 8 dígitos del DNI.
  // Auto-aplica el nombre SIEMPRE que verifique correctamente y dispara
  // automáticamente la consulta de licencia con MTC.
  const lookupDni = useCallback(async (dniValue: string) => {
    if (!/^\d{8}$/.test(dniValue) || !token) return;
    setDniLookup({ state: "loading" });
    try {
      const res = await fetch("/api/validar/dni", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dni: dniValue }),
      });
      const data = await res.json();
      if (res.status === 404) { setDniLookup({ state: "not_found" }); return; }
      if (!res.ok || !data.success) {
        setDniLookup({ state: "error", message: data.error ?? "El servicio RENIEC no está disponible." });
        return;
      }
      const nombre = (data.data?.nombre_completo ?? "").toString().trim();
      setDniLookup({ state: "ok", nombreCompleto: nombre });
      // Auto-aplica el nombre SIEMPRE al verificar (no solo si está vacío).
      setForm(prev => ({ ...prev, name: nombre }));
      // Dispara consulta MTC en cadena.
      void lookupLicencia(dniValue);
    } catch {
      setDniLookup({ state: "error", message: "No se pudo verificar el DNI." });
    }
  }, [token, lookupLicencia]);

  useEffect(() => {
    if (dniTimer.current) clearTimeout(dniTimer.current);
    if (!canEdit || !/^\d{8}$/.test(form.dni)) {
      if (dniLookup.state !== "idle") setDniLookup({ state: "idle" });
      if (licLookup.state !== "idle") setLicLookup({ state: "idle" });
      return;
    }
    dniTimer.current = setTimeout(() => { void lookupDni(form.dni); }, 350);
    return () => { if (dniTimer.current) clearTimeout(dniTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.dni, canEdit, lookupDni]);

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      next.name = "El nombre es requerido (mínimo 2 caracteres).";
    else if (form.name.trim().length > 160)
      next.name = "Máximo 160 caracteres.";
    if (!form.dni.trim() || form.dni.trim().length < 6)
      next.dni = "El DNI es requerido (mínimo 6 dígitos).";
    if (!form.licenseNumber.trim() || form.licenseNumber.trim().length < 4)
      next.licenseNumber = "Licencia requerida (mínimo 4 caracteres).";
    if (!form.licenseCategory)
      next.licenseCategory = "Seleccione la categoría de licencia.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null); setSuccessMsg(null);
    if (!validate()) return;
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      dni: form.dni.trim(),
      licenseNumber: form.licenseNumber.trim(),
      licenseCategory: form.licenseCategory,
    };
    if (form.companyId) payload.companyId = form.companyId;
    payload.phone = form.phone.trim() || undefined;
    try {
      const res = await fetch(`/api/conductores/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const body = await res.json();
        setConductor(body?.data ?? body);
        setSuccessMsg("Cambios guardados correctamente.");
        setTimeout(() => setSuccessMsg(null), 3500);
        return;
      }
      const body = await res.json().catch(() => ({}));
      setServerError(
        (body as { message?: string; error?: string })?.message
        ?? (body as { error?: string })?.error
        ?? `Error ${res.status}`
      );
    } catch { setServerError("Error de conexión. Intente nuevamente."); }
    finally { setSubmitting(false); }
  }

  async function handleDelete() {
    setDeleting(true); setServerError(null);
    try {
      const res = await fetch(`/api/conductores/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { router.push("/conductores"); return; }
      const body = await res.json().catch(() => ({}));
      setServerError(
        (body as { message?: string; error?: string })?.message
        ?? (body as { error?: string })?.error
        ?? `Error ${res.status}`
      );
      setConfirmDelete(false);
    } catch { setServerError("Error de conexión."); setConfirmDelete(false); }
    finally { setDeleting(false); }
  }

  function handleChange(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setSuccessMsg(null);
    if (errors[field as keyof FieldErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }

  if (!authorized) return null;

  const backBtnPlain = (
    <Link href="/conductores">
      <button style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 36, padding: "0 14px", borderRadius: 9,
        border: `1.5px solid ${INK2}`, background: "#fff",
        color: INK6, fontSize: "0.875rem", fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit",
      }}>
        <ArrowLeft size={15} />Volver
      </button>
    </Link>
  );

  if (loadingConductor) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <PageHeader kicker="Conductores · Detalle" title="Cargando conductor…" action={backBtnPlain} />
        <KPIStrip cols={4} items={[
          { label: "ESTADO", value: "—", subtitle: "—", icon: User },
          { label: "REPUTACIÓN", value: "—", subtitle: "—", icon: TrendingUp },
          { label: "HORAS CONT.", value: "—", subtitle: "—", icon: Clock },
          { label: "DESCANSO", value: "—", subtitle: "—", icon: Award },
        ]} />
        {[0,1,2].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ height: 140, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <PageHeader kicker="Conductores · Detalle" title="Conductor no encontrado" action={backBtnPlain} />
        <div style={{
          padding: "32px 24px", background: "#fff", border: `1px solid ${INK2}`,
          borderRadius: 12, color: INK6, textAlign: "center", fontSize: "0.875rem",
        }}>
          El conductor solicitado no existe o fue eliminado.
        </div>
      </div>
    );
  }

  if (!conductor) return null;

  // Defensa: el backend puede devolver `status` faltante o desconocido (ej. "apto" no calculado).
  const safeStatus: keyof typeof STATUS_META =
    conductor.status && conductor.status in STATUS_META
      ? conductor.status
      : "apto";
  const st = STATUS_META[safeStatus];
  const StIcon = st.icon;
  const rep = conductor.reputationScore ?? 0;
  const repColor = rep >= 70 ? APTO : rep >= 40 ? RIESGO : NO;
  const continuous = conductor.continuousHours ?? 0;
  const fatigaColor = continuous >= 8 ? NO : continuous >= 5 ? RIESGO : INK6;

  const headerAction = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {backBtnPlain}
      {canEdit && (
        <button form="conductor-form" type="submit" disabled={submitting || deleting}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 36, padding: "0 14px", borderRadius: 9,
            border: "none", background: INK9, color: "#fff",
            fontWeight: 700, fontSize: "0.875rem",
            cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit",
            opacity: submitting ? 0.7 : 1,
          }}>
          {submitting ? <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> : <Save size={14} />}
          {submitting ? "Guardando…" : "Guardar"}
        </button>
      )}
    </div>
  );

  const conductorInitials = (conductor.name ?? "—")
    .split(" ").map(w => w[0] ?? "").slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10" style={{ color: INK9 }}>
      <PageHeader
        kicker={`Conductores · RF-08 · ${canEdit ? "Editar" : "Detalle"}`}
        title={conductor.name}
        subtitle={`DNI ${conductor.dni ?? "—"} · Licencia ${conductor.licenseCategory ?? "—"} · ${st.label}`}
        action={headerAction}
      />

      <KPIStrip cols={4} items={[
        {
          label: "ESTADO", value: st.label,
          subtitle: safeStatus === "apto" ? "operativo" : "revisar",
          icon: User, accent: st.color,
        },
        {
          label: "REPUTACIÓN", value: `${rep}`,
          subtitle: "de 100 puntos",
          icon: TrendingUp, accent: repColor,
        },
        {
          label: "HORAS CONT.", value: `${continuous}h`,
          subtitle: continuous >= 8 ? "límite excedido"
            : continuous >= 5 ? "cerca del límite" : "dentro del rango",
          icon: Clock, accent: fatigaColor,
        },
        {
          label: "DESCANSO", value: `${conductor.restHours ?? 0}h`,
          subtitle: "horas de reposo",
          icon: Award,
        },
      ]} />

      {(serverError || successMsg) && (
        <div role={serverError ? "alert" : "status"} style={{
          padding: "10px 14px",
          background: serverError ? NO_BG : APTO_BG,
          border: `1px solid ${serverError ? NO_BD : APTO_BD}`,
          borderRadius: 8, color: serverError ? NO : APTO,
          fontSize: "0.8125rem", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {serverError ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
          {serverError ?? successMsg}
        </div>
      )}

      <div className="sfit-aside-layout">
        <form id="conductor-form" onSubmit={handleSave} noValidate
          style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Información personal — DNI con validación RENIEC */}
          <SectionCard
            icon={<User size={14} color={INK6} />}
            title="Información personal"
            subtitle="Identidad verificable y datos de contacto"
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <Field
                  label="DNI"
                  hint={canEdit ? "(verificación RENIEC)" : undefined}
                  required={canEdit}
                  error={errors.dni}
                >
                  {canEdit ? (
                    <div
                      style={{ position: "relative" }}
                      onMouseEnter={() => setDniHover(true)}
                      onMouseLeave={() => setDniHover(false)}
                    >
                      <input
                        value={form.dni}
                        onChange={e => handleChange("dni", e.target.value.replace(/\D/g, "").slice(0, 8))}
                        style={{
                          ...FIELD,
                          fontFamily: "ui-monospace, monospace", paddingRight: 36,
                          borderColor:
                            errors.dni ? NO
                            : dniLookup.state === "ok" ? APTO
                            : dniLookup.state === "not_found" ? "#F59E0B"
                            : dniLookup.state === "error" ? NO
                            : INK2,
                        }}
                        placeholder="12345678" inputMode="numeric" maxLength={8}
                        disabled={submitting}
                        onFocus={e => { if (!errors.dni) e.target.style.borderColor = INK9; }}
                        onBlur={e => {
                          e.target.style.borderColor =
                            errors.dni ? NO
                            : dniLookup.state === "ok" ? APTO
                            : dniLookup.state === "not_found" ? "#F59E0B"
                            : dniLookup.state === "error" ? NO
                            : INK2;
                        }}
                      />
                      <div style={{
                        position: "absolute", right: 10, top: "50%",
                        transform: "translateY(-50%)", pointerEvents: "none",
                      }}>
                        {dniLookup.state === "loading" && <Loader2 size={14} color={INK5} style={{ animation: "spin 0.7s linear infinite" }} />}
                        {dniLookup.state === "ok" && <CheckCircle size={14} color={APTO} />}
                        {dniLookup.state === "not_found" && <AlertTriangle size={14} color="#F59E0B" />}
                        {dniLookup.state === "error" && <AlertTriangle size={14} color={NO} />}
                      </div>
                      {dniHover && dniLookup.state !== "idle" && (
                        <DniPopover
                          lookup={dniLookup}
                          currentName={form.name}
                          onApply={() => {
                            if (dniLookup.state === "ok") {
                              handleChange("name", dniLookup.nombreCompleto);
                            }
                          }}
                          onRetry={() => { void lookupDni(form.dni); }}
                        />
                      )}
                    </div>
                  ) : (
                    <input value={form.dni} style={{ ...READ, fontFamily: "ui-monospace, monospace" }} readOnly />
                  )}
                </Field>
                {/* Feedback inline OK — con botón "Aplicar nombre" si difiere */}
                {canEdit && dniLookup.state === "ok" && (() => {
                  const differs = form.name.trim().toLowerCase() !== dniLookup.nombreCompleto.toLowerCase();
                  if (!differs) {
                    return (
                      <p style={{ marginTop: 6, fontSize: "0.75rem", color: APTO, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                        <CheckCircle size={11} />Verificado: {dniLookup.nombreCompleto}
                      </p>
                    );
                  }
                  return (
                    <div style={{
                      marginTop: 8, padding: "8px 10px", borderRadius: 8,
                      border: `1px solid ${APTO_BD}`, background: APTO_BG,
                      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                    }}>
                      <CheckCircle size={13} color={APTO} style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, fontSize: "0.75rem" }}>
                        <div style={{ fontWeight: 700, color: APTO, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.625rem" }}>
                          RENIEC
                        </div>
                        <div style={{ color: INK9, fontWeight: 600, marginTop: 1, wordBreak: "break-word" }}>
                          {dniLookup.nombreCompleto}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleChange("name", dniLookup.nombreCompleto)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          height: 28, padding: "0 12px", borderRadius: 6,
                          border: `1px solid ${APTO}`, background: "#fff", color: APTO,
                          fontSize: "0.75rem", fontWeight: 700,
                          cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                        }}
                      >
                        Aplicar nombre
                      </button>
                    </div>
                  );
                })()}
                {canEdit && dniLookup.state === "not_found" && (
                  <p style={{ marginTop: 6, fontSize: "0.75rem", color: RIESGO, fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                    <AlertTriangle size={11} />DNI no encontrado en RENIEC.
                  </p>
                )}
              </div>

              <Field label="Teléfono">
                <div style={{ position: "relative" }}>
                  <Phone size={13} color={INK5} style={{
                    position: "absolute", left: 11, top: "50%",
                    transform: "translateY(-50%)", pointerEvents: "none",
                  }} />
                  <input
                    type="tel" value={form.phone}
                    onChange={e => handleChange("phone", e.target.value)}
                    style={{ ...(canEdit ? FIELD : READ), paddingLeft: 32 }}
                    placeholder="987 654 321"
                    disabled={submitting || !canEdit} readOnly={!canEdit}
                    onFocus={e => { if (canEdit) e.target.style.borderColor = INK9; }}
                    onBlur={e => { e.target.style.borderColor = INK2; }}
                  />
                </div>
              </Field>

              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Nombre completo" error={errors.name} required={canEdit}>
                  <input
                    type="text" value={form.name} maxLength={160}
                    onChange={e => handleChange("name", e.target.value)}
                    style={{
                      ...(canEdit ? FIELD : READ),
                      ...(errors.name ? { borderColor: NO } : {}),
                    }}
                    placeholder="Ej. Juan Carlos Pérez Quispe"
                    disabled={submitting || !canEdit} readOnly={!canEdit}
                    onFocus={e => { if (canEdit && !errors.name) e.target.style.borderColor = INK9; }}
                    onBlur={e => { if (!errors.name) e.target.style.borderColor = INK2; }}
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          {/* Datos de licencia (MTC) — auto-validados al verificar el DNI */}
          <SectionCard
            icon={<CreditCard size={14} color={INK6} />}
            title="Licencia de conducir"
            subtitle={
              licLookup.state === "loading"
                ? "Consultando MTC…"
                : licLookup.state === "ok"
                  ? `MTC verificado · ${licLookup.estado ?? "vigente"}${licLookup.fechaVencimiento ? ` · vence ${licLookup.fechaVencimiento}` : ""}`
                  : licLookup.state === "not_found"
                    ? "MTC: licencia no encontrada — completa manualmente"
                    : licLookup.state === "error"
                      ? "MTC no disponible — completa manualmente"
                      : "Datos del documento MTC (se autocompleta al verificar DNI)"
            }
          >
            {/* Banner de verificación MTC */}
            {canEdit && licLookup.state === "ok" && (
              <div style={{
                marginBottom: 10, padding: "8px 10px", borderRadius: 8,
                border: `1px solid ${APTO_BD}`, background: APTO_BG,
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              }}>
                <CheckCircle size={13} color={APTO} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: "0.75rem" }}>
                  <div style={{ fontWeight: 700, color: APTO, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.625rem" }}>
                    MTC
                  </div>
                  <div style={{ color: INK9, fontWeight: 600, marginTop: 1 }}>
                    {licLookup.numero} · {licLookup.categoria}
                    {licLookup.estado && <span style={{ color: INK5, fontWeight: 500 }}> · {licLookup.estado}</span>}
                    {licLookup.fechaVencimiento && <span style={{ color: INK5, fontWeight: 500 }}> · vence {licLookup.fechaVencimiento}</span>}
                  </div>
                </div>
              </div>
            )}
            {canEdit && licLookup.state === "loading" && (
              <div style={{
                marginBottom: 10, padding: "8px 10px", borderRadius: 8,
                background: INK1, border: `1px solid ${INK2}`,
                display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem", color: INK6,
              }}>
                <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} />
                Consultando licencia en MTC…
              </div>
            )}
            {canEdit && licLookup.state === "not_found" && (
              <div style={{
                marginBottom: 10, padding: "8px 10px", borderRadius: 8,
                background: "#FFFBEB", border: "1px solid #FDE68A",
                display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem", color: "#92400E",
              }}>
                <AlertTriangle size={12} />
                Licencia no encontrada en MTC para este DNI. Completa los datos manualmente.
              </div>
            )}
            {canEdit && licLookup.state === "error" && (
              <div style={{
                marginBottom: 10, padding: "8px 10px", borderRadius: 8,
                background: NO_BG, border: `1px solid ${NO_BD}`,
                display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem", color: NO,
              }}>
                <AlertTriangle size={12} />
                {licLookup.message}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Número de licencia" error={errors.licenseNumber} required={canEdit}>
                <input
                  type="text" value={form.licenseNumber} maxLength={30}
                  onChange={e => handleChange("licenseNumber", e.target.value)}
                  style={{
                    ...(canEdit ? FIELD : READ),
                    ...(errors.licenseNumber ? { borderColor: NO } : {}),
                    fontFamily: "ui-monospace, monospace", letterSpacing: "0.04em",
                    borderColor: licLookup.state === "ok" ? APTO
                      : errors.licenseNumber ? NO : INK2,
                  }}
                  placeholder="Ej. Q12345678"
                  disabled={submitting || !canEdit} readOnly={!canEdit}
                  onFocus={e => { if (canEdit && !errors.licenseNumber) e.target.style.borderColor = INK9; }}
                  onBlur={e => {
                    e.target.style.borderColor =
                      licLookup.state === "ok" ? APTO
                      : errors.licenseNumber ? NO : INK2;
                  }}
                />
              </Field>
              <Field label="Categoría" error={errors.licenseCategory} required={canEdit}>
                {canEdit ? (
                  <select
                    value={form.licenseCategory}
                    onChange={e => handleChange("licenseCategory", e.target.value)}
                    style={{
                      ...FIELD,
                      appearance: "none", cursor: "pointer", paddingRight: 30,
                      ...(errors.licenseCategory ? { borderColor: NO } : {}),
                    }}
                    disabled={submitting}
                    onFocus={e => { if (!errors.licenseCategory) e.target.style.borderColor = INK9; }}
                    onBlur={e => { if (!errors.licenseCategory) e.target.style.borderColor = INK2; }}
                  >
                    <option value="">Seleccionar categoría…</option>
                    {LICENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                ) : (
                  <input style={READ} value={form.licenseCategory} readOnly disabled />
                )}
              </Field>
            </div>
          </SectionCard>

          {/* Empresa de transporte */}
          <SectionCard
            icon={<Building2 size={14} color={INK6} />}
            title="Empresa de transporte"
            subtitle={canEdit ? "Asigna o cambia la empresa" : "Empresa asignada"}
          >
            {canEdit ? (
              <div style={{ position: "relative" }}>
                <select
                  value={form.companyId}
                  onChange={e => handleChange("companyId", e.target.value)}
                  style={{ ...FIELD, appearance: "none", cursor: "pointer", paddingRight: 30 }}
                  disabled={submitting}
                  onFocus={e => { e.target.style.borderColor = INK9; }}
                  onBlur={e => { e.target.style.borderColor = INK2; }}
                >
                  <option value="">Sin empresa asignada</option>
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.razonSocial}</option>
                  ))}
                </select>
              </div>
            ) : (
              <input
                style={READ}
                value={conductor.companyName ?? "Sin empresa asignada"}
                readOnly disabled
              />
            )}
          </SectionCard>
        </form>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Tarjeta de identidad — estilo usuarios/[id] */}
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "20px 16px 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: st.bg, border: `2px solid ${st.bd}`,
                color: st.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: "1.375rem",
              }}>
                {conductorInitials || "—"}
              </div>
              <div style={{ minWidth: 0, width: "100%" }}>
                <div style={{ fontWeight: 800, fontSize: "0.9375rem", color: INK9, lineHeight: 1.3, wordBreak: "break-word" }}>
                  {conductor.name}
                </div>
                {conductor.phone && (
                  <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2 }}>
                    {conductor.phone}
                  </div>
                )}
                <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 6, fontSize: "0.6875rem", fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.bd}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color }} />
                  {st.label.toUpperCase()}
                </div>
              </div>
            </div>
            <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              <Row k="DNI" v={conductor.dni ?? "—"} mono />
              <Row k="Licencia" v={conductor.licenseNumber ?? "—"} mono />
              <Row k="Categoría" v={conductor.licenseCategory ?? "—"} />
              <Row k="Empresa" v={conductor.companyName?.trim() || "—"} />
              <Row k="Activo" v={conductor.active ? "Sí" : "No"} />
            </div>
          </div>

          <SectionCard
            icon={<TrendingUp size={14} color={INK6} />}
            title="Estado operativo"
            subtitle="Datos del FatigueEngine"
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 8,
              background: st.bg, border: `1px solid ${st.bd}`,
            }}>
              <StIcon size={16} color={st.color} strokeWidth={2} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: "0.625rem", fontWeight: 800, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: st.color, marginBottom: 1,
                }}>
                  Estado
                </div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: st.color, lineHeight: 1 }}>
                  {st.label}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
              <MiniRow label="Conducción continua" value={`${continuous}h`} />
              <MiniRow label="Descanso restante" value={`${conductor.restHours ?? 0}h`} />
              <MiniRow label="Reputación" value={`${rep}/100`} accent={repColor} />
              <MiniRow label="Activo" value={conductor.active ? "Sí" : "No"} />
            </div>
          </SectionCard>

          {/* Información del registro */}
          <div style={{
            background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
            overflow: "hidden",
          }}>
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${INK1}` }}>
              <div style={{
                fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", color: INK5,
              }}>Información del registro</div>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <SystemIdRow id={conductor.id} />
              <Row k="Creado" v={new Date(conductor.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })} />
              {conductor.updatedAt !== conductor.createdAt && (
                <Row k="Actualizado" v={new Date(conductor.updatedAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })} />
              )}
            </div>
          </div>

          {/* Zona de peligro */}
          {canEdit && (
            <DangerZoneSidebar
              name={conductor.name}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
              deleting={deleting}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Subcomponentes ─────────── */

function SectionCard({
  icon, title, subtitle, children,
}: {
  icon: React.ReactNode; title: string; subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${INK2}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 16px", borderBottom: `1px solid ${INK1}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: INK1, border: `1px solid ${INK2}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9, lineHeight: 1.25 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: "0.75rem", color: INK5, lineHeight: 1.3, marginTop: 1 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: "14px 16px" }}>{children}</div>
    </div>
  );
}

function DniPopover({
  lookup, currentName, onApply, onRetry,
}: {
  lookup: DniLookup; currentName: string;
  onApply: () => void; onRetry?: () => void;
}) {
  return (
    <div role="status" aria-live="polite" style={{
      position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
      zIndex: 50, background: "#fff",
      border: `1px solid ${
        lookup.state === "ok" ? APTO_BD
        : lookup.state === "not_found" ? "#FDE68A"
        : lookup.state === "error" ? NO_BD : INK2
      }`,
      borderRadius: 8, padding: "10px 12px",
      boxShadow: "0 8px 24px rgba(9,9,11,0.10), 0 1px 2px rgba(9,9,11,0.06)",
      animation: "fadeIn 120ms ease",
    }}>
      {lookup.state === "loading" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 size={13} color={INK5} style={{ animation: "spin 0.7s linear infinite" }} />
          <span style={{ fontSize: "0.8125rem", color: INK6 }}>Consultando RENIEC…</span>
        </div>
      )}
      {lookup.state === "ok" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <CheckCircle size={12} color={APTO} />
            <span style={{ fontSize: "0.625rem", fontWeight: 800, color: APTO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              RENIEC verificado
            </span>
          </div>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9, lineHeight: 1.35, wordBreak: "break-word" }}>
            {lookup.nombreCompleto}
          </div>
          {currentName.trim().toLowerCase() !== lookup.nombreCompleto.toLowerCase() && (
            <button type="button" onClick={onApply} style={{
              marginTop: 8, width: "100%", height: 28, borderRadius: 6,
              border: `1px solid ${APTO}`, background: APTO_BG, color: APTO,
              fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>
              Usar este nombre
            </button>
          )}
        </>
      )}
      {lookup.state === "not_found" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <AlertTriangle size={12} color="#92400E" />
            <span style={{ fontSize: "0.625rem", fontWeight: 800, color: "#92400E", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              No registrado
            </span>
          </div>
          <div style={{ fontSize: "0.75rem", color: INK6, lineHeight: 1.5 }}>
            DNI no encontrado en RENIEC. Puedes ingresar el nombre manualmente.
          </div>
        </>
      )}
      {lookup.state === "error" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <AlertTriangle size={12} color={NO} />
            <span style={{ fontSize: "0.625rem", fontWeight: 800, color: NO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Servicio no disponible
            </span>
          </div>
          <div style={{ fontSize: "0.75rem", color: INK6, lineHeight: 1.5, marginBottom: onRetry ? 8 : 0 }}>
            {lookup.message}
          </div>
          {onRetry && (
            <button type="button" onClick={onRetry} style={{
              width: "100%", height: 26, borderRadius: 6,
              border: `1px solid ${INK2}`, background: "#fff", color: INK6,
              fontSize: "0.6875rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>
              Reintentar consulta
            </button>
          )}
        </>
      )}
    </div>
  );
}

function MiniRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{
      padding: "8px 10px", borderRadius: 7,
      background: INK1, border: `1px solid ${INK2}`,
    }}>
      <div style={{
        fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.06em",
        textTransform: "uppercase", color: INK5, marginBottom: 2,
      }}>{label}</div>
      <div style={{
        fontSize: "0.875rem", fontWeight: 800, color: accent ?? INK9,
        fontVariantNumeric: "tabular-nums",
      }}>{value}</div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 10px", borderRadius: 6, background: INK1, gap: 8,
    }}>
      <span style={{ fontSize: "0.75rem", color: INK5, flexShrink: 0 }}>{k}</span>
      <span style={{
        fontSize: "0.8125rem", fontWeight: 600, color: INK9, textAlign: "right",
        fontFamily: mono ? "ui-monospace, monospace" : "inherit",
        letterSpacing: mono ? "0.04em" : 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{v}</span>
    </div>
  );
}

function SystemIdRow({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const shortId = id.slice(-8).toUpperCase();
  return (
    <div style={{
      background: "#fff", border: `1px dashed ${INK2}`, borderRadius: 7,
      padding: "7px 10px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <Hash size={11} color={INK5} />
        <span style={{
          fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: INK5,
        }}>ID</span>
        <code title={id} style={{
          fontFamily: "ui-monospace, monospace", fontSize: "0.75rem",
          color: INK9, fontWeight: 600, letterSpacing: "0.04em",
          fontVariantNumeric: "tabular-nums",
        }}>{shortId}</code>
      </div>
      <button type="button" onClick={async () => {
        try {
          await navigator.clipboard.writeText(id);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch { /* */ }
      }} title="Copiar ID completo" style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        height: 22, padding: "0 7px", borderRadius: 5,
        border: `1px solid ${INK2}`, background: "#fff", color: INK6,
        fontSize: "0.625rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      }}>
        {copied ? <Check size={10} color={APTO} /> : <Copy size={10} />}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

function DangerZoneSidebar({
  name, confirmDelete, setConfirmDelete, deleting, onDelete,
}: {
  name: string;
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${NO_BD}`, borderRadius: 12,
      padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Trash2 size={13} color={NO} />
        <div style={{
          fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: NO,
        }}>Zona de peligro</div>
      </div>

      {!confirmDelete ? (
        <>
          <p style={{ fontSize: "0.75rem", color: INK6, lineHeight: 1.5, margin: 0 }}>
            Eliminar este conductor es permanente. Se borrarán sus registros de viajes y reputación.
          </p>
          <button onClick={() => setConfirmDelete(true)} style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            height: 32, padding: "0 12px", borderRadius: 7,
            border: `1px solid ${NO_BD}`, background: NO_BG, color: NO,
            fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>
            <Trash2 size={12} />Eliminar conductor
          </button>
        </>
      ) : (
        <div style={{ background: NO_BG, border: `1px solid ${NO_BD}`, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontWeight: 700, color: NO, marginBottom: 4, fontSize: "0.8125rem" }}>¿Confirmar?</div>
          <p style={{ fontSize: "0.75rem", color: INK6, marginBottom: 10, lineHeight: 1.5 }}>
            Eliminarás a <strong>{name}</strong>. Acción irreversible.
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onDelete} disabled={deleting}
              style={{
                flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                height: 30, borderRadius: 7, border: "none", background: NO, color: "#fff",
                fontSize: "0.75rem", fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer",
                fontFamily: "inherit", opacity: deleting ? 0.7 : 1,
              }}>
              {deleting ? <Loader2 size={11} style={{ animation: "spin 0.7s linear infinite" }} /> : <Trash2 size={11} />}
              {deleting ? "…" : "Sí, eliminar"}
            </button>
            <button onClick={() => setConfirmDelete(false)} disabled={deleting}
              style={{
                flex: 1, height: 30, borderRadius: 7,
                border: `1px solid ${INK2}`, background: "#fff", color: INK6,
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
