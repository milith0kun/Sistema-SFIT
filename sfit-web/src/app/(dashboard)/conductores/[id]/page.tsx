"use client";

import { use as usePromise, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Trash2, User, Phone, CreditCard, Award, Clock, TrendingUp,
  AlertTriangle, CheckCircle, Loader2, Building2, Pencil, ImageUp,
  Activity, Shield, MessageSquareWarning,
} from "lucide-react";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";
import { PhotoUploader } from "@/components/ui/PhotoUploader";
import { SectionCard } from "@/components/ui/SectionCard";
import { KeyValueRow, SystemIdRow } from "@/components/ui/KeyValueRow";
import { useSetBreadcrumbTitle } from "@/hooks/useBreadcrumbTitle";
import { hasWebPermission, FATIGUE_ROLES } from "@/lib/auth/roleMatrix";
import { ROLES, type Role } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import {
  INK1, INK2, INK5, INK6, INK9,
  GRN as APTO, GRNBG as APTO_BG, GRNBD as APTO_BD,
  RED as NO, REDBG as NO_BG, REDBD as NO_BD,
  AMBER as RIESGO, AMBER_BG as RIESGO_BG, AMBER_BD as RIESGO_BD,
} from "@/lib/design-tokens";
import { FIELD, READ, LABEL } from "@/lib/form-styles";

const LICENSE_CATEGORIES = ["A-I", "A-IIa", "A-IIb", "A-IIIa", "A-IIIb", "A-IIIc"];

interface Conductor {
  id: string; name: string; dni: string; licenseNumber: string;
  licenseCategory: string;
  licenseIssuedAt?: string | null;
  licenseExpiryDate?: string | null;
  userId?: string | null;
  companyId?: string; companyName?: string;
  phone?: string; status: "apto" | "riesgo" | "no_apto";
  continuousHours: number; restHours: number; reputationScore: number;
  active: boolean; createdAt: string; updatedAt: string;
  photoUrl?: string;
}
interface LinkedUser {
  id: string; name: string; email: string; role: string; status: string;
}
interface Empresa { id: string; razonSocial: string }
interface FormData {
  name: string; dni: string; licenseNumber: string;
  licenseCategory: string;
  licenseIssuedAt: string;
  licenseExpiryDate: string;
  companyId: string; phone: string;
  photoUrl: string;
}
interface FieldErrors {
  name?: string; dni?: string; licenseNumber?: string; licenseCategory?: string;
  licenseExpiryDate?: string;
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

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", admin_municipal: "Admin Municipal",
  fiscal: "Fiscal / Inspector", operador: "Operador",
  conductor: "Conductor", ciudadano: "Ciudadano",
};
const STATUS_META_LABELS: Record<string, string> = {
  activo: "Activo", pendiente: "Pendiente", suspendido: "Suspendido", rechazado: "Rechazado",
};

function assignableRoles(): { value: string; label: string }[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("sfit_user") : null;
    if (!raw) return [];
    const u = JSON.parse(raw) as { role?: string };
    if (u.role === "super_admin") {
      return Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }));
    }
    if (u.role === "admin_municipal") {
      return [
        { value: "fiscal", label: "Fiscal / Inspector" },
        { value: "operador", label: "Operador" },
        { value: "conductor", label: "Conductor" },
        { value: "ciudadano", label: "Ciudadano" },
      ];
    }
    return [];
  } catch { return []; }
}

