"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";

const CREATE_ROLES = ["admin_municipal", "operador", "super_admin"];

const CURRENT_YEAR = new Date().getFullYear();

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

export default function NuevoVehiculoPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [tipos, setTipos] = useState<TipoVehiculo[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [form, setForm] = useState<FormData>({
    plate: "",
    vehicleTypeKey: "",
    brand: "",
    model: "",
    year: String(CURRENT_YEAR),
    companyId: "",
    status: "",
    soatExpiry: "",
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

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

    if (!user.role || !CREATE_ROLES.includes(user.role)) {
      router.replace("/vehiculos");
      return;
    }

    setAuthorized(true);
    setToken(tk);
  }, [router]);

  useEffect(() => {
    if (!authorized || !token) return;

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch("/api/empresas?limit=100", { headers }).then((r) => r.json()),
      fetch("/api/tipos-vehiculo?limit=100", { headers }).then((r) => r.json()),
    ])
      .then(([empBody, tiposBody]) => {
        setEmpresas(empBody?.data?.items ?? []);
        const allTipos: TipoVehiculo[] = tiposBody?.data?.items ?? [];
        setTipos(allTipos.filter((t) => t.active));
      })
      .catch(() => {
        setEmpresas([]);
        setTipos([]);
      })
      .finally(() => setLoadingData(false));
  }, [authorized, token]);

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
    if (form.companyId) payload.companyId = form.companyId;
    if (form.status) payload.status = form.status;
    if (form.soatExpiry) payload.soatExpiry = form.soatExpiry;

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

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <PageHeader
        title="Nuevo vehículo"
        subtitle="Registra una nueva unidad en el sistema SFIT."
        kicker="Vehículos · RF-06"
      />

      <form onSubmit={handleSubmit} noValidate>
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
                disabled={submitting}
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
                disabled={submitting || loadingData}
              >
                <option value="">
                  {loadingData ? "Cargando tipos…" : "Seleccionar tipo…"}
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
                disabled={submitting}
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
                disabled={submitting}
              />
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
