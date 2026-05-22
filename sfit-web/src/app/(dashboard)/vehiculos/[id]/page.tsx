"use client";

import { use as usePromise, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, Save, Trash2, AlertTriangle, CheckCircle, Loader2,
  Car, TrendingUp, ClipboardCheck, ShieldCheck, Building2, Calendar, ShieldOff,
  BadgeCheck, Search, RefreshCw,
} from "lucide-react";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { KeyValueRow, SystemIdRow } from "@/components/ui/KeyValueRow";
import { PhotoUploader } from "@/components/ui/PhotoUploader";
import { useSetBreadcrumbTitle } from "@/hooks/useBreadcrumbTitle";
import { hasWebPermission, SUSPEND_ROLES } from "@/lib/auth/roleMatrix";
import { fmtDate } from "@/lib/format";
import { INK1, INK2, INK3, INK5, INK6, INK9, RED, REDBG, REDBD, GRN, GRNBG, GRNBD, AMBER, AMBER_BG, AMBER_BD, INFO_BG, INFO_BD } from "@/lib/design-tokens";
import { DOC_STATUS_META, type DocStatus } from "@/lib/vehicle-status";
import { BTN_PRIMARY, BTN_OUTLINE } from "@/lib/form-styles";
import type { Role } from "@/lib/constants";

type PlacaLookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; marca: string; modelo: string; color?: string }
  | { state: "not_found" }
  | { state: "error"; message: string };

const INFO = "#1E40AF";
const CURRENT_YEAR = new Date().getFullYear();

type VehicleStatus = "disponible" | "en_ruta" | "en_mantenimiento" | "fuera_de_servicio";
type InspectionStatus = "aprobada" | "observada" | "rechazada" | "pendiente";

interface Vehicle {
  id: string; municipalityId: string;
  plate: string;
  vehicleTypeKey: string;
  brand: string;
  model: string;
  year: number;
  companyId?: string;
  companyName?: string;
  status: VehicleStatus;
  currentDriverId?: string | null;
  currentDriverName?: string;
  ownerName?: string | null;
  lastInspectionStatus?: InspectionStatus;
  lastInspectionDate?: string | null;
  lastInspectionCertificate?: string | null;
  reputationScore: number;
  soatExpiry?: string | null;
  soatInsurer?: string | null;
  soatCertificate?: string | null;
  soatStatus?: DocStatus;
  citvExpiryDate?: string | null;
  citvStatus?: DocStatus;
  qrHmac?: string;
  photoUrl?: string | null;
  verified?: boolean;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  active: boolean;
  scrapingStatus?: string;
  createdAt: string;
  updatedAt: string;
}

interface ScrapingData {
  overallStatus: string;
  sources: Record<string, { source: string; status: string; data: unknown; error: string | null; captchaCost: number; durationMs: number; completedAt: string | null }>;
}

interface Empresa { id: string; razonSocial: string }
interface TipoVehiculo { id: string; key: string; name: string; active: boolean }

interface FormData {
  plate: string;
  vehicleTypeKey: string;
  brand: string;
  model: string;
  year: string;
  ownerName: string;
  companyId: string;
  status: string;
  soatExpiry: string;
  soatInsurer: string;
  soatCertificate: string;
  lastInspectionDate: string;
  lastInspectionStatus: string;
  lastInspectionCertificate: string;
  citvExpiryDate: string;
  photoUrl: string;
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
  disponible:        { color: GRN, bd: GRNBD, label: "Disponible" },
  en_ruta:           { color: INFO, bd: INFO_BD, label: "En ruta" },
  en_mantenimiento:  { color: AMBER, bd: AMBER_BD, label: "Mantenimiento" },
  fuera_de_servicio: { color: RED, bd: REDBD, label: "Fuera de servicio" },
};

const INSPECTION_META: Record<InspectionStatus, { color: string; bg: string; bd: string; label: string }> = {
  aprobada:  { color: GRN, bg: GRNBG, bd: GRNBD, label: "Aprobada" },
  observada: { color: AMBER, bg: AMBER_BG, bd: AMBER_BD, label: "Observada" },
  rechazada: { color: RED, bg: REDBG, bd: REDBD, label: "Rechazada" },
  pendiente: { color: INK6, bg: INK1, bd: INK2, label: "Pendiente" },
};

