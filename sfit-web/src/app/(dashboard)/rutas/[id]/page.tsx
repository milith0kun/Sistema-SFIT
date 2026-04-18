"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

type RouteType = "ruta" | "zona";
type RouteStatus = "activa" | "suspendida";

type Route = {
  id: string;
  code: string;
  name: string;
  type: RouteType;
  companyId?: string;
  companyName?: string;
  vehicleTypeKey?: string;
  stops?: number;
  length?: string;
  vehicleCount: number;
  status: RouteStatus;
  frequencies?: string[];
};

type Company = { id: string; razonSocial: string };
type VehicleType = { id: string; key: string; name: string; active: boolean };
type StoredUser = { role: string };

interface Props {
  params: Promise<{ id: string }>;
}

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const CAN_EDIT = ["admin_municipal", "super_admin"];

const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const NO = "#b91c1c"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const INK2 = "#e4e4e7"; const INK5 = "#71717a";

export default function RutaDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [route, setRoute] = useState<Route | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notFound, setNotFound] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!ALLOWED.includes(u.role)) {
      router.replace("/dashboard");
      return;
    }
    setUser(u);
    void loadRoute();
    void loadCompanies();
    void loadVehicleTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function loadRoute() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/rutas/${id}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo cargar la ruta.");
        return;
      }
      setRoute(data.data);
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCompanies() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/empresas?limit=100", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setCompanies(data.data.items ?? []);
    } catch {
      // silent
    }
  }

  async function loadVehicleTypes() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/tipos-vehiculo?limit=100", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setVehicleTypes((data.data.items ?? []).filter((t: VehicleType) => t.active));
    } catch {
      // silent
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const code = (form.get("code") as string)?.trim();
    const name = (form.get("name") as string)?.trim();
    const type = (form.get("type") as string) || "ruta";
    const companyId = (form.get("companyId") as string)?.trim() || undefined;
    const vehicleTypeKey = (form.get("vehicleTypeKey") as string)?.trim() || undefined;
    const stopsRaw = (form.get("stops") as string)?.trim();
    const stops = stopsRaw ? Number(stopsRaw) : undefined;
    const length = (form.get("length") as string)?.trim() || undefined;
    const status = (form.get("status") as string) || "activa";
    const frequenciesRaw = (form.get("frequencies") as string)?.trim();
    const frequencies = frequenciesRaw
      ? frequenciesRaw.split(",").map((f) => f.trim()).filter(Boolean)
      : undefined;

    const localErrors: Record<string, string> = {};
    if (!code) localErrors.code = "El código es obligatorio.";
    if (!name) localErrors.name = "El nombre es obligatorio.";

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = { code, name, type, status };
    if (companyId) payload.companyId = companyId;
    if (vehicleTypeKey) payload.vehicleTypeKey = vehicleTypeKey;
    if (stops != null && !isNaN(stops)) payload.stops = stops;
    if (length) payload.length = length;
    if (frequencies && frequencies.length > 0) payload.frequencies = frequencies;

    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/rutas/${id}`, {
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
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) mapped[k] = (v as string[])[0];
          setFieldErrors(mapped);
        } else {
          setError(data.error ?? "No se pudo guardar los cambios.");
        }
        return;
      }
      setRoute(data.data);
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!route) return;
    const confirmed = window.confirm(
      `¿Eliminar la ruta "${route.code} · ${route.name}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/rutas/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        window.alert(data.error ?? "No se pudo eliminar la ruta.");
        return;
      }
      router.push("/rutas");
    } catch {
      window.alert("Error de conexión.");
    } finally {
      setDeleting(false);
    }
  }

  if (notFound) {
    return (
      <Card>
        <h3 style={{ fontFamily: "var(--font-inter)", fontWeight: 700, marginBottom: 16 }}>
          Ruta no encontrada
        </h3>
        <Link href="/rutas">
          <Button variant="outline">
            <ArrowLeft size={16} strokeWidth={1.8} />
            Volver
          </Button>
        </Link>
      </Card>
    );
  }

  if (loading || !route) {
    return (
      <Card>
        <div style={{ color: INK5 }}>Cargando…</div>
      </Card>
    );
  }

  const canEdit = CAN_EDIT.includes(user?.role ?? "");
  const statusColor = route.status === "activa"
    ? { color: APTO, bg: APTOBG, border: APTOBD }
    : { color: NO, bg: NOBG, border: NOBD };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Rutas · RF-09"
        title={`${route.code} · ${route.name}`}
        subtitle={route.type === "ruta" ? "Ruta fija de transporte público" : "Zona de operación"}
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/rutas">
              <Button variant="outline">
                <ArrowLeft size={16} strokeWidth={1.8} />
                Volver
              </Button>
            </Link>
            {canEdit && (
              <Button
                variant="danger"
                loading={deleting}
                onClick={handleDelete}
              >
                <Trash2 size={15} strokeWidth={1.8} />
                Eliminar
              </Button>
            )}
          </div>
        }
      />

      {/* Status badge */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 999,
            fontSize: "0.8125rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            background: statusColor.bg,
            color: statusColor.color,
            border: `1.5px solid ${statusColor.border}`,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "currentColor",
              display: "inline-block",
            }}
          />
          {route.status === "activa" ? "ACTIVA" : "SUSPENDIDA"}
        </span>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: 999,
            fontSize: "0.8125rem",
            fontWeight: 600,
            background: "#f4f4f5",
            color: "#52525b",
            border: `1px solid ${INK2}`,
          }}
        >
          {route.vehicleCount} vehículo{route.vehicleCount !== 1 ? "s" : ""}
        </span>
      </div>

      {error && (
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
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
            Identificación
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 720 }}>
            <div>
              <label htmlFor="code" style={{ display: "block", marginBottom: 8 }}>
                Código de ruta
              </label>
              <input
                id="code"
                name="code"
                className={`field${fieldErrors.code ? " field-error" : ""}`}
                placeholder="R001"
                defaultValue={route.code}
                disabled={!canEdit}
              />
              {fieldErrors.code && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: NO, fontWeight: 500 }}>
                  {fieldErrors.code}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="type" style={{ display: "block", marginBottom: 8 }}>
                Tipo
              </label>
              <select id="type" name="type" className="field" defaultValue={route.type} disabled={!canEdit}>
                <option value="ruta">Ruta</option>
                <option value="zona">Zona</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="name" style={{ display: "block", marginBottom: 8 }}>
                Nombre de la ruta
              </label>
              <input
                id="name"
                name="name"
                className={`field${fieldErrors.name ? " field-error" : ""}`}
                placeholder="Terminal Terrestre – Plaza de Armas"
                defaultValue={route.name}
                disabled={!canEdit}
              />
              {fieldErrors.name && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: NO, fontWeight: 500 }}>
                  {fieldErrors.name}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
            Operación
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 720 }}>
            <div>
              <label htmlFor="companyId" style={{ display: "block", marginBottom: 8 }}>
                Empresa (opcional)
              </label>
              <select
                id="companyId"
                name="companyId"
                className="field"
                defaultValue={route.companyId ?? ""}
                disabled={!canEdit}
              >
                <option value="">— Sin empresa —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razonSocial}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="vehicleTypeKey" style={{ display: "block", marginBottom: 8 }}>
                Tipo de vehículo (opcional)
              </label>
              <select
                id="vehicleTypeKey"
                name="vehicleTypeKey"
                className="field"
                defaultValue={route.vehicleTypeKey ?? ""}
                disabled={!canEdit}
              >
                <option value="">— Sin tipo —</option>
                {vehicleTypes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="stops" style={{ display: "block", marginBottom: 8 }}>
                Paradas (opcional)
              </label>
              <input
                id="stops"
                name="stops"
                type="number"
                min={0}
                className="field"
                placeholder="12"
                defaultValue={route.stops ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label htmlFor="length" style={{ display: "block", marginBottom: 8 }}>
                Longitud (opcional)
              </label>
              <input
                id="length"
                name="length"
                className="field"
                placeholder="8.5 km"
                defaultValue={route.length ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label htmlFor="status" style={{ display: "block", marginBottom: 8 }}>
                Estado
              </label>
              <select
                id="status"
                name="status"
                className="field"
                defaultValue={route.status}
                disabled={!canEdit}
              >
                <option value="activa">Activa</option>
                <option value="suspendida">Suspendida</option>
              </select>
            </div>
            <div>
              <label htmlFor="frequencies" style={{ display: "block", marginBottom: 8 }}>
                Frecuencias (opcional)
              </label>
              <input
                id="frequencies"
                name="frequencies"
                className="field"
                placeholder="10 min, 15 min"
                defaultValue={route.frequencies ? route.frequencies.join(", ") : ""}
                disabled={!canEdit}
              />
              <p style={{ marginTop: 6, fontSize: "0.8125rem", color: INK5 }}>
                Separadas por coma, ej: 10 min, 15 min
              </p>
            </div>
          </div>
        </Card>

        {canEdit && (
          <div style={{ display: "flex", gap: 10 }}>
            <Button type="submit" variant="primary" size="lg" loading={saving}>
              Guardar cambios
            </Button>
            <Link href="/rutas">
              <Button type="button" variant="outline" size="lg">
                Cancelar
              </Button>
            </Link>
          </div>
        )}

        {!canEdit && (
          <div
            style={{
              padding: "12px 16px",
              background: "#FAFAFA",
              border: `1px solid ${INK2}`,
              borderRadius: 10,
              color: INK5,
              fontSize: "0.875rem",
            }}
          >
            Solo administradores municipales o superadministradores pueden editar esta ruta.
          </div>
        )}
      </form>
    </div>
  );
}

