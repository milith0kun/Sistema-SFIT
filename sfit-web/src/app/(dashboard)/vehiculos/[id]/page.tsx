"use client";

import { use as usePromise, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Trash2, AlertTriangle, CheckCircle, Loader2, Hash, Copy, Check,
  Car, TrendingUp, ClipboardCheck, ShieldCheck, Building2, Calendar,
} from "lucide-react";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSetBreadcrumbTitle } from "@/hooks/useBreadcrumbTitle";

type PlacaLookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; marca: string; modelo: string; color?: string }
  | { state: "not_found" }
  | { state: "error"; message: string };

/* Paleta sobria */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d"; const APTO_BG = "#F0FDF4"; const APTO_BD = "#86EFAC";
const RIESGO = "#B45309"; const RIESGO_BG = "#FFFBEB"; const RIESGO_BD = "#FDE68A";
const NO = "#DC2626"; const NO_BG = "#FFF5F5"; const NO_BD = "#FCA5A5";
const INFO = "#1E40AF"; const INFO_BD = "#BFDBFE";

const CURRENT_YEAR = new Date().getFullYear();
const VIEW_ROLES = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const EDIT_ROLES = ["admin_municipal", "super_admin"];

type VehicleStatus = "disponible" | "en_ruta" | "en_mantenimiento" | "fuera_de_servicio";
type InspectionStatus = "aprobada" | "observada" | "rechazada" | "pendiente";

interface Vehicle {
  id: string;
  plate: string;
  vehicleTypeKey: string;
  brand: string;
  model: string;
  year: number;
  companyId?: string;
  companyName?: string;
  status: VehicleStatus;
  currentDriverName?: string;
  lastInspectionStatus?: InspectionStatus;
  reputationScore: number;
  soatExpiry?: string;
  active: boolean;
  createdAt: string;
}

interface Empresa { id: string; razonSocial: string }
interface TipoVehiculo { id: string; key: string; name: string; active: boolean }

interface FormData {
  plate: string;
  vehicleTypeKey: string;
  brand: string;
  model: string;
  year: string;
  companyId: string;
  status: string;
  soatExpiry: string;
}
interface FieldErrors {
  plate?: string;
  vehicleTypeKey?: string;
  brand?: string;
  model?: string;
  year?: string;
}

interface Props { params: Promise<{ id: string }> }

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

const VEHICLE_STATUS_META: Record<VehicleStatus, { color: string; bd: string; label: string }> = {
  disponible:        { color: APTO, bd: APTO_BD, label: "Disponible" },
  en_ruta:           { color: INFO, bd: INFO_BD, label: "En ruta" },
  en_mantenimiento:  { color: RIESGO, bd: RIESGO_BD, label: "Mantenimiento" },
  fuera_de_servicio: { color: NO, bd: NO_BD, label: "Fuera de servicio" },
};

const INSPECTION_META: Record<InspectionStatus, { color: string; bg: string; bd: string; label: string }> = {
  aprobada:  { color: APTO, bg: APTO_BG, bd: APTO_BD, label: "Aprobada" },
  observada: { color: RIESGO, bg: RIESGO_BG, bd: RIESGO_BD, label: "Observada" },
  rechazada: { color: NO, bg: NO_BG, bd: NO_BD, label: "Rechazada" },
  pendiente: { color: INK6, bg: INK1, bd: INK2, label: "Pendiente" },
};

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - today.getTime()) / 86400000);
}

