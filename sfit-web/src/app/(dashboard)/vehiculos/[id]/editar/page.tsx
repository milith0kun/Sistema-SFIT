"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";

// ─── paleta del proyecto ──────────────────────────────────────────────────────
const G = "#6C0606"; const GBG = "#FBEAEA"; const GBR = "#D9B0B0";
const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const NO = "#DC2626"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

// ─── tipos ───────────────────────────────────────────────────────────────────
type VehicleStatus = "disponible" | "en_ruta" | "en_mantenimiento" | "fuera_de_servicio";

type VehicleDetail = {
  id: string;
  plate: string;
  vehicleTypeKey: string;
  brand: string;
  model: string;
  year: number;
  status: VehicleStatus;
  companyId?: string;
  companyName?: string;
};

type FormState = {
  brand: string;
  model: string;
  year: string;
  status: VehicleStatus;
  companyId: string;
};

type Empresa = { id: string; razonSocial: string };

const VEHICLE_STATUSES: { value: VehicleStatus; label: string }[] = [
  { value: "disponible",        label: "Disponible" },
  { value: "en_ruta",           label: "En ruta" },
  { value: "en_mantenimiento",  label: "En mantenimiento" },
  { value: "fuera_de_servicio", label: "Fuera de servicio" },
];

const ALLOWED = ["admin_municipal", "super_admin", "operador"];

