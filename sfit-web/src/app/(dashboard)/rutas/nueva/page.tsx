"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, AlertTriangle, MapPin, Building2, Briefcase, Loader2, Map,
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { WaypointsEditor, type Waypoint } from "@/components/ui/WaypointsEditor";

type Company = { id: string; razonSocial: string };
type VehicleType = { id: string; key: string; name: string; active: boolean };
type StoredUser = { role: string };

const ALLOWED_CREATE = ["admin_municipal", "super_admin"];

/* Paleta sobria */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const RED = "#DC2626"; const RED_BG = "#FFF5F5"; const RED_BD = "#FCA5A5";

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

export default function NuevaRutaPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!ALLOWED_CREATE.includes(u.role)) { router.replace("/dashboard"); return; }
    void loadCompanies();
    void loadVehicleTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadCompanies() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/empresas?limit=100", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (res.ok && data.success) setCompanies(data.data.items ?? []);
    } catch { /* silent */ }
  }

  async function loadVehicleTypes() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/tipos-vehiculo?limit=100", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (res.ok && data.success) {
        // Deduplica por `key` (la base puede tener duplicados como "minibus" repetido).
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
    setLoading(true); setError(null); setFieldErrors({});

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
    if (Object.keys(localErrors).length > 0) { setFieldErrors(localErrors); setLoading(false); return; }

    const payload: Record<string, unknown> = { code, name, type, status };
    if (companyId) payload.companyId = companyId;
    if (vehicleTypeKey) payload.vehicleTypeKey = vehicleTypeKey;
    if (stops != null && !isNaN(stops)) payload.stops = stops;
    if (length) payload.length = length;
    if (frequencies && frequencies.length > 0) payload.frequencies = frequencies;
    payload.waypoints = waypoints;

    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/rutas", {
        method: "POST",
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
          setError(data.error ?? "No se pudo crear la ruta.");
        }
        return;
      }
      router.push("/rutas");
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

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
      <button form="ruta-form" type="submit" disabled={loading} style={{
        display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px",
        borderRadius: 7, border: "none", background: "#fff", color: INK9,
        fontWeight: 700, fontSize: "0.8125rem", cursor: loading ? "not-allowed" : "pointer",
        fontFamily: "inherit", opacity: loading ? 0.7 : 1,
      }}>
        {loading ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} /> : <Save size={12} />}
        {loading ? "Creando…" : "Crear ruta"}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      <DashboardHero
        kicker="Rutas · RF-09"
        title="Nueva ruta"
        pills={[
          { label: "Paradas", value: waypoints.length },
          { label: "Tipo", value: "Ruta fija" },
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

      <form id="ruta-form" onSubmit={handleSubmit} noValidate
        style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Identificación + Operación en grid 2 cols */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <SectionCard
            icon={<MapPin size={14} color={INK6} />}
            title="Identificación"
            subtitle="Código y nombre de la ruta"
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label htmlFor="code" style={LABEL}>Código <span style={{ color: RED, marginLeft: 3 }}>*</span></label>
                <input id="code" name="code" placeholder="R001"
                  style={{ ...FIELD, borderColor: fieldErrors.code ? RED : INK2 }}
                  onFocus={e => { if (!fieldErrors.code) e.target.style.borderColor = INK9; }}
                  onBlur={e => { if (!fieldErrors.code) e.target.style.borderColor = INK2; }}
                />
                {fieldErrors.code && <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.code}</p>}
              </div>
              <div>
                <label htmlFor="type" style={LABEL}>Tipo</label>
                <select id="type" name="type" defaultValue="ruta"
                  style={{ ...FIELD, appearance: "none", paddingRight: 30, cursor: "pointer" }}
                >
                  <option value="ruta">Ruta fija</option>
                  <option value="zona">Zona de operación</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="name" style={LABEL}>Nombre <span style={{ color: RED, marginLeft: 3 }}>*</span></label>
                <input id="name" name="name" placeholder="Terminal – Plaza de Armas"
                  style={{ ...FIELD, borderColor: fieldErrors.name ? RED : INK2 }}
                  onFocus={e => { if (!fieldErrors.name) e.target.style.borderColor = INK9; }}
                  onBlur={e => { if (!fieldErrors.name) e.target.style.borderColor = INK2; }}
                />
                {fieldErrors.name && <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.name}</p>}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={<Briefcase size={14} color={INK6} />}
            title="Operación"
            subtitle="Empresa, tipo de vehículo y estado"
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="companyId" style={LABEL}>Empresa</label>
                <div style={{ position: "relative" }}>
                  <Building2 size={13} color={INK5} style={{
                    position: "absolute", left: 11, top: "50%",
                    transform: "translateY(-50%)", pointerEvents: "none",
                  }} />
                  <select id="companyId" name="companyId" defaultValue=""
                    style={{ ...FIELD, paddingLeft: 32, appearance: "none", paddingRight: 30, cursor: "pointer" }}
                  >
                    <option value="">— Sin empresa —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="vehicleTypeKey" style={LABEL}>Tipo de vehículo</label>
                <select id="vehicleTypeKey" name="vehicleTypeKey" defaultValue=""
                  style={{ ...FIELD, appearance: "none", paddingRight: 30, cursor: "pointer" }}
                >
                  <option value="">— Sin tipo —</option>
                  {vehicleTypes.map(t => <option key={t.id} value={t.key}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="status" style={LABEL}>Estado inicial</label>
                <select id="status" name="status" defaultValue="activa"
                  style={{ ...FIELD, appearance: "none", paddingRight: 30, cursor: "pointer" }}
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
                  placeholder={waypoints.length > 0 ? String(waypoints.length) : "12"}
                  style={FIELD}
                />
              </div>
              <div>
                <label htmlFor="length" style={LABEL}>Longitud</label>
                <input id="length" name="length" placeholder="8.5 km" style={FIELD} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="frequencies" style={LABEL}>
                  Frecuencias
                  <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>
                    (separadas por coma)
                  </span>
                </label>
                <input id="frequencies" name="frequencies" placeholder="10 min, 15 min" style={FIELD} />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Trazado en mapa — full width */}
        <SectionCard
          icon={<Map size={14} color={INK6} />}
          title="Trazado en mapa"
          subtitle="Click para agregar paradas. Arrastra los puntos para ajustar."
        >
          <WaypointsEditor waypoints={waypoints} onChange={setWaypoints} height={420} />
        </SectionCard>
      </form>
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
