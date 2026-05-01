"use client";

import { useCallback, useEffect, useRef, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, Save, X, TrendingUp, Building2, Users, Car,
  Loader2, CheckCircle, AlertTriangle, Hash, Copy, Check, FileText, Plus,
  Briefcase,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { useSetBreadcrumbTitle } from "@/hooks/useBreadcrumbTitle";

/* ── Tokens — paleta sobria ── */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK3 = "#d4d4d8";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const RED = "#DC2626"; const RED_BG = "#FFF5F5"; const RED_BD = "#FCA5A5";
const GRN = "#15803d"; const GRN_BG = "#F0FDF4"; const GRN_BD = "#86EFAC";
const WARN = "#B45309"; const WARN_BG = "#FFFBEB"; const WARN_BD = "#FDE68A";

const FIELD: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 12px", borderRadius: 8,
  border: `1px solid ${INK2}`, fontSize: "0.875rem", color: INK9,
  background: "#fff", outline: "none", boxSizing: "border-box",
  fontFamily: "var(--font-inter), Inter, sans-serif",
  transition: "border-color 150ms",
};
const READ: React.CSSProperties = {
  ...FIELD, background: INK1, color: INK6, border: `1px solid ${INK2}`,
};
const LABEL: React.CSSProperties = {
  fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: INK5, marginBottom: 6,
};

