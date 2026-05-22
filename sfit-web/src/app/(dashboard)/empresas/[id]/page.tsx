"use client";

import { useCallback, useEffect, useRef, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, Save, X, TrendingUp, Building2, Users, Car,
  Loader2, CheckCircle, AlertTriangle, FileText, Plus,
  Briefcase, Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { SectionCard } from "@/components/ui/SectionCard";
import { SystemIdRow } from "@/components/ui/KeyValueRow";
import { useSetBreadcrumbTitle } from "@/hooks/useBreadcrumbTitle";
import { ACTIVE_DISTRICTS, INTERPROV_DESTINATIONS } from "@/lib/scope";
import {
  getCompanyAuthorizationStatus,
  AUTHORIZATION_WARN_DAYS,
} from "@/lib/company-authorization";
import { INK1, INK2, INK5, INK6, INK9, RED, REDBG, REDBD, GRN, GRNBG, GRNBD, AMBER, AMBER_BG, AMBER_BD } from "@/lib/design-tokens";
import { FIELD, READ, LABEL } from "@/lib/form-styles";

const WARN = AMBER;
const WARN_BG = AMBER_BG;
const WARN_BD = AMBER_BD;
const RED_BG = REDBG;
const RED_BD = REDBD;
const GRN_BG = GRNBG;
const GRN_BD = GRNBD;

type ServiceScope = "urbano" | "interprovincial";

type AuthorityLevel =
  | "municipal_distrital"
  | "municipal_provincial"
  | "regional"
  | "mtc";

type Authorization = {
  level: AuthorityLevel;
  scope: ServiceScope;
  issuedBy?: string;
  resolutionNumber?: string;
  issuedAt?: string;
  expiresAt?: string;
  documentUrl?: string;
};

type Coverage = {
  departmentCodes: string[];
  provinceCodes: string[];
  districtCodes: string[];
};

type Company = {
  id: string; razonSocial: string; ruc: string;
  representanteLegal: { name: string; dni: string; phone?: string };
  vehicleTypeKeys: string[]; documents: { name: string; url: string }[];
  active: boolean; reputationScore: number;
  serviceScope?: ServiceScope;
  coverage?: Coverage;
  authorizations?: Authorization[];
};

const SCOPE_LABEL: Record<ServiceScope, string> = {
  urbano: "Urbano",
  interprovincial: "Interprovincial",
};

const AUTHORITY_LABEL: Record<AuthorityLevel, string> = {
  municipal_distrital: "Muni. distrital",
  municipal_provincial: "Muni. provincial",
  regional: "Gobierno regional",
  mtc: "MTC",
};
type StoredUser = { role: string };
interface FormState {
  razonSocial: string; ruc: string;
  repName: string; repDni: string; repPhone: string;
  serviceScope: ServiceScope;
  districtCodes: string[];
  authorizations: Authorization[];
  documents: { name: string; url: string }[];
}
type RucLookup =
  | { state: "idle" } | { state: "loading" }
  | { state: "ok"; razonSocial: string }
  | { state: "not_found" } | { state: "error"; message: string };
type DniLookup =
  | { state: "idle" } | { state: "loading" }
  | { state: "ok"; nombreCompleto: string }
  | { state: "not_found" } | { state: "error"; message: string };

function scoreColor(s: number): { color: string; bg: string; bd: string } {
  if (s >= 80) return { color: GRN, bg: GRN_BG, bd: GRN_BD };
  if (s >= 50) return { color: WARN, bg: WARN_BG, bd: WARN_BD };
  return { color: RED, bg: RED_BG, bd: RED_BD };
}

interface Props { params: Promise<{ id: string }> }

export default function EmpresaDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({
    razonSocial: "", ruc: "", repName: "", repDni: "", repPhone: "",
    serviceScope: "urbano",
    districtCodes: [],
    authorizations: [],
    documents: [],
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"suspend" | "reactivate" | "delete" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [tab, setTab] = useState<"perfil" | "documentacion" | "flota" | "operadores">("perfil");

  // Operadores que administran esta empresa (tab F5.2)
  const [operadores, setOperadores] = useState<Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    lastLoginAt: string | null;
  }> | null>(null);

  // Vehículos y conductores de esta empresa
  const [vehiculos, setVehiculos] = useState<Array<{
    id: string; plate: string; brand: string; model: string; year: number;
    vehicleTypeKey: string; status: string;
  }> | null>(null);
  const [conductores, setConductores] = useState<Array<{
    id: string; name: string; dni: string; licenseCategory: string; status: string;
  }> | null>(null);

  // Validación RUC (SUNAT)
  const [rucLookup, setRucLookup] = useState<RucLookup>({ state: "idle" });
  const [rucHover, setRucHover] = useState(false);
  const rucTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Validación DNI (RENIEC)
  const [dniLookup, setDniLookup] = useState<DniLookup>({ state: "idle" });
  const [dniHover, setDniHover] = useState(false);
  const dniTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!["super_admin", "admin_municipal"].includes(u.role)) {
      router.replace("/dashboard"); return;
    }
    setUser(u);
    void load();
    void loadOperadores();
    void loadVehiculos();
    void loadConductores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function loadOperadores() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/empresas/${id}/operadores`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setOperadores([]); return; }
      const body = await res.json();
      setOperadores(body?.data?.items ?? []);
    } catch { setOperadores([]); }
  }

  async function loadVehiculos() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/vehiculos?companyId=${id}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setVehiculos([]); return; }
      const body = await res.json();
      setVehiculos(body?.data?.items ?? []);
    } catch { setVehiculos([]); }
  }

  async function loadConductores() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/conductores?companyId=${id}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setConductores([]); return; }
      const body = await res.json();
      setConductores(body?.data?.items ?? []);
    } catch { setConductores([]); }
  }

  // Breadcrumb dinámico
  useSetBreadcrumbTitle(company?.razonSocial);

  async function load() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/empresas/${id}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo cargar la empresa."); return;
      }
      const c: Company = data.data;
      setCompany(c);
      setForm({
        razonSocial: c.razonSocial, ruc: c.ruc,
        repName: c.representanteLegal?.name ?? "",
        repDni: c.representanteLegal?.dni ?? "",
        repPhone: c.representanteLegal?.phone ?? "",
        serviceScope: c.serviceScope ?? "urbano",
        districtCodes: c.coverage?.districtCodes ?? [],
        authorizations: c.authorizations ?? [],
        documents: c.documents ?? [],
      });
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  // Auto-lookup RUC con doble proveedor (apiperu+factiliza vía /api/validar/ruc)
  // Auto-aplica razón social si el campo está vacío.
  const lookupRuc = useCallback(async (rucValue: string) => {
    if (!/^\d{11}$/.test(rucValue)) return;
    setRucLookup({ state: "loading" });
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/validar/ruc", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ ruc: rucValue }),
      });
      const data = await res.json();
      if (res.status === 404) { setRucLookup({ state: "not_found" }); return; }
      if (!res.ok || !data.success) {
        setRucLookup({ state: "error", message: data.error ?? `Servicio SUNAT no disponible (HTTP ${res.status})` });
        return;
      }
      const rs = (data.data?.razon_social ?? "").toString().trim();
      if (!rs) { setRucLookup({ state: "not_found" }); return; }
      setRucLookup({ state: "ok", razonSocial: rs });
      // Auto-aplica razón social SIEMPRE al verificar (no solo si está vacío).
      setForm(prev => ({ ...prev, razonSocial: rs }));
    } catch {
      setRucLookup({ state: "error", message: "No se pudo conectar con el servicio." });
    }
  }, []);

  useEffect(() => {
    if (rucTimer.current) clearTimeout(rucTimer.current);
    if (!editing || !/^\d{11}$/.test(form.ruc)) {
      if (rucLookup.state !== "idle") setRucLookup({ state: "idle" });
      return;
    }
    rucTimer.current = setTimeout(() => { void lookupRuc(form.ruc); }, 350);
    return () => { if (rucTimer.current) clearTimeout(rucTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ruc, editing, lookupRuc]);

  // Auto-lookup DNI (RENIEC) para representante legal
  useEffect(() => {
    if (dniTimer.current) clearTimeout(dniTimer.current);
    if (!editing || !/^\d{8}$/.test(form.repDni)) {
      if (dniLookup.state !== "idle") setDniLookup({ state: "idle" });
      return;
    }
    setDniLookup({ state: "loading" });
    dniTimer.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem("sfit_access_token");
        const res = await fetch("/api/validar/dni", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
          body: JSON.stringify({ dni: form.repDni }),
        });
        const data = await res.json();
        if (res.status === 404) { setDniLookup({ state: "not_found" }); return; }
        if (!res.ok || !data.success) {
          setDniLookup({ state: "error", message: data.error ?? "El servicio RENIEC no está disponible." });
          return;
        }
        const nombre = (data.data?.nombre_completo ?? "").toString().trim();
        setDniLookup({ state: "ok", nombreCompleto: nombre });
        // Auto-aplica el nombre del representante SIEMPRE al verificar.
        setForm(prev => ({ ...prev, repName: nombre }));
      } catch {
        setDniLookup({ state: "error", message: "No se pudo verificar el DNI." });
      }
    }, 350);
    return () => { if (dniTimer.current) clearTimeout(dniTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.repDni, editing]);

  function startEdit() { setEditing(true); setSaveError(null); }
  function cancelEdit() {
    if (!company) return;
    setEditing(false); setSaveError(null);
    setForm({
      razonSocial: company.razonSocial, ruc: company.ruc,
      repName: company.representanteLegal?.name ?? "",
      repDni: company.representanteLegal?.dni ?? "",
      repPhone: company.representanteLegal?.phone ?? "",
      serviceScope: company.serviceScope ?? "urbano",
      districtCodes: company.coverage?.districtCodes ?? [],
      authorizations: company.authorizations ?? [],
      documents: company.documents ?? [],
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaveError(null);
    if (!form.razonSocial.trim() || !form.ruc.trim()) {
      setSaveError("Razón social y RUC son requeridos."); return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/empresas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({
          razonSocial: form.razonSocial.trim(), ruc: form.ruc.trim(),
          representanteLegal: {
            name: form.repName.trim(), dni: form.repDni.trim(),
            phone: form.repPhone.trim() || undefined,
          },
          serviceScope: form.serviceScope,
          coverage: {
            // departmentCodes/provinceCodes se mantienen; districtCodes editable.
            departmentCodes: company?.coverage?.departmentCodes ?? [],
            provinceCodes:   company?.coverage?.provinceCodes   ?? [],
            districtCodes:   form.districtCodes,
          },
          authorizations: form.authorizations.map(a => ({
            ...a,
            issuedAt: a.issuedAt || undefined,
            expiresAt: a.expiresAt || undefined,
          })),
          documents: form.documents.filter(d => d.name.trim() && d.url.trim()),
        }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSaveError(data.error ?? "No se pudo guardar."); return;
      }
      setCompany(data.data);
      setEditing(false);
    } catch { setSaveError("Error de conexión."); }
    finally { setSaving(false); }
  }

  async function toggleActive() {
    if (!company) return;
    const isSuspended = !company.active;
    setToggling(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/empresas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ active: isSuspended }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo actualizar."); return;
      }
      setCompany(data.data);
    } catch { setError("Error de conexión."); }
    finally { setToggling(false); setConfirm(null); }
  }

  async function handleDeleteEmpresa() {
    if (!company) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/empresas/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo eliminar la empresa."); return;
      }
      router.push("/empresas");
    } catch {
      setError("Error de conexión.");
    } finally {
      setDeleting(false); setConfirm(null);
    }
  }

  const backBtnPlain = (
    <Link href="/empresas">
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

  if (loading || !company) {
    if (notFound) return null;
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <PageHeader kicker="Empresas · Detalle" title="Cargando empresa…" action={backBtnPlain} />
        <KPIStrip cols={3} items={[
          { label: "ESTADO", value: "—", subtitle: "cargando", icon: Building2 },
          { label: "REPUTACIÓN", value: "—", subtitle: "cargando", icon: TrendingUp },
          { label: "TIPOS AUTORIZADOS", value: "—", subtitle: "cargando", icon: Car },
        ]} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
              padding: 16, height: 160,
            }}>
              <div className="skeleton-shimmer" style={{ height: 14, width: "40%", borderRadius: 5, marginBottom: 14 }} />
              <div className="skeleton-shimmer" style={{ height: 38, borderRadius: 8, marginBottom: 10 }} />
              <div className="skeleton-shimmer" style={{ height: 38, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <PageHeader kicker="Empresas · Detalle" title="Empresa no encontrada" action={backBtnPlain} />
        <div style={{
          padding: "32px 24px", background: "#fff", border: `1px solid ${INK2}`,
          borderRadius: 12, color: INK6, textAlign: "center", fontSize: "0.875rem",
        }}>
          La empresa solicitada no existe o fue eliminada.
        </div>
      </div>
    );
  }

  const sc = scoreColor(company.reputationScore);
  const canManage = !!user?.role && ["super_admin", "admin_municipal"].includes(user.role);
  const isSuspended = !company.active;

  function updateAuth(i: number, patch: Partial<Authorization>) {
    setForm(p => ({
      ...p,
      authorizations: p.authorizations.map((a, idx) => idx === i ? { ...a, ...patch } : a),
    }));
  }
  function removeAuth(i: number) {
    setForm(p => ({ ...p, authorizations: p.authorizations.filter((_, idx) => idx !== i) }));
  }
  function updateDoc(i: number, patch: Partial<{ name: string; url: string }>) {
    setForm(p => ({
      ...p,
      documents: p.documents.map((d, idx) => idx === i ? { ...d, ...patch } : d),
    }));
  }
  function removeDoc(i: number) {
    setForm(p => ({ ...p, documents: p.documents.filter((_, idx) => idx !== i) }));
  }

  const headerAction = backBtnPlain;

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      {confirm && confirm !== "delete" && (
        <ConfirmModal
          title={confirm === "suspend" ? "Suspender empresa" : "Reactivar empresa"}
          body={confirm === "suspend"
            ? `¿Suspender "${company.razonSocial}"? No podrá registrar nuevos viajes.`
            : `¿Reactivar "${company.razonSocial}"?`}
          confirmLabel={confirm === "suspend" ? "Sí, suspender" : "Sí, reactivar"}
          confirmColor={confirm === "suspend" ? RED : GRN}
          onClose={() => setConfirm(null)}
          onConfirm={toggleActive}
          loading={toggling}
        />
      )}
      {confirm === "delete" && (
        <ConfirmModal
          title="Eliminar empresa"
          body={`¿Eliminar permanentemente "${company.razonSocial}"? Esta acción no se puede deshacer. Se marcará como inactiva y no podrá operar.`}
          confirmLabel="Sí, eliminar"
          confirmColor={RED}
          onClose={() => setConfirm(null)}
          onConfirm={handleDeleteEmpresa}
          loading={deleting}
        />
      )}

      <PageHeader
        kicker="Empresas · RF-04 · Detalle"
        title={company.razonSocial}
        subtitle={`RUC ${company.ruc} · ${isSuspended ? "Suspendida" : "Activa"}`}
        action={headerAction}
      />

      <KPIStrip cols={3} items={[
        {
          label: "ESTADO",
          value: isSuspended ? "Suspendida" : "Activa",
          subtitle: isSuspended ? "sin acceso operativo" : "operativa",
          icon: Building2,
          accent: isSuspended ? RED : GRN,
        },
        {
          label: "REPUTACIÓN",
          value: `${company.reputationScore}`,
          subtitle: "de 100 puntos",
          icon: TrendingUp,
          accent: sc.color,
        },
        {
          label: "MODALIDAD",
          value: SCOPE_LABEL[company.serviceScope ?? "urbano"],
          subtitle: "tipo de servicio",
          icon: Car,
        },
      ]} />

      {(error || saveError) && (
        <div role="alert" style={{
          padding: "10px 14px", background: RED_BG, border: `1px solid ${RED_BD}`,
          borderRadius: 8, color: RED, fontWeight: 500, fontSize: "0.8125rem",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />{error ?? saveError}
        </div>
      )}

      {/* Banner de vigencia de autorizaciones. Solo se muestra cuando hay algo
          que reportar (expiring_soon / expired / none). El estado "valid" es
          el default silencioso para no saturar la UI. */}
      {(() => {
        const status = getCompanyAuthorizationStatus(company.authorizations);
        if (status.state === "valid") return null;
        const palette =
          status.state === "expired"        ? { bg: RED_BG,  bd: RED_BD,  color: RED  } :
          status.state === "expiring_soon"  ? { bg: WARN_BG, bd: WARN_BD, color: WARN } :
                                              { bg: WARN_BG, bd: WARN_BD, color: WARN };
        const heading =
          status.state === "expired"       ? "Autorización vencida" :
          status.state === "expiring_soon" ? `Autorización por vencer en ${status.daysToExpiry} días` :
                                             "Sin autorización registrada";
        const sub =
          status.state === "none"
            ? "Esta empresa no tiene autorizaciones cargadas. Crea una rutas/viaje quedará bloqueado hasta registrar la resolución vigente."
            : status.state === "expired"
            ? "La empresa no puede crear rutas ni iniciar viajes hasta renovar y registrar la nueva resolución."
            : `Renueva la autorización para evitar interrupciones. Se alerta cuando faltan ≤${AUTHORIZATION_WARN_DAYS} días.`;
        return (
          <div role="alert" style={{
            padding: "12px 16px", background: palette.bg, border: `1px solid ${palette.bd}`,
            borderRadius: 9, display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <AlertTriangle size={16} color={palette.color} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: palette.color }}>
                {heading}
              </div>
              <div style={{ fontSize: "0.75rem", color: INK6, marginTop: 4, lineHeight: 1.5 }}>
                {sub}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Navegación por pestañas ── */}
      <div style={{
        display: "flex", gap: 0, flexWrap: "wrap", alignItems: "stretch",
        borderBottom: `2px solid ${INK2}`,
        marginBottom: 16,
      }}>
        {([
          ["perfil", "Perfil", Building2],
          ["documentacion", "Documentación", FileText],
          ["flota", "Flota", Car],
          ["operadores", "Operadores", Users],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => { setTab(key); setEditing(false); }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 16px", border: "none", background: "transparent",
              color: tab === key ? INK9 : INK6,
              fontWeight: tab === key ? 700 : 500,
              fontSize: "0.8125rem",
              borderBottom: tab === key ? `2.5px solid ${INK9}` : "2.5px solid transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "color 140ms ease, border-color 140ms ease",
              whiteSpace: "nowrap",
            }}
          >
            <Icon size={14} />
            {label}
            {/* Contadores en las pestañas */}
            {key === "flota" && vehiculos && conductores && (
              <span style={{
                fontSize: "0.625rem", fontWeight: 700,
                color: INK5, background: INK1, padding: "1px 6px",
                borderRadius: 4, marginLeft: 2,
              }}>
                {vehiculos.length + conductores.length}
              </span>
            )}
            {key === "operadores" && operadores && operadores.length > 0 && (
              <span style={{
                fontSize: "0.625rem", fontWeight: 700,
                color: INK5, background: INK1, padding: "1px 6px",
                borderRadius: 4, marginLeft: 2,
              }}>
                {operadores.length}
              </span>
            )}
          </button>
        ))}
        {/* Acciones a la derecha */}
        <div style={{ flex: 1, minWidth: 8 }} />
        {(tab === "perfil" || tab === "documentacion") && canManage && !editing && (
          <button onClick={startEdit} type="button" style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            height: 34, padding: "0 16px", borderRadius: 8,
            border: `1.5px solid ${INK2}`, background: "#fff", color: INK9,
            fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer",
            fontFamily: "inherit", alignSelf: "center",
          }}>
            <Pencil size={13} />Editar
          </button>
        )}
        {(tab === "perfil" || tab === "documentacion") && editing && (
          <>
            <button onClick={cancelEdit} type="button" style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              height: 34, padding: "0 16px", borderRadius: 8,
              border: `1.5px solid ${INK2}`, background: "#fff", color: INK9,
              fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer",
              fontFamily: "inherit", alignSelf: "center",
            }}>
              <X size={13} />Cancelar
            </button>
            <button form="empresa-form" type="submit" disabled={saving} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              height: 34, padding: "0 16px", borderRadius: 8, border: "none",
              background: INK9, color: "#fff",
              fontWeight: 700, fontSize: "0.8125rem",
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit", opacity: saving ? 0.7 : 1,
              alignSelf: "center",
            }}>
              {saving ? <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} /> : <Save size={13} />}
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </>
        )}
        {/* Botón Suspender/Reactivar */}
        {canManage && (
          <button type="button" onClick={() => setConfirm(isSuspended ? "reactivate" : "suspend")} disabled={toggling}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              height: 34, padding: "0 16px", borderRadius: 8,
              border: `1.5px solid ${isSuspended ? GRN_BD : RED_BD}`,
              background: isSuspended ? GRN_BG : RED_BG,
              color: isSuspended ? GRN : RED,
              fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer",
              fontFamily: "inherit", marginLeft: 6, alignSelf: "center",
            }}>
            {isSuspended ? "Reactivar" : "Suspender"}
          </button>
        )}
        {/* Botón Eliminar */}
        {canManage && (
          <button type="button" onClick={() => setConfirm("delete")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              height: 34, padding: "0 16px", borderRadius: 8,
              border: `1.5px solid ${RED_BD}`,
              background: RED_BG, color: RED,
              fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer",
              fontFamily: "inherit", marginLeft: 6, alignSelf: "center",
            }}>
            <Trash2 size={12} />Eliminar
          </button>
        )}
      </div>

      {/* ── Contenido de pestañas ── */}
      <form id="empresa-form" onSubmit={handleSave} noValidate>
        <div style={{ display: tab === "perfil" ? "grid" : "none", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 14 }}>

          {/* ── Datos de la empresa (RUC con SUNAT) ── */}
          <SectionCard
            icon={<Building2 size={14} color={INK6} />}
            title="Datos de la empresa"
            subtitle="Razón social oficial y RUC verificable"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={LABEL}>Razón social</div>
                {editing ? (
                  <input
                    value={form.razonSocial}
                    onChange={e => setForm(p => ({ ...p, razonSocial: e.target.value }))}
                    style={FIELD} placeholder="Razón social"
                    onFocus={e => { e.target.style.borderColor = INK9; }}
                    onBlur={e => { e.target.style.borderColor = INK2; }}
                  />
                ) : (
                  <input value={company.razonSocial} style={READ} readOnly />
                )}
              </div>

              <div>
                <div style={LABEL}>
                  RUC
                  {editing && (
                    <span style={{
                      color: INK5, fontWeight: 500, textTransform: "none",
                      letterSpacing: 0, marginLeft: 6,
                    }}>
                      (verificación SUNAT)
                    </span>
                  )}
                </div>
                {editing ? (
                  <div
                    style={{ position: "relative" }}
                    onMouseEnter={() => setRucHover(true)}
                    onMouseLeave={() => setRucHover(false)}
                  >
                    <input
                      value={form.ruc}
                      onChange={e => setForm(p => ({
                        ...p, ruc: e.target.value.replace(/\D/g, "").slice(0, 11),
                      }))}
                      style={{
                        ...FIELD,
                        fontFamily: "ui-monospace, monospace",
                        paddingRight: 36,
                        borderColor:
                          rucLookup.state === "ok" ? GRN
                          : rucLookup.state === "not_found" ? "#F59E0B"
                          : rucLookup.state === "error" ? RED
                          : INK2,
                      }}
                      placeholder="20XXXXXXXXX" inputMode="numeric" maxLength={11}
                      onFocus={e => { e.target.style.borderColor = INK9; }}
                      onBlur={e => {
                        e.target.style.borderColor =
                          rucLookup.state === "ok" ? GRN
                          : rucLookup.state === "not_found" ? "#F59E0B"
                          : rucLookup.state === "error" ? RED
                          : INK2;
                      }}
                    />
                    <div style={{
                      position: "absolute", right: 10, top: "50%",
                      transform: "translateY(-50%)", pointerEvents: "none",
                    }}>
                      {rucLookup.state === "loading" && <Loader2 size={14} color={INK5} style={{ animation: "spin 0.7s linear infinite" }} />}
                      {rucLookup.state === "ok" && <CheckCircle size={14} color={GRN} />}
                      {rucLookup.state === "not_found" && <AlertTriangle size={14} color="#F59E0B" />}
                      {rucLookup.state === "error" && <AlertTriangle size={14} color={RED} />}
                    </div>

                    {rucHover && rucLookup.state !== "idle" && (
                      <LookupPopover
                        kind="ruc"
                        lookup={rucLookup}
                        onApply={() => {
                          if (rucLookup.state === "ok") {
                            setForm(p => ({ ...p, razonSocial: rucLookup.razonSocial }));
                          }
                        }}
                        currentValue={form.razonSocial}
                        onRetry={() => { void lookupRuc(form.ruc); }}
                      />
                    )}
                  </div>
                ) : (
                  <input value={company.ruc} style={{ ...READ, fontFamily: "ui-monospace, monospace" }} readOnly />
                )}
                {/* Feedback inline OK — con botón "Aplicar" si difiere */}
                {editing && rucLookup.state === "ok" && (() => {
                  const differs = form.razonSocial.trim().toLowerCase() !== rucLookup.razonSocial.toLowerCase();
                  if (!differs) {
                    return (
                      <p style={{ marginTop: 6, fontSize: "0.75rem", color: GRN, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                        <CheckCircle size={11} />Verificado: {rucLookup.razonSocial}
                      </p>
                    );
                  }
                  return (
                    <div style={{
                      marginTop: 8, padding: "8px 10px", borderRadius: 8,
                      border: `1px solid ${GRN_BD}`, background: GRN_BG,
                      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                    }}>
                      <CheckCircle size={13} color={GRN} style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, fontSize: "0.75rem" }}>
                        <div style={{ fontWeight: 700, color: GRN, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.625rem" }}>
                          SUNAT
                        </div>
                        <div style={{ color: INK9, fontWeight: 600, marginTop: 1, wordBreak: "break-word" }}>
                          {rucLookup.razonSocial}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm(p => ({ ...p, razonSocial: rucLookup.razonSocial }))}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          height: 28, padding: "0 12px", borderRadius: 6,
                          border: `1px solid ${GRN}`, background: "#fff", color: GRN,
                          fontSize: "0.75rem", fontWeight: 700,
                          cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                        }}
                      >
                        Aplicar razón social
                      </button>
                    </div>
                  );
                })()}
                {editing && rucLookup.state === "not_found" && (
                  <p style={{ marginTop: 6, fontSize: "0.75rem", color: WARN, fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                    <AlertTriangle size={11} />RUC no encontrado en SUNAT.
                  </p>
                )}
                {editing && rucLookup.state === "error" && (
                  <p style={{ marginTop: 6, fontSize: "0.75rem", color: RED, fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                    <AlertTriangle size={11} />{rucLookup.message}
                  </p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* ── Representante legal (DNI con RENIEC) ── */}
          <SectionCard
            icon={<Users size={14} color={INK6} />}
            title="Representante legal"
            subtitle="Datos del titular registrado"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={LABEL}>
                  DNI
                  {editing && (
                    <span style={{
                      color: INK5, fontWeight: 500, textTransform: "none",
                      letterSpacing: 0, marginLeft: 6,
                    }}>
                      (verificación RENIEC)
                    </span>
                  )}
                </div>
                {editing ? (
                  <div
                    style={{ position: "relative" }}
                    onMouseEnter={() => setDniHover(true)}
                    onMouseLeave={() => setDniHover(false)}
                  >
                    <input
                      value={form.repDni}
                      onChange={e => setForm(p => ({
                        ...p, repDni: e.target.value.replace(/\D/g, "").slice(0, 8),
                      }))}
                      style={{
                        ...FIELD,
                        fontFamily: "ui-monospace, monospace",
                        paddingRight: 36,
                        borderColor:
                          dniLookup.state === "ok" ? GRN
                          : dniLookup.state === "not_found" ? "#F59E0B"
                          : dniLookup.state === "error" ? RED
                          : INK2,
                      }}
                      placeholder="12345678" inputMode="numeric" maxLength={8}
                      onFocus={e => { e.target.style.borderColor = INK9; }}
                      onBlur={e => {
                        e.target.style.borderColor =
                          dniLookup.state === "ok" ? GRN
                          : dniLookup.state === "not_found" ? "#F59E0B"
                          : dniLookup.state === "error" ? RED
                          : INK2;
                      }}
                    />
                    <div style={{
                      position: "absolute", right: 10, top: "50%",
                      transform: "translateY(-50%)", pointerEvents: "none",
                    }}>
                      {dniLookup.state === "loading" && <Loader2 size={14} color={INK5} style={{ animation: "spin 0.7s linear infinite" }} />}
                      {dniLookup.state === "ok" && <CheckCircle size={14} color={GRN} />}
                      {dniLookup.state === "not_found" && <AlertTriangle size={14} color="#F59E0B" />}
                      {dniLookup.state === "error" && <AlertTriangle size={14} color={RED} />}
                    </div>

                    {dniHover && dniLookup.state !== "idle" && (
                      <LookupPopover
                        kind="dni"
                        lookup={dniLookup}
                        onApply={() => {
                          if (dniLookup.state === "ok") {
                            setForm(p => ({ ...p, repName: dniLookup.nombreCompleto }));
                          }
                        }}
                        currentValue={form.repName}
                      />
                    )}
                  </div>
                ) : (
                  <input value={company.representanteLegal?.dni ?? "—"} style={{ ...READ, fontFamily: "ui-monospace, monospace" }} readOnly />
                )}
              </div>

              <div>
                <div style={LABEL}>Nombre completo</div>
                {editing ? (
                  <input
                    value={form.repName}
                    onChange={e => setForm(p => ({ ...p, repName: e.target.value }))}
                    style={FIELD} placeholder="Nombre del representante"
                    onFocus={e => { e.target.style.borderColor = INK9; }}
                    onBlur={e => { e.target.style.borderColor = INK2; }}
                  />
                ) : (
                  <input value={company.representanteLegal?.name ?? "—"} style={READ} readOnly />
                )}
              </div>

              <div>
                <div style={LABEL}>Teléfono</div>
                {editing ? (
                  <input
                    value={form.repPhone}
                    onChange={e => setForm(p => ({ ...p, repPhone: e.target.value }))}
                    style={FIELD} placeholder="987 654 321"
                    onFocus={e => { e.target.style.borderColor = INK9; }}
                    onBlur={e => { e.target.style.borderColor = INK2; }}
                  />
                ) : (
                  <input value={company.representanteLegal?.phone ?? "—"} style={READ} readOnly />
                )}
              </div>
            </div>
          </SectionCard>

          {/* ── Modalidad y cobertura operativa ── */}
          <SectionCard
            icon={<Briefcase size={14} color={INK6} />}
            title="Ámbito de servicio"
            subtitle="Modalidad legal y distritos donde opera la empresa"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={LABEL}>Modalidad</div>
                {editing ? (
                  <select
                    value={form.serviceScope}
                    onChange={e => {
                      const scope = e.target.value as ServiceScope;
                      setForm(p => ({
                        ...p,
                        serviceScope: scope,
                        authorizations: p.authorizations.map(a => ({ ...a, scope })),
                      }));
                    }}
                    style={{ ...FIELD, appearance: "none", paddingRight: 30 }}
                  >
                    <option value="urbano">Urbano</option>
                    <option value="interprovincial">Interprovincial</option>
                  </select>
                ) : (
                  <input value={SCOPE_LABEL[company.serviceScope ?? "urbano"]} style={READ} readOnly />
                )}
              </div>
              <div>
                <div style={LABEL}>Cobertura — distritos de origen (Cotabambas)</div>
                {editing ? (
                  <div style={{
                    display: "grid", gap: 6,
                    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                    padding: 8, border: `1px solid ${INK2}`, borderRadius: 8, background: "#fff",
                    marginBottom: form.serviceScope === "interprovincial" ? 14 : 0,
                  }}>
                    {ACTIVE_DISTRICTS.map(d => {
                      const checked = form.districtCodes.includes(d.code);
                      return (
                        <label key={d.code} style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "6px 10px", borderRadius: 6,
                          border: `1px solid ${checked ? GRN_BD : INK2}`,
                          background: checked ? GRN_BG : "#fff",
                          cursor: "pointer", fontSize: "0.8125rem",
                        }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setForm(p => ({
                              ...p,
                              districtCodes: checked
                                ? p.districtCodes.filter(c => c !== d.code)
                                : [...p.districtCodes, d.code],
                            }))}
                            style={{ accentColor: GRN }}
                          />
                          <span style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: INK9 }}>{d.name}</div>
                            <div style={{ fontSize: "0.6875rem", color: INK5, fontFamily: "ui-monospace, monospace" }}>
                              {d.code}
                            </div>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ marginBottom: (() => {
                    const codes = company.coverage?.districtCodes ?? [];
                    return codes.some(c => INTERPROV_DESTINATIONS.some(d => d.code === c)) ? 14 : 0;
                  })() }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(company.coverage?.districtCodes ?? []).filter(code => ACTIVE_DISTRICTS.some(d => d.code === code)).length === 0 ? (
                        <span style={{ fontSize: "0.8125rem", color: INK5 }}>— Sin distritos definidos —</span>
                      ) : (
                        (company.coverage?.districtCodes ?? []).filter(code => ACTIVE_DISTRICTS.some(d => d.code === code)).map(code => {
                          const found = ACTIVE_DISTRICTS.find(d => d.code === code);
                          return found ? (
                            <span key={code} style={{
                              padding: "4px 10px", borderRadius: 6,
                              background: GRN_BG, color: GRN, border: `1px solid ${GRN_BD}`,
                              fontSize: "0.75rem", fontWeight: 600,
                            }}>
                              {found.name}
                            </span>
                          ) : null;
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Destinos interprovinciales — solo visibles si aplica */}
                {(editing ? form.serviceScope === "interprovincial" : (() => {
                  const codes = company.coverage?.districtCodes ?? [];
                  return codes.some(c => INTERPROV_DESTINATIONS.some(d => d.code === c));
                })()) && (
                  <>
                    <div style={{ ...LABEL, marginTop: editing ? 0 : 4 }}>Destinos interprovinciales</div>
                    {editing ? (
                      <div style={{
                        display: "grid", gap: 6,
                        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                        padding: 8, border: `1px solid ${INK2}`, borderRadius: 8, background: "#fff",
                      }}>
                        {INTERPROV_DESTINATIONS.map(d => {
                          const checked = form.districtCodes.includes(d.code);
                          return (
                            <label key={d.code} style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "6px 10px", borderRadius: 6,
                              border: `1px solid ${checked ? GRN_BD : INK2}`,
                              background: checked ? GRN_BG : "#fff",
                              cursor: "pointer", fontSize: "0.8125rem",
                            }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setForm(p => ({
                                  ...p,
                                  districtCodes: checked
                                    ? p.districtCodes.filter(c => c !== d.code)
                                    : [...p.districtCodes, d.code],
                                }))}
                                style={{ accentColor: GRN }}
                              />
                              <span style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: INK9 }}>{d.name}</div>
                                <div style={{ fontSize: "0.6875rem", color: INK5, fontFamily: "ui-monospace, monospace" }}>
                                  {d.code} · {d.province}
                                </div>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {(company.coverage?.districtCodes ?? []).filter(code => INTERPROV_DESTINATIONS.some(d => d.code === code)).map(code => {
                          const found = INTERPROV_DESTINATIONS.find(d => d.code === code);
                          return found ? (
                            <span key={code} style={{
                              padding: "4px 10px", borderRadius: 6,
                              background: GRN_BG, color: GRN, border: `1px solid ${GRN_BD}`,
                              fontSize: "0.75rem", fontWeight: 600,
                            }}>
                              {found.name}{found.province !== found.name ? ` · ${found.province}` : ""}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </SectionCard>

        </div>

        {/* ── Pestaña: Documentación ── */}
        <div style={{ display: tab === "documentacion" ? "grid" : "none", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 14 }}>

          {/* ── Autorizaciones ── */}
          <SectionCard
            icon={<FileText size={14} color={INK6} />}
            title="Autorizaciones"
            subtitle="Resoluciones municipales / regionales / MTC"
          >
            {!editing ? (
              !(company.authorizations?.length) ? (
                <EmptyBlock
                  icon={<FileText size={20} color={INK5} strokeWidth={1.5} />}
                  title="Sin autorizaciones registradas"
                  subtitle="Las resoluciones de operación se mostrarán aquí."
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(company.authorizations ?? []).map((a, i) => (
                    <div key={i} style={{
                      padding: "10px 12px", borderRadius: 8,
                      background: "#fff", border: `1px solid ${INK2}`,
                      display: "flex", flexDirection: "column", gap: 4,
                    }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: INK9, fontSize: "0.8125rem" }}>
                          {AUTHORITY_LABEL[a.level]}
                        </span>
                        <span style={{ fontSize: "0.6875rem", color: INK5 }}>·</span>
                        <span style={{ fontSize: "0.75rem", color: INK6 }}>
                          {SCOPE_LABEL[a.scope]}
                        </span>
                      </div>
                      {a.resolutionNumber && (
                        <div style={{ fontSize: "0.75rem", color: INK6, fontFamily: "ui-monospace, monospace" }}>
                          Res. {a.resolutionNumber}{a.issuedBy ? ` · ${a.issuedBy}` : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {form.authorizations.map((a, i) => (
                  <div key={i} style={{
                    padding: 10, borderRadius: 8,
                    border: `1px solid ${INK2}`, background: "#fff",
                    display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8,
                  }}>
                    <select
                      value={a.level}
                      onChange={e => updateAuth(i, { level: e.target.value as AuthorityLevel })}
                      style={{ ...FIELD, height: 34 }}
                    >
                      <option value="municipal_provincial">Municipal provincial</option>
                      <option value="regional">Regional</option>
                      <option value="mtc">MTC</option>
                    </select>
                    <input
                      value={SCOPE_LABEL[a.scope]}
                      readOnly
                      style={{ ...READ, height: 34, textAlign: "center" }}
                    />
                    <button
                      type="button"
                      onClick={() => removeAuth(i)}
                      style={{
                        height: 34, padding: "0 10px", borderRadius: 7,
                        border: `1px solid ${RED_BD}`, background: RED_BG, color: RED,
                        cursor: "pointer", fontSize: "0.75rem", fontWeight: 600,
                      }}
                    >
                      Quitar
                    </button>
                    <input
                      placeholder="N° de resolución"
                      value={a.resolutionNumber ?? ""}
                      onChange={e => updateAuth(i, { resolutionNumber: e.target.value })}
                      style={{ ...FIELD, height: 34, gridColumn: "1 / 3" }}
                    />
                    <input
                      placeholder="Emisora"
                      value={a.issuedBy ?? ""}
                      onChange={e => updateAuth(i, { issuedBy: e.target.value })}
                      style={{ ...FIELD, height: 34, gridColumn: "3" }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setForm(p => ({
                    ...p,
                    authorizations: [...p.authorizations, {
                      level: "municipal_provincial",
                      scope: form.serviceScope,
                      resolutionNumber: "",
                      issuedBy: "",
                    }],
                  }))}
                  style={{
                    alignSelf: "flex-start",
                    height: 32, padding: "0 12px", borderRadius: 7,
                    border: `1px solid ${INK2}`, background: "#fff", color: INK6,
                    cursor: "pointer", fontSize: "0.75rem", fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <Plus size={12} /> Agregar autorización
                </button>
              </div>
            )}
          </SectionCard>

          {/* ── Documentos ── */}
          <SectionCard
            icon={<FileText size={14} color={INK6} />}
            title="Documentos"
            subtitle={`${(editing ? form.documents : company.documents)?.length ?? 0} adjunto${((editing ? form.documents : company.documents)?.length ?? 0) === 1 ? "" : "s"}`}
          >
            {!editing ? (
              !company.documents?.length ? (
                <EmptyBlock
                  icon={<FileText size={20} color={INK5} strokeWidth={1.5} />}
                  title="Sin documentos adjuntos"
                  subtitle="Permisos, autorizaciones MTC o resoluciones se mostrarán aquí."
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {company.documents.map((d, i) => (
                    <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 12px", borderRadius: 8,
                      background: "#fff", border: `1px solid ${INK2}`, color: INK9,
                      fontSize: "0.8125rem", textDecoration: "none",
                      transition: "border-color 120ms",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = INK5; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = INK2; }}
                    >
                      <FileText size={13} color={INK6} />
                      <span style={{ flex: 1, fontWeight: 600 }}>{d.name}</span>
                      <span style={{ fontSize: "0.6875rem", color: INK5 }}>Abrir →</span>
                    </a>
                  ))}
                </div>
              )
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {form.documents.map((d, i) => (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 8,
                    padding: 8, borderRadius: 8,
                    border: `1px solid ${INK2}`, background: "#fff",
                  }}>
                    <input
                      placeholder="Nombre del documento"
                      value={d.name}
                      onChange={e => updateDoc(i, { name: e.target.value })}
                      style={{ ...FIELD, height: 34 }}
                    />
                    <input
                      placeholder="https://..."
                      value={d.url}
                      onChange={e => updateDoc(i, { url: e.target.value })}
                      style={{ ...FIELD, height: 34 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeDoc(i)}
                      style={{
                        height: 34, padding: "0 10px", borderRadius: 7,
                        border: `1px solid ${RED_BD}`, background: RED_BG, color: RED,
                        cursor: "pointer", fontSize: "0.75rem", fontWeight: 600,
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setForm(p => ({
                    ...p,
                    documents: [...p.documents, { name: "", url: "" }],
                  }))}
                  style={{
                    alignSelf: "flex-start",
                    height: 32, padding: "0 12px", borderRadius: 7,
                    border: `1px solid ${INK2}`, background: "#fff", color: INK6,
                    cursor: "pointer", fontSize: "0.75rem", fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <Plus size={12} /> Agregar documento
                </button>
              </div>
            )}
          </SectionCard>

        </div>

        {/* ── Pestaña: Operadores ── */}
        <div style={{ display: tab === "operadores" ? "block" : "none" }}>
            <SectionCard
              icon={<Users size={14} color={INK6} />}
              title="Operadores que administran"
              subtitle={
                operadores === null
                  ? "Cargando…"
                  : operadores.length === 0
                  ? "Aún ningún operador vinculó su cuenta a esta empresa"
                  : `${operadores.length} operador${operadores.length === 1 ? "" : "es"} vinculado${operadores.length === 1 ? "" : "s"}`
              }
            >
              {operadores === null ? (
                <div style={{ fontSize: "0.8125rem", color: INK5 }}>
                  <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite", marginRight: 6 }} />
                  Consultando…
                </div>
              ) : operadores.length === 0 ? (
                <div style={{ fontSize: "0.8125rem", color: INK5 }}>
                  Cuando un operador complete su onboarding con el RUC{" "}
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{company.ruc}</span>{" "}
                  aparecerá aquí.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {operadores.map((o) => (
                    <div key={o.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 12px", borderRadius: 8,
                      background: INK1, border: `1px solid ${INK2}`,
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: INK9 }}>{o.name}</div>
                        <div style={{ fontSize: "0.75rem", color: INK5 }}>{o.email}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: 5,
                          background: o.status === "activo" ? GRN_BG : WARN_BG,
                          color: o.status === "activo" ? GRN : WARN,
                          border: `1px solid ${o.status === "activo" ? GRN_BD : WARN_BD}`,
                          fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                        }}>{o.status}</span>
                        <Link href={`/usuarios/${o.id}`} style={{ fontSize: "0.75rem", color: INK6, fontWeight: 600, textDecoration: "underline" }}>
                          Ver ficha
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
        </div>

        {/* ── Pestaña: Flota ── */}
        <div style={{ display: tab === "flota" ? "block" : "none" }}>
            <SectionCard
              icon={<Car size={14} color={INK6} />}
              title="Flota y conductores"
              subtitle={
                vehiculos === null || conductores === null
                  ? "Cargando…"
                  : `${vehiculos.length} vehículo${vehiculos.length === 1 ? "" : "s"} · ${conductores.length} conductor${conductores.length === 1 ? "" : "es"}`
              }
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
                {/* Vehículos */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.75rem", color: INK6, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Vehículos ({vehiculos?.length ?? 0})
                  </div>
                  {vehiculos === null ? (
                    <div style={{ fontSize: "0.8125rem", color: INK5 }}>
                      <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite", marginRight: 6 }} />
                      Consultando…
                    </div>
                  ) : vehiculos.length === 0 ? (
                    <div style={{ fontSize: "0.8125rem", color: INK5 }}>
                      Ningún vehículo registrado para esta empresa.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {vehiculos.map(v => (
                        <Link key={v.id} href={`/vehiculos/${v.id}`} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 12px", borderRadius: 8,
                          background: INK1, border: `1px solid ${INK2}`,
                          textDecoration: "none", color: "inherit",
                          transition: "border-color 120ms",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = INK5; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = INK2; }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: INK9 }}>
                              {v.plate} <span style={{ fontWeight: 400, fontSize: "0.6875rem", color: INK5 }}>{v.brand} {v.model} {v.year}</span>
                            </div>
                          </div>
                          <span style={{
                            padding: "2px 8px", borderRadius: 5,
                            background: v.status === "disponible" ? GRN_BG : INK1,
                            color: v.status === "disponible" ? GRN : INK5,
                            border: `1px solid ${v.status === "disponible" ? GRN_BD : INK2}`,
                            fontSize: "0.625rem", fontWeight: 700,
                            letterSpacing: "0.04em", textTransform: "uppercase",
                          }}>
                            {v.status?.replace(/_/g, " ") ?? "—"}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Conductores */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.75rem", color: INK6, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Conductores ({conductores?.length ?? 0})
                  </div>
                  {conductores === null ? (
                    <div style={{ fontSize: "0.8125rem", color: INK5 }}>
                      <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite", marginRight: 6 }} />
                      Consultando…
                    </div>
                  ) : conductores.length === 0 ? (
                    <div style={{ fontSize: "0.8125rem", color: INK5 }}>
                      Ningún conductor registrado para esta empresa.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {conductores.map(c => (
                        <Link key={c.id} href={`/conductores/${c.id}`} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 12px", borderRadius: 8,
                          background: INK1, border: `1px solid ${INK2}`,
                          textDecoration: "none", color: "inherit",
                          transition: "border-color 120ms",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = INK5; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = INK2; }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: INK9 }}>{c.name}</div>
                            <div style={{ fontSize: "0.6875rem", color: INK5 }}>
                              DNI {c.dni} · Lic. {c.licenseCategory}
                            </div>
                          </div>
                          <span style={{
                            padding: "2px 8px", borderRadius: 5,
                            background: c.status === "apto" ? GRN_BG : c.status === "riesgo" ? WARN_BG : RED_BG,
                            color: c.status === "apto" ? GRN : c.status === "riesgo" ? WARN : RED,
                            border: `1px solid ${c.status === "apto" ? GRN_BD : c.status === "riesgo" ? WARN_BD : RED_BD}`,
                            fontSize: "0.625rem", fontWeight: 700,
                            letterSpacing: "0.04em", textTransform: "uppercase",
                          }}>
                            {c.status ?? "—"}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
        </div>

        {/* ── ID de soporte (siempre visible) ── */}
        <div style={{ marginTop: 16 }}>
          <SystemIdRow id={company.id} />
        </div>
      </form>
    </div>
  );
}

/* ─────────── Subcomponentes ─────────── */

function EmptyBlock({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{
      padding: "20px 16px", textAlign: "center",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      background: INK1, borderRadius: 8, border: `1px dashed ${INK2}`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9,
        background: "#fff", border: `1px solid ${INK2}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: INK9 }}>{title}</div>
        <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2, maxWidth: 260, lineHeight: 1.45 }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function LookupPopover({
  kind, lookup, onApply, currentValue, onRetry,
}: {
  kind: "ruc" | "dni";
  lookup: RucLookup | DniLookup;
  onApply: () => void;
  currentValue: string;
  onRetry?: () => void;
}) {
  const verifLabel = kind === "ruc" ? "SUNAT verificado" : "RENIEC verificado";
  const applyLabel = kind === "ruc" ? "Usar esta razón social" : "Usar este nombre";
  const okText = lookup.state === "ok" ? (kind === "ruc" ? (lookup as RucLookup & { state: "ok" }).razonSocial : (lookup as DniLookup & { state: "ok" }).nombreCompleto) : "";

  return (
    <div role="status" aria-live="polite" style={{
      position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
      zIndex: 50, background: "#fff",
      border: `1px solid ${
        lookup.state === "ok" ? GRN_BD
        : lookup.state === "not_found" ? "#FDE68A"
        : lookup.state === "error" ? RED_BD : INK2
      }`,
      borderRadius: 8, padding: "10px 12px",
      boxShadow: "0 8px 24px rgba(9,9,11,0.10), 0 1px 2px rgba(9,9,11,0.06)",
      animation: "fadeIn 120ms ease",
    }}>
      {lookup.state === "loading" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 size={13} color={INK5} style={{ animation: "spin 0.7s linear infinite" }} />
          <span style={{ fontSize: "0.8125rem", color: INK6 }}>
            Consultando {kind === "ruc" ? "SUNAT" : "RENIEC"}…
          </span>
        </div>
      )}
      {lookup.state === "ok" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <CheckCircle size={12} color={GRN} />
            <span style={{ fontSize: "0.625rem", fontWeight: 800, color: GRN, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {verifLabel}
            </span>
          </div>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9, lineHeight: 1.35, wordBreak: "break-word" }}>
            {okText}
          </div>
          {currentValue.trim().toLowerCase() !== okText.toLowerCase() && (
            <button type="button" onClick={onApply} style={{
              marginTop: 8, width: "100%", height: 28, borderRadius: 6,
              border: `1px solid ${GRN}`, background: GRN_BG, color: GRN,
              fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>
              {applyLabel}
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
            {kind === "ruc"
              ? "RUC no encontrado en SUNAT. Puedes ingresar manualmente."
              : "DNI no encontrado en RENIEC. Puedes ingresar el nombre manualmente."}
          </div>
        </>
      )}
      {lookup.state === "error" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <AlertTriangle size={12} color={RED} />
            <span style={{ fontSize: "0.625rem", fontWeight: 800, color: RED, letterSpacing: "0.08em", textTransform: "uppercase" }}>
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

function ConfirmModal({
  title, body, confirmLabel, confirmColor, onClose, onConfirm, loading,
}: {
  title: string; body: string;
  confirmLabel: string; confirmColor: string;
  onClose: () => void; onConfirm: () => void; loading: boolean;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60,
      background: "rgba(9,9,11,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "#fff", borderRadius: 12, width: "100%", maxWidth: 420,
        boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
      }}>
        <div style={{ padding: "18px 20px 14px" }}>
          <div style={{ fontWeight: 800, fontSize: "1rem", color: INK9, marginBottom: 6 }}>
            {title}
          </div>
          <div style={{ fontSize: "0.875rem", color: INK6, lineHeight: 1.5 }}>{body}</div>
        </div>
        <div style={{ padding: "0 20px 18px", display: "flex", gap: 8 }}>
          <button onClick={onClose} disabled={loading} style={{
            flex: 1, height: 36, borderRadius: 8,
            border: `1px solid ${INK2}`, background: "#fff", color: INK6,
            fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit",
          }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} style={{
            flex: 1, height: 36, borderRadius: 8, border: "none",
            background: confirmColor, color: "#fff",
            fontWeight: 700, fontSize: "0.875rem", cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit", opacity: loading ? 0.7 : 1,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            {loading && <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} />}
            {loading ? "Procesando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
