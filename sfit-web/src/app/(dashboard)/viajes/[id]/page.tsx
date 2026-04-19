"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Clock, User, Truck, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";

type TripStatus = "en_curso" | "completado" | "auto_cierre";

type Trip = {
  id: string;
  vehicle: { _id: string; plate: string; brand: string; model: string };
  driver: { _id: string; name: string };
  route?: { _id: string; code: string; name: string } | null;
  fleetEntryId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  km: number;
  passengers: number;
  status: TripStatus;
  createdAt: string;
};

const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

const STATUS_STYLE: Record<TripStatus, { bg: string; color: string; border: string; label: string }> = {
  en_curso:    { bg: "#EFF6FF", color: "#1e40af", border: "#BFDBFE", label: "En curso" },
  completado:  { bg: "#F0FDF4", color: "#15803d", border: "#86EFAC", label: "Completado" },
  auto_cierre: { bg: "#f4f4f5", color: "#71717a", border: "#e4e4e7", label: "Auto-cierre" },
};

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const CAN_EDIT = ["operador", "admin_municipal", "super_admin"];

interface Props { params: Promise<{ id: string }> }

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
}

export default function ViajeDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();

  const [trip,     setTrip]     = useState<Trip | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [userRole, setUserRole] = useState("");

  // Edit state
  const [km,        setKm]       = useState("");
  const [passengers, setPassengers] = useState("");
  const [endTime,   setEndTime]  = useState("");
  const [newStatus, setNewStatus] = useState<TripStatus | "">("");
  const [saving,    setSaving]   = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    setUserRole(u.role);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/viajes/${id}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar viaje."); return; }
      const t: Trip = data.data;
      setTrip(t);
      setKm(t.km ? String(t.km) : "");
      setPassengers(t.passengers ? String(t.passengers) : "");
      setNewStatus(t.status);
      if (t.endTime) {
        const d = new Date(t.endTime);
        d.setSeconds(0, 0);
        setEndTime(d.toISOString().slice(0, 16));
      }
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const payload: Record<string, unknown> = {};
      if (km !== "")         payload.km         = Number(km);
      if (passengers !== "") payload.passengers  = Number(passengers);
      if (endTime)           payload.endTime     = new Date(endTime).toISOString();
      if (newStatus)         payload.status      = newStatus;

      const res = await fetch(`/api/viajes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al actualizar."); return; }
      void load();
    } catch { setError("Error de conexión."); }
    finally { setSaving(false); }
  }

  async function handleFinish() {
    setFinishing(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/viajes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ status: "completado", endTime: new Date().toISOString() }),
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al finalizar."); return; }
      void load();
    } catch { setError("Error de conexión."); }
    finally { setFinishing(false); }
  }

  const canEdit = CAN_EDIT.includes(userRole);

  if (loading) return <div style={{ color: INK5, padding: 40 }}>Cargando viaje…</div>;
  if (notFound) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <p style={{ color: INK5, marginBottom: 16 }}>Viaje no encontrado.</p>
      <Link href="/viajes"><Button variant="outline">Volver a Viajes</Button></Link>
    </div>
  );
  if (error && !trip) return (
    <div style={{ padding: "12px 16px", background: "#FFF5F5", border: "1px solid #FCA5A5", borderRadius: 10, color: "#b91c1c" }}>{error}</div>
  );
  if (!trip) return null;

  const st = STATUS_STYLE[trip.status];

  return (
    <div className="space-y-8 animate-fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/viajes" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: INK5, textDecoration: "none", fontSize: "0.875rem" }}>
          <ArrowLeft size={16} /> Viajes
        </Link>
      </div>

      <PageHeader
        kicker={`Viaje · ${trip.vehicle?.plate ?? "—"}`}
        title={trip.route ? `${trip.route.code} · ${trip.route.name}` : "Sin ruta asignada"}
        subtitle={`Registrado el ${fmt(trip.createdAt)}`}
        action={
          canEdit && trip.status === "en_curso" ? (
            <Button variant="primary" size="md" loading={finishing} onClick={handleFinish}>
              <CheckCircle size={16} />
              Finalizar viaje
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div role="alert" style={{ background: "#FFF5F5", border: "1.5px solid #FCA5A5", borderRadius: 12, padding: 16, color: "#b91c1c", fontSize: "0.9375rem", fontWeight: 500 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Left column */}
        <div className="space-y-6">
          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>Información del viaje</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { icon: <Truck size={15} />, label: "Vehículo", value: trip.vehicle?.plate ?? "—" },
                { icon: <User size={15} />,  label: "Conductor", value: trip.driver?.name ?? "—" },
                { icon: <MapPin size={15} />, label: "Ruta", value: trip.route ? `${trip.route.code} · ${trip.route.name}` : "Sin ruta" },
                { icon: <Clock size={15} />,  label: "Estado", value: st.label },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{ padding: 14, background: INK1, borderRadius: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: INK5, marginBottom: 6 }}>
                    {icon} {label}
                  </div>
                  <div style={{ fontWeight: 600, color: INK9 }}>{value}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>Tiempos y métricas</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
              {[
                { label: "Hora inicio", value: fmt(trip.startTime) },
                { label: "Hora fin",    value: fmt(trip.endTime) },
                { label: "Kilómetros",  value: trip.km ? `${trip.km} km` : "—" },
                { label: "Pasajeros",   value: trip.passengers ? String(trip.passengers) : "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: 14, background: INK1, borderRadius: 10 }}>
                  <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: INK5, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 700, color: INK9, fontVariantNumeric: "tabular-nums" }}>{value}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Status badge */}
          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>Estado</h3>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: st.bg, border: `1.5px solid ${st.border}`, marginBottom: canEdit ? 18 : 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.color }} />
              <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: st.color }}>{st.label}</span>
            </div>

            {canEdit && (
              <>
                <label style={{ display: "block", marginBottom: 8, fontSize: "0.875rem", fontWeight: 500 }}>Cambiar estado</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as TripStatus)}
                  className="field"
                  style={{ marginBottom: 12 }}
                >
                  <option value="en_curso">En curso</option>
                  <option value="completado">Completado</option>
                  <option value="auto_cierre">Auto-cierre</option>
                </select>
              </>
            )}
          </Card>

          {/* Edit fields */}
          {canEdit && (
            <Card>
              <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>Editar datos</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label htmlFor="km" style={{ display: "block", marginBottom: 8, fontSize: "0.875rem", fontWeight: 500 }}>Kilómetros recorridos</label>
                  <input
                    id="km"
                    type="number"
                    min="0"
                    step="0.1"
                    value={km}
                    onChange={e => setKm(e.target.value)}
                    className="field"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label htmlFor="passengers" style={{ display: "block", marginBottom: 8, fontSize: "0.875rem", fontWeight: 500 }}>Pasajeros</label>
                  <input
                    id="passengers"
                    type="number"
                    min="0"
                    step="1"
                    value={passengers}
                    onChange={e => setPassengers(e.target.value)}
                    className="field"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label htmlFor="endTime" style={{ display: "block", marginBottom: 8, fontSize: "0.875rem", fontWeight: 500 }}>Hora de fin</label>
                  <input
                    id="endTime"
                    type="datetime-local"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="field"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  loading={saving}
                  style={{ width: "100%" }}
                >
                  Guardar cambios
                </Button>
              </div>
            </Card>
          )}

          {/* Trip ID info */}
          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 12 }}>Identificador</h3>
            <div style={{ padding: "10px 12px", background: INK1, borderRadius: 8, fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", fontWeight: 700, color: INK6, wordBreak: "break-all" }}>
              {trip.id}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
