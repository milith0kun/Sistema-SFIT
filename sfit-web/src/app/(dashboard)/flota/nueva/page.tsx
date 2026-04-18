"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";

const CREATE_ROLES = ["admin_municipal", "operador", "super_admin"];

interface Vehiculo {
  id: string;
  plate: string;
  vehicleTypeKey?: string;
  brand?: string;
  model?: string;
  status?: string;
}

interface Conductor {
  id: string;
  name: string;
  licenseNumber?: string;
  status?: string;
}

interface Ruta {
  id: string;
  code: string;
  name: string;
  status?: string;
}

interface FormData {
  date: string;
  vehicleId: string;
  driverId: string;
  routeId: string;
  departureTime: string;
  observations: string;
  checklistComplete: boolean;
}

interface FieldErrors {
  vehicleId?: string;
  driverId?: string;
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function NuevaFlotaPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  const [form, setForm] = useState<FormData>({
    date: todayISO(),
    vehicleId: "",
    driverId: "",
    routeId: "",
    departureTime: "",
    observations: "",
    checklistComplete: false,
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Auth
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
      router.replace("/flota");
      return;
    }

    setAuthorized(true);
    setToken(tk);
  }, [router]);

  // Load dropdowns en paralelo
  useEffect(() => {
    if (!authorized || !token) return;

    setLoadingDropdowns(true);

    Promise.all([
      fetch("/api/vehiculos?limit=100", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/conductores?limit=100", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/rutas?limit=100", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([vBody, cBody, rBody]) => {
        setVehiculos(vBody?.data?.items ?? []);
        setConductores(cBody?.data?.items ?? []);
        setRutas(rBody?.data?.items ?? []);
      })
      .catch(() => {
        setVehiculos([]);
        setConductores([]);
        setRutas([]);
      })
      .finally(() => setLoadingDropdowns(false));
  }, [authorized, token]);

  function validate(): boolean {
    const next: FieldErrors = {};

    if (!form.vehicleId) {
      next.vehicleId = "Debe seleccionar un vehículo.";
    }
    if (!form.driverId) {
      next.driverId = "Debe seleccionar un conductor.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setSubmitting(true);

    const payload: Record<string, unknown> = {
      vehicleId: form.vehicleId,
      driverId: form.driverId,
      date: form.date,
      checklistComplete: form.checklistComplete,
    };
    if (form.routeId) payload.routeId = form.routeId;
    if (form.departureTime) payload.departureTime = form.departureTime;
    if (form.observations.trim()) payload.observations = form.observations.trim();

    try {
      const res = await fetch("/api/flota", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push("/flota");
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

  function handleField<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "vehicleId" && errors.vehicleId) {
      setErrors((prev) => ({ ...prev, vehicleId: undefined }));
    }
    if (field === "driverId" && errors.driverId) {
      setErrors((prev) => ({ ...prev, driverId: undefined }));
    }
  }

  if (!authorized) return null;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <PageHeader
        kicker="Flota"
        title="Nueva asignación"
        subtitle="Registra la asignación diaria de vehículo y conductor."
      />

      <form onSubmit={handleSubmit} noValidate>
        {/* Datos principales */}
        <Card>
          <h3
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Datos de la asignación
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              maxWidth: 720,
            }}
          >
            {/* Fecha */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="date" style={{ display: "block", marginBottom: 8 }}>
                Fecha <span style={{ color: "#b91c1c" }}>*</span>
              </label>
              <input
                id="date"
                type="date"
                className="field"
                value={form.date}
                onChange={(e) => handleField("date", e.target.value)}
                disabled={submitting}
                style={{ maxWidth: 200 }}
              />
            </div>

            {/* Vehículo */}
            <div>
              <label htmlFor="vehicleId" style={{ display: "block", marginBottom: 8 }}>
                Vehículo <span style={{ color: "#b91c1c" }}>*</span>
              </label>
              <select
                id="vehicleId"
                className={`field${errors.vehicleId ? " field-error" : ""}`}
                value={form.vehicleId}
                onChange={(e) => handleField("vehicleId", e.target.value)}
                disabled={submitting || loadingDropdowns}
              >
                <option value="">
                  {loadingDropdowns ? "Cargando…" : "— Seleccionar —"}
                </option>
                {vehiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                    {v.brand || v.model ? ` · ${[v.brand, v.model].filter(Boolean).join(" ")}` : ""}
                  </option>
                ))}
              </select>
              {errors.vehicleId && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#b91c1c", fontWeight: 500 }}>
                  {errors.vehicleId}
                </p>
              )}
            </div>

            {/* Conductor */}
            <div>
              <label htmlFor="driverId" style={{ display: "block", marginBottom: 8 }}>
                Conductor <span style={{ color: "#b91c1c" }}>*</span>
              </label>
              <select
                id="driverId"
                className={`field${errors.driverId ? " field-error" : ""}`}
                value={form.driverId}
                onChange={(e) => handleField("driverId", e.target.value)}
                disabled={submitting || loadingDropdowns}
              >
                <option value="">
                  {loadingDropdowns ? "Cargando…" : "— Seleccionar —"}
                </option>
                {conductores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.licenseNumber ? ` · ${c.licenseNumber}` : ""}
                    {c.status ? ` · ${c.status}` : ""}
                  </option>
                ))}
              </select>
              {errors.driverId && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#b91c1c", fontWeight: 500 }}>
                  {errors.driverId}
                </p>
              )}
            </div>

            {/* Ruta (opcional) */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="routeId" style={{ display: "block", marginBottom: 8 }}>
                Ruta <span style={{ color: "#71717a", fontSize: "0.8125rem", fontWeight: 400 }}>(opcional)</span>
              </label>
              <select
                id="routeId"
                className="field"
                value={form.routeId}
                onChange={(e) => handleField("routeId", e.target.value)}
                disabled={submitting || loadingDropdowns}
                style={{ maxWidth: 400 }}
              >
                <option value="">
                  {loadingDropdowns ? "Cargando…" : "— Sin ruta asignada —"}
                </option>
                {rutas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} - {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Horario y checklist */}
        <Card style={{ marginTop: 16 }}>
          <h3
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Horario y checklist
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              maxWidth: 720,
            }}
          >
            {/* Hora de salida */}
            <div>
              <label htmlFor="departureTime" style={{ display: "block", marginBottom: 8 }}>
                Hora de salida{" "}
                <span style={{ color: "#71717a", fontSize: "0.8125rem", fontWeight: 400 }}>(opcional)</span>
              </label>
              <input
                id="departureTime"
                type="time"
                className="field"
                value={form.departureTime}
                onChange={(e) => handleField("departureTime", e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* Checklist */}
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
              <label
                htmlFor="checklistComplete"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: submitting ? "not-allowed" : "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  id="checklistComplete"
                  type="checkbox"
                  checked={form.checklistComplete}
                  onChange={(e) => handleField("checklistComplete", e.target.checked)}
                  disabled={submitting}
                  style={{ width: 18, height: 18, accentColor: "#B8860B", cursor: "inherit" }}
                />
                <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "#18181b" }}>
                  Checklist pre-viaje completo
                </span>
              </label>
            </div>

            {/* Observaciones */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="observations" style={{ display: "block", marginBottom: 8 }}>
                Observaciones{" "}
                <span style={{ color: "#71717a", fontSize: "0.8125rem", fontWeight: 400 }}>(opcional)</span>
              </label>
              <textarea
                id="observations"
                className="field"
                value={form.observations}
                onChange={(e) => handleField("observations", e.target.value)}
                placeholder="Notas adicionales sobre la asignación…"
                rows={3}
                disabled={submitting}
                style={{ resize: "vertical", minHeight: 80 }}
              />
            </div>
          </div>
        </Card>

        {/* Error servidor */}
        {serverError && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 8,
              backgroundColor: "#FFF5F5",
              border: "1px solid #FCA5A5",
              color: "#b91c1c",
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
          <Button type="submit" disabled={submitting || loadingDropdowns}>
            {submitting ? "Registrando…" : "Registrar asignación"}
          </Button>
          <Link href="/flota">
            <Button type="button" variant="outline" disabled={submitting}>
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
