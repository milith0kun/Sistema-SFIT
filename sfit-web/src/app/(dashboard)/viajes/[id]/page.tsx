"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, MapPin, Clock, User, Truck, CheckCircle, Save, AlertTriangle,
  Loader2, Hash, Copy, Check, Calendar, Activity, Users as UsersIcon, Gauge,
  Route as RouteIcon,
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { GoogleMapView, type MapPolyline } from "@/components/ui/GoogleMapView";
import { useSetBreadcrumbTitle } from "@/hooks/useBreadcrumbTitle";

type TripStatus = "en_curso" | "completado" | "auto_cierre" | "cerrado_automatico";

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
  autoClosedReason?: string;
  createdAt: string;
};

/* Paleta sobria */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d"; const APTO_BG = "#F0FDF4"; const APTO_BD = "#86EFAC";
const INFO = "#1E40AF"; const INFO_BD = "#BFDBFE";
const RIESGO = "#B45309"; const RIESGO_BG = "#FFFBEB"; const RIESGO_BD = "#FDE68A";
const NO = "#DC2626"; const NO_BG = "#FFF5F5"; const NO_BD = "#FCA5A5";

const STATUS_META: Record<TripStatus, { color: string; bg: string; bd: string; label: string }> = {
  en_curso:           { color: INFO, bg: "#fff", bd: INFO_BD, label: "En curso" },
  completado:         { color: APTO, bg: APTO_BG, bd: APTO_BD, label: "Completado" },
  auto_cierre:        { color: RIESGO, bg: RIESGO_BG, bd: RIESGO_BD, label: "Auto-cierre" },
  cerrado_automatico: { color: RIESGO, bg: RIESGO_BG, bd: RIESGO_BD, label: "Auto-cierre" },
};

const FIELD: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 12px", borderRadius: 8,
  border: `1px solid ${INK2}`, fontSize: "0.875rem", color: INK9,
  background: "#fff", outline: "none", boxSizing: "border-box",
  fontFamily: "var(--font-inter), Inter, sans-serif",
  transition: "border-color 150ms",
};
const LABEL: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 6,
};

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const CAN_EDIT = ["operador", "admin_municipal", "super_admin"];