const fieldStyle: React.CSSProperties = {
  width: "100%",
  height: 42,
  padding: "0 14px",
  borderRadius: 10,
  border: `1.5px solid ${INK2}`,
  fontSize: "0.9375rem",
  fontFamily: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif",
  color: INK9,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

// ─── página ───────────────────────────────────────────────────────────────────
interface Props { params: Promise<{ id: string }> }

export default function VehiculoEditarPage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [form, setForm] = useState<FormState>({
    brand: "", model: "", year: "", status: "disponible", companyId: "",
  });
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    void loadVehicle();
    void loadEmpresas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function loadEmpresas() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/empresas?limit=200", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      const data = await res.json();
      setEmpresas(data?.data?.items ?? []);
    } catch { setEmpresas([]); }
  }

  async function loadVehicle() {
    setLoading(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/vehiculos/${id}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar vehículo"); return; }
      const v: VehicleDetail = data.data;
      setVehicle(v);
      setForm({
        brand: v.brand,
        model: v.model,
        year: String(v.year),
        status: v.status,
        companyId: v.companyId ?? "",
      });
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const yearNum = parseInt(form.year, 10);
    if (isNaN(yearNum) || yearNum < 1990 || yearNum > new Date().getFullYear() + 1) {
      setError("El año debe ser un número válido (desde 1990).");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const body: Record<string, unknown> = {
        brand: form.brand.trim(),
        model: form.model.trim(),
        year: yearNum,
        status: form.status,
      };
      if (form.companyId.trim()) body.companyId = form.companyId.trim();

      const res = await fetch(`/api/vehiculos/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) {
        const fieldErrors = data.errors as Record<string, string[]> | undefined;
        if (fieldErrors) {
          setError(Object.values(fieldErrors).flat().join(". "));
        } else {
          setError(data.error ?? "No se pudo guardar los cambios.");
        }
        return;
      }
      setSuccess("Vehículo actualizado correctamente.");
      setTimeout(() => router.push(`/vehiculos/${id}`), 1200);
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  function field(key: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // ─── estados de carga / error ─────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader kicker="Vehículos" title="Vehículo no encontrado"
          action={<Link href="/vehiculos"><Button variant="outline" size="md"><ArrowLeft size={16} strokeWidth={1.8} />Volver</Button></Link>} />
        <Card><p style={{ color: INK5 }}>No existe un vehículo con el ID indicado.</p></Card>
      </div>
    );
  }

  if (loading || !vehicle) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader kicker="Vehículos · Editar" title="Cargando…" />
        <Card><p style={{ color: INK5 }}>Cargando datos del vehículo…</p></Card>
      </div>
    );
  }

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Vehículos · Editar"
        title={`${vehicle.brand} ${vehicle.model}`}
        subtitle={`Placa ${vehicle.plate} · Modificar datos del vehículo`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={`/vehiculos/${id}`}>
              <Button variant="outline" size="md">
                <ArrowLeft size={16} strokeWidth={1.8} />
                Cancelar
              </Button>
            </Link>
          </div>
        }
      />

      {/* placa no editable */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 8, background: GBG, border: `1.5px solid ${GBR}`, fontSize: "0.8125rem", color: G, fontWeight: 600 }}>
        Placa: <span style={{ fontFamily: "ui-monospace,monospace", letterSpacing: "0.07em", fontWeight: 700, color: INK9 }}>{vehicle.plate}</span>
        <span style={{ fontSize: "0.75rem", color: INK5, fontWeight: 400 }}>(no editable)</span>
      </div>

      {error && (
        <div role="alert" style={{ background: NOBG, border: `1.5px solid ${NOBD}`, borderRadius: 12, padding: 16, color: NO, fontSize: "0.9375rem", fontWeight: 500 }}>
          {error}
        </div>
      )}
      {success && (
        <div role="status" style={{ background: APTOBG, border: `1.5px solid ${APTOBD}`, borderRadius: 12, padding: 16, color: APTO, fontSize: "0.9375rem", fontWeight: 500 }}>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, color: INK9, margin: "0 0 20px" }}>
            Datos del vehículo
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            {/* Marca */}
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Marca <span style={{ color: NO }}>*</span>
              </span>
              <input
                style={fieldStyle}
                value={form.brand}
                onChange={e => field("brand", e.target.value)}
                placeholder="Ej. Toyota"
                required
                maxLength={80}
              />
            </label>

            {/* Modelo */}
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Modelo <span style={{ color: NO }}>*</span>
              </span>
              <input
                style={fieldStyle}
                value={form.model}
                onChange={e => field("model", e.target.value)}
                placeholder="Ej. Hilux"
                required
                maxLength={80}
              />
            </label>

            {/* Año */}
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Año <span style={{ color: NO }}>*</span>
              </span>
              <input
                style={fieldStyle}
                type="number"
                min={1990}
                max={new Date().getFullYear() + 1}
                value={form.year}
                onChange={e => field("year", e.target.value)}
                required
              />
            </label>

            {/* Estado */}
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Estado operativo <span style={{ color: NO }}>*</span>
              </span>
              <select
                style={{ ...fieldStyle, appearance: "none", cursor: "pointer" }}
                value={form.status}
                onChange={e => field("status", e.target.value as VehicleStatus)}
                required
              >
                {VEHICLE_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>

            {/* Empresa */}
            <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "span 2" }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Empresa de transporte
                <span style={{ fontSize: "0.75rem", fontWeight: 400, color: INK5, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>(opcional)</span>
              </span>
              <select
                style={{ ...fieldStyle, appearance: "none", cursor: "pointer", maxWidth: "100%" }}
                value={form.companyId}
                onChange={e => field("companyId", e.target.value)}
              >
                <option value="">Sin empresa asignada</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.razonSocial}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Divisor */}
          <div style={{ height: 1, background: INK1, margin: "24px 0" }} />

          {/* Acciones */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Link href={`/vehiculos/${id}`}>
              <Button type="button" variant="outline" size="md" style={{ minWidth: 120 }}>
                Cancelar
              </Button>
            </Link>
            <Button type="submit" variant="primary" size="md" loading={saving} style={{ minWidth: 160 }}>
              <Save size={16} />
              Guardar cambios
            </Button>
          </div>
        </Card>
      </form>

      {/* nota informativa */}
      <div style={{ padding: "14px 18px", borderRadius: 12, background: INK1, border: `1px solid ${INK2}`, fontSize: "0.8125rem", color: INK5 }}>
        Los campos <strong style={{ color: INK6 }}>placa</strong> y <strong style={{ color: INK6 }}>tipo de vehículo</strong> no se modifican desde este formulario.
        Para cambiarlos contacta al administrador del sistema.
      </div>
    </div>
  );
}
