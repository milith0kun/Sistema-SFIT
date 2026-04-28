"use client";

import { use as usePromise, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";

const VIEW_ROLES = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const EDIT_ROLES = ["admin_municipal", "operador", "super_admin"];
const DELETE_ROLES = ["admin_municipal", "super_admin"];

type FleetStatus =
  | "disponible"
  | "en_ruta"
  | "cerrado"
  | "auto_cierre"
  | "mantenimiento"
  | "fuera_de_servicio";

const STATUS_CONFIG: Record<
  FleetStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  disponible: { label: "Disponible", color: "#15803d", bg: "#F0FDF4", border: "#86EFAC" },
  en_ruta: { label: "En ruta", color: "#1d4ed8", bg: "#EFF6FF", border: "#93C5FD" },
  cerrado: { label: "Cerrado", color: "#71717a", bg: "#f4f4f5", border: "#e4e4e7" },
  auto_cierre: { label: "Auto cierre", color: "#71717a", bg: "#f4f4f5", border: "#e4e4e7" },
  mantenimiento: { label: "Mantenimiento", color: "#b45309", bg: "#FFFBEB", border: "#FCD34D" },
  fuera_de_servicio: { label: "Fuera de servicio", color: "#DC2626", bg: "#FFF5F5", border: "#FCA5A5" },
};

const ALL_STATUSES: FleetStatus[] = [
  "disponible",
  "en_ruta",
  "cerrado",
  "auto_cierre",
  "mantenimiento",
  "fuera_de_servicio",
];

interface Props {
  params: Promise<{ id: string }>;
}

