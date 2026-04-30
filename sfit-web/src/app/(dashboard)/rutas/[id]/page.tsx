"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Trash2, Save, AlertTriangle, MapPin, Building2, Briefcase, Map,
  Loader2, CheckCircle, Hash, Copy, Check,
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { WaypointsEditor, type Waypoint } from "@/components/ui/WaypointsEditor";
import { useSetBreadcrumbTitle } from "@/hooks/useBreadcrumbTitle";

type RouteType = "ruta" | "zona";
type RouteStatus = "activa" | "suspendida";

type Route = {
  id: string; code: string; name: string; type: RouteType;
  companyId?: string; companyName?: string; vehicleTypeKey?: string;
  stops?: number; length?: string; vehicleCount: number;
  status: RouteStatus; frequencies?: string[];
  waypoints?: Waypoint[];
};

type Company = { id: string; razonSocial: string };
type VehicleType = { id: string; key: string; name: string; active: boolean };
type StoredUser = { role: string };

interface Props { params: Promise<{ id: string }> }

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
// Operador (gestor de flota de empresa) también edita las rutas asignadas a su empresa.
const CAN_EDIT = ["admin_municipal", "super_admin", "operador"];

/* Paleta sobria */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d"; const APTO_BG = "#F0FDF4"; const APTO_BD = "#86EFAC";
const RED = "#DC2626"; const RED_BG = "#FFF5F5"; const RED_BD = "#FCA5A5";

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

