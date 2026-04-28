"use client";

import { use as usePromise, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";

// ─── paleta ───────────────────────────────────────────────────────────────────
const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const RIESGO = "#b45309"; const RIESGOBG = "#FFFBEB"; const RIESGOBD = "#FCD34D";
const NO = "#DC2626"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

const CURRENT_YEAR = new Date().getFullYear();

const VIEW_ROLES = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const EDIT_ROLES = ["admin_municipal", "super_admin"];

// ─── tipos ────────────────────────────────────────────────────────────────────
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

interface Props {
  params: Promise<{ id: string }>;
}

// ─── badge inspección ─────────────────────────────────────────────────────────
function inspectionStyle(s?: InspectionStatus) {
  if (s === "aprobada")  return { bg: APTOBG,  color: APTO,   border: APTOBD,  label: "APROBADA" };
  if (s === "observada") return { bg: RIESGOBG, color: RIESGO, border: RIESGOBD, label: "OBSERVADA" };
  if (s === "rechazada") return { bg: NOBG,     color: NO,     border: NOBD,    label: "RECHAZADA" };
  return { bg: INK1, color: INK5, border: INK2, label: "PENDIENTE" };
}

function InspectionBadge({ status }: { status?: InspectionStatus }) {
  const st = inspectionStyle(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: "0.6875rem",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: st.bg,
        color: st.color,
        border: `1px solid ${st.border}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "currentColor",
          display: "inline-block",
        }}
      />
      {st.label}
    </span>
  );
}

// ─── página ───────────────────────────────────────────────────────────────────
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
    plate: "",
    vehicleTypeKey: "",
    brand: "",
    model: "",
    year: "",
    companyId: "",
    status: "",
    soatExpiry: "",
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ─── auth + carga inicial ──────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");

    let user: { role?: string } = {};
    try {
      user = JSON.parse(raw);
    } catch {
      router.replace("/login");
      return;
    }

    if (!user.role || !VIEW_ROLES.includes(user.role)) {
      router.replace("/dashboard");
      return;
    }

    setCanEdit(EDIT_ROLES.includes(user.role ?? ""));
    void loadVehicle();
    void loadDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function loadVehicle() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/vehiculos/${id}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLoadError(data.error ?? "No se pudo cargar el vehículo.");
        return;
      }
      const v: Vehicle = data.data;
      setVehicle(v);
      setForm({
        plate: v.plate,
        vehicleTypeKey: v.vehicleTypeKey,
        brand: v.brand,
        model: v.model,
        year: String(v.year),
        companyId: v.companyId ?? "",
        status: v.status,
        soatExpiry: v.soatExpiry ? v.soatExpiry.split("T")[0] : "",
      });
    } catch {
      setLoadError("Error de conexión.");
    } finally {
      setLoading(false);
    }
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
      setTipos(allTipos.filter((t) => t.active));
    } catch {
      // silent — formulario funciona aunque fallen los dropdowns
    }
  }

  // ─── validación ───────────────────────────────────────────────────────────
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
      next.vehicleTypeKey = "El tipo de vehículo es requerido.";
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

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  // ─── guardar cambios (PUT) ────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSaveSuccess(false);

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
    if (form.soatExpiry) payload.soatExpiry = form.soatExpiry;

    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/vehiculos/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
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
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setServerError("Error de conexión. Intente nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── eliminar (DELETE) ────────────────────────────────────────────────────
  async function handleDelete() {
    if (!vehicle) return;
    if (
      !window.confirm(
        `¿Eliminar el vehículo con placa "${vehicle.plate}"? Esta acción no se puede deshacer.`
      )
    )
      return;

    setDeleting(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/vehiculos/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        window.alert(data.error ?? "No se pudo eliminar el vehículo.");
        return;
      }
      router.push("/vehiculos");
    } catch {
      window.alert("Error de conexión.");
    } finally {
      setDeleting(false);
    }
  }

  function handleChange(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  // ─── estados de render ────────────────────────────────────────────────────
  if (notFound) {
    return (
      <Card>
        <h3 style={{ fontFamily: "var(--font-inter)", fontWeight: 700 }}>Vehículo no encontrado</h3>
        <p style={{ color: INK5, marginTop: 8, fontSize: "0.9375rem" }}>
          El vehículo que buscas no existe o fue eliminado.
        </p>
        <div style={{ marginTop: 16 }}>
          <Link href="/vehiculos">
            <Button variant="outline">
              <ArrowLeft size={16} strokeWidth={1.8} />
              Volver a vehículos
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (loading || !vehicle) {
    return (
      <Card>
        <div style={{ color: INK5 }}>Cargando vehículo…</div>
      </Card>
    );
  }

  const repColor =
    vehicle.reputationScore >= 80 ? APTO : vehicle.reputationScore >= 50 ? RIESGO : NO;
  const tipoNombre =
    tipos.find((t) => t.key === vehicle.vehicleTypeKey)?.name ?? vehicle.vehicleTypeKey;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <PageHeader
        kicker="Vehículos · RF-06"
        title={vehicle.plate}
        subtitle={`${vehicle.brand} ${vehicle.model} · ${vehicle.year} · ${tipoNombre}`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/vehiculos">
              <Button variant="outline">
                <ArrowLeft size={16} strokeWidth={1.8} />
                Volver
              </Button>
            </Link>
            {canEdit && (
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Eliminar
              </Button>
            )}
          </div>
        }
      />

      {/* ─── Info de solo lectura ─────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 14,
          margin: "24px 0 20px",
        }}
      >
        {/* Última inspección */}
        <div
          style={{
            background: "#fff",
            border: `1px solid ${INK2}`,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: INK5,
              marginBottom: 10,
            }}
          >
            Última inspección
          </div>
          <InspectionBadge status={vehicle.lastInspectionStatus} />
        </div>

        {/* Reputación */}
        <div
          style={{
            background: "#fff",
            border: `1px solid ${INK2}`,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: INK5,
              marginBottom: 10,
            }}
          >
            Reputación
          </div>
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}
          >
            <span style={{ fontSize: "1.25rem", fontWeight: 800, color: repColor }}>
              {vehicle.reputationScore}
              <span style={{ fontSize: "0.75rem", fontWeight: 500, color: INK5 }}>/100</span>
            </span>
          </div>
          <div style={{ height: 6, background: INK2, borderRadius: 999, overflow: "hidden" }}>
            <span
              style={{
                display: "block",
                height: "100%",
                borderRadius: 999,
                background: repColor,
                width: `${vehicle.reputationScore}%`,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>

        {/* Conductor actual */}
        <div
          style={{
            background: "#fff",
            border: `1px solid ${INK2}`,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: INK5,
              marginBottom: 10,
            }}
          >
            Conductor actual
          </div>
          <div
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: vehicle.currentDriverName ? INK9 : INK5,
            }}
          >
            {vehicle.currentDriverName ?? "Sin conductor asignado"}
          </div>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          style={{
            background: NOBG,
            border: `1.5px solid ${NOBD}`,
            borderRadius: 12,
            padding: 16,
            color: NO,
            fontSize: "0.9375rem",
            fontWeight: 500,
            marginBottom: 16,
          }}
        >
          {loadError}
        </div>
      )}

      {/* ─── Formulario ───────────────────────────────────────────────────── */}
      <form onSubmit={handleSave} noValidate>
        {/* Identificación */}
        <Card>
          <h3
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Identificación del vehículo
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              maxWidth: 720,
            }}
          >
            {/* Placa */}
            <div>
              <label htmlFor="plate" style={{ display: "block", marginBottom: 8 }}>
                Placa <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                id="plate"
                type="text"
                className={`field${fieldErrors.plate ? " field-error" : ""}`}
                value={form.plate}
                onChange={(e) => handleChange("plate", e.target.value.toUpperCase())}
                placeholder="ABC-123"
                maxLength={10}
                disabled={submitting || !canEdit}
                style={{ fontFamily: "ui-monospace,monospace", letterSpacing: "0.05em" }}
              />
              {fieldErrors.plate && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>
                  {fieldErrors.plate}
                </p>
              )}
            </div>

            {/* Tipo de vehículo */}
            <div>
              <label htmlFor="vehicleTypeKey" style={{ display: "block", marginBottom: 8 }}>
                Tipo de vehículo <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <select
                id="vehicleTypeKey"
                className={`field${fieldErrors.vehicleTypeKey ? " field-error" : ""}`}
                value={form.vehicleTypeKey}
                onChange={(e) => handleChange("vehicleTypeKey", e.target.value)}
                disabled={submitting || !canEdit}
              >
                <option value="">Seleccionar tipo…</option>
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
          </div>
        </Card>

        {/* Datos del vehículo */}
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              maxWidth: 720,
            }}
          >
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
                disabled={submitting || !canEdit}
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
                disabled={submitting || !canEdit}
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
                disabled={submitting || !canEdit}
              />
              {fieldErrors.year && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>
                  {fieldErrors.year}
                </p>
              )}
            </div>

            {/* Estado */}
            <div>
              <label htmlFor="status" style={{ display: "block", marginBottom: 8 }}>
                Estado
              </label>
              <select
                id="status"
                className="field"
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                disabled={submitting || !canEdit}
              >
                <option value="">Seleccionar estado…</option>
                <option value="disponible">Disponible</option>
                <option value="en_ruta">En ruta</option>
                <option value="en_mantenimiento">En mantenimiento</option>
                <option value="fuera_de_servicio">Fuera de servicio</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Empresa y SOAT */}
        <Card style={{ marginTop: 16 }}>
          <h3
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Empresa y documentación
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              maxWidth: 720,
            }}
          >
            {/* Empresa */}
            <div>
              <label htmlFor="companyId" style={{ display: "block", marginBottom: 8 }}>
                Empresa de transporte
              </label>
              <select
                id="companyId"
                className="field"
                value={form.companyId}
                onChange={(e) => handleChange("companyId", e.target.value)}
                disabled={submitting || !canEdit}
              >
                <option value="">Sin empresa asignada</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.razonSocial}
                  </option>
                ))}
              </select>
            </div>

            {/* SOAT */}
            <div>
              <label htmlFor="soatExpiry" style={{ display: "block", marginBottom: 8 }}>
                Vencimiento SOAT
              </label>
              <input
                id="soatExpiry"
                type="date"
                className="field"
                value={form.soatExpiry}
                onChange={(e) => handleChange("soatExpiry", e.target.value)}
                disabled={submitting || !canEdit}
              />
            </div>
          </div>
        </Card>

        {/* Meta info */}
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            background: INK1,
            borderRadius: 10,
            fontSize: "0.8125rem",
            color: INK5,
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <span>
            <strong style={{ color: INK6 }}>Empresa:</strong>{" "}
            {vehicle.companyName ?? "Sin empresa"}
          </span>
          <span>
            <strong style={{ color: INK6 }}>Registrado:</strong>{" "}
            {new Date(vehicle.createdAt).toLocaleDateString("es-PE", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span>
            <strong style={{ color: INK6 }}>Estado:</strong>{" "}
            {vehicle.active ? "Activo" : "Inactivo"}
          </span>
        </div>

        {/* Feedback mensajes */}
        {serverError && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 8,
              backgroundColor: NOBG,
              border: `1px solid ${NOBD}`,
              color: NO,
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            {serverError}
          </div>
        )}

        {saveSuccess && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 8,
              backgroundColor: APTOBG,
              border: `1px solid ${APTOBD}`,
              color: APTO,
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Vehículo actualizado correctamente.
          </div>
        )}

        {/* Botones de acción */}
        {canEdit ? (
          <div style={{ display: "flex", gap: 12, marginTop: 24, alignItems: "center" }}>
            <Button type="submit" disabled={submitting || deleting}>
              {submitting ? "Guardando…" : "Guardar cambios"}
            </Button>
            <Link href="/vehiculos">
              <Button type="button" variant="outline" disabled={submitting || deleting}>
                Cancelar
              </Button>
            </Link>
          </div>
        ) : (
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              borderRadius: 8,
              background: INK1,
              color: INK5,
              fontSize: "0.8125rem",
              border: `1px solid ${INK2}`,
            }}
          >
            Solo administradores municipales y super administradores pueden editar o eliminar vehículos.
          </div>
        )}
      </form>
    </div>
  );
}