interface Props { params: Promise<{ id: string }> }

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
}
function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}
function durationMinutes(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e)) return null;
  return Math.max(0, Math.floor((e - s) / 60000));
}
function fmtDuration(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ViajeDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [userRole, setUserRole] = useState("");

  const [km, setKm] = useState("");
  const [passengers, setPassengers] = useState("");
  const [endTime, setEndTime] = useState("");
  const [newStatus, setNewStatus] = useState<TripStatus | "">("");
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Trazado real (GPS del conductor) y planeado (waypoints de la ruta)
  const [trackPoints, setTrackPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [trackStart, setTrackStart] = useState<{ lat: number; lng: number } | null>(null);
  const [trackEnd, setTrackEnd] = useState<{ lat: number; lng: number } | null>(null);
  const [routeWaypoints, setRouteWaypoints] = useState<Array<{ lat: number; lng: number; label?: string; order: number }>>([]);
  const [trackLoading, setTrackLoading] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    setUserRole(u.role);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  // Breadcrumb dinámico — usa placa o ID corto como título
  useSetBreadcrumbTitle(
    trip ? (trip.vehicle?.plate || `Viaje ${trip.id.slice(-6).toUpperCase()}`) : null
  );

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
      } else {
        setEndTime("");
      }
      // Cargar trazado real + ruta planeada en paralelo (defensivo: errores no rompen la página)
      void loadTrackAndRoute(t, token ?? "");
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  async function loadTrackAndRoute(t: Trip, token: string) {
    setTrackLoading(true);
    try {
      const tasks: Promise<void>[] = [];
      // Trazado real desde la entrada de flota vinculada
      if (t.fleetEntryId) {
        tasks.push((async () => {
          try {
            const r = await fetch(`/api/flota/${t.fleetEntryId}/location`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!r.ok) return;
            const j = await r.json();
            const pts = (j?.data?.trackPoints ?? []) as Array<{ lat: number; lng: number }>;
            setTrackPoints(pts.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)));
            const sl = j?.data?.startLocation;
            const el = j?.data?.endLocation;
            if (sl && Number.isFinite(sl.lat) && Number.isFinite(sl.lng)) setTrackStart({ lat: sl.lat, lng: sl.lng });
            if (el && Number.isFinite(el.lat) && Number.isFinite(el.lng)) setTrackEnd({ lat: el.lat, lng: el.lng });
          } catch { /* viaje sin GPS — silencioso */ }
        })());
      }
      // Ruta planeada (waypoints)
      const routeId = t.route?._id;
      if (routeId) {
        tasks.push((async () => {
          try {
            const r = await fetch(`/api/rutas/${routeId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!r.ok) return;
            const j = await r.json();
            const wps = (j?.data?.waypoints ?? []) as Array<{ lat: number; lng: number; label?: string; order: number }>;
            const valid = wps
              .filter(w => Number.isFinite(w.lat) && Number.isFinite(w.lng))
              .sort((a, b) => a.order - b.order);
            setRouteWaypoints(valid);
          } catch { /* ruta sin waypoints — silencioso */ }
        })());
      }
      await Promise.all(tasks);
    } finally {
      setTrackLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true); setError(null); setSuccess(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const payload: Record<string, unknown> = {};
      if (km !== "") payload.km = Number(km);
      if (passengers !== "") payload.passengers = Number(passengers);
      if (endTime) payload.endTime = new Date(endTime).toISOString();
      if (newStatus) payload.status = newStatus;

      const res = await fetch(`/api/viajes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al actualizar."); return; }
      setSuccess("Viaje actualizado correctamente.");
      setTimeout(() => setSuccess(null), 3500);
      void load();
    } catch { setError("Error de conexión."); }
    finally { setSaving(false); }
  }

  async function handleFinish() {
    setFinishing(true); setError(null); setSuccess(null);
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
      setSuccess("Viaje finalizado.");
      setTimeout(() => setSuccess(null), 3500);
      void load();
    } catch { setError("Error de conexión."); }
    finally { setFinishing(false); }
  }

  const canEdit = CAN_EDIT.includes(userRole);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <DashboardHero kicker="Viajes · RF-10" title="Cargando viaje…" />
        <KPIStrip cols={4} items={[
          { label: "ESTADO", value: "—", subtitle: "—", icon: Activity },
          { label: "INICIO", value: "—", subtitle: "—", icon: Clock },
          { label: "FIN", value: "—", subtitle: "—", icon: CheckCircle },
          { label: "KM", value: "—", subtitle: "—", icon: Gauge },
        ]} />
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ height: 140, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <DashboardHero kicker="Viajes · RF-10" title="Viaje no encontrado" />
        <div style={{
          padding: "32px 24px", background: "#fff", border: `1px solid ${INK2}`,
          borderRadius: 12, color: INK6, textAlign: "center", fontSize: "0.875rem",
        }}>
          El viaje solicitado no existe o ya no está disponible.
        </div>
        <Link href="/viajes" style={{
          alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7,
          height: 36, padding: "0 14px", borderRadius: 8,
          border: `1px solid ${INK2}`, background: "#fff", color: INK6,
          fontWeight: 600, fontSize: "0.8125rem", textDecoration: "none",
        }}>
          <ArrowLeft size={13} />Volver a viajes
        </Link>
      </div>
    );
  }

  if (!trip) return null;

  const stMeta = STATUS_META[trip.status] ?? STATUS_META.en_curso;
  const titleLine = trip.route
    ? `${trip.route.code} · ${trip.route.name}`
    : `Viaje ${trip.id.slice(-6).toUpperCase()}`;
  const subtitleLine = trip.route ? "Sin ruta asignada" : null;
  const duration = durationMinutes(trip.startTime, trip.endTime);

  const heroAction = (
    <div style={{ display: "flex", gap: 6 }}>
      <Link href="/viajes" style={{
        display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
        borderRadius: 7, border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)",
        fontWeight: 600, fontSize: "0.8125rem", textDecoration: "none",
      }}>
        <ArrowLeft size={12} />Volver
      </Link>
      {canEdit && trip.status === "en_curso" && (
        <button onClick={handleFinish} disabled={finishing}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px",
            borderRadius: 7, border: "none", background: "#fff", color: INK9,
            fontWeight: 700, fontSize: "0.8125rem", cursor: finishing ? "not-allowed" : "pointer",
            fontFamily: "inherit", opacity: finishing ? 0.7 : 1,
          }}>
          {finishing ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} /> : <CheckCircle size={12} />}
          {finishing ? "Finalizando…" : "Finalizar viaje"}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      <DashboardHero
        kicker="Viajes · RF-10"
        title={titleLine}
        pills={[
          { label: "Vehículo", value: trip.vehicle?.plate || "—" },
          { label: "Conductor", value: trip.driver?.name?.split(" ")[0] || "—" },
          { label: "Estado", value: stMeta.label, warn: trip.status !== "en_curso" && trip.status !== "completado" },
        ]}
        action={heroAction}
      />

      <KPIStrip cols={4} items={[
        {
          label: "ESTADO", value: stMeta.label,
          subtitle: trip.status === "en_curso" ? "operando" : trip.status === "completado" ? "finalizado" : "cerrado por sistema",
          icon: Activity, accent: stMeta.color,
        },
        {
          label: "INICIO", value: fmtTime(trip.startTime),
          subtitle: trip.startTime ? new Date(trip.startTime).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }) : "—",
          icon: Clock,
        },
        {
          label: "FIN", value: fmtTime(trip.endTime),
          subtitle: trip.endTime ? `duración ${fmtDuration(duration)}` : "en curso",
          icon: CheckCircle,
        },
        {
          label: "KM RECORRIDOS", value: trip.km > 0 ? trip.km.toLocaleString("es-PE") : "—",
          subtitle: trip.passengers > 0 ? `${trip.passengers} pasajeros` : "sin pasajeros",
          icon: Gauge,
        },
      ]} />

      {trip.status === "auto_cierre" && trip.autoClosedReason && (
        <div role="status" style={{
          padding: "10px 14px", background: RIESGO_BG, border: `1px solid ${RIESGO_BD}`,
          borderRadius: 8, color: RIESGO, fontSize: "0.8125rem", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />
          <span><strong>Auto-cierre:</strong> {trip.autoClosedReason}</span>
        </div>
      )}

      {error && (
        <div role="alert" style={{
          padding: "10px 14px", background: NO_BG, border: `1px solid ${NO_BD}`,
          borderRadius: 8, color: NO, fontSize: "0.8125rem", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />{error}
        </div>
      )}
      {success && (
        <div role="status" style={{
          padding: "10px 14px", background: APTO_BG, border: `1px solid ${APTO_BD}`,
          borderRadius: 8, color: APTO, fontSize: "0.8125rem", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <CheckCircle size={14} />{success}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12, alignItems: "start" }}>

        {/* Columna principal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

          <SectionCard
            icon={<Activity size={14} color={INK6} />}
            title="Información del viaje"
            subtitle={subtitleLine ?? "Vehículo, conductor y ruta"}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <InfoBlock
                icon={<Truck size={12} />}
                label="Vehículo"
                value={trip.vehicle?.plate || "—"}
                sub={trip.vehicle ? `${trip.vehicle.brand ?? ""} ${trip.vehicle.model ?? ""}`.trim() || undefined : undefined}
                mono
              />
              <InfoBlock
                icon={<User size={12} />}
                label="Conductor"
                value={trip.driver?.name?.trim() || "Sin conductor"}
              />
              <InfoBlock
                icon={<MapPin size={12} />}
                label="Ruta / Zona"
                value={trip.route ? `${trip.route.code} · ${trip.route.name}` : "Sin ruta asignada"}
              />
              <InfoBlock
                icon={<Activity size={12} />}
                label="Estado"
                value={stMeta.label}
                accent={stMeta.color}
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={<Clock size={14} color={INK6} />}
            title="Tiempos y métricas"
            subtitle={duration != null ? `Duración total: ${fmtDuration(duration)}` : "Viaje en curso"}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
              <InfoBlock
                icon={<Calendar size={12} />}
                label="Inicio"
                value={trip.startTime ? fmtTime(trip.startTime) : "—"}
                sub={trip.startTime ? new Date(trip.startTime).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : undefined}
              />
              <InfoBlock
                icon={<CheckCircle size={12} />}
                label="Fin"
                value={trip.endTime ? fmtTime(trip.endTime) : "En curso"}
                sub={trip.endTime ? new Date(trip.endTime).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : undefined}
              />
              <InfoBlock
                icon={<Gauge size={12} />}
                label="Kilómetros"
                value={trip.km > 0 ? `${trip.km.toLocaleString("es-PE")} km` : "—"}
              />
              <InfoBlock
                icon={<UsersIcon size={12} />}
                label="Pasajeros"
                value={trip.passengers > 0 ? trip.passengers.toLocaleString("es-PE") : "—"}
              />
            </div>
          </SectionCard>

          <TripTrackCard
            trackPoints={trackPoints}
            trackStart={trackStart}
            trackEnd={trackEnd}
            routeWaypoints={routeWaypoints}
            loading={trackLoading}
            hasFleetEntry={!!trip.fleetEntryId}
            hasRoute={!!trip.route}
          />
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 16 }}>

          {/* Editar datos */}
          {canEdit ? (
            <SectionCard
              icon={<Save size={14} color={INK6} />}
              title="Editar datos del viaje"
              subtitle="Estado, métricas y hora de fin"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={LABEL}>Cambiar estado</label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value as TripStatus)}
                    style={{ ...FIELD, appearance: "none", paddingRight: 30, cursor: "pointer" }}
                  >
                    <option value="en_curso">En curso</option>
                    <option value="completado">Completado</option>
                    <option value="auto_cierre">Auto-cierre</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="km" style={LABEL}>Kilómetros recorridos</label>
                  <input
                    id="km" type="number" min="0" step="0.1"
                    value={km} onChange={e => setKm(e.target.value)}
                    placeholder="0"
                    style={{ ...FIELD, fontVariantNumeric: "tabular-nums" }}
                  />
                </div>
                <div>
                  <label htmlFor="passengers" style={LABEL}>Pasajeros</label>
                  <input
                    id="passengers" type="number" min="0" step="1"
                    value={passengers} onChange={e => setPassengers(e.target.value)}
                    placeholder="0"
                    style={{ ...FIELD, fontVariantNumeric: "tabular-nums" }}
                  />
                </div>
                <div>
                  <label htmlFor="endTime" style={LABEL}>Hora de fin</label>
                  <input
                    id="endTime" type="datetime-local"
                    value={endTime} onChange={e => setEndTime(e.target.value)}
                    style={FIELD}
                  />
                </div>
                <button
                  onClick={handleSave} disabled={saving}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                    height: 36, borderRadius: 8, border: "none",
                    background: INK9, color: "#fff",
                    fontSize: "0.8125rem", fontWeight: 700,
                    cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
                    opacity: saving ? 0.7 : 1, marginTop: 4,
                  }}
                >
                  {saving ? <Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} /> : <Save size={13} />}
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </SectionCard>
          ) : null}

          {/* Información de registro */}
          <div style={{
            background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, overflow: "hidden",
          }}>
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${INK1}` }}>
              <div style={{
                fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", color: INK5,
              }}>Información del registro</div>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <SystemIdRow id={trip.id} />
              <Row k="Registrado" v={fmtDateTime(trip.createdAt)} />
              {trip.fleetEntryId && (
                <Row k="Flota del día" v={trip.fleetEntryId.slice(-8).toUpperCase()} mono />
              )}
            </div>
          </div>
        </div>
      </div>

      {!canEdit && (
        <div style={{
          padding: "10px 14px", background: INK1, border: `1px solid ${INK2}`,
          borderRadius: 8, color: INK6, fontSize: "0.8125rem",
        }}>
          Solo operadores, administradores municipales y superadministradores pueden editar este viaje.
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

function InfoBlock({ icon, label, value, sub, accent, mono }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  accent?: string; mono?: boolean;
}) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 8,
      background: INK1, border: `1px solid ${INK2}`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.06em",
        color: INK5, textTransform: "uppercase", marginBottom: 3,
      }}>
        {icon}{label}
      </div>
      <div style={{
        fontSize: "0.875rem", fontWeight: 700, color: accent ?? INK9,
        lineHeight: 1.25, wordBreak: "break-word",
        fontFamily: mono ? "ui-monospace, monospace" : "inherit",
        letterSpacing: mono ? "0.04em" : 0,
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: "0.6875rem", color: INK5, marginTop: 2 }}>
          {sub}
        </div>
      )}
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

/**
 * Tarjeta con mapa que superpone el trazado real (GPS del conductor) sobre la
 * ruta planeada (waypoints). Si no hay ninguna de las dos fuentes, no renderiza nada.
 * Si solo hay una, muestra lo disponible con un mensaje aclaratorio.
 */
function TripTrackCard({
  trackPoints, trackStart, trackEnd, routeWaypoints, loading, hasFleetEntry, hasRoute,
}: {
  trackPoints: Array<{ lat: number; lng: number }>;
  trackStart: { lat: number; lng: number } | null;
  trackEnd: { lat: number; lng: number } | null;
  routeWaypoints: Array<{ lat: number; lng: number; label?: string; order: number }>;
  loading: boolean;
  hasFleetEntry: boolean;
  hasRoute: boolean;
}) {
  // Si no hay ningún dato útil, no renderizar la card.
  const hasReal = trackPoints.length > 0;
  const hasPlanned = routeWaypoints.length > 0;
  if (!hasFleetEntry && !hasRoute) return null;
  if (!loading && !hasReal && !hasPlanned) return null;

  const polylines: MapPolyline[] = [];
  if (hasPlanned) {
    polylines.push({
      path: routeWaypoints.map(w => ({ lat: w.lat, lng: w.lng })),
      color: INK9,
      weight: 3,
      opacity: 0.45,
    });
  }
  if (hasReal) {
    polylines.push({
      path: trackPoints,
      color: APTO,
      weight: 4,
      opacity: 0.95,
    });
  }

  const markers: Array<{ lat: number; lng: number; label?: string; title?: string; color?: "gold" | "red" | "green" | "blue" }> = [];
  if (trackStart) markers.push({ lat: trackStart.lat, lng: trackStart.lng, label: "A", title: "Inicio (GPS)", color: "green" });
  if (trackEnd) markers.push({ lat: trackEnd.lat, lng: trackEnd.lng, label: "B", title: "Fin (GPS)", color: "red" });
  // Marcadores intermedios (paraderos planeados, excluyendo extremos)
  if (hasPlanned) {
    routeWaypoints.forEach((w, i) => {
      if (i === 0 || i === routeWaypoints.length - 1) return;
      markers.push({
        lat: w.lat, lng: w.lng,
        label: String(i),
        title: w.label ?? `Paradero ${i}`,
        color: "gold",
      });
    });
  }

  // Centro: priorizar trazado real; si no, primer waypoint planeado.
  const center =
    hasReal ? trackPoints[Math.floor(trackPoints.length / 2)] :
    hasPlanned ? routeWaypoints[Math.floor(routeWaypoints.length / 2)] :
    undefined;

  // Subtitle según los datos disponibles.
  let subtitle = "Trazado real del conductor vs ruta planeada";
  if (!hasReal && hasPlanned) subtitle = "Solo ruta planeada — el viaje no registró GPS";
  else if (hasReal && !hasPlanned) subtitle = "Solo trazado real — el viaje no tenía ruta asignada";

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
          <RouteIcon size={14} color={INK6} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9, lineHeight: 1.25 }}>
            Recorrido en mapa
          </div>
          <div style={{ fontSize: "0.75rem", color: INK5, lineHeight: 1.3, marginTop: 1 }}>
            {subtitle}
          </div>
        </div>
        {hasReal && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 9px", borderRadius: 999,
            background: "#fff", color: APTO, border: `1px solid #86EFAC`,
            fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: APTO }} />
            {trackPoints.length} pts
          </div>
        )}
      </div>
      <div style={{ padding: 12 }}>
        {loading ? (
          <div style={{
            height: 360, borderRadius: 10, background: INK1,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: INK5, gap: 8, fontSize: "0.8125rem",
          }}>
            <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />
            Cargando recorrido…
          </div>
        ) : (
          <>
            <GoogleMapView
              center={center}
              zoom={13}
              markers={markers}
              polylines={polylines}
              height={360}
            />
            <div style={{
              marginTop: 10, display: "flex", flexWrap: "wrap", gap: 14,
              fontSize: "0.6875rem", color: INK6,
            }}>
              {hasReal && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 22, height: 0, borderTop: `3px solid ${APTO}` }} />
                  Trazado real GPS
                </span>
              )}
              {hasPlanned && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 22, height: 0, borderTop: `2px dashed ${INK9}`, opacity: 0.65 }} />
                  Ruta planeada
                </span>
              )}
              {!hasReal && hasFleetEntry && (
                <span style={{ color: INK5, marginLeft: "auto" }}>
                  El conductor no envió posiciones GPS para este viaje.
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