export default function RutaDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [route, setRoute] = useState<Route | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notFound, setNotFound] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    setUser(u);
    void loadRoute();
    void loadCompanies();
    void loadVehicleTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  useSetBreadcrumbTitle(route ? `${route.code} · ${route.name}` : null);

  async function loadRoute() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/rutas/${id}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "No se pudo cargar la ruta."); return; }
      setRoute(data.data);
      setWaypoints(data.data.waypoints ?? []);
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  async function loadCompanies() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/empresas?limit=100", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      const data = await res.json();
      if (res.ok && data.success) setCompanies(data.data.items ?? []);
    } catch { /* silent */ }
  }

  async function loadVehicleTypes() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/tipos-vehiculo?limit=100", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      const data = await res.json();
      if (res.ok && data.success) {
        // Deduplica por `key` (la base puede tener registros duplicados, ej. "minibus" 2x).
        const items: VehicleType[] = data.data.items ?? [];
        const seen = new Set<string>();
        const unique = items.filter(t => {
          if (!t.active) return false;
          if (seen.has(t.key)) return false;
          seen.add(t.key);
          return true;
        });
        setVehicleTypes(unique);
      }
    } catch { /* silent */ }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setError(null); setSuccess(null); setFieldErrors({});

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
    const frequencies = frequenciesRaw ? frequenciesRaw.split(",").map(f => f.trim()).filter(Boolean) : undefined;

    const localErrors: Record<string, string> = {};
    if (!code) localErrors.code = "El código es obligatorio.";
    if (!name) localErrors.name = "El nombre es obligatorio.";
    if (Object.keys(localErrors).length > 0) { setFieldErrors(localErrors); setSaving(false); return; }

    const payload: Record<string, unknown> = { code, name, type, status };
    payload.companyId = companyId || null;
    if (vehicleTypeKey) payload.vehicleTypeKey = vehicleTypeKey;
    if (stops != null && !isNaN(stops)) payload.stops = stops;
    if (length) payload.length = length;
    if (frequencies && frequencies.length > 0) payload.frequencies = frequencies;
    payload.waypoints = waypoints;

    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/rutas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
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
      setWaypoints(data.data.waypoints ?? []);
      setSuccess("Ruta actualizada correctamente.");
      setTimeout(() => setSuccess(null), 3500);
    } catch { setError("Error de conexión."); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/rutas/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "No se pudo eliminar la ruta."); return; }
      router.push("/rutas");
    } catch { setError("Error de conexión."); }
    finally { setDeleting(false); setConfirmDelete(false); }
  }

  if (notFound) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <DashboardHero kicker="Rutas · RF-09" title="Ruta no encontrada" />
        <div style={{
          padding: "32px 24px", background: "#fff", border: `1px solid ${INK2}`,
          borderRadius: 12, color: INK6, textAlign: "center", fontSize: "0.875rem",
        }}>
          La ruta solicitada no existe o fue eliminada.
        </div>
        <Link href="/rutas" style={{
          alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7,
          height: 36, padding: "0 14px", borderRadius: 8,
          border: `1px solid ${INK2}`, background: "#fff", color: INK6,
          fontWeight: 600, fontSize: "0.8125rem", textDecoration: "none",
        }}>
          <ArrowLeft size={13} />Volver a rutas
        </Link>
      </div>
    );
  }

  if (loading || !route) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <DashboardHero kicker="Rutas · RF-09" title="Cargando ruta…" />
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ height: 140, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  const canEdit = CAN_EDIT.includes(user?.role ?? "");
  const heroAction = (
    <div style={{ display: "flex", gap: 6 }}>
      <Link href="/rutas" style={{
        display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
        borderRadius: 7, border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)",
        fontWeight: 600, fontSize: "0.8125rem", textDecoration: "none",
      }}>
        <ArrowLeft size={12} />Volver
      </Link>
      {canEdit && (
        <button form="ruta-form" type="submit" disabled={saving}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px",
            borderRadius: 7, border: "none", background: "#fff", color: INK9,
            fontWeight: 700, fontSize: "0.8125rem", cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "inherit", opacity: saving ? 0.7 : 1,
          }}>
          {saving ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} /> : <Save size={12} />}
          {saving ? "Guardando…" : "Guardar"}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      <DashboardHero
        kicker={`Rutas · ${canEdit ? "Editar" : "Detalle"}`}
        title={`${route.code} · ${route.name}`}
        pills={[
          { label: "Tipo", value: route.type === "ruta" ? "Ruta fija" : "Zona" },
          { label: "Estado", value: route.status === "activa" ? "Activa" : "Suspendida", warn: route.status !== "activa" },
          { label: "Vehículos", value: route.vehicleCount },
          { label: "Paradas", value: waypoints.length },
        ]}
        action={heroAction}
      />

      {error && (
        <div role="alert" style={{
          padding: "10px 14px", background: RED_BG, border: `1px solid ${RED_BD}`,
          borderRadius: 8, color: RED, fontSize: "0.8125rem",
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

      <form id="ruta-form" onSubmit={handleSubmit} noValidate
        style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12, alignItems: "start" }}>

          {/* Columna principal: Identificación + Operación + Trazado */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <SectionCard
                icon={<MapPin size={14} color={INK6} />}
                title="Identificación"
                subtitle="Código y nombre de la ruta"
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label htmlFor="code" style={LABEL}>Código <span style={{ color: RED, marginLeft: 3 }}>*</span></label>
                    <input id="code" name="code" defaultValue={route.code} disabled={!canEdit}
                      placeholder="R001"
                      style={{ ...(canEdit ? FIELD : READ), borderColor: fieldErrors.code ? RED : INK2 }}
                      onFocus={e => { if (canEdit && !fieldErrors.code) e.target.style.borderColor = INK9; }}
                      onBlur={e => { if (!fieldErrors.code) e.target.style.borderColor = INK2; }}
                    />
                    {fieldErrors.code && <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.code}</p>}
                  </div>
                  <div>
                    <label htmlFor="type" style={LABEL}>Tipo</label>
                    <select id="type" name="type" defaultValue={route.type} disabled={!canEdit}
                      style={{ ...(canEdit ? FIELD : READ), appearance: "none", paddingRight: 30, cursor: canEdit ? "pointer" : "default" }}
                    >
                      <option value="ruta">Ruta fija</option>
                      <option value="zona">Zona de operación</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="name" style={LABEL}>Nombre <span style={{ color: RED, marginLeft: 3 }}>*</span></label>
                    <input id="name" name="name" defaultValue={route.name} disabled={!canEdit}
                      placeholder="Terminal – Plaza de Armas"
                      style={{ ...(canEdit ? FIELD : READ), borderColor: fieldErrors.name ? RED : INK2 }}
                      onFocus={e => { if (canEdit && !fieldErrors.name) e.target.style.borderColor = INK9; }}
                      onBlur={e => { if (!fieldErrors.name) e.target.style.borderColor = INK2; }}
                    />
                    {fieldErrors.name && <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.name}</p>}
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon={<Briefcase size={14} color={INK6} />}
                title="Operación"
                subtitle="Empresa, tipo y estado"
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="companyId" style={LABEL}>Empresa</label>
                    <div style={{ position: "relative" }}>
                      <Building2 size={13} color={INK5} style={{
                        position: "absolute", left: 11, top: "50%",
                        transform: "translateY(-50%)", pointerEvents: "none",
                      }} />
                      <select id="companyId" name="companyId" defaultValue={route.companyId ?? ""} disabled={!canEdit}
                        style={{
                          ...(canEdit ? FIELD : READ),
                          paddingLeft: 32, appearance: "none", paddingRight: 30,
                          cursor: canEdit ? "pointer" : "default",
                        }}
                      >
                        <option value="">— Sin empresa —</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="vehicleTypeKey" style={LABEL}>Tipo de vehículo</label>
                    <select id="vehicleTypeKey" name="vehicleTypeKey" defaultValue={route.vehicleTypeKey ?? ""} disabled={!canEdit}
                      style={{ ...(canEdit ? FIELD : READ), appearance: "none", paddingRight: 30, cursor: canEdit ? "pointer" : "default" }}
                    >
                      <option value="">— Sin tipo —</option>
                      {vehicleTypes.map(t => <option key={t.id} value={t.key}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="status" style={LABEL}>Estado</label>
                    <select id="status" name="status" defaultValue={route.status} disabled={!canEdit}
                      style={{ ...(canEdit ? FIELD : READ), appearance: "none", paddingRight: 30, cursor: canEdit ? "pointer" : "default" }}
                    >
                      <option value="activa">Activa</option>
                      <option value="suspendida">Suspendida</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="stops" style={LABEL}>
                      Paradas
                      {waypoints.length > 0 && (
                        <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>
                          ({waypoints.length} en mapa)
                        </span>
                      )}
                    </label>
                    <input id="stops" name="stops" type="number" min={0}
                      defaultValue={route.stops ?? ""} disabled={!canEdit}
                      placeholder="12"
                      style={canEdit ? FIELD : READ}
                    />
                  </div>
                  <div>
                    <label htmlFor="length" style={LABEL}>Longitud</label>
                    <input id="length" name="length" defaultValue={route.length ?? ""} disabled={!canEdit}
                      placeholder="8.5 km" style={canEdit ? FIELD : READ} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="frequencies" style={LABEL}>
                      Frecuencias
                      <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>
                        (separadas por coma)
                      </span>
                    </label>
                    <input id="frequencies" name="frequencies"
                      defaultValue={route.frequencies ? route.frequencies.join(", ") : ""}
                      disabled={!canEdit} placeholder="10 min, 15 min"
                      style={canEdit ? FIELD : READ}
                    />
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Trazado en mapa */}
            <SectionCard
              icon={<Map size={14} color={INK6} />}
              title="Trazado en mapa"
              subtitle={canEdit
                ? "Click para agregar paradas. Arrastra los puntos para ajustar."
                : "Visualización del trazado registrado"
              }
            >
              <WaypointsEditor
                waypoints={waypoints}
                onChange={canEdit ? setWaypoints : undefined}
                height={420}
                readOnly={!canEdit}
              />
            </SectionCard>
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 16 }}>
            {/* Información del registro */}
            <div style={{
              background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
              overflow: "hidden",
            }}>
              <div style={{ padding: "10px 16px", borderBottom: `1px solid ${INK1}` }}>
                <div style={{
                  fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: INK5,
                }}>Información de la ruta</div>
              </div>
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                <SystemIdRow id={route.id} />
                <Row k="Código" v={route.code} />
                <Row k="Tipo" v={route.type === "ruta" ? "Ruta fija" : "Zona"} />
                <Row k="Vehículos asignados" v={`${route.vehicleCount}`} />
                {waypoints.length > 0 && <Row k="Paradas en mapa" v={`${waypoints.length}`} />}
                {route.companyName && <Row k="Empresa" v={route.companyName} />}
              </div>
            </div>

            {/* Zona de peligro */}
            {canEdit && (
              <DangerZoneSidebar
                code={route.code}
                name={route.name}
                confirmDelete={confirmDelete}
                setConfirmDelete={setConfirmDelete}
                deleting={deleting}
                onDelete={handleDelete}
              />
            )}
          </div>
        </div>
      </form>

      {!canEdit && (
        <div style={{
          padding: "10px 14px", background: INK1, border: `1px solid ${INK2}`,
          borderRadius: 8, color: INK6, fontSize: "0.8125rem",
        }}>
          Solo administradores municipales o superadministradores pueden editar esta ruta.
        </div>
      )}
    </div>
  );
}

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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 10px", borderRadius: 6, background: INK1, gap: 8,
    }}>
      <span style={{ fontSize: "0.75rem", color: INK5, flexShrink: 0 }}>{k}</span>
      <span style={{
        fontSize: "0.8125rem", fontWeight: 600, color: INK9,
        textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
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

function DangerZoneSidebar({
  code, name, confirmDelete, setConfirmDelete, deleting, onDelete,
}: {
  code: string; name: string;
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${RED_BD}`, borderRadius: 12,
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
            Eliminar esta ruta es permanente. Si tiene vehículos asignados deberás reasignarlos primero.
          </p>
          <button onClick={() => setConfirmDelete(true)} style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            height: 32, padding: "0 12px", borderRadius: 7,
            border: `1px solid ${RED_BD}`, background: RED_BG, color: RED,
            fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>
            <Trash2 size={12} />Eliminar ruta
          </button>
        </>
      ) : (
        <div style={{ background: RED_BG, border: `1px solid ${RED_BD}`, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontWeight: 700, color: RED, marginBottom: 4, fontSize: "0.8125rem" }}>¿Confirmar?</div>
          <p style={{ fontSize: "0.75rem", color: INK6, marginBottom: 10, lineHeight: 1.5 }}>
            Eliminarás <strong>{code} · {name}</strong>. Acción irreversible.
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
