"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Loader2, FileSearch, ShieldCheck, FileWarning, User, Building2, Camera } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { PhotoUploader } from "@/components/ui/PhotoUploader";
import { hasWebPermission, FIXED_COMPANY_ROLES } from "@/lib/auth/roleMatrix";
import type { Role } from "@/lib/constants";

const CURRENT_YEAR = new Date().getFullYear();

type ScrapeVerifyState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; data: {
      soatInsurer?: string; soatExpiry?: string; soatCertificate?: string; soatStatus?: string;
      citvLastDate?: string; citvNextDate?: string; citvResult?: string; citvCertificate?: string;
      sunarpOwnerName?: string; sunarpBrand?: string; sunarpModel?: string;
      sunarpYear?: string; sunarpManufacturingYear?: string;
      sunarpTitulares?: string[]; sunarpGravamenes?: string[];
      captchaCost?: number;
    }; sources: string[]; errors: string[] }
  | { state: "error"; message: string };

/** Datos registrales SUNARP que persisten en pantalla aunque el usuario edite los campos manuales. */
interface SunarpRegistralData {
  ownerName?: string;
  brand?: string;
  model?: string;
  year?: string;
  manufacturingYear?: string;
  titulares?: string[];
  gravamenes?: string[];
  plate?: string;
  estado?: string;
  sede?: string;
}

interface Empresa {
  id: string;
  razonSocial: string;
}

interface TipoVehiculo {
  id: string;
  key: string;
  name: string;
  active: boolean;
}

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
  photoUrl?: string;
}