interface FleetEntry {
  id: string;
  vehicleId: string;
  vehiclePlate?: string;
  driverId: string;
  driverName?: string;
  routeId?: string;
  routeName?: string;
  date: string;
  departureTime?: string;
  returnTime?: string;
  km?: number;
  status: FleetStatus;
  observations?: string;
  checklistComplete?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface Vehiculo {
  id: string;
  plate: string;
  brand?: string;
  model?: string;
}

interface Conductor {
  id: string;
  name: string;
  licenseNumber?: string;
}

interface Ruta {
  id: string;
  code: string;
  name: string;
}

interface EditForm {
  departureTime: string;
  returnTime: string;
  km: string;
  status: FleetStatus;
  observations: string;
  checklistComplete: boolean;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
}

export default function FlotaDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const [entry, setEntry] = useState<FleetEntry | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(true);

  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);

  const [editForm, setEditForm] = useState<EditForm>({
    departureTime: "",
    returnTime: "",
    km: "",
    status: "disponible",
    observations: "",
    checklistComplete: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

    if (!user.role || !VIEW_ROLES.includes(user.role)) {
      router.replace("/flota");
      return;
    }

    setAuthorized(true);
    setCanEdit(EDIT_ROLES.includes(user.role ?? ""));
    setCanDelete(DELETE_ROLES.includes(user.role ?? ""));
    setToken(tk);
  }, [router]);

  // Load entry
  useEffect(() => {
    if (!authorized || !token) return;

    setLoadingEntry(true);
    fetch(`/api/flota/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const body = await res.json();
        const data: FleetEntry = body?.data ?? body;
        setEntry(data);
        setEditForm({
          departureTime: data.departureTime ?? "",
          returnTime: data.returnTime ?? "",
          km: data.km != null ? String(data.km) : "",
          status: data.status ?? "disponible",
          observations: data.observations ?? "",
          checklistComplete: data.checklistComplete ?? false,
        });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingEntry(false));
  }, [authorized, token, id]);

  // Load dropdowns en paralelo
  useEffect(() => {
    if (!authorized || !token) return;

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
        /* tolerable */
      });
  }, [authorized, token]);

  function handleEditField<K extends keyof EditForm>(field: K, value: EditForm[K]) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
    setSuccessMsg(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      status: editForm.status,
      checklistComplete: editForm.checklistComplete,
    };
    if (editForm.departureTime) payload.departureTime = editForm.departureTime;
    else payload.departureTime = null;
    if (editForm.returnTime) payload.returnTime = editForm.returnTime;
    else payload.returnTime = null;
    if (editForm.km !== "") payload.km = Number(editForm.km);
    if (editForm.observations.trim()) payload.observations = editForm.observations.trim();
    else payload.observations = null;

    try {
      const res = await fetch(`/api/flota/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const body = await res.json();
        const updated: FleetEntry = body?.data ?? body;
        setEntry(updated);
        setSuccessMsg("Cambios guardados correctamente.");
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

  async function handleDelete() {
    const plate = entry?.vehiclePlate ?? entry?.vehicleId ?? id;
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar la asignación del vehículo "${plate}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setServerError(null);

    try {
      const res = await fetch(`/api/flota/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
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
      setDeleting(false);
    }
  }

  if (!authorized) return null;

  if (loadingEntry) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <PageHeader title="Cargando…" />
        <p style={{ color: "#71717a", marginTop: 24 }}>Obteniendo datos de la asignación…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <PageHeader kicker="Flota" title="Asignación no encontrada" />
        <Card style={{ marginTop: 16 }}>
          <p style={{ color: "#71717a", marginBottom: 16 }}>
            La asignación solicitada no existe o fue eliminada.
          </p>
          <Link href="/flota">
            <Button variant="outline">Volver a flota</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const statusCfg = entry ? STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.cerrado : null;

  // Resolve nombres para la tarjeta de solo lectura
  const vehiculoLabel =
    entry?.vehiclePlate ??
    vehiculos.find((v) => v.id === entry?.vehicleId)?.plate ??
    entry?.vehicleId ??
    "—";
  const conductorLabel =
    entry?.driverName ??
    conductores.find((c) => c.id === entry?.driverId)?.name ??
    entry?.driverId ??
    "—";
  const rutaLabel =
    entry?.routeName ??
    (entry?.routeId
      ? rutas.find((r) => r.id === entry?.routeId)
          ? `${rutas.find((r) => r.id === entry?.routeId)!.code} - ${rutas.find((r) => r.id === entry?.routeId)!.name}`
          : entry.routeId
      : "Sin ruta asignada");

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <PageHeader
        kicker="Flota"
        title={entry?.vehiclePlate ? `Asignación · ${entry.vehiclePlate}` : "Detalle de asignación"}
        subtitle="Consulta y actualización de la asignación diaria de flota."
      />

      {/* Info de solo lectura */}
      {entry && (
        <Card style={{ marginBottom: 16 }}>
          <h3
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Información de la asignación
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 20,
              maxWidth: 720,
            }}
          >
            {/* Vehículo */}
            <div>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#71717a",
                  marginBottom: 4,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Vehículo
              </p>
              <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#18181b" }}>
                {vehiculoLabel}
              </p>
            </div>

            {/* Conductor */}
            <div>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#71717a",
                  marginBottom: 4,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Conductor
              </p>
              <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#18181b" }}>
                {conductorLabel}
              </p>
            </div>

            {/* Ruta */}
            <div>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#71717a",
                  marginBottom: 4,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Ruta
              </p>
              <p style={{ fontSize: "0.9375rem", fontWeight: 500, color: "#52525b" }}>
                {rutaLabel}
              </p>
            </div>

            {/* Fecha */}
            <div>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#71717a",
                  marginBottom: 4,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Fecha
              </p>
              <p style={{ fontSize: "0.9375rem", fontWeight: 500, color: "#52525b" }}>
                {formatDate(entry.date)}
              </p>
            </div>

            {/* Estado badge */}
            <div>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#71717a",
                  marginBottom: 6,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Estado actual
              </p>
              {statusCfg && (
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: statusCfg.color,
                    backgroundColor: statusCfg.bg,
                    border: `1px solid ${statusCfg.border}`,
                  }}
                >
                  {statusCfg.label}
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Formulario editable */}
      <form onSubmit={handleSave} noValidate>
        {/* Horario y km */}
        <Card>
          <h3
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Horario y kilometraje
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 16,
              maxWidth: 720,
            }}
          >
            {/* Hora de salida */}
            <div>
              <label htmlFor="departureTime" style={{ display: "block", marginBottom: 8 }}>
                Hora de salida
              </label>
              <input
                id="departureTime"
                type="time"
                className="field"
                value={editForm.departureTime}
                onChange={(e) => handleEditField("departureTime", e.target.value)}
                disabled={submitting || !canEdit}
                readOnly={!canEdit}
              />
            </div>

            {/* Hora de regreso */}
            <div>
              <label htmlFor="returnTime" style={{ display: "block", marginBottom: 8 }}>
                Hora de regreso
              </label>
              <input
                id="returnTime"
                type="time"
                className="field"
                value={editForm.returnTime}
                onChange={(e) => handleEditField("returnTime", e.target.value)}
                disabled={submitting || !canEdit}
                readOnly={!canEdit}
              />
            </div>

            {/* Km recorridos */}
            <div>
              <label htmlFor="km" style={{ display: "block", marginBottom: 8 }}>
                Km recorridos
              </label>
              <input
                id="km"
                type="number"
                min={0}
                step={0.1}
                className="field"
                value={editForm.km}
                onChange={(e) => handleEditField("km", e.target.value)}
                placeholder="0"
                disabled={submitting || !canEdit}
                readOnly={!canEdit}
                style={{ fontVariantNumeric: "tabular-nums" }}
              />
            </div>
          </div>
        </Card>

        {/* Estado y observaciones */}
        <Card style={{ marginTop: 16 }}>
          <h3
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Estado y observaciones
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              maxWidth: 720,
            }}
          >
            {/* Status */}
            <div>
              <label htmlFor="status" style={{ display: "block", marginBottom: 8 }}>
                Estado {canEdit && <span style={{ color: "#DC2626" }}>*</span>}
              </label>
              {canEdit ? (
                <select
                  id="status"
                  className="field"
                  value={editForm.status}
                  onChange={(e) => handleEditField("status", e.target.value as FleetStatus)}
                  disabled={submitting}
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_CONFIG[s].label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="status"
                  type="text"
                  className="field"
                  value={STATUS_CONFIG[editForm.status]?.label ?? editForm.status}
                  readOnly
                  disabled
                />
              )}
            </div>

            {/* Checklist */}
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 4 }}>
              <label
                htmlFor="checklistComplete"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: !canEdit || submitting ? "not-allowed" : "pointer",
                  userSelect: "none",
                  opacity: !canEdit ? 0.65 : 1,
                }}
              >
                <input
                  id="checklistComplete"
                  type="checkbox"
                  checked={editForm.checklistComplete}
                  onChange={(e) => handleEditField("checklistComplete", e.target.checked)}
                  disabled={submitting || !canEdit}
                  style={{ width: 18, height: 18, accentColor: "#6C0606", cursor: "inherit" }}
                />
                <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "#18181b" }}>
                  Checklist pre-viaje completo
                </span>
              </label>
            </div>

            {/* Observaciones */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="observations" style={{ display: "block", marginBottom: 8 }}>
                Observaciones
              </label>
              <textarea
                id="observations"
                className="field"
                value={editForm.observations}
                onChange={(e) => handleEditField("observations", e.target.value)}
                placeholder="Notas adicionales sobre la asignación…"
                rows={3}
                disabled={submitting || !canEdit}
                readOnly={!canEdit}
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
              color: "#DC2626",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            {serverError}
          </div>
        )}

        {/* Éxito */}
        {successMsg && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 8,
              backgroundColor: "#F0FDF4",
              border: "1px solid #86EFAC",
              color: "#15803d",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            {successMsg}
          </div>
        )}

        {/* Acciones */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 24,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {canEdit && (
            <>
              <Button type="submit" disabled={submitting || deleting}>
                {submitting ? "Guardando…" : "Guardar cambios"}
              </Button>
              <Link href="/flota">
                <Button type="button" variant="outline" disabled={submitting || deleting}>
                  Cancelar
                </Button>
              </Link>
            </>
          )}

          {!canEdit && (
            <Link href="/flota">
              <Button type="button" variant="outline">
                Volver a flota
              </Button>
            </Link>
          )}

          {canDelete && (
            <>
              <div style={{ flex: 1 }} />
              <Button
                type="button"
                variant="outline"
                disabled={submitting || deleting}
                onClick={handleDelete}
                style={{
                  borderColor: "#FCA5A5",
                  color: "#DC2626",
                  backgroundColor: "transparent",
                }}
              >
                {deleting ? "Eliminando…" : "Eliminar asignación"}
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