type Company = {
  id: string; razonSocial: string; ruc: string;
  representanteLegal: { name: string; dni: string; phone?: string };
  vehicleTypeKeys: string[]; documents: { name: string; url: string }[];
  active: boolean; reputationScore: number; status?: string;
};
type VehicleType = { id: string; key: string; name: string };
type StoredUser = { role: string };
interface FormState {
  razonSocial: string; ruc: string;
  repName: string; repDni: string; repPhone: string;
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

/** Convierte una key técnica (snake_case) en un label legible. */
function humanizeKey(key: string): string {
  if (!key) return "";
  const cleaned = key.replace(/_/g, " ").trim().toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

interface Props { params: Promise<{ id: string }> }

export default function EmpresaDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({
    razonSocial: "", ruc: "", repName: "", repDni: "", repPhone: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"suspend" | "reactivate" | null>(null);
  const [toggling, setToggling] = useState(false);
  const [togglingType, setTogglingType] = useState<string | null>(null);

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
    if (!["admin_municipal", "fiscal", "admin_provincial", "super_admin"].includes(u.role)) {
      router.replace("/dashboard"); return;
    }
    setUser(u);
    void load();
    void loadTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

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
      });
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  async function loadTypes() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/tipos-vehiculo", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setTypes(data.data.items ?? []);
    } catch { /* silent */ }
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
    const isSuspended = !company.active || company.status === "suspendido";
    setToggling(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/empresas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({
          active: isSuspended,
          status: isSuspended ? "activo" : "suspendido",
        }),
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

  /** Agrega o quita un tipo de vehículo del catálogo autorizado de la empresa. */
  async function toggleVehicleType(key: string) {
    if (!company) return;
    const current = company.vehicleTypeKeys ?? [];
    const next = current.includes(key)
      ? current.filter(k => k !== key)
      : [...current, key];
    setTogglingType(key); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/empresas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ vehicleTypeKeys: next }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo actualizar la flota."); return;
      }
      setCompany(data.data);
    } catch { setError("Error de conexión."); }
    finally { setTogglingType(null); }
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
  const typeMap = new Map(types.map(t => [t.key, t.name]));
  const canManage = user?.role === "admin_municipal" || user?.role === "super_admin";
  const isSuspended = !company.active || company.status === "suspendido";

  const headerAction = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {backBtnPlain}
      {canManage && !editing && (
        <>
          <button onClick={startEdit} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 36, padding: "0 14px", borderRadius: 9,
            border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
            fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit",
          }}>
            <Pencil size={14} />Editar
          </button>
          <button onClick={() => setConfirm(isSuspended ? "reactivate" : "suspend")} disabled={toggling}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 36, padding: "0 14px", borderRadius: 9,
              border: `1.5px solid ${isSuspended ? GRN_BD : RED_BD}`,
              background: isSuspended ? GRN_BG : RED_BG,
              color: isSuspended ? GRN : RED,
              fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit",
            }}>
            {isSuspended ? "Reactivar" : "Suspender"}
          </button>
        </>
      )}
      {editing && (
        <>
          <button onClick={cancelEdit} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 36, padding: "0 14px", borderRadius: 9,
            border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
            fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit",
          }}>
            <X size={14} />Cancelar
          </button>
          <button form="empresa-form" type="submit" disabled={saving} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 36, padding: "0 14px", borderRadius: 9,
            border: "none", background: INK9, color: "#fff",
            fontWeight: 700, fontSize: "0.875rem", cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "inherit", opacity: saving ? 0.7 : 1,
          }}>
            {saving ? <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> : <Save size={14} />}
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      {confirm && (
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
          label: "TIPOS AUTORIZADOS",
          value: company.vehicleTypeKeys.length,
          subtitle: "modelos en flota",
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

      <form id="empresa-form" onSubmit={handleSave} noValidate>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

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

          {/* ── Tipos de vehículo autorizados ── */}
          <SectionCard
            icon={<Car size={14} color={INK6} />}
            title="Tipos de vehículo autorizados"
            subtitle={canManage
              ? "Marca los tipos que esta empresa puede operar"
              : `${company.vehicleTypeKeys.length} tipo${company.vehicleTypeKeys.length === 1 ? "" : "s"} autorizado${company.vehicleTypeKeys.length === 1 ? "" : "s"}`}
          >
            {(() => {
              const selected = new Set(company.vehicleTypeKeys);
              const catalogKeys = new Set(types.map(t => t.key));
              // Tipos que la empresa tiene pero ya no están en el catálogo activo:
              // los mostramos igual, marcados como obsoletos, para no perder la trazabilidad.
              const orphanKeys = company.vehicleTypeKeys.filter(k => !catalogKeys.has(k));

              if (!canManage) {
                // Vista de solo lectura para roles sin permisos de gestión
                if (company.vehicleTypeKeys.length === 0) {
                  return (
                    <EmptyBlock
                      icon={<Car size={20} color={INK5} strokeWidth={1.5} />}
                      title="Sin tipos asignados"
                      subtitle="No se han autorizado tipos de vehículo para esta empresa."
                    />
                  );
                }
                return (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {company.vehicleTypeKeys.map(k => (
                      <span key={k} style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 6,
                        background: INK1, border: `1px solid ${INK2}`, color: INK9,
                        fontSize: "0.75rem", fontWeight: 600,
                      }}>
                        <Car size={11} color={INK6} />
                        {typeMap.get(k) ?? humanizeKey(k)}
                      </span>
                    ))}
                  </div>
                );
              }

              // Vista interactiva: toggle por chip
              if (types.length === 0 && company.vehicleTypeKeys.length === 0) {
                return (
                  <EmptyBlock
                    icon={<Car size={20} color={INK5} strokeWidth={1.5} />}
                    title="Catálogo vacío"
                    subtitle="Aún no hay tipos de vehículo en el catálogo de la municipalidad."
                  />
                );
              }
              return (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {types.map(t => {
                      const isOn = selected.has(t.key);
                      const loading = togglingType === t.key;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => { void toggleVehicleType(t.key); }}
                          disabled={loading}
                          aria-pressed={isOn}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "5px 11px", borderRadius: 6,
                            background: isOn ? INK9 : "#fff",
                            color: isOn ? "#fff" : INK6,
                            border: `1px solid ${isOn ? INK9 : INK2}`,
                            fontSize: "0.75rem", fontWeight: 600,
                            cursor: loading ? "not-allowed" : "pointer",
                            opacity: loading ? 0.6 : 1,
                            fontFamily: "inherit", transition: "background 120ms, color 120ms, border-color 120ms",
                          }}
                        >
                          {loading
                            ? <Loader2 size={11} style={{ animation: "spin 0.7s linear infinite" }} />
                            : isOn ? <Check size={11} /> : <Plus size={11} />}
                          {t.name}
                        </button>
                      );
                    })}
                    {orphanKeys.map(k => {
                      const loading = togglingType === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => { void toggleVehicleType(k); }}
                          disabled={loading}
                          title="Tipo fuera del catálogo activo — clic para quitar"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "5px 11px", borderRadius: 6,
                            background: WARN_BG, color: WARN,
                            border: `1px dashed ${WARN_BD}`,
                            fontSize: "0.75rem", fontWeight: 600,
                            cursor: loading ? "not-allowed" : "pointer",
                            opacity: loading ? 0.6 : 1,
                            fontFamily: "inherit",
                          }}
                        >
                          {loading
                            ? <Loader2 size={11} style={{ animation: "spin 0.7s linear infinite" }} />
                            : <X size={11} />}
                          {humanizeKey(k)}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 10, fontSize: "0.6875rem", color: INK5, lineHeight: 1.5 }}>
                    Cada cambio se guarda automáticamente. Los chips negros están autorizados; los blancos disponibles para agregar.
                  </div>
                </>
              );
            })()}
          </SectionCard>

          {/* ── Documentos ── */}
          <SectionCard
            icon={<FileText size={14} color={INK6} />}
            title="Documentos"
            subtitle={`${company.documents?.length ?? 0} adjunto${(company.documents?.length ?? 0) === 1 ? "" : "s"}`}
          >
            {!company.documents?.length ? (
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
            )}
          </SectionCard>

          {/* ── ID de soporte ── */}
          <div style={{ gridColumn: "1 / -1" }}>
            <SystemIdRow id={company.id} />
          </div>
        </div>
      </form>
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

function SystemIdRow({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const shortId = id.slice(-8).toUpperCase();
  return (
    <div style={{
      background: "#fff", border: `1px dashed ${INK2}`, borderRadius: 8,
      padding: "8px 12px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Hash size={12} color={INK5} />
        <span style={{
          fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: INK5,
        }}>
          ID de soporte
        </span>
        <code title={id} style={{
          fontFamily: "ui-monospace, monospace", fontSize: "0.75rem",
          color: INK9, fontWeight: 600, letterSpacing: "0.04em",
          fontVariantNumeric: "tabular-nums", marginLeft: 6,
        }}>
          {shortId}
        </code>
      </div>
      <button type="button" onClick={async () => {
        try {
          await navigator.clipboard.writeText(id);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch { /* clipboard blocked */ }
      }} style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        height: 22, padding: "0 8px", borderRadius: 5,
        border: `1px solid ${INK2}`, background: "#fff", color: INK6,
        fontSize: "0.6875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      }}>
        {copied ? <Check size={11} color={GRN} /> : <Copy size={11} />}
        {copied ? "Copiado" : "Copiar ID completo"}
      </button>
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