export default function VehiculoDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [tipos, setTipos] = useState<TipoVehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const [form, setForm] = useState<FormData>({
    plate: "", vehicleTypeKey: "", brand: "", model: "",
    year: "", companyId: "", status: "", soatExpiry: "",
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Validación SUNARP de la placa
  const [placaLookup, setPlacaLookup] = useState<PlacaLookup>({ state: "idle" });
  const [placaHover, setPlacaHover] = useState(false);
  const placaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    let user: { role?: string } = {};
    try { user = JSON.parse(raw); } catch { router.replace("/login"); return; }
    if (!user.role || !VIEW_ROLES.includes(user.role)) { router.replace("/dashboard"); return; }
    setCanEdit(EDIT_ROLES.includes(user.role ?? ""));
    void loadVehicle();
    void loadDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  // Breadcrumb dinámico con la placa
  useSetBreadcrumbTitle(vehicle?.plate);

  // Auto-lookup SUNARP cuando la placa cambia y tiene formato válido (6-7 alfanuméricos sin guión).
  // Si los campos marca/modelo están vacíos, se auto-aplica al verificar.
  const lookupPlaca = useCallback(async (plateValue: string) => {
    const clean = plateValue.replace(/-/g, "").toUpperCase();
    if (!/^[A-Z0-9]{6,7}$/.test(clean)) return;
    setPlacaLookup({ state: "loading" });
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/validar/placa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ placa: clean }),
      });
      const data = await res.json();
      if (res.status === 404) { setPlacaLookup({ state: "not_found" }); return; }
      if (!res.ok || !data.success) {
        setPlacaLookup({ state: "error", message: data.error ?? `Servicio SUNARP no disponible (HTTP ${res.status})` });
        return;
      }
      const marca = (data.data?.marca ?? "").toString().trim();
      const modelo = (data.data?.modelo ?? "").toString().trim();
      const color = (data.data?.color ?? "").toString().trim() || undefined;

      setPlacaLookup({ state: "ok", marca, modelo, color });

      // Auto-aplica marca y modelo SIEMPRE que SUNARP verifique correctamente.
      // El banner muestra la confirmación; el usuario puede editar después si lo desea.
      setForm(prev => ({
        ...prev,
        brand: marca || prev.brand,
        model: modelo || prev.model,
      }));
    } catch {
      setPlacaLookup({ state: "error", message: "No se pudo conectar con el servicio." });
    }
  }, []);

  useEffect(() => {
    if (placaTimer.current) clearTimeout(placaTimer.current);
    if (!canEdit) {
      if (placaLookup.state !== "idle") setPlacaLookup({ state: "idle" });
      return;
    }
    const clean = form.plate.replace(/-/g, "").toUpperCase();
    if (!/^[A-Z0-9]{6,7}$/.test(clean)) {
      if (placaLookup.state !== "idle") setPlacaLookup({ state: "idle" });
      return;
    }
    // No re-consultar si la placa coincide con la guardada y ya hay datos.
    if (vehicle && clean === vehicle.plate.replace(/-/g, "").toUpperCase() && placaLookup.state === "idle") {
      return;
    }
    placaTimer.current = setTimeout(() => { void lookupPlaca(form.plate); }, 400);
    return () => { if (placaTimer.current) clearTimeout(placaTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.plate, canEdit, lookupPlaca]);

  async function loadVehicle() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/vehiculos/${id}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setLoadError(data.error ?? "No se pudo cargar el vehículo."); return; }
      const v: Vehicle = data.data;
      setVehicle(v);
      setForm({
        plate: v.plate ?? "",
        vehicleTypeKey: v.vehicleTypeKey ?? "",
        brand: v.brand ?? "",
        model: v.model ?? "",
        year: String(v.year ?? ""),
        companyId: v.companyId ?? "",
        status: v.status ?? "",
        soatExpiry: v.soatExpiry ? v.soatExpiry.split("T")[0] : "",
      });
    } catch { setLoadError("Error de conexión."); }
    finally { setLoading(false); }
  }

  async function loadDropdowns() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const headers = { Authorization: `Bearer ${token ?? ""}` };
      const [empRes, tiposRes] = await Promise.all([
        fetch("/api/empresas?limit=100", { headers }),
        fetch("/api/tipos-vehiculo?limit=100", { headers }),
      ]);
      const [empBody, tiposBody] = await Promise.all([empRes.json(), tiposRes.json()]);
      setEmpresas(empBody?.data?.items ?? []);
      const allTipos: TipoVehiculo[] = tiposBody?.data?.items ?? [];
      setTipos(allTipos.filter(t => t.active));
    } catch { /* silent */ }
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    const plate = form.plate.trim();
    if (!plate) next.plate = "La placa es requerida.";
    else if (plate.length < 5) next.plate = "Mínimo 5 caracteres.";
    else if (plate.length > 10) next.plate = "Máximo 10 caracteres.";
    if (!form.vehicleTypeKey) next.vehicleTypeKey = "Selecciona un tipo.";
    const brand = form.brand.trim();
    if (!brand) next.brand = "La marca es requerida.";
    else if (brand.length > 80) next.brand = "Máximo 80 caracteres.";
    const model = form.model.trim();
    if (!model) next.model = "El modelo es requerido.";
    else if (model.length > 80) next.model = "Máximo 80 caracteres.";
    const yearNum = parseInt(form.year, 10);
    if (!form.year || isNaN(yearNum)) next.year = "El año es requerido.";
    else if (yearNum < 1990 || yearNum > CURRENT_YEAR + 1) next.year = `Entre 1990 y ${CURRENT_YEAR + 1}.`;
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null); setSaveSuccess(false);
    if (!validate()) return;
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      plate: form.plate.trim().toUpperCase(),
      vehicleTypeKey: form.vehicleTypeKey,
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: parseInt(form.year, 10),
    };
    if (form.status) payload.status = form.status;
    if (form.companyId) payload.companyId = form.companyId;
    else payload.companyId = null;
    if (form.soatExpiry) payload.soatExpiry = form.soatExpiry;
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/vehiculos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setServerError(data.error ?? data.message ?? `Error ${res.status}`);
        return;
      }
      setVehicle(data.data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch { setServerError("Error de conexión. Intente nuevamente."); }
    finally { setSubmitting(false); }
  }

  async function handleDelete() {
    if (!vehicle) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/vehiculos/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setServerError(data.error ?? "No se pudo eliminar el vehículo.");
        setConfirmDelete(false); return;
      }
      router.push("/vehiculos");
    } catch { setServerError("Error de conexión."); setConfirmDelete(false); }
    finally { setDeleting(false); }
  }

  function handleChange(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (fieldErrors[field as keyof FieldErrors]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }

  const backBtnPlain = (
    <Link href="/vehiculos">
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

  if (notFound) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <PageHeader kicker="Vehículos · RF-06" title="Vehículo no encontrado" action={backBtnPlain} />
        <div style={{
          padding: "32px 24px", background: "#fff", border: `1px solid ${INK2}`,
          borderRadius: 12, color: INK6, textAlign: "center", fontSize: "0.875rem",
        }}>
          El vehículo que buscas no existe o fue eliminado.
        </div>
      </div>
    );
  }

  if (loading || !vehicle) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <PageHeader kicker="Vehículos · RF-06" title="Cargando vehículo…" action={backBtnPlain} />
        <KPIStrip cols={3} items={[
          { label: "ÚLTIMA INSPECCIÓN", value: "—", subtitle: "—", icon: ClipboardCheck },
          { label: "REPUTACIÓN", value: "—", subtitle: "—", icon: TrendingUp },
          { label: "CONDUCTOR ACTUAL", value: "—", subtitle: "—", icon: Car },
        ]} />
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ height: 140, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  const tipoNombre = tipos.find(t => t.key === vehicle.vehicleTypeKey)?.name ?? vehicle.vehicleTypeKey;
  const repColor = vehicle.reputationScore >= 80 ? APTO : vehicle.reputationScore >= 50 ? RIESGO : NO;
  const inspMeta = INSPECTION_META[vehicle.lastInspectionStatus ?? "pendiente"];
  const stMeta = VEHICLE_STATUS_META[vehicle.status] ?? VEHICLE_STATUS_META.disponible;
  const soatDays = daysUntil(vehicle.soatExpiry);
  const soatWarn = soatDays != null && soatDays >= 0 && soatDays <= 30;
  const soatExpired = soatDays != null && soatDays < 0;

  const headerAction = (
    <div style={{ display: "flex", gap: 8 }}>
      {backBtnPlain}
      {canEdit && (
        <button form="vehiculo-form" type="submit" disabled={submitting || deleting}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 36, padding: "0 14px", borderRadius: 9,
            border: "none", background: INK9, color: "#fff",
            fontWeight: 700, fontSize: "0.875rem",
            cursor: submitting ? "not-allowed" : "pointer",
            fontFamily: "inherit", opacity: submitting ? 0.7 : 1,
          }}>
          {submitting ? <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> : <Save size={14} />}
          {submitting ? "Guardando…" : "Guardar"}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10" style={{ color: INK9 }}>
      <PageHeader
        kicker={`Vehículos · RF-06 · ${canEdit ? "Editar" : "Detalle"}`}
        title={vehicle.plate}
        subtitle={`${vehicle.brand} ${vehicle.model} · ${vehicle.year} · ${stMeta.label}`}
        action={headerAction}
      />

      <KPIStrip cols={3} items={[
        {
          label: "ÚLTIMA INSPECCIÓN",
          value: inspMeta.label,
          subtitle: vehicle.lastInspectionStatus === "rechazada" ? "requiere atención"
            : vehicle.lastInspectionStatus === "observada" ? "con observaciones"
            : vehicle.lastInspectionStatus === "aprobada" ? "vigente" : "sin registro",
          icon: ClipboardCheck,
        },
        {
          label: "REPUTACIÓN",
          value: `${vehicle.reputationScore}`,
          subtitle: "de 100 puntos",
          icon: TrendingUp,
        },
        {
          label: "CONDUCTOR ACTUAL",
          value: vehicle.currentDriverName?.trim() || "Sin asignar",
          subtitle: vehicle.currentDriverName ? "operando hoy" : "vehículo libre",
          icon: Car,
        },
      ]} />

      {soatExpired && (
        <div role="alert" style={{
          padding: "10px 14px", background: NO_BG, border: `1px solid ${NO_BD}`,
          borderRadius: 8, color: NO, fontSize: "0.8125rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />
          SOAT vencido hace {Math.abs(soatDays!)} días. Renueva la cobertura antes de operar.
        </div>
      )}
      {soatWarn && !soatExpired && (
        <div role="status" style={{
          padding: "10px 14px", background: RIESGO_BG, border: `1px solid ${RIESGO_BD}`,
          borderRadius: 8, color: RIESGO, fontSize: "0.8125rem", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />
          SOAT vence en {soatDays} día{soatDays === 1 ? "" : "s"}. Considera renovarlo.
        </div>
      )}

      {(loadError || serverError) && (
        <div role="alert" style={{
          padding: "10px 14px", background: NO_BG, border: `1px solid ${NO_BD}`,
          borderRadius: 8, color: NO, fontSize: "0.8125rem", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />{loadError ?? serverError}
        </div>
      )}
      {saveSuccess && (
        <div role="status" style={{
          padding: "10px 14px", background: APTO_BG, border: `1px solid ${APTO_BD}`,
          borderRadius: 8, color: APTO, fontSize: "0.8125rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <CheckCircle size={14} />Vehículo actualizado correctamente.
        </div>
      )}

      <form id="vehiculo-form" onSubmit={handleSave} noValidate>
        <div className="sfit-aside-layout">

          {/* Columna principal */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

            {/* Identificación */}
            <SectionCard
              icon={<Car size={14} color={INK6} />}
              title="Identificación del vehículo"
              subtitle="Placa y tipo registrados en MTC"
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label htmlFor="plate" style={LABEL}>
                    Placa <span style={{ color: NO, marginLeft: 3 }}>*</span>
                    {canEdit && (
                      <span style={{
                        color: INK5, fontWeight: 500, textTransform: "none",
                        letterSpacing: 0, marginLeft: 6,
                      }}>
                        (verificación SUNARP)
                      </span>
                    )}
                  </label>
                  {canEdit ? (
                    <div
                      style={{ position: "relative" }}
                      onMouseEnter={() => setPlacaHover(true)}
                      onMouseLeave={() => setPlacaHover(false)}
                    >
                      <input
                        id="plate" type="text" value={form.plate}
                        onChange={e => handleChange("plate", e.target.value.toUpperCase())}
                        placeholder="ABC-123" maxLength={10}
                        disabled={submitting}
                        style={{
                          ...FIELD,
                          fontFamily: "ui-monospace, monospace", letterSpacing: "0.05em",
                          paddingRight: 36,
                          borderColor:
                            fieldErrors.plate ? NO
                            : placaLookup.state === "ok" ? APTO
                            : placaLookup.state === "not_found" ? "#F59E0B"
                            : placaLookup.state === "error" ? NO
                            : INK2,
                        }}
                        onFocus={e => { if (!fieldErrors.plate) e.target.style.borderColor = INK9; }}
                        onBlur={e => {
                          e.target.style.borderColor =
                            fieldErrors.plate ? NO
                            : placaLookup.state === "ok" ? APTO
                            : placaLookup.state === "not_found" ? "#F59E0B"
                            : placaLookup.state === "error" ? NO
                            : INK2;
                        }}
                      />
                      <div style={{
                        position: "absolute", right: 10, top: "50%",
                        transform: "translateY(-50%)", pointerEvents: "none",
                      }}>
                        {placaLookup.state === "loading" && <Loader2 size={14} color={INK5} style={{ animation: "spin 0.7s linear infinite" }} />}
                        {placaLookup.state === "ok" && <CheckCircle size={14} color={APTO} />}
                        {placaLookup.state === "not_found" && <AlertTriangle size={14} color="#F59E0B" />}
                        {placaLookup.state === "error" && <AlertTriangle size={14} color={NO} />}
                      </div>

                      {placaHover && placaLookup.state !== "idle" && (
                        <PlacaPopover
                          lookup={placaLookup}
                          currentBrand={form.brand}
                          currentModel={form.model}
                          onApply={() => {
                            if (placaLookup.state === "ok") {
                              handleChange("brand", placaLookup.marca);
                              handleChange("model", placaLookup.modelo);
                            }
                          }}
                          onRetry={() => { void lookupPlaca(form.plate); }}
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      id="plate" type="text" value={form.plate}
                      readOnly
                      style={{
                        ...READ,
                        fontFamily: "ui-monospace, monospace", letterSpacing: "0.05em",
                      }}
                    />
                  )}
                  {fieldErrors.plate && <p style={{ marginTop: 5, fontSize: "0.75rem", color: NO, fontWeight: 500 }}>{fieldErrors.plate}</p>}
                  {/* Feedback inline OK — con botón "Aplicar" si difiere */}
                  {canEdit && placaLookup.state === "ok" && (() => {
                    const differsBrand = form.brand.trim().toLowerCase() !== placaLookup.marca.toLowerCase();
                    const differsModel = form.model.trim().toLowerCase() !== placaLookup.modelo.toLowerCase();
                    const differs = differsBrand || differsModel;

                    if (!differs) {
                      // Campos ya coinciden con SUNARP — solo confirmación discreta
                      return (
                        <p style={{ marginTop: 5, fontSize: "0.75rem", color: APTO, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                          <CheckCircle size={11} />Verificado: {placaLookup.marca} {placaLookup.modelo}
                          {placaLookup.color && (
                            <span style={{ color: INK5, fontWeight: 500 }}>· {placaLookup.color}</span>
                          )}
                        </p>
                      );
                    }

                    // Campos NO coinciden — banner accionable
                    return (
                      <div style={{
                        marginTop: 8, padding: "8px 10px", borderRadius: 8,
                        border: `1px solid ${APTO_BD}`, background: APTO_BG,
                        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                      }}>
                        <CheckCircle size={13} color={APTO} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0, fontSize: "0.75rem" }}>
                          <div style={{ fontWeight: 700, color: APTO, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.625rem" }}>
                            SUNARP
                          </div>
                          <div style={{ color: INK9, fontWeight: 600, marginTop: 1, wordBreak: "break-word" }}>
                            {placaLookup.marca} {placaLookup.modelo}
                            {placaLookup.color && <span style={{ color: INK5, fontWeight: 500 }}> · {placaLookup.color}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleChange("brand", placaLookup.marca);
                            handleChange("model", placaLookup.modelo);
                          }}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            height: 28, padding: "0 12px", borderRadius: 6,
                            border: `1px solid ${APTO}`, background: "#fff", color: APTO,
                            fontSize: "0.75rem", fontWeight: 700,
                            cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                          }}
                        >
                          Aplicar marca y modelo
                        </button>
                      </div>
                    );
                  })()}
                  {canEdit && placaLookup.state === "not_found" && (
                    <p style={{ marginTop: 5, fontSize: "0.75rem", color: RIESGO, fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                      <AlertTriangle size={11} />Placa no encontrada en SUNARP.
                    </p>
                  )}
                  {canEdit && placaLookup.state === "error" && (
                    <p style={{ marginTop: 5, fontSize: "0.75rem", color: NO, fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                      <AlertTriangle size={11} />{placaLookup.message}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="vehicleTypeKey" style={LABEL}>Tipo de vehículo <span style={{ color: NO, marginLeft: 3 }}>*</span></label>
                  <select
                    id="vehicleTypeKey" value={form.vehicleTypeKey}
                    onChange={e => handleChange("vehicleTypeKey", e.target.value)}
                    disabled={submitting || !canEdit}
                    style={{
                      ...(canEdit ? FIELD : READ),
                      appearance: "none", paddingRight: 30, cursor: canEdit ? "pointer" : "default",
                      borderColor: fieldErrors.vehicleTypeKey ? NO : INK2,
                    }}
                  >
                    <option value="">Seleccionar tipo…</option>
                    {tipos.map(t => <option key={t.id} value={t.key}>{t.name}</option>)}
                  </select>
                  {fieldErrors.vehicleTypeKey && <p style={{ marginTop: 5, fontSize: "0.75rem", color: NO, fontWeight: 500 }}>{fieldErrors.vehicleTypeKey}</p>}
                </div>
              </div>
            </SectionCard>

            {/* Datos del vehículo */}
            <SectionCard
              icon={<Building2 size={14} color={INK6} />}
              title="Datos del vehículo"
              subtitle="Marca, modelo, año y estado operativo"
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label htmlFor="brand" style={LABEL}>Marca <span style={{ color: NO, marginLeft: 3 }}>*</span></label>
                  <input
                    id="brand" type="text" value={form.brand}
                    onChange={e => handleChange("brand", e.target.value)}
                    placeholder="Ej. Toyota" maxLength={80}
                    disabled={submitting || !canEdit}
                    style={{ ...(canEdit ? FIELD : READ), borderColor: fieldErrors.brand ? NO : INK2 }}
                    onFocus={e => { if (canEdit && !fieldErrors.brand) e.target.style.borderColor = INK9; }}
                    onBlur={e => { if (!fieldErrors.brand) e.target.style.borderColor = INK2; }}
                  />
                  {fieldErrors.brand && <p style={{ marginTop: 5, fontSize: "0.75rem", color: NO, fontWeight: 500 }}>{fieldErrors.brand}</p>}
                </div>
                <div>
                  <label htmlFor="model" style={LABEL}>Modelo <span style={{ color: NO, marginLeft: 3 }}>*</span></label>
                  <input
                    id="model" type="text" value={form.model}
                    onChange={e => handleChange("model", e.target.value)}
                    placeholder="Ej. Hiace" maxLength={80}
                    disabled={submitting || !canEdit}
                    style={{ ...(canEdit ? FIELD : READ), borderColor: fieldErrors.model ? NO : INK2 }}
                    onFocus={e => { if (canEdit && !fieldErrors.model) e.target.style.borderColor = INK9; }}
                    onBlur={e => { if (!fieldErrors.model) e.target.style.borderColor = INK2; }}
                  />
                  {fieldErrors.model && <p style={{ marginTop: 5, fontSize: "0.75rem", color: NO, fontWeight: 500 }}>{fieldErrors.model}</p>}
                </div>
                <div>
                  <label htmlFor="year" style={LABEL}>Año <span style={{ color: NO, marginLeft: 3 }}>*</span></label>
                  <input
                    id="year" type="number" value={form.year}
                    onChange={e => handleChange("year", e.target.value)}
                    placeholder={String(CURRENT_YEAR)} min={1990} max={CURRENT_YEAR + 1}
                    disabled={submitting || !canEdit}
                    style={{
                      ...(canEdit ? FIELD : READ),
                      fontVariantNumeric: "tabular-nums",
                      borderColor: fieldErrors.year ? NO : INK2,
                    }}
                    onFocus={e => { if (canEdit && !fieldErrors.year) e.target.style.borderColor = INK9; }}
                    onBlur={e => { if (!fieldErrors.year) e.target.style.borderColor = INK2; }}
                  />
                  {fieldErrors.year && <p style={{ marginTop: 5, fontSize: "0.75rem", color: NO, fontWeight: 500 }}>{fieldErrors.year}</p>}
                </div>
                <div>
                  <label htmlFor="status" style={LABEL}>Estado operativo</label>
                  <select
                    id="status" value={form.status}
                    onChange={e => handleChange("status", e.target.value)}
                    disabled={submitting || !canEdit}
                    style={{ ...(canEdit ? FIELD : READ), appearance: "none", paddingRight: 30, cursor: canEdit ? "pointer" : "default" }}
                  >
                    <option value="">— Seleccionar —</option>
                    <option value="disponible">Disponible</option>
                    <option value="en_ruta">En ruta</option>
                    <option value="en_mantenimiento">En mantenimiento</option>
                    <option value="fuera_de_servicio">Fuera de servicio</option>
                  </select>
                </div>
              </div>
            </SectionCard>

            {/* Empresa y SOAT */}
            <SectionCard
              icon={<ShieldCheck size={14} color={INK6} />}
              title="Empresa y documentación"
              subtitle="Asignación y vencimientos legales"
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label htmlFor="companyId" style={LABEL}>Empresa de transporte</label>
                  <select
                    id="companyId" value={form.companyId}
                    onChange={e => handleChange("companyId", e.target.value)}
                    disabled={submitting || !canEdit}
                    style={{ ...(canEdit ? FIELD : READ), appearance: "none", paddingRight: 30, cursor: canEdit ? "pointer" : "default" }}
                  >
                    <option value="">Sin empresa asignada</option>
                    {empresas.map(emp => <option key={emp.id} value={emp.id}>{emp.razonSocial}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="soatExpiry" style={LABEL}>
                    Vencimiento SOAT
                    {soatDays != null && (
                      <span style={{
                        color: soatExpired ? NO : soatWarn ? RIESGO : INK5,
                        fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 6,
                      }}>
                        ({soatExpired ? `vencido hace ${Math.abs(soatDays)}d`
                          : soatDays === 0 ? "vence hoy"
                          : `en ${soatDays}d`})
                      </span>
                    )}
                  </label>
                  <div style={{ position: "relative" }}>
                    <Calendar size={13} color={INK5} style={{
                      position: "absolute", left: 11, top: "50%",
                      transform: "translateY(-50%)", pointerEvents: "none",
                    }} />
                    <input
                      id="soatExpiry" type="date" value={form.soatExpiry}
                      onChange={e => handleChange("soatExpiry", e.target.value)}
                      disabled={submitting || !canEdit}
                      style={{
                        ...(canEdit ? FIELD : READ), paddingLeft: 32,
                        borderColor: soatExpired ? NO : soatWarn ? RIESGO : INK2,
                      }}
                    />
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Tarjeta de identidad (sobria) */}
            <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "20px 16px 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 12,
                  background: INK1, border: `1px solid ${INK2}`,
                  color: INK6,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Car size={28} strokeWidth={1.8} />
                </div>
                <div style={{ minWidth: 0, width: "100%" }}>
                  <div style={{ fontFamily: "ui-monospace,monospace", fontWeight: 800, fontSize: "1rem", color: INK9, letterSpacing: "0.04em" }}>
                    {vehicle.plate}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2 }}>
                    {vehicle.brand} {vehicle.model}
                  </div>
                  <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 6, fontSize: "0.6875rem", fontWeight: 700, background: "#fff", color: INK9, border: `1px solid ${INK2}`, letterSpacing: "0.04em" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: stMeta.color }} />
                    {stMeta.label.toUpperCase()}
                  </div>
                </div>
              </div>
              <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                <SystemIdRow id={vehicle.id} />
                <Row k="Tipo" v={tipoNombre} />
                <Row k="Empresa" v={vehicle.companyName?.trim() || "—"} />
                <Row k="Año" v={String(vehicle.year)} mono />
                <Row k="Registrado" v={new Date(vehicle.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })} />
                <Row k="Activo" v={vehicle.active ? "Sí" : "No"} />
              </div>
            </div>

            {/* Acciones rápidas: ver inspecciones del vehículo */}
            <Link href={`/inspecciones?vehicleId=${vehicle.id}`}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 9,
                border: `1px solid ${INK2}`, background: "#fff",
                color: INK6, fontSize: "0.8125rem", fontWeight: 600,
                textDecoration: "none",
              }}>
              <ClipboardCheck size={14} />Ver inspecciones del vehículo →
            </Link>

            {/* Zona de peligro */}
            {canEdit && (
              <DangerZoneSidebar
                plate={vehicle.plate}
                confirmDelete={confirmDelete}
                setConfirmDelete={setConfirmDelete}
                deleting={deleting}
                onDelete={handleDelete}
              />
            )}
          </div>
        </div>
      </form>

      {!canEdit && (
        <div style={{
          padding: "10px 14px", background: INK1, border: `1px solid ${INK2}`,
          borderRadius: 8, color: INK6, fontSize: "0.8125rem",
        }}>
          Solo administradores municipales o superadministradores pueden editar o eliminar vehículos.
        </div>
      )}
    </div>
  );
}

/* ─── Subcomponentes ─── */

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

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 10px", borderRadius: 6, background: INK1, gap: 8,
    }}>
      <span style={{ fontSize: "0.75rem", color: INK5, flexShrink: 0 }}>{k}</span>
      <span style={{
        fontSize: "0.8125rem", fontWeight: 600, color: INK9,
        textAlign: "right",
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

function PlacaPopover({
  lookup, currentBrand, currentModel, onApply, onRetry,
}: {
  lookup: PlacaLookup;
  currentBrand: string;
  currentModel: string;
  onApply: () => void;
  onRetry?: () => void;
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
          <span style={{ fontSize: "0.8125rem", color: INK6 }}>Consultando SUNARP…</span>
        </div>
      )}
      {lookup.state === "ok" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <CheckCircle size={12} color={APTO} />
            <span style={{ fontSize: "0.625rem", fontWeight: 800, color: APTO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              SUNARP verificado
            </span>
          </div>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9, lineHeight: 1.35, wordBreak: "break-word" }}>
            {lookup.marca} {lookup.modelo}
            {lookup.color && (
              <span style={{ color: INK5, fontWeight: 500 }}> · {lookup.color}</span>
            )}
          </div>
          {(currentBrand.trim().toLowerCase() !== lookup.marca.toLowerCase()
            || currentModel.trim().toLowerCase() !== lookup.modelo.toLowerCase()) && (
            <button type="button" onClick={onApply} style={{
              marginTop: 8, width: "100%", height: 28, borderRadius: 6,
              border: `1px solid ${APTO}`, background: APTO_BG, color: APTO,
              fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>
              Usar marca y modelo de SUNARP
            </button>
          )}
        </>
      )}
      {lookup.state === "not_found" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <AlertTriangle size={12} color="#92400E" />
            <span style={{ fontSize: "0.625rem", fontWeight: 800, color: "#92400E", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              No registrada
            </span>
          </div>
          <div style={{ fontSize: "0.75rem", color: INK6, lineHeight: 1.5 }}>
            Placa no encontrada en SUNARP. Puedes ingresar marca y modelo manualmente.
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

function DangerZoneSidebar({
  plate, confirmDelete, setConfirmDelete, deleting, onDelete,
}: {
  plate: string;
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
            Eliminar este vehículo es permanente. Los conductores asignados perderán el vínculo.
          </p>
          <button onClick={() => setConfirmDelete(true)} style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            height: 32, padding: "0 12px", borderRadius: 7,
            border: `1px solid ${NO_BD}`, background: NO_BG, color: NO,
            fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>
            <Trash2 size={12} />Eliminar vehículo
          </button>
        </>
      ) : (
        <div style={{ background: NO_BG, border: `1px solid ${NO_BD}`, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontWeight: 700, color: NO, marginBottom: 4, fontSize: "0.8125rem" }}>¿Confirmar?</div>
          <p style={{ fontSize: "0.75rem", color: INK6, marginBottom: 10, lineHeight: 1.5 }}>
            Eliminarás <strong style={{ fontFamily: "ui-monospace, monospace" }}>{plate}</strong>. Acción irreversible.
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