const BTN_PRIMARY: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  height: 32, padding: "0 14px", borderRadius: 7,
  border: "none", background: INK9, color: "#fff",
  fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
  fontFamily: "inherit", transition: "opacity 0.15s",
};
const BTN_SECONDARY: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  height: 32, padding: "0 14px", borderRadius: 7,
  border: `1px solid ${INK2}`, background: "#fff", color: INK6,
  fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
  fontFamily: "inherit", transition: "opacity 0.15s",
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
  const [canMarkFatigue, setCanMarkFatigue] = useState(false);
  const [showFatigue, setShowFatigue] = useState(false);
  const [fatigueLevel, setFatigueLevel] = useState<"riesgo" | "no_apto">("no_apto");
  const [markingFatigue, setMarkingFatigue] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadingConductor, setLoadingConductor] = useState(true);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [history, setHistory] = useState<Array<{
    id: string;
    companyId: string | null;
    companyName: string | null;
    companyRuc: string | null;
    joinedAt: string;
    leftAt: string | null;
    leftReason: string | null;
    isOpen: boolean;
  }> | null>(null);
  const [resumen, setResumen] = useState<{
    trips: { total: number; lastAt: string | null; lastStatus: string | null };
    inspections: { total: number; aprobadas: number; rechazadas: number; observadas: number };
    sanctions: { total: number; totalSoles: number; lastAt: string | null; lastAmountSoles: number | null; lastStatus: string | null };
  } | null>(null);
  const [form, setForm] = useState<FormData>({
    name: "", dni: "", licenseNumber: "", licenseCategory: "",
    licenseIssuedAt: "", licenseExpiryDate: "",
    companyId: "", phone: "", photoUrl: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [linkedUser, setLinkedUser] = useState<LinkedUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);

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
    let user: { role?: Role } = {};
    try { user = JSON.parse(raw); } catch { router.replace("/login"); return; }
    if (!hasWebPermission(user.role, "conductores", "view")) { router.replace("/conductores"); return; }
    setAuthorized(true);
    setCanEdit(hasWebPermission(user.role, "conductores", "edit"));
    setCanMarkFatigue(user.role ? FATIGUE_ROLES.includes(user.role) : false);
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
          licenseIssuedAt: data.licenseIssuedAt ? String(data.licenseIssuedAt).slice(0, 10) : "",
          licenseExpiryDate: data.licenseExpiryDate ? String(data.licenseExpiryDate).slice(0, 10) : "",
          companyId: data.companyId ?? "", phone: data.phone ?? "",
          photoUrl: data.photoUrl ?? "",
        });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingConductor(false));

    // Cargar usuario vinculado (cuenta del sistema)
    fetch(`/api/conductores/${id}?includeUser=true`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async res => {
        if (!res.ok) return;
        const body = await res.json();
        const data: Conductor = body?.data ?? body;
        if (data.userId) {
          setLoadingUser(true);
          fetch(`/api/admin/usuarios/${data.userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then(async r => {
              if (!r.ok) { setLinkedUser(null); return; }
              const b = await r.json();
              const u = b?.data;
              if (u) {
                setLinkedUser({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status });
                setNewRole(u.role);
              }
            })
            .catch(() => setLinkedUser(null))
            .finally(() => setLoadingUser(false));
        }
      })
      .catch(() => {});
  }, [authorized, token, id]);

  // Cargar historial laboral en paralelo al detalle del conductor. No bloquea
  // el render principal — el SectionCard tiene su propio "cargando".
  useEffect(() => {
    if (!authorized || !token) return;
    fetch(`/api/conductores/${id}/historial`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) { setHistory([]); return; }
        const body = await res.json();
        setHistory(body?.data?.items ?? []);
      })
      .catch(() => setHistory([]));
  }, [authorized, token, id]);

  // Resumen operativo (viajes/inspecciones/sanciones). Independiente para no
  // bloquear el render principal.
  useEffect(() => {
    if (!authorized || !token) return;
    fetch(`/api/conductores/${id}/resumen`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) return;
        const body = await res.json();
        if (body?.data) setResumen(body.data);
      })
      .catch(() => { /* opcional, no bloquea */ });
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
    if (form.licenseIssuedAt && form.licenseExpiryDate) {
      if (new Date(form.licenseExpiryDate) <= new Date(form.licenseIssuedAt)) {
        next.licenseExpiryDate = "El vencimiento debe ser posterior a la emisión.";
      }
    }
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
      licenseIssuedAt: form.licenseIssuedAt ? form.licenseIssuedAt : null,
      licenseExpiryDate: form.licenseExpiryDate ? form.licenseExpiryDate : null,
    };
    // Enviamos companyId siempre: cadena vacía → null (desasignar);
    // valor → ObjectId. Esto permite al admin desligar el conductor.
    payload.companyId = form.companyId.trim() || null;
    payload.phone = form.phone.trim() || undefined;
    payload.photoUrl = form.photoUrl.trim() || null;
    try {
      const res = await fetch(`/api/conductores/${id}`, {
        method: "PATCH",
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

  async function handleRoleChange(userId: string, newRoleValue: string) {
    setSubmitting(true); setServerError(null);
    try {
      const res = await fetch(`/api/admin/usuarios/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRoleValue }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setServerError((body as { error?: string })?.error ?? "Error al cambiar rol");
        return;
      }
      setLinkedUser(prev => prev ? { ...prev, role: newRoleValue } : prev);
      setSuccessMsg("Rol actualizado correctamente.");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch { setServerError("Error de conexión."); }
    finally { setSubmitting(false); }
  }

  async function handlePasswordReset(userId: string) {
    if (newPass !== confirmPass || newPass.length < 8) {
      setServerError("Las contraseñas no coinciden o son muy cortas.");
      return;
    }
    setSubmitting(true); setServerError(null);
    try {
      const res = await fetch(`/api/admin/usuarios/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPass }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setServerError((body as { error?: string })?.error ?? "Error al restablecer");
        return;
      }
      setNewPass(""); setConfirmPass("");
      setSuccessMsg("Contraseña restablecida correctamente.");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch { setServerError("Error de conexión."); }
    finally { setSubmitting(false); }
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

  const showFatigueBtn = canMarkFatigue && conductor.status !== "no_apto";
  const headerAction = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {backBtnPlain}
      {showFatigueBtn && (
        <button
          type="button"
          onClick={() => setShowFatigue(true)}
          disabled={submitting || markingFatigue}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 36, padding: "0 14px", borderRadius: 9,
            border: `1.5px solid ${RIESGO}`, background: "#FFFBEB",
            color: RIESGO, fontWeight: 700, fontSize: "0.875rem",
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <AlertTriangle size={14} /> Marcar fatiga
        </button>
      )}
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

  async function handleMarkFatigue() {
    if (!conductor) return;
    setMarkingFatigue(true);
    try {
      const res = await fetch(`/api/conductores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ status: fatigueLevel }),
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setServerError(data.error ?? "No se pudo marcar fatiga."); return; }
      setShowFatigue(false);
      setConductor((c) => c ? { ...c, status: fatigueLevel } : c);
      setSuccessMsg(`Conductor marcado como ${fatigueLevel === "no_apto" ? "no apto" : "en riesgo"}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch { setServerError("Error de conexión."); }
    finally { setMarkingFatigue(false); }
  }

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
          icon: User,
        },
        {
          label: "REPUTACIÓN", value: `${rep}`,
          subtitle: "de 100 puntos",
          icon: TrendingUp,
        },
        {
          label: "HORAS CONT.", value: `${continuous}h`,
          subtitle: continuous >= 8 ? "límite excedido"
            : continuous >= 5 ? "cerca del límite" : "dentro del rango",
          icon: Clock,
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
            <div className="cols-2-responsive" style={{ gap: 12 }}>
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

            <div className="cols-2-responsive" style={{ gap: 12 }}>
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
                    {LICENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input style={READ} value={form.licenseCategory} readOnly disabled />
                )}
              </Field>

              <Field
                label="Emitida el"
                error={undefined}
                required={false}
              >
                <input
                  type="date"
                  value={form.licenseIssuedAt}
                  onChange={e => handleChange("licenseIssuedAt", e.target.value)}
                  style={canEdit ? FIELD : READ}
                  disabled={submitting || !canEdit}
                  readOnly={!canEdit}
                />
              </Field>

              <Field
                label="Vence el"
                error={errors.licenseExpiryDate}
                required={false}
              >
                <input
                  type="date"
                  value={form.licenseExpiryDate}
                  onChange={e => handleChange("licenseExpiryDate", e.target.value)}
                  style={{
                    ...(canEdit ? FIELD : READ),
                    ...(errors.licenseExpiryDate ? { borderColor: NO } : {}),
                  }}
                  disabled={submitting || !canEdit}
                  readOnly={!canEdit}
                />
              </Field>
            </div>
          </SectionCard>

          {/* Empresa de transporte: editable por admin (super_admin /
              admin_municipal). El operador móvil también puede asignar al
              enganchar conductor↔vehículo para su turno; aquí permitimos
              el override administrativo cuando hay rotaciones reales. */}
          <SectionCard
            icon={<Building2 size={14} color={INK6} />}
            title="Empresa de transporte"
            subtitle={canEdit
              ? "Asigna o cambia la empresa que opera con este conductor"
              : "Asignación actual del conductor"}
          >
            {canEdit ? (
              <select
                value={form.companyId}
                onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
                style={{ ...FIELD, appearance: "none", paddingRight: 30, cursor: "pointer" }}
                disabled={empresas.length === 0}
              >
                <option value="">— Sin empresa asignada —</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>{e.razonSocial}</option>
                ))}
              </select>
            ) : (
              <input
                style={READ}
                value={conductor.companyName ?? "Sin empresa asignada"}
                readOnly disabled
              />
            )}
            {empresas.length === 0 && (
              <p style={{ marginTop: 6, fontSize: "0.6875rem", color: INK5, fontStyle: "italic" }}>
                No hay empresas registradas en la municipalidad todavía.
              </p>
            )}
          </SectionCard>

          {/* Foto referencial — usada en escaneo del ciudadano + reportes */}
          <SectionCard
            icon={<ImageUp size={14} color={INK6} />}
            title="Foto referencial"
            subtitle="Aparece en el escaneo del ciudadano y en reportes"
          >
            <PhotoUploader
              category="driver"
              value={form.photoUrl || null}
              onChange={(url) => handleChange("photoUrl", url ?? "")}
              aspect="square"
              label=""
              disabled={!canEdit || submitting}
            />
          </SectionCard>

          {/* Resumen operativo — viajes / inspecciones / sanciones */}
          <SectionCard
            icon={<TrendingUp size={14} color={INK6} />}
            title="Resumen operativo"
            subtitle="Actividad acumulada del conductor"
          >
            {resumen === null ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", color: INK5 }}>
                <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} />
                Cargando resumen…
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {/* Viajes */}
                <div style={{ padding: "12px 14px", borderRadius: 9, background: INK1, border: `1px solid ${INK2}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Activity size={13} color={INK6} strokeWidth={1.8} />
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK5 }}>
                      Viajes
                    </span>
                  </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: INK9, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                    {resumen.trips.total}
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: INK5, marginTop: 6 }}>
                    {resumen.trips.lastAt
                      ? `Último: ${fmtDate(resumen.trips.lastAt)}`
                      : "Sin viajes registrados"}
                  </div>
                </div>

                {/* Inspecciones */}
                <div style={{ padding: "12px 14px", borderRadius: 9, background: INK1, border: `1px solid ${INK2}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Shield size={13} color={INK6} strokeWidth={1.8} />
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK5 }}>
                      Inspecciones
                    </span>
                  </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: INK9, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                    {resumen.inspections.total}
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: INK5, marginTop: 6 }}>
                    {resumen.inspections.total > 0
                      ? `${resumen.inspections.aprobadas} aprob. · ${resumen.inspections.rechazadas} rech.`
                      : "Sin inspecciones"}
                  </div>
                </div>

                {/* Sanciones */}
                <div style={{
                  padding: "12px 14px", borderRadius: 9,
                  background: resumen.sanctions.total > 0 ? NO_BG : INK1,
                  border: `1px solid ${resumen.sanctions.total > 0 ? NO_BD : INK2}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <MessageSquareWarning size={13} color={resumen.sanctions.total > 0 ? NO : INK6} strokeWidth={1.8} />
                    <span style={{
                      fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                      color: resumen.sanctions.total > 0 ? NO : INK5,
                    }}>
                      Sanciones
                    </span>
                  </div>
                  <div style={{
                    fontSize: "1.5rem", fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums",
                    color: resumen.sanctions.total > 0 ? NO : INK9,
                  }}>
                    {resumen.sanctions.total}
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: INK5, marginTop: 6 }}>
                    {resumen.sanctions.total > 0
                      ? `S/ ${resumen.sanctions.totalSoles.toLocaleString("es-PE")} acumulado`
                      : "Sin sanciones"}
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
        </form>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Tarjeta de identidad (sobria) */}
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "20px 16px 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: INK1, border: `1px solid ${INK2}`,
                color: INK6,
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
                <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 6, fontSize: "0.6875rem", fontWeight: 700, background: "#fff", color: INK9, border: `1px solid ${INK2}`, letterSpacing: "0.04em" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color }} />
                  {st.label.toUpperCase()}
                </div>
              </div>
            </div>
            <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              <KeyValueRow k="DNI" v={conductor.dni ?? "—"} mono />
              <KeyValueRow k="Licencia" v={conductor.licenseNumber ?? "—"} mono />
              <KeyValueRow k="Categoría" v={conductor.licenseCategory ?? "—"} />
              <KeyValueRow k="Empresa" v={conductor.companyName?.trim() || "—"} />
              <KeyValueRow k="Activo" v={conductor.active ? "Sí" : "No"} />
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
              background: INK1, border: `1px solid ${INK2}`,
            }}>
              <StIcon size={16} color={st.color} strokeWidth={1.8} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: "0.625rem", fontWeight: 800, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: INK5, marginBottom: 1,
                }}>
                  Estado
                </div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: INK9, lineHeight: 1 }}>
                  {st.label}
                </div>
              </div>
            </div>
            <div className="cols-2-responsive" style={{ gap: 6, marginTop: 8 }}>
              <MiniRow label="Conducción continua" value={`${continuous}h`} />
              <MiniRow label="Descanso restante" value={`${conductor.restHours ?? 0}h`} />
              <MiniRow label="Reputación" value={`${rep}/100`} />
              <MiniRow label="Activo" value={conductor.active ? "Sí" : "No"} />
            </div>
          </SectionCard>

          {/* Historial laboral — todas las membresías conductor↔empresa,
              abierta o cerrada. Sirve para auditar rotaciones cuando un
              admin investiga un conductor con quejas recurrentes. */}
          <SectionCard
            icon={<Building2 size={14} color={INK6} />}
            title="Historial laboral"
            subtitle="Vinculaciones con empresas de transporte"
          >
            {history === null ? (
              <div style={{ fontSize: "0.8125rem", color: INK5 }}>
                <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite", marginRight: 6 }} />
                Cargando historial…
              </div>
            ) : history.length === 0 ? (
              <div style={{ fontSize: "0.8125rem", color: INK5 }}>
                Sin vinculaciones registradas.
              </div>
            ) : (
              <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {history.map((m) => (
                  <li key={m.id} style={{
                    padding: "10px 12px", borderRadius: 8,
                    background: m.isOpen ? APTO_BG : INK1,
                    border: `1px solid ${m.isOpen ? APTO_BD : INK2}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: m.isOpen ? APTO : INK5,
                      }}>
                        {m.isOpen ? "Vigente" : "Cerrada"}
                      </span>
                      {m.leftReason && (
                        <span style={{ fontSize: "0.6875rem", color: INK5 }}>
                          · {m.leftReason.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: INK9 }}>
                      {m.companyName ?? "(empresa eliminada)"}
                    </div>
                    {m.companyRuc && (
                      <div style={{ fontSize: "0.6875rem", color: INK5, fontFamily: "ui-monospace, monospace" }}>
                        RUC {m.companyRuc}
                      </div>
                    )}
                    <div style={{ fontSize: "0.6875rem", color: INK6, marginTop: 4 }}>
                      Desde {fmtDate(m.joinedAt)}
                      {m.leftAt && ` · Hasta ${fmtDate(m.leftAt)}`}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          {/* Cuenta de usuario vinculada */}
          {(linkedUser || loadingUser) && (
            <SectionCard
              icon={<Shield size={14} color={INK6} />}
              title="Cuenta de usuario"
              subtitle={loadingUser ? "Cargando…" : `Vinculada a ${linkedUser!.email}`}
            >
              {loadingUser ? (
                <div style={{ fontSize: "0.8125rem", color: INK5 }}>
                  <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite", marginRight: 6 }} />
                  Consultando cuenta…
                </div>
              ) : linkedUser ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <KeyValueRow k="Correo" v={linkedUser.email} />
                  <KeyValueRow k="Rol actual" v={ROLE_LABELS[linkedUser.role] ?? linkedUser.role} />
                  <KeyValueRow k="Estado" v={STATUS_META_LABELS[linkedUser.status] ?? linkedUser.status} />

                  {/* Cambiar rol */}
                  <div>
                    <label style={LABEL}>Cambiar rol</label>
                    <select
                      value={newRole}
                      onChange={e => setNewRole(e.target.value)}
                      style={FIELD}
                    >
                      {assignableRoles().map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRoleChange(linkedUser.id, newRole)}
                      disabled={submitting || newRole === linkedUser.role}
                      style={{
                        ...BTN_PRIMARY, marginTop: 8,
                        opacity: submitting || newRole === linkedUser.role ? 0.4 : 1,
                        cursor: submitting || newRole === linkedUser.role ? "not-allowed" : "pointer",
                      }}
                    >
                      {submitting ? "Guardando…" : "Cambiar rol"}
                    </button>
                  </div>

                  {/* Restablecer contraseña */}
                  <div>
                    <label style={LABEL}>Restablecer contraseña</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type={showPass ? "text" : "password"}
                        value={newPass}
                        onChange={e => setNewPass(e.target.value)}
                        placeholder="Nueva contraseña"
                        style={{ ...FIELD, flex: 1 }}
                      />
                      <button
                        onClick={() => setShowPass(!showPass)}
                        style={{ ...BTN_SECONDARY, height: 38 }}
                      >
                        {showPass ? "Ocultar" : "Mostrar"}
                      </button>
                    </div>
                    {newPass && (
                      <input
                        type={showPass ? "text" : "password"}
                        value={confirmPass}
                        onChange={e => setConfirmPass(e.target.value)}
                        placeholder="Confirmar contraseña"
                        style={{ ...FIELD, marginTop: 8 }}
                      />
                    )}
                    <button
                      onClick={() => handlePasswordReset(linkedUser.id)}
                      disabled={submitting || !newPass || !confirmPass || newPass !== confirmPass || newPass.length < 8}
                      style={{
                        ...BTN_PRIMARY, marginTop: 8,
                        opacity: submitting || !newPass || !confirmPass || newPass !== confirmPass || newPass.length < 8 ? 0.4 : 1,
                        cursor: submitting || !newPass || !confirmPass || newPass !== confirmPass || newPass.length < 8 ? "not-allowed" : "pointer",
                      }}
                    >
                      {submitting ? "…" : "Restablecer contraseña"}
                    </button>
                  </div>

                  <Link href={`/usuarios/${linkedUser.id}`} style={{
                    fontSize: "0.8125rem", fontWeight: 600, color: INK6,
                    textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
                    Ir a ficha completa de usuario →
                  </Link>
                </div>
              ) : (
                <div style={{ fontSize: "0.8125rem", color: INK5 }}>
                  Sin cuenta de usuario vinculada.
                </div>
              )}
            </SectionCard>
          )}

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
              <KeyValueRow k="Creado" v={fmtDate(conductor.createdAt)} />
              {conductor.updatedAt !== conductor.createdAt && (
                <KeyValueRow k="Actualizado" v={fmtDate(conductor.updatedAt)} />
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

      {showFatigue && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !markingFatigue && setShowFatigue(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15,15,17,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 14, maxWidth: 460, width: "100%",
              padding: "24px 24px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              border: `1px solid ${INK2}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <AlertTriangle size={22} color={RIESGO} />
              <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 800, color: INK9 }}>
                Marcar fatiga
              </h3>
            </div>
            <p style={{ margin: "0 0 16px", color: INK6, fontSize: "0.875rem", lineHeight: 1.5 }}>
              Cambia el estado del conductor <b>{conductor.name}</b> para alertar al
              sistema de despacho. La acción queda registrada en el log.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {(["riesgo", "no_apto"] as const).map((lvl) => {
                const active = fatigueLevel === lvl;
                const color = lvl === "no_apto" ? NO : RIESGO;
                const bg = lvl === "no_apto" ? NO_BG : RIESGO_BG;
                const label = lvl === "no_apto" ? "No apto (no puede operar)" : "Riesgo (alerta supervisor)";
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setFatigueLevel(lvl)}
                    style={{
                      padding: "10px 12px", borderRadius: 8, textAlign: "left",
                      border: active ? `1.5px solid ${color}` : `1px solid ${INK2}`,
                      background: active ? bg : "#fff",
                      color: active ? color : INK9,
                      fontWeight: active ? 700 : 500, fontSize: "0.875rem",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >{label}</button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowFatigue(false)}
                disabled={markingFatigue}
                style={{
                  height: 36, padding: "0 16px", borderRadius: 8,
                  border: `1.5px solid ${INK2}`, background: "#fff",
                  color: INK6, fontSize: "0.875rem", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >Cancelar</button>
              <button
                onClick={handleMarkFatigue}
                disabled={markingFatigue}
                style={{
                  height: 36, padding: "0 16px", borderRadius: 8,
                  border: "none",
                  background: fatigueLevel === "no_apto" ? NO : RIESGO,
                  color: "#fff", fontSize: "0.875rem", fontWeight: 700,
                  cursor: markingFatigue ? "not-allowed" : "pointer",
                  opacity: markingFatigue ? 0.5 : 1,
                  fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                {markingFatigue ? <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> : <AlertTriangle size={14} />}
                {markingFatigue ? "Aplicando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Subcomponentes ─────────── */

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