export default function NuevoVehiculoPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [miEmpresa, setMiEmpresa] = useState<Empresa | null>(null);
  const [miEmpresaMissing, setMiEmpresaMissing] = useState(false);
  const [tipos, setTipos] = useState<TipoVehiculo[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [form, setForm] = useState<FormData>({
    plate: "",
    vehicleTypeKey: "",
    brand: "",
    model: "",
    year: String(CURRENT_YEAR),
    ownerName: "",
    companyId: "",
    status: "",
    soatExpiry: "",
    soatInsurer: "",
    soatCertificate: "",
    lastInspectionDate: "",
    lastInspectionStatus: "",
    lastInspectionCertificate: "",
    citvExpiryDate: "",
    photoUrl: "",
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Verificación vía scraping (SOAT + CITV)
  const [scrapeVerify, setScrapeVerify] = useState<ScrapeVerifyState>({ state: "idle" });

  // SUNARP manual (headful browser + OCR)
  const [sunarpState, setSunarpState] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "ok"; data: SunarpRegistralData; errors: string[] }
    | { state: "error"; message: string }
  >({ state: "idle" });

  // Datos registrales persistentes (no se pierden al editar campos manuales)
  const [registralData, setRegistralData] = useState<SunarpRegistralData | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    const tk = localStorage.getItem("sfit_access_token");

    if (!raw || !tk) {
      router.replace("/login");
      return;
    }

    let user: { role?: string } = {};
    try {
      user = JSON.parse(raw);
    } catch {
      router.replace("/login");
      return;
    }

    if (!user.role || !hasWebPermission(user.role as Role, "vehiculos", "create")) {
      router.replace("/vehiculos");
      return;
    }

    setAuthorized(true);
    setToken(tk);
    setRole(user.role);
  }, [router]);

  useEffect(() => {
    if (!authorized || !token || !role) return;

    const headers = { Authorization: `Bearer ${token}` };
    const isOperador = FIXED_COMPANY_ROLES.includes(role as Role);

    const empresaPromise = isOperador
      ? fetch("/api/operador/mi-empresa", { headers }).then(async (r) => {
          if (r.status === 404) {
            return { __miEmpresaMissing: true } as const;
          }
          const body = await r.json().catch(() => null);
          if (!r.ok || !body?.success) {
            return { __miEmpresaMissing: true } as const;
          }
          const c = body.data;
          return { __miEmpresa: { id: c.id, razonSocial: c.razonSocial } as Empresa } as const;
        })
      : fetch("/api/empresas?limit=100", { headers }).then((r) => r.json());

    Promise.all([
      empresaPromise,
      fetch("/api/tipos-vehiculo?limit=100", { headers }).then((r) => r.json()),
    ])
      .then(([empResult, tiposBody]) => {
        if (isOperador) {
          const r = empResult as
            | { __miEmpresa: Empresa }
            | { __miEmpresaMissing: true };
          if ("__miEmpresaMissing" in r) {
            setMiEmpresaMissing(true);
          } else {
            setMiEmpresa(r.__miEmpresa);
            setForm((prev) => ({ ...prev, companyId: r.__miEmpresa.id }));
          }
        } else {
          const empBody = empResult as { data?: { items?: Empresa[] } };
          setEmpresas(empBody?.data?.items ?? []);
        }
        const allTipos: TipoVehiculo[] = tiposBody?.data?.items ?? [];
        setTipos(allTipos.filter((t) => t.active));
      })
      .catch(() => {
        setEmpresas([]);
        setTipos([]);
      })
      .finally(() => setLoadingData(false));
  }, [authorized, token, role]);

  // Refiltrar empresas cuando cambia el tipo de servicio seleccionado
  useEffect(() => {
    if (!authorized || !token || role === "operador") return;
    const vt = form.vehicleTypeKey;
    const qs = vt ? `limit=100&vehicleTypeKey=${vt}` : "limit=100";
    fetch(`/api/empresas?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((body) => {
        const items: Empresa[] = body?.data?.items ?? [];
        setEmpresas(items);
        // Si la empresa seleccionada ya no está en la lista filtrada, limpiar
        if (form.companyId && items.length > 0 && !items.some((e) => e.id === form.companyId)) {
          setForm((prev) => ({ ...prev, companyId: "" }));
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vehicleTypeKey, authorized, token, role]);

  async function handleVerifyPlate() {
    const placa = form.plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (!/^[A-Z0-9]{6,7}$/.test(placa)) return;

    setScrapeVerify({ state: "loading" });
    try {
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      const r = await fetch("/api/vehiculos/verify-plate", {
        method: "POST",
        headers,
        body: JSON.stringify({ plate: placa }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) {
        setScrapeVerify({ state: "error", message: j?.error ?? "Error al consultar fuentes oficiales" });
        return;
      }
      const d = j.data;

      // Auto-llenar campos de documentación desde el scraper para comodidad
      // del operador. Los campos se muestran con fondo verde (#f0fdf4) para
      // indicar que vienen de fuente externa y el operador puede editarlos.
      const citvStatusMap: Record<string, string> = {
        "aprobado": "aprobada", "observado": "observada",
        "rechazado": "rechazada", "pendiente": "pendiente",
      };
      const citvStatus = (d.citvResult ?? "").toString().trim().toLowerCase();
      const mappedCitvStatus = citvStatusMap[citvStatus] ?? "";

      // El scraper devuelve fechas en formato DD/MM/YYYY o rangos "inicio - fin".
      const toDateInput = (raw: string | null | undefined): string => {
        if (!raw) return "";
        // Rango: "24/01/2026 - 24/01/2027" → tomar la fecha de fin (expiración)
        const rangeMatch = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (rangeMatch) {
          return `${rangeMatch[6]}-${rangeMatch[5].padStart(2, "0")}-${rangeMatch[4].padStart(2, "0")}`;
        }
        // Fecha simple: "24/01/2026" → "2026-01-24"
        const singleMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (singleMatch) {
          return `${singleMatch[3]}-${singleMatch[2].padStart(2, "0")}-${singleMatch[1].padStart(2, "0")}`;
        }
        // ISO o ya en formato correcto
        return raw.split("T")[0];
      };

      setForm(prev => ({
        ...prev,
        soatInsurer: d.soatInsurer ?? prev.soatInsurer,
        soatExpiry: toDateInput(d.soatExpiry) || prev.soatExpiry,
        soatCertificate: d.soatCertificate ?? prev.soatCertificate,
        lastInspectionDate: toDateInput(d.citvLastDate) || prev.lastInspectionDate,
        lastInspectionStatus: mappedCitvStatus || prev.lastInspectionStatus,
        citvExpiryDate: toDateInput(d.citvNextDate) || prev.citvExpiryDate,
        lastInspectionCertificate: d.citvCertificate ?? prev.lastInspectionCertificate,
      }));

      setScrapeVerify({
        state: "ok",
        data: {
          soatInsurer: d.soatInsurer,
          soatExpiry: d.soatExpiry,
          soatCertificate: d.soatCertificate,
          soatStatus: d.soatStatus,
          citvLastDate: d.citvLastDate,
          citvNextDate: d.citvNextDate,
          citvResult: d.citvResult,
          citvCertificate: d.citvCertificate,
          sunarpOwnerName: d.sunarpOwnerName,
          sunarpBrand: d.sunarpBrand,
          sunarpModel: d.sunarpModel,
          sunarpYear: d.sunarpYear,
          sunarpManufacturingYear: d.sunarpManufacturingYear,
          sunarpTitulares: d.sunarpTitulares,
          sunarpGravamenes: d.sunarpGravamenes,
          captchaCost: j.captchaCost,
        },
        sources: j.sources_consulted ?? [],
        errors: j.errors ?? [],
      });
    } catch {
      setScrapeVerify({ state: "error", message: "No se pudo contactar al servicio de verificación" });
    }
  }

  /** Verificación manual de SUNARP: abre navegador visible + OCR sobre Tarjeta TIVE. */
  async function handleVerifySunarp() {
    const placa = form.plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (!/^[A-Z0-9]{6,7}$/.test(placa)) return;

    setSunarpState({ state: "loading" });
    try {
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      const r = await fetch("/api/vehiculos/sunarp-headful", {
        method: "POST",
        headers,
        body: JSON.stringify({ plate: placa }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) {
        setSunarpState({ state: "error", message: j?.error ?? "Error al consultar SUNARP" });
        return;
      }
      const d = j.data;

      const registral: SunarpRegistralData = {
        ownerName: d.sunarpOwnerName,
        brand: d.sunarpBrand,
        model: d.sunarpModel,
        year: d.sunarpYear,
        manufacturingYear: d.sunarpManufacturingYear,
        titulares: d.sunarpTitulares,
        gravamenes: d.sunarpGravamenes,
        plate: d.plate || placa,
        estado: d.sunarpRaw ? _extractRegistralField(d.sunarpRaw, "ESTADO", "EN CIRCULACION") : undefined,
        sede: d.sunarpRaw ? _extractRegistralField(d.sunarpRaw, "SEDE", "LIMA") : undefined,
      };

      setRegistralData(registral);
      setSunarpState({
        state: "ok",
        data: registral,
        errors: j.errors ?? [],
      });
    } catch {
      setSunarpState({ state: "error", message: "No se pudo contactar al servicio SUNARP" });
    }
  }

  /** Aplica los datos registrales SUNARP a los campos del formulario (Card 2). */
  function applySunarpData() {
    if (!registralData) return;
    setForm((prev) => {
      const next = { ...prev };
      if (registralData.ownerName && !prev.ownerName.trim()) next.ownerName = registralData.ownerName;
      if (registralData.brand && !prev.brand.trim()) next.brand = registralData.brand;
      if (registralData.model && !prev.model.trim()) next.model = registralData.model;
      const anio = registralData.manufacturingYear || registralData.year;
      if (anio && (!prev.year || prev.year === String(CURRENT_YEAR))) next.year = anio;
      return next;
    });
  }

  /** Extrae un campo del texto raw del OCR de SUNARP. */
  function _extractRegistralField(raw: string, label: string, fallback: string): string {
    if (!raw) return fallback;
    const idx = raw.indexOf(label);
    if (idx < 0) return fallback;
    const after = raw.slice(idx + label.length);
    const lines = after.split("\n");
    // Tomar primera línea no vacía, limpiar ruido OCR
    for (const line of lines) {
      const clean = line.replace(/^[:\s=0]+/, "").trim();
      if (clean.length >= 2) {
        // Cortar al encontrar la siguiente etiqueta conocida
        const cutIdx = clean.search(/\s{2,}(?:MARCA|MODELO|PLACA|AÑO|SEDE|PROPIETARIO|COLOR|MOTOR|ANOTACIONES|N°)/i);
        return cutIdx >= 0 ? clean.slice(0, cutIdx).trim() : clean;
      }
    }
    return fallback;
  }

  /** Intenta parsear fecha de texto (dd/mm/aaaa o ISO) a YYYY-MM-DD para input date. */
  function _parseDateToInput(raw: string): string | null {
    const dmy = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    return null;
  }

  function validate(): boolean {
    const next: FieldErrors = {};

    const plate = form.plate.trim();
    if (!plate) {
      next.plate = "La placa es requerida.";
    } else if (plate.length < 5) {
      next.plate = "La placa debe tener al menos 5 caracteres.";
    } else if (plate.length > 10) {
      next.plate = "La placa no puede superar 10 caracteres.";
    }

    if (!form.vehicleTypeKey) {
      next.vehicleTypeKey = "El tipo de servicio es requerido.";
    }

    const brand = form.brand.trim();
    if (!brand) {
      next.brand = "La marca es requerida.";
    } else if (brand.length > 80) {
      next.brand = "La marca no puede superar 80 caracteres.";
    }

    const model = form.model.trim();
    if (!model) {
      next.model = "El modelo es requerido.";
    } else if (model.length > 80) {
      next.model = "El modelo no puede superar 80 caracteres.";
    }

    const yearNum = parseInt(form.year, 10);
    if (!form.year || isNaN(yearNum)) {
      next.year = "El año es requerido.";
    } else if (yearNum < 1990 || yearNum > CURRENT_YEAR + 1) {
      next.year = `El año debe estar entre 1990 y ${CURRENT_YEAR + 1}.`;
    }

    if (!form.photoUrl.trim()) {
      next.photoUrl = "La foto referencial del vehículo es requerida.";
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setSubmitting(true);

    const payload: Record<string, unknown> = {
      plate: form.plate.trim().toUpperCase(),
      vehicleTypeKey: form.vehicleTypeKey,
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: parseInt(form.year, 10),
    };
    const isOperador = role ? FIXED_COMPANY_ROLES.includes(role as Role) : false;
    const companyIdToSend = isOperador ? miEmpresa?.id : form.companyId;
    if (companyIdToSend) payload.companyId = companyIdToSend;
    if (form.status) payload.status = form.status;
    if (form.soatExpiry) payload.soatExpiry = form.soatExpiry;
    if (form.ownerName.trim()) payload.ownerName = form.ownerName.trim();
    if (form.soatInsurer.trim()) payload.soatInsurer = form.soatInsurer.trim();
    if (form.soatCertificate.trim()) payload.soatCertificate = form.soatCertificate.trim();
    if (form.lastInspectionDate) payload.lastInspectionDate = form.lastInspectionDate;
    if (form.lastInspectionStatus) payload.lastInspectionStatus = form.lastInspectionStatus;
    if (form.lastInspectionCertificate.trim()) payload.lastInspectionCertificate = form.lastInspectionCertificate.trim();
    if (form.citvExpiryDate) payload.citvExpiryDate = form.citvExpiryDate;
    if (form.photoUrl) payload.photoUrl = form.photoUrl;

    try {
      const res = await fetch("/api/vehiculos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push("/vehiculos");
        return;
      }

      let msg = `Error ${res.status}`;
      try {
        const body = await res.json();
        msg = body?.message ?? body?.error ?? msg;
      } catch {
        // ignore
      }
      setServerError(msg);
    } catch {
      setServerError("Error de conexión. Intente nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleChange(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  if (!authorized) return null;

  const normalizedPlate = form.plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const plateValid = /^[A-Z0-9]{6,7}$/.test(normalizedPlate);

  // Estados calculados de documentos
  const soatDays = (() => {
    if (!form.soatExpiry) return null;
    const d = new Date(form.soatExpiry);
    if (isNaN(d.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.floor((d.getTime() - today.getTime()) / 86400000);
  })();
  const soatExpired = soatDays != null && soatDays < 0;
  const soatWarn = soatDays != null && soatDays >= 0 && soatDays <= 30;
  const citvDays = (() => {
    if (!form.citvExpiryDate) return null;
    const d = new Date(form.citvExpiryDate);
    if (isNaN(d.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.floor((d.getTime() - today.getTime()) / 86400000);
  })();
  const citvExpired = citvDays != null && citvDays < 0;
  const citvWarn = citvDays != null && citvDays >= 0 && citvDays <= 30;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <PageHeader
        title="Nuevo vehículo"
        subtitle="Registra una nueva unidad en el sistema SFIT."
        kicker="Vehículos · RF-06"
      />

      <form onSubmit={handleSubmit} noValidate>
        {/* ═══════════════════════════════════════════════════════
            CARD 1 — Verificación SUNARP
            ═══════════════════════════════════════════════════════ */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Building2 size={18} color="#7c3aed" />
            <h3
              style={{
                fontFamily: "var(--font-inter)",
                fontSize: "1rem",
                fontWeight: 700,
              }}
            >
              Verificación registral SUNARP
            </h3>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "#6b7280", marginBottom: 16, marginTop: 0 }}>
            Consulta los datos oficiales del vehículo en la Superintendencia Nacional de
            Registros Públicos. Se abrirá el navegador para resolver el CAPTCHA.
          </p>

          {/* Fila: placa + botón */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", maxWidth: 520 }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="plate" style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: "0.875rem" }}>
                Placa del vehículo <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                id="plate"
                type="text"
                className={`field${fieldErrors.plate ? " field-error" : ""}`}
                value={form.plate}
                onChange={(e) => handleChange("plate", e.target.value.toUpperCase())}
                placeholder="ABC-123"
                maxLength={10}
                disabled={submitting}
                style={{ fontFamily: "ui-monospace,monospace", letterSpacing: "0.05em" }}
              />
              {fieldErrors.plate && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>
                  {fieldErrors.plate}
                </p>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 28 }}>
              {/* Botón Verificar (SOAT + CITV auto) */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={scrapeVerify.state === "loading" || !plateValid || submitting}
                onClick={handleVerifyPlate}
                style={{ whiteSpace: "nowrap", gap: 6 }}
              >
                {scrapeVerify.state === "loading" ? (
                  <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />
                ) : (
                  <FileSearch size={14} />
                )}
                Verificar SOAT/CITV
              </Button>

              {/* Botón SUNARP (headful manual) */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sunarpState.state === "loading" || !plateValid || submitting}
                onClick={handleVerifySunarp}
                style={{
                  whiteSpace: "nowrap",
                  gap: 6,
                  borderColor: "#7c3aed",
                  color: "#7c3aed",
                }}
              >
                {sunarpState.state === "loading" ? (
                  <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />
                ) : (
                  <Building2 size={14} />
                )}
                Verificar SUNARP
              </Button>
            </div>
          </div>

          {/* ── Verificación automática (SOAT + CITV) ── */}
          {scrapeVerify.state === "ok" && (
            <div style={{
              marginTop: 12, padding: "10px 14px",
              background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 9,
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#15803d", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
                Documentación verificada
              </div>

              {(scrapeVerify.data.soatInsurer || scrapeVerify.data.soatStatus) && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem" }}>
                  <ShieldCheck size={15} color="#15803d" />
                  <strong>SOAT:</strong>
                  <span>{scrapeVerify.data.soatInsurer}</span>
                  {scrapeVerify.data.soatStatus && (
                    <span style={{
                      fontSize: "0.6875rem", fontWeight: 700, padding: "1px 8px", borderRadius: 9999,
                      background: scrapeVerify.data.soatStatus === "VIGENTE" ? "#DCFCE7" : scrapeVerify.data.soatStatus === "VENCIDO" ? "#FEE2E2" : "#FEF3C7",
                      color: scrapeVerify.data.soatStatus === "VIGENTE" ? "#15803D" : scrapeVerify.data.soatStatus === "VENCIDO" ? "#B91C1C" : "#92400E",
                    }}>
                      {scrapeVerify.data.soatStatus}
                    </span>
                  )}
                </div>
              )}
              {scrapeVerify.data.soatExpiry && (
                <div style={{ fontSize: "0.8125rem", color: "#52525b", marginLeft: 23 }}>
                  Vigencia: {scrapeVerify.data.soatExpiry}
                  {scrapeVerify.data.soatCertificate ? ` · Certificado: ${scrapeVerify.data.soatCertificate}` : ""}
                </div>
              )}

              {scrapeVerify.data.citvResult && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", marginTop: 2 }}>
                  <FileWarning size={15} color={scrapeVerify.data.citvResult === "APROBADO" ? "#15803d" : "#b91c1c"} />
                  <strong>CITV:</strong>
                  <span style={{
                    fontSize: "0.6875rem", fontWeight: 700, padding: "1px 8px", borderRadius: 9999,
                    background: scrapeVerify.data.citvResult === "APROBADO" ? "#DCFCE7" : "#FEE2E2",
                    color: scrapeVerify.data.citvResult === "APROBADO" ? "#15803D" : "#B91C1C",
                  }}>
                    {scrapeVerify.data.citvResult}
                  </span>
                </div>
              )}
              {scrapeVerify.data.citvLastDate && (
                <div style={{ fontSize: "0.8125rem", color: "#52525b", marginLeft: 23 }}>
                  Última inspección: {scrapeVerify.data.citvLastDate}
                  {scrapeVerify.data.citvNextDate ? ` · Próxima: ${scrapeVerify.data.citvNextDate}` : ""}
                  {scrapeVerify.data.citvCertificate ? ` · Certificado: ${scrapeVerify.data.citvCertificate}` : ""}
                </div>
              )}

              {scrapeVerify.errors.length > 0 && (
                <div style={{ marginTop: 4, fontSize: "0.75rem", color: "#92400E" }}>
                  {scrapeVerify.errors.map((e, i) => (
                    <div key={i}>⚠ {e}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {scrapeVerify.state === "error" && (
            <div style={{
              marginTop: 12, padding: "8px 12px",
              background: "#FFF5F5", border: "1.5px solid #FCA5A5", borderRadius: 9,
              fontSize: "0.75rem", color: "#b91c1c",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertTriangle size={14} />
              {scrapeVerify.message}
              <Button type="button" variant="outline" size="sm" onClick={handleVerifyPlate} style={{ marginLeft: "auto", fontSize: "0.75rem" }}>
                Reintentar
              </Button>
            </div>
          )}

          {/* ── SUNARP loading ── */}
          {sunarpState.state === "loading" && (
            <div style={{
              marginTop: 12, padding: "12px 16px",
              background: "#EEF2FF", border: "1.5px solid #A5B4FC", borderRadius: 9,
              fontSize: "0.8125rem", color: "#3730A3",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <Loader2 size={16} style={{ animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
              <span>
                Se abrió el navegador Chrome.{' '}
                <strong>Resuelve el CAPTCHA</strong> en la ventana del navegador y haz clic en Buscar.
                El sistema detectará los resultados automáticamente...
              </span>
            </div>
          )}

          {/* ── SUNARP error ── */}
          {sunarpState.state === "error" && (
            <div style={{
              marginTop: 12, padding: "10px 14px",
              background: "#FFF5F5", border: "1.5px solid #FCA5A5", borderRadius: 9,
              fontSize: "0.8125rem", color: "#b91c1c",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertTriangle size={14} />
              SUNARP: {sunarpState.message}
              <Button type="button" variant="outline" size="sm" onClick={handleVerifySunarp} style={{ marginLeft: "auto", fontSize: "0.75rem" }}>
                Reintentar
              </Button>
            </div>
          )}

          {/* ── BLOQUE REGISTRAL SUNARP ── */}
          {registralData && (
            <div style={{
              marginTop: 16,
              border: "2px solid #C4B5FD",
              borderRadius: 12,
              overflow: "hidden",
            }}>
              {/* Encabezado */}
              <div style={{
                background: "#F5F3FF",
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderBottom: "1px solid #DDD6FE",
              }}>
                <Building2 size={16} color="#6D28D9" />
                <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: "#6D28D9", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Datos registrales SUNARP
                </span>
                {sunarpState.state === "ok" && sunarpState.errors.length > 0 && (
                  <span style={{ fontSize: "0.6875rem", color: "#92400E", marginLeft: "auto" }}>
                    {sunarpState.errors.length} advertencia(s)
                  </span>
                )}
              </div>

              {/* Contenido */}
              <div style={{ padding: "16px 20px" }}>
                {/* Propietario — destacado */}
                {registralData.ownerName && (
                  <div style={{
                    background: "#FFFBEB",
                    border: "1px solid #FDE68A",
                    borderRadius: 8,
                    padding: "12px 16px",
                    marginBottom: 16,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <User size={16} color="#92400E" />
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Propietario registral
                      </span>
                    </div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1f2937", fontFamily: "var(--font-inter)" }}>
                      {registralData.ownerName}
                    </div>
                  </div>
                )}

                {/* Grid de datos del vehículo */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  gap: 12,
                  marginBottom: 12,
                }}>
                  {registralData.brand && (
                    <div>
                      <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>Marca</div>
                      <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#111827" }}>{registralData.brand}</div>
                    </div>
                  )}
                  {registralData.model && (
                    <div>
                      <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>Modelo</div>
                      <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#111827" }}>{registralData.model}</div>
                    </div>
                  )}
                  {(registralData.manufacturingYear || registralData.year) && (
                    <div>
                      <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>Año</div>
                      <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#111827" }}>
                        {registralData.manufacturingYear || registralData.year}
                      </div>
                    </div>
                  )}
                  {registralData.plate && (
                    <div>
                      <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>Placa vigente</div>
                      <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#111827", fontFamily: "ui-monospace,monospace" }}>
                        {registralData.plate}
                      </div>
                    </div>
                  )}
                </div>

                {/* Línea secundaria: estado + sede */}
                <div style={{ display: "flex", gap: 24, marginBottom: 12 }}>
                  {registralData.estado && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}>Estado:</span>
                      <span style={{
                        fontSize: "0.75rem", fontWeight: 600, padding: "1px 10px", borderRadius: 9999,
                        background: "#DCFCE7", color: "#15803D",
                      }}>
                        {registralData.estado}
                      </span>
                    </div>
                  )}
                  {registralData.sede && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}>Sede:</span>
                      <span style={{ fontSize: "0.75rem", color: "#374151" }}>{registralData.sede}</span>
                    </div>
                  )}
                </div>

                {/* Gravamenes */}
                {registralData.gravamenes !== undefined && (
                  <div style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: registralData.gravamenes.length > 0 ? "#FEF2F2" : "#F0FDF4",
                    border: `1px solid ${registralData.gravamenes.length > 0 ? "#FECACA" : "#86EFAC"}`,
                    marginBottom: 12,
                  }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: registralData.gravamenes.length > 0 ? "#991B1B" : "#15803D" }}>
                      {registralData.gravamenes.length > 0
                        ? `⚠ Gravamenes: ${registralData.gravamenes.slice(0, 3).join("; ")}${registralData.gravamenes.length > 3 ? ` y ${registralData.gravamenes.length - 3} más` : ""}`
                        : "✓ Sin gravamenes registrados"}
                    </div>
                  </div>
                )}

                {/* Titulares adicionales */}
                {registralData.titulares && registralData.titulares.length > 0 && (
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 12 }}>
                    Titulares registrados: {registralData.titulares.join(", ")}
                  </div>
                )}

                {/* Botón aplicar datos */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={applySunarpData}
                  disabled={
                    !registralData.ownerName &&
                    !registralData.brand &&
                    !registralData.model &&
                    !registralData.manufacturingYear &&
                    !registralData.year
                  }
                  style={{
                    borderColor: "#7c3aed",
                    color: "#7c3aed",
                    fontWeight: 600,
                  }}
                >
                  Usar estos datos en el formulario
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* ═══════════════════════════════════════════════════════
            CARD 2 — Datos del vehículo
            ═══════════════════════════════════════════════════════ */}
        <Card style={{ marginTop: 16 }}>
          <h3
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Datos del vehículo
          </h3>

          {/* ── Foto referencial del vehículo ── */}
          <div style={{ marginBottom: 20 }}>
            <PhotoUploader
              category="vehicle"
              value={form.photoUrl || null}
              onChange={(url) => handleChange("photoUrl", url ?? "")}
              aspect="wide"
              label="Foto referencial del vehículo"
              disabled={submitting}
            />
            {!form.photoUrl && !fieldErrors.photoUrl && (
              <p style={{ marginTop: 6, fontSize: "0.75rem", color: "#a1a1aa" }}>
                Sube al menos una foto lateral o frontal del vehículo. Esta imagen aparecerá
                en el escaneo ciudadano y en los reportes de fiscalización.
              </p>
            )}
            {fieldErrors.photoUrl && (
              <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>
                {fieldErrors.photoUrl}
              </p>
            )}
          </div>

          {/* ── Sección 1: Campos organizacionales (manual) ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: "0.6875rem", fontWeight: 700, color: "#6b7280",
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
            }}>
              Información operativa
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                maxWidth: 720,
              }}
            >
              {/* Tipo de servicio */}
              <div>
                <label htmlFor="vehicleTypeKey" style={{ display: "block", marginBottom: 8 }}>
                  Tipo de servicio <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <select
                  id="vehicleTypeKey"
                  className={`field${fieldErrors.vehicleTypeKey ? " field-error" : ""}`}
                  value={form.vehicleTypeKey}
                  onChange={(e) => handleChange("vehicleTypeKey", e.target.value)}
                  disabled={submitting || loadingData}
                >
                  <option value="">
                    {loadingData ? "Cargando tipos…" : "Seleccionar tipo de servicio…"}
                  </option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.key}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.vehicleTypeKey && (
                  <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>
                    {fieldErrors.vehicleTypeKey}
                  </p>
                )}
              </div>

              {/* Empresa de transporte */}
              <div>
                <label htmlFor="companyId" style={{ display: "block", marginBottom: 8 }}>
                  Empresa de transporte
                </label>
                {role && FIXED_COMPANY_ROLES.includes(role as Role) ? (
                  miEmpresaMissing ? (
                    <div
                      style={{
                        padding: "10px 14px",
                        background: "#FFFBEB",
                        border: "1.5px solid #FDE68A",
                        borderRadius: 9,
                        fontSize: "0.8125rem",
                        color: "#92400E",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                      }}
                    >
                      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>
                        Aún no tienes una empresa asignada. Pídele al administrador
                        municipal que te asigne una empresa antes de registrar
                        vehículos.
                      </span>
                    </div>
                  ) : (
                    <input
                      id="companyId"
                      type="text"
                      className="field"
                      value={loadingData ? "Cargando…" : (miEmpresa?.razonSocial ?? "")}
                      readOnly
                      disabled
                      title="Tu empresa asignada (no editable)"
                      style={{ background: "#f4f4f5", color: "#52525b", cursor: "not-allowed" }}
                    />
                  )
                ) : (
                  <select
                    id="companyId"
                    className="field"
                    value={form.companyId}
                    onChange={(e) => handleChange("companyId", e.target.value)}
                    disabled={submitting || loadingData}
                  >
                    <option value="">
                      {loadingData ? "Cargando empresas…" : "Sin empresa asignada"}
                    </option>
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.razonSocial}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Estado inicial */}
              <div>
                <label htmlFor="status" style={{ display: "block", marginBottom: 8 }}>
                  Estado inicial
                </label>
                <select
                  id="status"
                  className="field"
                  value={form.status}
                  onChange={(e) => handleChange("status", e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Seleccionar estado…</option>
                  <option value="disponible">Disponible</option>
                  <option value="en_ruta">En ruta</option>
                  <option value="en_mantenimiento">En mantenimiento</option>
                  <option value="fuera_de_servicio">Fuera de servicio</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Sección 2: Datos del vehículo (SUNARP + manual) ── */}
          <div style={{
            paddingTop: 16,
            borderTop: "1px solid #e4e4e7",
          }}>
            <div style={{
              fontSize: "0.6875rem", fontWeight: 700, color: "#6b7280",
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
            }}>
              Datos del vehículo
              {registralData && (
                <span style={{ fontWeight: 400, color: "#7c3aed", marginLeft: 8 }}>
                  — auto-llenado desde SUNARP
                </span>
              )}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                maxWidth: 720,
              }}
            >
              {/* Nombre del propietario */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="ownerName" style={{ display: "block", marginBottom: 8 }}>
                  Nombre del propietario
                </label>
                <input
                  id="ownerName"
                  type="text"
                  className="field"
                  value={form.ownerName}
                  onChange={(e) => handleChange("ownerName", e.target.value)}
                  placeholder="Auto-llenado desde SUNARP"
                  maxLength={200}
                  disabled={submitting}
                  style={{
                    background: form.ownerName && registralData?.ownerName && form.ownerName === registralData.ownerName
                      ? "#f0fdf4" : undefined,
                  }}
                />
              </div>

              {/* Marca */}
              <div>
                <label htmlFor="brand" style={{ display: "block", marginBottom: 8 }}>
                  Marca <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  id="brand"
                  type="text"
                  className={`field${fieldErrors.brand ? " field-error" : ""}`}
                  value={form.brand}
                  onChange={(e) => handleChange("brand", e.target.value)}
                  placeholder="Ej. Toyota"
                  maxLength={80}
                  disabled={submitting}
                  style={{
                    background: form.brand && registralData?.brand && form.brand === registralData.brand
                      ? "#f0fdf4" : undefined,
                  }}
                />
                {fieldErrors.brand && (
                  <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>
                    {fieldErrors.brand}
                  </p>
                )}
              </div>

              {/* Modelo */}
              <div>
                <label htmlFor="model" style={{ display: "block", marginBottom: 8 }}>
                  Modelo <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  id="model"
                  type="text"
                  className={`field${fieldErrors.model ? " field-error" : ""}`}
                  value={form.model}
                  onChange={(e) => handleChange("model", e.target.value)}
                  placeholder="Ej. Hiace"
                  maxLength={80}
                  disabled={submitting}
                  style={{
                    background: form.model && registralData?.model && form.model === registralData.model
                      ? "#f0fdf4" : undefined,
                  }}
                />
                {fieldErrors.model && (
                  <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>
                    {fieldErrors.model}
                  </p>
                )}
              </div>

              {/* Año */}
              <div>
                <label htmlFor="year" style={{ display: "block", marginBottom: 8 }}>
                  Año de fabricación <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  id="year"
                  type="number"
                  className={`field${fieldErrors.year ? " field-error" : ""}`}
                  value={form.year}
                  onChange={(e) => handleChange("year", e.target.value)}
                  placeholder={String(CURRENT_YEAR)}
                  min={1990}
                  max={CURRENT_YEAR + 1}
                  disabled={submitting}
                  style={{
                    background: registralData?.year && form.year === registralData.year
                      ? "#f0fdf4" : undefined,
                  }}
                />
                {fieldErrors.year && (
                  <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>
                    {fieldErrors.year}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* ═══════════════════════════════════════════════════════
            CARD 3 — Documentación (SOAT + CITV)
            ═══════════════════════════════════════════════════════ */}
        <Card style={{ marginTop: 16 }}>
          <h3
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Documentación
          </h3>

          {/* ── SOAT ── */}
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: "0.6875rem", fontWeight: 700, color: "#6b7280",
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
            }}>
              SOAT
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 16,
                maxWidth: 720,
              }}
            >
              <div>
                <label htmlFor="soatExpiry" style={{ display: "block", marginBottom: 8, fontSize: "0.8125rem", fontWeight: 600, color: "#52525b" }}>
                  Vencimiento
                  {soatDays != null && (
                    <span style={{ marginLeft: 6, fontSize: "0.6875rem", fontWeight: 500,
                      color: soatExpired ? "#DC2626" : soatWarn ? "#92400E" : "#6B7280" }}>
                      ({soatExpired ? `vencido hace ${Math.abs(soatDays)}d`
                        : soatDays === 0 ? "vence hoy"
                        : `en ${soatDays}d`})
                    </span>
                  )}
                </label>
                <input
                  id="soatExpiry"
                  type="date"
                  className="field"
                  value={form.soatExpiry}
                  onChange={(e) => handleChange("soatExpiry", e.target.value)}
                  disabled={submitting}
                  style={{
                    background: form.soatExpiry ? "#f0fdf4" : undefined,
                    borderColor: soatExpired ? "#DC2626" : soatWarn ? "#D97706" : undefined,
                  }}
                />
              </div>

              <div>
                <label htmlFor="soatInsurer" style={{ display: "block", marginBottom: 8, fontSize: "0.8125rem", fontWeight: 600, color: "#52525b" }}>
                  Aseguradora
                </label>
                <input
                  id="soatInsurer"
                  type="text"
                  className="field"
                  value={form.soatInsurer}
                  onChange={(e) => handleChange("soatInsurer", e.target.value)}
                  placeholder="Auto-llenado"
                  maxLength={120}
                  disabled={submitting}
                  style={{ background: form.soatInsurer ? "#f0fdf4" : undefined }}
                />
              </div>

              <div>
                <label htmlFor="soatCertificate" style={{ display: "block", marginBottom: 8, fontSize: "0.8125rem", fontWeight: 600, color: "#52525b" }}>
                  N° Certificado
                </label>
                <input
                  id="soatCertificate"
                  type="text"
                  className="field"
                  value={form.soatCertificate}
                  onChange={(e) => handleChange("soatCertificate", e.target.value)}
                  placeholder="Auto-llenado"
                  maxLength={60}
                  disabled={submitting}
                  style={{ background: form.soatCertificate ? "#f0fdf4" : undefined, fontFamily: "ui-monospace,monospace" }}
                />
              </div>
            </div>
          </div>

          {/* ── CITV ── */}
          <div style={{
            paddingTop: 16,
            borderTop: "1px solid #e4e4e7",
          }}>
            <div style={{
              fontSize: "0.6875rem", fontWeight: 700, color: "#6b7280",
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
            }}>
              CITV
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                maxWidth: 720,
              }}
            >
              <div>
                <label htmlFor="lastInspectionStatus" style={{ display: "block", marginBottom: 8, fontSize: "0.8125rem", fontWeight: 600, color: "#52525b" }}>
                  Estado
                </label>
                <select
                  id="lastInspectionStatus"
                  className="field"
                  value={form.lastInspectionStatus}
                  onChange={(e) => handleChange("lastInspectionStatus", e.target.value)}
                  disabled={submitting}
                  style={{ background: form.lastInspectionStatus ? "#f0fdf4" : undefined }}
                >
                  <option value="">Seleccionar estado…</option>
                  <option value="aprobada">Aprobada</option>
                  <option value="observada">Observada</option>
                  <option value="rechazada">Rechazada</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </div>

              <div>
                <label htmlFor="lastInspectionDate" style={{ display: "block", marginBottom: 8, fontSize: "0.8125rem", fontWeight: 600, color: "#52525b" }}>
                  Última inspección
                </label>
                <input
                  id="lastInspectionDate"
                  type="date"
                  className="field"
                  value={form.lastInspectionDate}
                  onChange={(e) => handleChange("lastInspectionDate", e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div>
                <label htmlFor="citvExpiryDate" style={{ display: "block", marginBottom: 8, fontSize: "0.8125rem", fontWeight: 600, color: "#52525b" }}>
                  Vencimiento
                  {citvDays != null && (
                    <span style={{ marginLeft: 6, fontSize: "0.6875rem", fontWeight: 500,
                      color: citvExpired ? "#DC2626" : citvWarn ? "#92400E" : "#6B7280" }}>
                      ({citvExpired ? `vencido hace ${Math.abs(citvDays)}d`
                        : citvDays === 0 ? "vence hoy"
                        : `en ${citvDays}d`})
                    </span>
                  )}
                </label>
                <input
                  id="citvExpiryDate"
                  type="date"
                  className="field"
                  value={form.citvExpiryDate}
                  onChange={(e) => handleChange("citvExpiryDate", e.target.value)}
                  disabled={submitting}
                  style={{
                    borderColor: citvExpired ? "#DC2626" : citvWarn ? "#D97706" : undefined,
                    background: form.citvExpiryDate ? "#f0fdf4" : undefined,
                  }}
                />
              </div>

              <div>
                <label htmlFor="lastInspectionCertificate" style={{ display: "block", marginBottom: 8, fontSize: "0.8125rem", fontWeight: 600, color: "#52525b" }}>
                  N° Certificado
                </label>
                <input
                  id="lastInspectionCertificate"
                  type="text"
                  className="field"
                  value={form.lastInspectionCertificate}
                  onChange={(e) => handleChange("lastInspectionCertificate", e.target.value)}
                  placeholder="Auto-llenado"
                  maxLength={60}
                  disabled={submitting}
                  style={{ background: form.lastInspectionCertificate ? "#f0fdf4" : undefined, fontFamily: "ui-monospace,monospace" }}
                />
              </div>
            </div>
          </div>

        </Card>

        {/* Error de servidor */}
        {serverError && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 8,
              backgroundColor: "#FFF5F5",
              border: "1px solid #FCA5A5",
              color: "#DC2626",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            {serverError}
          </div>
        )}

        {/* Acciones */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 24,
            alignItems: "center",
          }}
        >
          <Button type="submit" disabled={submitting}>
            {submitting ? "Registrando…" : "Registrar vehículo"}
          </Button>
          <Link href="/vehiculos">
            <Button type="button" variant="outline" disabled={submitting}>
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