function daysUntil(iso?: string | null): number | null {
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
  const [canDelete, setCanDelete] = useState(false);
  const [canSuspend, setCanSuspend] = useState(false);
  const [showSuspend, setShowSuspend] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspending, setSuspending] = useState(false);

  const [form, setForm] = useState<FormData>({
    plate: "", vehicleTypeKey: "", brand: "", model: "",
    year: "", ownerName: "", companyId: "", status: "", soatExpiry: "",
    soatInsurer: "", soatCertificate: "",
    lastInspectionDate: "", lastInspectionStatus: "",
    lastInspectionCertificate: "", citvExpiryDate: "",
    photoUrl: "",
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Verificación administrativa del vehículo (espejo del flujo conductores).
  const [verifying, setVerifying] = useState(false);

  // Scraping de historial legal (SOAT / MTC CITV / SUNARP)
  const [scrapeData, setScrapeData] = useState<ScrapingData | null>(null);
  const [scrapePolling, setScrapePolling] = useState(false);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const sunarpAutoFilled = useRef(false);

  // Poll scraping status cuando está en progreso, o cargar resultados existentes
  useEffect(() => {
    if (!vehicle?.scrapingStatus || vehicle.scrapingStatus === "idle") return;
    if (vehicle.scrapingStatus === "pending" || vehicle.scrapingStatus === "in_progress") {
      setScrapePolling(true);
      return;
    }
    // Ya completado: cargar resultados para auto-llenar campos
    if (!vehicle?.id) return;
    const token = localStorage.getItem("sfit_access_token");
    fetch(`/api/vehiculos/${vehicle.id}/scrape/status`, {
      headers: { Authorization: `Bearer ${token ?? ""}` },
    })
      .then(r => r.json())
      .then(json => { if (json.success) setScrapeData(json.data); })
      .catch(() => {});
  }, [vehicle?.scrapingStatus, vehicle?.id]);

  useEffect(() => {
    if (!scrapePolling || !vehicle?.id) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const token = localStorage.getItem("sfit_access_token");
        const res = await fetch(`/api/vehiculos/${vehicle.id}/scrape/status`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.success) {
          setScrapeData(json.data);
          const status = json.data.overallStatus;
          // Actualizar vehicle localmente
          setVehicle(prev => prev ? { ...prev, scrapingStatus: status } : prev);
          if (status === "complete" || status === "partial" || status === "error") {
            setScrapePolling(false);
          }
        }
      } catch { /* ignorar */ }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrapePolling, vehicle?.id]);

  // Auto-llenar ownerName desde SUNARP scraping cuando llegan titulares
  useEffect(() => {
    if (!scrapeData || !canEdit || sunarpAutoFilled.current) return;
    const sunarp = scrapeData.sources?.sunarp_vehicular;
    if (!sunarp || sunarp.status !== "ok") return;
    const data = sunarp.data as Record<string, unknown> | undefined;
    const titulares = data?.titulares as string[] | undefined;
    if (!titulares || titulares.length === 0) return;
    // Solo auto-llenar si el campo está vacío
    setForm(prev => {
      if (prev.ownerName.trim()) return prev;
      sunarpAutoFilled.current = true;
      return { ...prev, ownerName: titulares[0] };
    });
  }, [scrapeData, canEdit]);

  const handleTriggerScrape = async () => {
    if (!vehicle?.id) return;
    setScrapeLoading(true);
    sunarpAutoFilled.current = false;
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/vehiculos/${vehicle.id}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      });
      const json = await res.json();
      if (json.success) {
        setVehicle(prev => prev ? { ...prev, scrapingStatus: "pending" } : prev);
        setScrapePolling(true);
      }
    } catch { /* ignorar */ }
    finally { setScrapeLoading(false); }
  };

  // Validación SUNARP de la placa
  const [placaLookup, setPlacaLookup] = useState<PlacaLookup>({ state: "idle" });
  const [placaHover, setPlacaHover] = useState(false);
  const placaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    let user: { role?: Role } = {};
    try { user = JSON.parse(raw); } catch { router.replace("/login"); return; }
    if (!hasWebPermission(user.role, "vehiculos", "view")) { router.replace("/dashboard"); return; }
    setCanEdit(hasWebPermission(user.role, "vehiculos", "edit"));
    setCanDelete(hasWebPermission(user.role, "vehiculos", "delete"));
    setCanSuspend(user.role ? SUSPEND_ROLES.includes(user.role) : false);
    sunarpAutoFilled.current = false;
    void loadVehicle();
    void loadDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  // Refiltrar empresas cuando el usuario cambia el tipo de servicio
  useEffect(() => {
    if (!form.vehicleTypeKey) return;
    const vt = form.vehicleTypeKey;
    const token = localStorage.getItem("sfit_access_token");
    fetch(`/api/empresas?limit=100&vehicleTypeKey=${vt}`, {
      headers: { Authorization: `Bearer ${token ?? ""}` },
    })
      .then((r) => r.json())
      .then((body) => {
        const items = body?.data?.items ?? [];
        setEmpresas(items);
        if (form.companyId && items.length > 0 && !items.some((e: Empresa) => e.id === form.companyId)) {
          setForm((prev) => ({ ...prev, companyId: "" }));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vehicleTypeKey]);

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
        ownerName: v.ownerName ?? "",
        companyId: v.companyId ?? "",
        status: v.status ?? "",
        soatExpiry: v.soatExpiry ? v.soatExpiry.split("T")[0] : "",
        soatInsurer: v.soatInsurer ?? "",
        soatCertificate: v.soatCertificate ?? "",
        lastInspectionDate: v.lastInspectionDate ? v.lastInspectionDate.split("T")[0] : "",
        lastInspectionStatus: v.lastInspectionStatus ?? "",
        lastInspectionCertificate: v.lastInspectionCertificate ?? "",
        citvExpiryDate: v.citvExpiryDate ? v.citvExpiryDate.split("T")[0] : "",
        photoUrl: v.photoUrl ?? "",
      });
      // Recargar empresas filtradas por el tipo de servicio del vehículo
      loadDropdowns(v.vehicleTypeKey);
    } catch { setLoadError("Error de conexión."); }
    finally { setLoading(false); }
  }

  async function verifyVehicle() {
    if (!vehicle || vehicle.verified) return;
    setVerifying(true);
    setServerError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/vehiculos/${id}/verificar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setServerError(data.error ?? "No se pudo verificar el vehículo.");
        return;
      }
      setVehicle((v) => v ? { ...v, verified: true, verifiedAt: data.data?.verifiedAt ?? new Date().toISOString() } : v);
    } catch {
      setServerError("Error de conexión al verificar.");
    } finally {
      setVerifying(false);
    }
  }

  async function loadDropdowns(vehicleTypeKey?: string) {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const headers = { Authorization: `Bearer ${token ?? ""}` };
      const empQs = vehicleTypeKey
        ? `limit=100&vehicleTypeKey=${vehicleTypeKey}`
        : "limit=100";
      const [empRes, tiposRes] = await Promise.all([
        fetch(`/api/empresas?${empQs}`, { headers }),
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
    if (form.ownerName) payload.ownerName = form.ownerName.trim();
    if (form.soatExpiry) payload.soatExpiry = form.soatExpiry;
    if (form.soatInsurer) payload.soatInsurer = form.soatInsurer.trim();
    if (form.soatCertificate) payload.soatCertificate = form.soatCertificate.trim();
    if (form.lastInspectionDate) payload.lastInspectionDate = form.lastInspectionDate;
    if (form.lastInspectionStatus) payload.lastInspectionStatus = form.lastInspectionStatus;
    if (form.lastInspectionCertificate) payload.lastInspectionCertificate = form.lastInspectionCertificate.trim();
    if (form.citvExpiryDate) payload.citvExpiryDate = form.citvExpiryDate;
    if (form.photoUrl) payload.photoUrl = form.photoUrl;
    else if (vehicle?.photoUrl && !form.photoUrl) payload.photoUrl = null;

    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/vehiculos/${id}`, {
        method: "PATCH",
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

  async function handleSuspend() {
    if (suspendReason.trim().length < 5 || !vehicle) return;
    setSuspending(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/vehiculos/${id}/suspender`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ reason: suspendReason.trim() }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setServerError(data.error ?? "No se pudo suspender el vehículo.");
        return;
      }
      setShowSuspend(false);
      setSuspendReason("");
      setVehicle((v) => v ? { ...v, status: "fuera_de_servicio" } : v);
    } catch { setServerError("Error de conexión."); }
    finally { setSuspending(false); }
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
        <KPIStrip cols={4} items={[
          { label: "SOAT", value: "—", subtitle: "—", icon: ShieldCheck },
          { label: "REVISIÓN TÉCNICA", value: "—", subtitle: "—", icon: ClipboardCheck },
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
  const repColor = vehicle.reputationScore >= 80 ? GRN : vehicle.reputationScore >= 50 ? AMBER : RED;
  const soatMeta = DOC_STATUS_META[vehicle.soatStatus ?? "sin_registro"];
  const citvMeta = DOC_STATUS_META[vehicle.citvStatus ?? "sin_registro"];
  const citvExento = vehicle.citvStatus === "exento";
  const stMeta = VEHICLE_STATUS_META[vehicle.status] ?? VEHICLE_STATUS_META.disponible;
  const soatDays = daysUntil(vehicle.soatExpiry);
  const soatWarn = soatDays != null && soatDays >= 0 && soatDays <= 30;
  const soatExpired = soatDays != null && soatDays < 0;
  const citvDays = daysUntil(vehicle.citvExpiryDate);
  const citvWarn = citvDays != null && citvDays >= 0 && citvDays <= 30;
  const citvExpired = citvDays != null && citvDays < 0;

  const canShowSuspend = canSuspend && vehicle.status !== "fuera_de_servicio";
  const canVerify = canEdit && !vehicle.verified;
  const headerAction = (
    <div style={{ display: "flex", gap: 8 }}>
      {backBtnPlain}
      {canVerify && (
        <button
          type="button"
          onClick={() => { void verifyVehicle(); }}
          disabled={verifying || submitting}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 36, padding: "0 14px", borderRadius: 9,
            border: `1.5px solid ${GRNBD}`, background: GRNBG,
            color: GRN, fontWeight: 700, fontSize: "0.875rem",
            cursor: verifying ? "not-allowed" : "pointer", fontFamily: "inherit",
            opacity: verifying ? 0.7 : 1,
          }}
        >
          {verifying
            ? <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />
            : <BadgeCheck size={14} />}
          {verifying ? "Verificando…" : "Verificar"}
        </button>
      )}
      {canShowSuspend && (
        <button
          type="button"
          onClick={() => setShowSuspend(true)}
          disabled={submitting || deleting || suspending}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 36, padding: "0 14px", borderRadius: 9,
            border: `1.5px solid ${REDBD}`, background: REDBG,
            color: RED, fontWeight: 700, fontSize: "0.875rem",
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <ShieldOff size={14} /> Suspender
        </button>
      )}
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

      {/* Estado de verificación administrativa.
          - sin verificar  → banner ámbar "pendiente" + CTA al botón.
          - verificado     → línea verde compacta con fecha. */}
      {vehicle.verified ? (
        <div style={{
          padding: "8px 14px", borderRadius: 8,
          background: GRNBG, border: `1px solid ${GRNBD}`,
          color: GRN, fontSize: "0.8125rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <BadgeCheck size={14} />
          Vehículo verificado{vehicle.verifiedAt
            ? ` el ${fmtDate(vehicle.verifiedAt)}`
            : ""}.
        </div>
      ) : (
        <div role="alert" style={{
          padding: "10px 14px", borderRadius: 8,
          background: AMBER_BG, border: `1px solid ${AMBER_BD}`,
          color: AMBER, fontSize: "0.8125rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />
          Pendiente de verificación administrativa — el vehículo no puede asignarse a viajes hasta validar SOAT, revisión técnica y placa.
        </div>
      )}

      <KPIStrip cols={4} items={[
        {
          label: "SOAT",
          value: soatMeta.label,
          subtitle: vehicle.soatStatus === "vigente" ? "vigente"
            : vehicle.soatStatus === "vencido" ? "vencido"
            : vehicle.soatStatus === "por_vencer" ? "por vencer"
            : vehicle.soatStatus === "sin_registro" ? "sin registro"
            : "pendiente",
          icon: ShieldCheck,
        },
        {
          label: "REVISIÓN TÉCNICA",
          value: citvMeta.label,
          subtitle: citvExento
            ? `Exento hasta ${(vehicle.year ?? 0) + 3}`
            : vehicle.citvStatus === "vigente" ? "vigente"
            : vehicle.citvStatus === "vencido" ? "vencida"
            : vehicle.citvStatus === "por_vencer" ? "por vencer"
            : vehicle.citvStatus === "sin_registro" ? "sin registro"
            : "pendiente",
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
          padding: "10px 14px", background: REDBG, border: `1px solid ${REDBD}`,
          borderRadius: 8, color: RED, fontSize: "0.8125rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />
          SOAT vencido hace {Math.abs(soatDays!)} días. Renueva la cobertura antes de operar.
        </div>
      )}
      {soatWarn && !soatExpired && (
        <div role="status" style={{
          padding: "10px 14px", background: AMBER_BG, border: `1px solid ${AMBER_BD}`,
          borderRadius: 8, color: AMBER, fontSize: "0.8125rem", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />
          SOAT vence en {soatDays} día{soatDays === 1 ? "" : "s"}. Considera renovarlo.
        </div>
      )}
      {!citvExento && citvExpired && (
        <div role="alert" style={{
          padding: "10px 14px", background: REDBG, border: `1px solid ${REDBD}`,
          borderRadius: 8, color: RED, fontSize: "0.8125rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />
          CITV vencido hace {Math.abs(citvDays!)} días. Programa una revisión técnica antes de operar.
        </div>
      )}
      {!citvExento && citvWarn && !citvExpired && (
        <div role="status" style={{
          padding: "10px 14px", background: AMBER_BG, border: `1px solid ${AMBER_BD}`,
          borderRadius: 8, color: AMBER, fontSize: "0.8125rem", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />
          CITV vence en {citvDays} día{citvDays === 1 ? "" : "s"}. Programa la próxima revisión.
        </div>
      )}

      {(loadError || serverError) && (
        <div role="alert" style={{
          padding: "10px 14px", background: REDBG, border: `1px solid ${REDBD}`,
          borderRadius: 8, color: RED, fontSize: "0.8125rem", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />{loadError ?? serverError}
        </div>
      )}
      {saveSuccess && (
        <div role="status" style={{
          padding: "10px 14px", background: GRNBG, border: `1px solid ${GRNBD}`,
          borderRadius: 8, color: GRN, fontSize: "0.8125rem", fontWeight: 600,
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
                    Placa <span style={{ color: RED, marginLeft: 3 }}>*</span>
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
                            fieldErrors.plate ? RED
                            : placaLookup.state === "ok" ? GRN
                            : placaLookup.state === "not_found" ? "#F59E0B"
                            : placaLookup.state === "error" ? RED
                            : INK2,
                        }}
                        onFocus={e => { if (!fieldErrors.plate) e.target.style.borderColor = INK9; }}
                        onBlur={e => {
                          e.target.style.borderColor =
                            fieldErrors.plate ? RED
                            : placaLookup.state === "ok" ? GRN
                            : placaLookup.state === "not_found" ? "#F59E0B"
                            : placaLookup.state === "error" ? RED
                            : INK2;
                        }}
                      />
                      <div style={{
                        position: "absolute", right: 10, top: "50%",
                        transform: "translateY(-50%)", pointerEvents: "none",
                      }}>
                        {placaLookup.state === "loading" && <Loader2 size={14} color={INK5} style={{ animation: "spin 0.7s linear infinite" }} />}
                        {placaLookup.state === "ok" && <CheckCircle size={14} color={GRN} />}
                        {placaLookup.state === "not_found" && <AlertTriangle size={14} color="#F59E0B" />}
                        {placaLookup.state === "error" && <AlertTriangle size={14} color={RED} />}
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
                  {fieldErrors.plate && <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.plate}</p>}
                  {/* Feedback inline OK — con botón "Aplicar" si difiere */}
                  {canEdit && placaLookup.state === "ok" && (() => {
                    const differsBrand = form.brand.trim().toLowerCase() !== placaLookup.marca.toLowerCase();
                    const differsModel = form.model.trim().toLowerCase() !== placaLookup.modelo.toLowerCase();
                    const differs = differsBrand || differsModel;

                    if (!differs) {
                      // Campos ya coinciden con SUNARP — solo confirmación discreta
                      return (
                        <p style={{ marginTop: 5, fontSize: "0.75rem", color: GRN, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                          <CheckCircle size={11} />Verificado: {placaLookup.marca} {placaLookup.modelo}
                          {placaLookup.color && (
                            <span style={{ color: INK5, fontWeight: 500 }}>· {placaLookup.color}</span>
                          )}
                        </p>
                      );
                    }

                    // Campos RED coinciden — banner accionable
                    return (
                      <div style={{
                        marginTop: 8, padding: "8px 10px", borderRadius: 8,
                        border: `1px solid ${GRNBD}`, background: GRNBG,
                        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                      }}>
                        <CheckCircle size={13} color={GRN} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0, fontSize: "0.75rem" }}>
                          <div style={{ fontWeight: 700, color: GRN, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.625rem" }}>
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
                            border: `1px solid ${GRN}`, background: "#fff", color: GRN,
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
                    <p style={{ marginTop: 5, fontSize: "0.75rem", color: AMBER, fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                      <AlertTriangle size={11} />Placa no encontrada en SUNARP.
                    </p>
                  )}
                  {canEdit && placaLookup.state === "error" && (
                    <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                      <AlertTriangle size={11} />{placaLookup.message}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="vehicleTypeKey" style={LABEL}>Tipo de servicio <span style={{ color: RED, marginLeft: 3 }}>*</span></label>
                  <select
                    id="vehicleTypeKey" value={form.vehicleTypeKey}
                    onChange={e => handleChange("vehicleTypeKey", e.target.value)}
                    disabled={submitting || !canEdit}
                    style={{
                      ...(canEdit ? FIELD : READ),
                      appearance: "none", paddingRight: 30, cursor: canEdit ? "pointer" : "default",
                      borderColor: fieldErrors.vehicleTypeKey ? RED : INK2,
                    }}
                  >
                    <option value="">Seleccionar tipo…</option>
                    {tipos.map(t => <option key={t.id} value={t.key}>{t.name}</option>)}
                  </select>
                  {fieldErrors.vehicleTypeKey && <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.vehicleTypeKey}</p>}
                </div>
              </div>
            </SectionCard>

            {/* Datos del vehículo */}
            <SectionCard
              icon={<Building2 size={14} color={INK6} />}
              title="Datos del vehículo"
              subtitle="Información operativa y registral"
            >
              {/* ── Sección 1: Información operativa ── */}
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: "0.6875rem", fontWeight: 700, color: INK5,
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
                }}>
                  Información operativa
                </div>
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
              </div>

              {/* ── Foto referencial ── */}
              <div style={{ marginBottom: 16 }}>
                <PhotoUploader
                  category="vehicle"
                  value={form.photoUrl || null}
                  onChange={(url) => handleChange("photoUrl", url ?? "")}
                  aspect="wide"
                  label="Foto referencial del vehículo"
                  disabled={submitting || !canEdit}
                />
              </div>

              {/* ── Sección 2: Datos del vehículo ── */}
              <div style={{ paddingTop: 16, borderTop: "1px solid #e4e4e7" }}>
                <div style={{
                  fontSize: "0.6875rem", fontWeight: 700, color: INK5,
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
                }}>
                  Datos del vehículo
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {/* Nombre del propietario — full width */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="ownerName" style={LABEL}>Nombre del propietario</label>
                    <input
                      id="ownerName" type="text" value={form.ownerName}
                      onChange={e => handleChange("ownerName", e.target.value)}
                      placeholder="Propietario registral (SUNARP)"
                      maxLength={200}
                      disabled={submitting || !canEdit}
                      style={{ ...(canEdit ? FIELD : READ) }}
                      onFocus={e => { if (canEdit) e.target.style.borderColor = INK9; }}
                      onBlur={e => { e.target.style.borderColor = INK2; }}
                    />
                  </div>
                  <div>
                    <label htmlFor="brand" style={LABEL}>Marca <span style={{ color: RED, marginLeft: 3 }}>*</span></label>
                    <input
                      id="brand" type="text" value={form.brand}
                      onChange={e => handleChange("brand", e.target.value)}
                      placeholder="Ej. Toyota" maxLength={80}
                      disabled={submitting || !canEdit}
                      style={{ ...(canEdit ? FIELD : READ), borderColor: fieldErrors.brand ? RED : INK2 }}
                      onFocus={e => { if (canEdit && !fieldErrors.brand) e.target.style.borderColor = INK9; }}
                      onBlur={e => { if (!fieldErrors.brand) e.target.style.borderColor = INK2; }}
                    />
                    {fieldErrors.brand && <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.brand}</p>}
                  </div>
                  <div>
                    <label htmlFor="model" style={LABEL}>Modelo <span style={{ color: RED, marginLeft: 3 }}>*</span></label>
                    <input
                      id="model" type="text" value={form.model}
                      onChange={e => handleChange("model", e.target.value)}
                      placeholder="Ej. Hiace" maxLength={80}
                      disabled={submitting || !canEdit}
                      style={{ ...(canEdit ? FIELD : READ), borderColor: fieldErrors.model ? RED : INK2 }}
                      onFocus={e => { if (canEdit && !fieldErrors.model) e.target.style.borderColor = INK9; }}
                      onBlur={e => { if (!fieldErrors.model) e.target.style.borderColor = INK2; }}
                    />
                    {fieldErrors.model && <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.model}</p>}
                  </div>
                  <div>
                    <label htmlFor="year" style={LABEL}>Año <span style={{ color: RED, marginLeft: 3 }}>*</span></label>
                    <input
                      id="year" type="number" value={form.year}
                      onChange={e => handleChange("year", e.target.value)}
                      placeholder={String(CURRENT_YEAR)} min={1990} max={CURRENT_YEAR + 1}
                      disabled={submitting || !canEdit}
                      style={{
                        ...(canEdit ? FIELD : READ),
                        fontVariantNumeric: "tabular-nums",
                        borderColor: fieldErrors.year ? RED : INK2,
                      }}
                      onFocus={e => { if (canEdit && !fieldErrors.year) e.target.style.borderColor = INK9; }}
                      onBlur={e => { if (!fieldErrors.year) e.target.style.borderColor = INK2; }}
                    />
                    {fieldErrors.year && <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.year}</p>}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Documentación */}
            <SectionCard
              icon={<ShieldCheck size={14} color={INK6} />}
              title="Documentación"
              subtitle="SOAT y revisión técnica (CITV)"
            >
              {/* ── SOAT ── */}
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: "0.6875rem", fontWeight: 700, color: INK5,
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
                }}>
                  SOAT
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <label htmlFor="soatExpiry" style={LABEL}>
                      Vencimiento
                      {soatDays != null && (
                        <span style={{
                          color: soatExpired ? RED : soatWarn ? AMBER : INK5,
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
                          borderColor: soatExpired ? RED : soatWarn ? AMBER : INK2,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="soatInsurer" style={LABEL}>Aseguradora</label>
                    <input
                      id="soatInsurer" type="text" value={form.soatInsurer}
                      onChange={e => handleChange("soatInsurer", e.target.value)}
                      placeholder="Ej. Pacífico Seguros"
                      maxLength={120}
                      disabled={submitting || !canEdit}
                      style={{ ...(canEdit ? FIELD : READ) }}
                      onFocus={e => { if (canEdit) e.target.style.borderColor = INK9; }}
                      onBlur={e => { e.target.style.borderColor = INK2; }}
                    />
                  </div>
                  <div>
                    <label htmlFor="soatCertificate" style={LABEL}>N° Certificado</label>
                    <input
                      id="soatCertificate" type="text" value={form.soatCertificate}
                      onChange={e => handleChange("soatCertificate", e.target.value)}
                      placeholder="N° de póliza o certificado"
                      maxLength={60}
                      disabled={submitting || !canEdit}
                      style={{ ...(canEdit ? FIELD : READ) }}
                      onFocus={e => { if (canEdit) e.target.style.borderColor = INK9; }}
                      onBlur={e => { e.target.style.borderColor = INK2; }}
                    />
                  </div>
                </div>
              </div>

              {/* ── CITV ── */}
              <div style={{ paddingTop: 12, borderTop: "1px solid #e4e4e7" }}>
                <div style={{
                  fontSize: "0.6875rem", fontWeight: 700, color: INK5,
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
                }}>
                  Revisión técnica (CITV)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label htmlFor="lastInspectionStatus" style={LABEL}>Estado</label>
                    <select
                      id="lastInspectionStatus" value={form.lastInspectionStatus}
                      onChange={e => handleChange("lastInspectionStatus", e.target.value)}
                      disabled={submitting || !canEdit}
                      style={{ ...(canEdit ? FIELD : READ), appearance: "none", paddingRight: 30, cursor: canEdit ? "pointer" : "default" }}
                    >
                      <option value="">— Sin registro —</option>
                      <option value="aprobada">Aprobada</option>
                      <option value="observada">Observada</option>
                      <option value="rechazada">Rechazada</option>
                      <option value="pendiente">Pendiente</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="lastInspectionDate" style={LABEL}>Última inspección</label>
                    <input
                      id="lastInspectionDate" type="date" value={form.lastInspectionDate}
                      onChange={e => handleChange("lastInspectionDate", e.target.value)}
                      disabled={submitting || !canEdit}
                      style={{ ...(canEdit ? FIELD : READ) }}
                    />
                  </div>
                  <div>
                    <label htmlFor="citvExpiryDate" style={LABEL}>
                      Vencimiento CITV
                      {citvDays != null && (
                        <span style={{
                          marginLeft: 6, fontSize: "0.6875rem", fontWeight: 500,
                          color: citvExpired ? RED : citvWarn ? AMBER : INK5,
                        }}>
                          ({citvExpired ? `vencido hace ${Math.abs(citvDays)}d`
                            : citvDays === 0 ? "vence hoy"
                            : `en ${citvDays}d`})
                        </span>
                      )}
                    </label>
                    <input
                      id="citvExpiryDate" type="date" value={form.citvExpiryDate}
                      onChange={e => handleChange("citvExpiryDate", e.target.value)}
                      disabled={submitting || !canEdit}
                      style={{
                        ...(canEdit ? FIELD : READ),
                        borderColor: canEdit ? (citvExpired ? RED : citvWarn ? AMBER : INK2) : "transparent",
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor="lastInspectionCertificate" style={LABEL}>N° Certificado</label>
                    <input
                      id="lastInspectionCertificate" type="text" value={form.lastInspectionCertificate}
                      onChange={e => handleChange("lastInspectionCertificate", e.target.value)}
                      placeholder="N° de certificado CITV"
                      maxLength={60}
                      disabled={submitting || !canEdit}
                      style={{ ...(canEdit ? FIELD : READ) }}
                      onFocus={e => { if (canEdit) e.target.style.borderColor = INK9; }}
                      onBlur={e => { e.target.style.borderColor = INK2; }}
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
                {vehicle.photoUrl ? (
                  <div style={{
                    width: 80, height: 60, borderRadius: 10,
                    overflow: "hidden", border: `1.5px solid ${INK2}`,
                    background: INK1,
                  }}>
                    <Image
                      src={vehicle.photoUrl}
                      alt={`Foto de ${vehicle.plate}`}
                      width={80} height={60}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      unoptimized
                    />
                  </div>
                ) : (
                  <div style={{
                    width: 64, height: 64, borderRadius: 12,
                    background: INK1, border: `1px solid ${INK2}`,
                    color: INK6,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Car size={28} strokeWidth={1.8} />
                  </div>
                )}
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
                <KeyValueRow k="Tipo" v={tipoNombre} />
                <KeyValueRow k="Empresa" v={vehicle.companyName?.trim() || "—"} />
                <KeyValueRow k="Propietario" v={vehicle.ownerName?.trim() || "—"} />
                <KeyValueRow k="Año" v={String(vehicle.year)} mono />
                <KeyValueRow k="Registrado" v={fmtDate(vehicle.createdAt)} />
                <KeyValueRow k="Activo" v={vehicle.active ? "Sí" : "No"} />
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
            {canDelete && (
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

      {/* ─── Historial Legal (Web Scraping) ─── */}
      <ScrapingPanel
        vehicle={vehicle}
        scrapeData={scrapeData}
        polling={scrapePolling}
        loading={scrapeLoading}
        onTriggerScrape={handleTriggerScrape}
      />

      {!canEdit && (
        <div style={{
          padding: "10px 14px", background: INK1, border: `1px solid ${INK2}`,
          borderRadius: 8, color: INK6, fontSize: "0.8125rem",
        }}>
          Solo administradores municipales o superadministradores pueden editar o eliminar vehículos.
        </div>
      )}

      {showSuspend && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !suspending && setShowSuspend(false)}
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
              <ShieldOff size={22} color={RED} />
              <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 800, color: INK9 }}>
                Suspender vehículo
              </h3>
            </div>
            <p style={{ margin: "0 0 16px", color: INK6, fontSize: "0.875rem", lineHeight: 1.5 }}>
              Pondrá la placa <b>{vehicle.plate}</b> fuera de servicio. Esta acción se
              registra en el log de auditoría con motivo y autor.
            </p>
            <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: INK5, marginBottom: 6 }}>
              Motivo de la suspensión
            </label>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Ej: SOAT vencido y revisión técnica observada con falla grave"
              rows={3}
              autoFocus
              style={{
                width: "100%", padding: "10px 12px",
                borderRadius: 8, border: `1px solid ${INK2}`,
                fontSize: "0.875rem", fontFamily: "inherit",
                resize: "vertical", color: INK9, background: "#fff",
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button
                onClick={() => { setShowSuspend(false); setSuspendReason(""); }}
                disabled={suspending}
                style={{
                  height: 36, padding: "0 16px", borderRadius: 8,
                  border: `1.5px solid ${INK2}`, background: "#fff",
                  color: INK6, fontSize: "0.875rem", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >Cancelar</button>
              <button
                onClick={handleSuspend}
                disabled={suspending || suspendReason.trim().length < 5}
                style={{
                  height: 36, padding: "0 16px", borderRadius: 8,
                  border: "none", background: RED, color: "#fff",
                  fontSize: "0.875rem", fontWeight: 700,
                  cursor: suspending || suspendReason.trim().length < 5 ? "not-allowed" : "pointer",
                  opacity: suspending || suspendReason.trim().length < 5 ? 0.5 : 1,
                  fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                {suspending ? <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> : <ShieldOff size={14} />}
                {suspending ? "Suspendiendo…" : "Confirmar suspensión"}
              </button>
            </div>
          </div>
        </div>
      )}
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
        lookup.state === "ok" ? GRNBD
        : lookup.state === "not_found" ? "#FDE68A"
        : lookup.state === "error" ? REDBD : INK2
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
            <CheckCircle size={12} color={GRN} />
            <span style={{ fontSize: "0.625rem", fontWeight: 800, color: GRN, letterSpacing: "0.08em", textTransform: "uppercase" }}>
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
              border: `1px solid ${GRN}`, background: GRNBG, color: GRN,
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
      background: "#fff", border: `1px solid ${REDBD}`, borderRadius: 12,
      padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Trash2 size={13} color={RED} />
        <div style={{
          fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: RED,
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
            border: `1px solid ${REDBD}`, background: REDBG, color: RED,
            fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>
            <Trash2 size={12} />Eliminar vehículo
          </button>
        </>
      ) : (
        <div style={{ background: REDBG, border: `1px solid ${REDBD}`, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontWeight: 700, color: RED, marginBottom: 4, fontSize: "0.8125rem" }}>¿Confirmar?</div>
          <p style={{ fontSize: "0.75rem", color: INK6, marginBottom: 10, lineHeight: 1.5 }}>
            Eliminarás <strong style={{ fontFamily: "ui-monospace, monospace" }}>{plate}</strong>. Acción irreversible.
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onDelete} disabled={deleting}
              style={{
                flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                height: 30, borderRadius: 7, border: "none", background: RED, color: "#fff",
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

/* ─── Panel de Historial Legal (Web Scraping) ─── */

const SCRAPE_SOURCE_LABELS: Record<string, string> = {
  soat: "SOAT",
  mtc_citv: "MTC CITV",
  sunarp_vehicular: "SUNARP",
};

const SCRAPE_STATUS_META: Record<string, { color: string; bg: string; bd: string; label: string }> = {
  pending:     { color: "#1E40AF", bg: "#EFF6FF", bd: INFO_BD, label: "Pendiente" },
  running:     { color: "#1E40AF", bg: "#EFF6FF", bd: INFO_BD, label: "Ejecutando..." },
  ok:          { color: GRN, bg: GRNBG, bd: GRNBD, label: "Completado" },
  error:       { color: RED, bg: REDBG, bd: REDBD, label: "Error" },
  not_found:   { color: AMBER, bg: AMBER_BG, bd: AMBER_BD, label: "No encontrado" },
};

function ScrapingPanel({
  vehicle, scrapeData, polling, loading, onTriggerScrape,
}: {
  vehicle: Vehicle | null;
  scrapeData: ScrapingData | null;
  polling: boolean;
  loading: boolean;
  onTriggerScrape: () => void;
}) {
  const status = vehicle?.scrapingStatus ?? "idle";

  if (status === "idle") {
    return (
      <div style={{
        padding: "16px", borderRadius: 10,
        background: "#fff", border: `1px solid ${INK2}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Search size={14} color={INK6} />
          <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: INK9 }}>
            Historial Legal
          </span>
        </div>
        <p style={{ fontSize: "0.75rem", color: INK5, lineHeight: 1.5, margin: "0 0 12px" }}>
          Consulta automática de SOAT, revisiones técnicas (MTC) y antecedentes registrales (SUNARP).
        </p>
        <button onClick={onTriggerScrape} disabled={loading} style={{
          ...BTN_PRIMARY, height: 32, fontSize: "0.75rem", padding: "0 14px",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          {loading && <Loader2 size={11} style={{ animation: "spin 0.7s linear infinite" }} />}
          <Search size={12} />Consultar historial legal
        </button>
      </div>
    );
  }

  if (polling) {
    return (
      <div style={{
        padding: "16px", borderRadius: 10,
        background: "#EFF6FF", border: `1px solid ${INFO_BD}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <Loader2 size={14} color="#1E40AF" style={{ animation: "spin 0.7s linear infinite" }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "#1E40AF" }}>
            Consultando historial legal...
          </div>
          <div style={{ fontSize: "0.6875rem", color: INK5 }}>
            SOAT, MTC CITV y SUNARP — esto puede tomar hasta 90 segundos
          </div>
        </div>
      </div>
    );
  }

  if (!scrapeData) return null;

  return (
    <div style={{
      padding: "16px", borderRadius: 10,
      background: "#fff", border: `1px solid ${INK2}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={14} color={INK6} />
          <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: INK9 }}>
            Historial Legal
          </span>
          <ScrapeStatusBadge status={status} />
        </div>
        <button onClick={onTriggerScrape} disabled={loading} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          height: 28, padding: "0 10px", borderRadius: 6,
          border: `1px solid ${INK2}`, background: "#fff", color: INK6,
          fontSize: "0.6875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}>
          {loading ? <Loader2 size={10} style={{ animation: "spin 0.7s linear infinite" }} /> : <RefreshCw size={10} />}
          Re-consultar
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {["soat", "mtc_citv", "sunarp_vehicular"].map(source => {
          const result = scrapeData.sources?.[source];
          const meta = result ? SCRAPE_STATUS_META[result.status] ?? SCRAPE_STATUS_META.error : SCRAPE_STATUS_META.pending;
          const data = result?.data as Record<string, unknown> | undefined;
          return (
            <div key={source} style={{
              padding: "12px", borderRadius: 8,
              background: INK1, border: `1px solid ${INK2}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: "0.6875rem", color: INK9, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {SCRAPE_SOURCE_LABELS[source] ?? source}
                </span>
                <span style={{
                  fontSize: "0.5625rem", fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                  background: meta.bg, color: meta.color, border: `1px solid ${meta.bd}`,
                  letterSpacing: "0.03em", textTransform: "uppercase",
                }}>
                  {meta.label}
                </span>
              </div>
              {result?.status === "ok" && data ? (
                <div style={{ fontSize: "0.6875rem", color: INK6, lineHeight: 1.5 }}>
                  {source === "soat" && (
                    <>
                      {data.aseguradora && <div>Aseguradora: <strong>{String(data.aseguradora)}</strong></div>}
                      {data.vigencia && <div>Vigencia: {String(data.vigencia)}</div>}
                      {data.poliza && <div>Póliza: {String(data.poliza)}</div>}
                      {data.raw_text && !data.aseguradora && !data.vigencia && !data.poliza && (
                        <div style={{ maxHeight: 120, overflow: "hidden", whiteSpace: "pre-wrap" }}>
                          {String(data.raw_text).slice(0, 300)}
                        </div>
                      )}
                    </>
                  )}
                  {source === "mtc_citv" && (
                    <>
                      {data.ultimaRevision && <div>Última revisión: <strong>{String(data.ultimaRevision)}</strong></div>}
                      {data.resultado && <div>Resultado: {String(data.resultado)}</div>}
                      {data.centroInspeccion && <div>Centro: {String(data.centroInspeccion)}</div>}
                      {data.proximaRevision && <div>Próxima: {String(data.proximaRevision)}</div>}
                    </>
                  )}
                  {source === "sunarp_vehicular" && (
                    <>
                      {Array.isArray(data.titulares) && (data.titulares as string[]).length > 0 && (
                        <div>Titulares: <strong>{(data.titulares as string[]).length}</strong></div>
                      )}
                      {Array.isArray(data.gravamenes) && (data.gravamenes as string[]).length > 0 && (
                        <div>Gravámenes: <strong>{(data.gravamenes as string[]).length}</strong></div>
                      )}
                      {data.raw_text && !Array.isArray(data.titulares) && (
                        <div style={{ maxHeight: 120, overflow: "hidden", whiteSpace: "pre-wrap" }}>
                          {String(data.raw_text).slice(0, 300)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : result?.status === "not_found" ? (
                <div style={{ fontSize: "0.6875rem", color: INK5 }}>No se encontraron registros</div>
              ) : result?.status === "error" ? (
                <div style={{ fontSize: "0.625rem", color: RED }}>
                  {result.error ?? "Error desconocido"}
                </div>
              ) : (
                <div style={{ fontSize: "0.6875rem", color: INK5 }}>Pendiente</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScrapeStatusBadge({ status }: { status: string }) {
  const m = SCRAPE_STATUS_META[status] ?? SCRAPE_STATUS_META.error;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 5,
      background: m.bg, color: m.color, border: `1px solid ${m.bd}`,
      fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.03em",
      textTransform: "uppercase",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}
