"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, AlertTriangle, MapPin, Building2, Briefcase, Loader2, Map,
  Clock, Plus, X, Globe,
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { WaypointsEditor, type Waypoint } from "@/components/ui/WaypointsEditor";

type Company = { id: string; razonSocial: string };
type VehicleType = { id: string; key: string; name: string; active: boolean };
type StoredUser = { role: string };

type ServiceScope =
  | "urbano_distrital"
  | "urbano_provincial"
  | "interprovincial_regional"
  | "interregional_nacional";

const SCOPE_LABEL: Record<ServiceScope, string> = {
  urbano_distrital: "Urbano distrital",
  urbano_provincial: "Urbano provincial",
  interprovincial_regional: "Interprovincial / regional",
  interregional_nacional: "Interregional / nacional",
};
const SCOPE_DESC: Record<ServiceScope, string> = {
  urbano_distrital: "Dentro de un distrito · autoridad municipal distrital",
  urbano_provincial: "Entre distritos de la misma provincia · municipal provincial",
  interprovincial_regional: "Entre provincias del mismo o distinto departamento · regional + MTC",
  interregional_nacional: "Entre departamentos · MTC",
};
const URBAN_SCOPES = new Set<ServiceScope>(["urbano_distrital", "urbano_provincial"]);
const INTERPROV_SCOPES = new Set<ServiceScope>(["interprovincial_regional", "interregional_nacional"]);

/** Catálogo mínimo de distritos de demo (UBIGEO 6 dígitos).
 *  Si existe `/api/distritos` se usa; este array es fallback. */
const FALLBACK_DISTRICTS: Array<{ code: string; name: string; province: string }> = [
  { code: "080101", name: "Cusco",         province: "Cusco" },
  { code: "080102", name: "Ccorca",        province: "Cusco" },
  { code: "080103", name: "Poroy",         province: "Cusco" },
  { code: "080104", name: "San Jerónimo",  province: "Cusco" },
  { code: "080105", name: "San Sebastián", province: "Cusco" },
  { code: "080106", name: "Santiago",      province: "Cusco" },
  { code: "080107", name: "Saylla",        province: "Cusco" },
  { code: "080108", name: "Wanchaq",       province: "Cusco" },
  { code: "150101", name: "Lima",          province: "Lima" },
  { code: "150116", name: "Lince",         province: "Lima" },
  { code: "150122", name: "Miraflores",    province: "Lima" },
  { code: "150128", name: "San Isidro",    province: "Lima" },
  { code: "150140", name: "Surquillo",     province: "Lima" },
  { code: "040101", name: "Arequipa",      province: "Arequipa" },
  { code: "040102", name: "Alto Selva Alegre", province: "Arequipa" },
  { code: "040106", name: "Cerro Colorado", province: "Arequipa" },
  { code: "040112", name: "Mariano Melgar", province: "Arequipa" },
  { code: "040125", name: "Yanahuara",     province: "Arequipa" },
];

const ALLOWED_CREATE = ["admin_municipal", "super_admin", "operador"];

/* Paleta */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const RED = "#DC2626"; const RED_BG = "#FFF5F5"; const RED_BD = "#FCA5A5";
const APTO = "#15803d"; const APTO_BG = "#F0FDF4"; const APTO_BD = "#86EFAC";

const FIELD: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 12px", borderRadius: 8,
  border: `1px solid ${INK2}`, fontSize: "0.875rem", color: INK9,
  background: "#fff", outline: "none", boxSizing: "border-box",
  fontFamily: "var(--font-inter), Inter, sans-serif",
};
const LABEL: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 6,
};

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export default function NuevaRutaPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [districts] = useState(FALLBACK_DISTRICTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [serviceScope, setServiceScope] = useState<ServiceScope>("urbano_distrital");
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [originDistrictCode, setOriginDistrictCode] = useState("");
  const [destinationDistrictCode, setDestinationDistrictCode] = useState("");
  const [traversedDistrictCodes, setTraversedDistrictCodes] = useState<string[]>([]);

  const [departureSchedules, setDepartureSchedules] = useState<string[]>([]);
  const [scheduleDraft, setScheduleDraft] = useState("");

  const isUrban = URBAN_SCOPES.has(serviceScope);
  const isInterprov = INTERPROV_SCOPES.has(serviceScope);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    try {
      const u = JSON.parse(raw) as StoredUser;
      if (!ALLOWED_CREATE.includes(u.role)) { router.replace("/dashboard"); return; }
    } catch { router.replace("/login"); return; }
    void loadCompanies();
    void loadVehicleTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadCompanies() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/empresas?limit=100", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (res.ok && data.success) setCompanies(data.data.items ?? []);
    } catch { /* silent */ }
  }

  async function loadVehicleTypes() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/tipos-vehiculo?limit=100", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (res.ok && data.success) {
        const items: VehicleType[] = data.data.items ?? [];
        const seen = new Set<string>();
        setVehicleTypes(items.filter(t => {
          if (!t.active) return false;
          if (seen.has(t.key)) return false;
          seen.add(t.key); return true;
        }));
      }
    } catch { /* silent */ }
  }

  function addSchedule() {
    const v = scheduleDraft.trim();
    if (!TIME_REGEX.test(v)) {
      setFieldErrors(e => ({ ...e, schedule: "Formato HH:mm requerido" }));
      return;
    }
    if (departureSchedules.includes(v)) {
      setFieldErrors(e => ({ ...e, schedule: "Ese horario ya está agregado" }));
      return;
    }
    setDepartureSchedules([...departureSchedules, v].sort());
    setScheduleDraft("");
    setFieldErrors(e => ({ ...e, schedule: "" }));
  }
  function removeSchedule(s: string) {
    setDepartureSchedules(departureSchedules.filter(x => x !== s));
  }

  function toggleTraversed(code: string) {
    setTraversedDistrictCodes(prev =>
      prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]
    );
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
    if (isUrban && waypoints.length < 2) localErrors.waypoints = "Las rutas urbanas necesitan al menos 2 paradas.";
    if (isInterprov && !originDistrictCode) localErrors.originDistrictCode = "Selecciona el distrito de origen.";
    if (isInterprov && !destinationDistrictCode) localErrors.destinationDistrictCode = "Selecciona el distrito de destino.";
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors); setLoading(false); return;
    }

    const payload: Record<string, unknown> = { code, name, type, status, serviceScope };
    if (companyId) payload.companyId = companyId;
    if (vehicleTypeKey) payload.vehicleTypeKey = vehicleTypeKey;
    if (stops != null && !isNaN(stops)) payload.stops = stops;
    if (length) payload.length = length;
    if (frequencies && frequencies.length > 0) payload.frequencies = frequencies;
    if (departureSchedules.length > 0) payload.departureSchedules = departureSchedules;

    if (isUrban) {
      payload.waypoints = waypoints;
    } else {
      payload.originDistrictCode = originDistrictCode;
      payload.destinationDistrictCode = destinationDistrictCode;
      // Garantiza que origin/dest estén incluidos en la lista cruzada.
      const traversed = Array.from(new Set([
        originDistrictCode, destinationDistrictCode, ...traversedDistrictCodes,
      ].filter(Boolean)));
      if (traversed.length > 0) payload.traversedDistrictCodes = traversed;
      // Para interprov pueden mandarse waypoints opcionales pero no son obligatorios.
      if (waypoints.length > 0) payload.waypoints = waypoints;
    }

    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/rutas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { router.replace("/login"); return; }
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
          { label: "Modalidad", value: SCOPE_LABEL[serviceScope] },
          { label: isUrban ? "Paradas" : "Distritos", value: isUrban ? waypoints.length : (traversedDistrictCodes.length || (originDistrictCode && destinationDistrictCode ? 2 : 0)) },
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

        {/* Modalidad — primero, condiciona el resto del formulario */}
        <SectionCard
          icon={<Globe size={14} color={INK6} />}
          title="Modalidad de servicio"
          subtitle="Determina los datos requeridos y la autoridad reguladora"
        >
          <div style={{
            display: "grid", gap: 8,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}>
            {(Object.keys(SCOPE_LABEL) as ServiceScope[]).map(s => {
              const active = serviceScope === s;
              return (
                <button
                  key={s} type="button" onClick={() => setServiceScope(s)}
                  style={{
                    textAlign: "left", padding: "10px 12px",
                    borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                    background: active ? APTO_BG : "#fff",
                    border: `1.5px solid ${active ? APTO_BD : INK2}`,
                    color: INK9,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 2 }}>
                    {SCOPE_LABEL[s]}
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: INK5, lineHeight: 1.4 }}>
                    {SCOPE_DESC[s]}
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* Identificación + Operación */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="cols-2-responsive">
          <SectionCard
            icon={<MapPin size={14} color={INK6} />}
            title="Identificación"
            subtitle="Código y nombre"
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label htmlFor="code" style={LABEL}>Código <span style={{ color: RED, marginLeft: 3 }}>*</span></label>
                <input id="code" name="code" placeholder="R001"
                  style={{ ...FIELD, borderColor: fieldErrors.code ? RED : INK2 }}
                />
                {fieldErrors.code && <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.code}</p>}
              </div>
              <div>
                <label htmlFor="type" style={LABEL}>Tipo</label>
                <select id="type" name="type" defaultValue="ruta"
                  style={{ ...FIELD, appearance: "none", paddingRight: 30 }}>
                  <option value="ruta">Ruta fija</option>
                  <option value="zona">Zona de operación</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="name" style={LABEL}>Nombre <span style={{ color: RED, marginLeft: 3 }}>*</span></label>
                <input id="name" name="name" placeholder={isUrban ? "Terminal – Plaza de Armas" : "Cusco – Lima"}
                  style={{ ...FIELD, borderColor: fieldErrors.name ? RED : INK2 }}
                />
                {fieldErrors.name && <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.name}</p>}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={<Briefcase size={14} color={INK6} />}
            title="Operación"
            subtitle="Empresa y tipo de vehículo"
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
                    style={{ ...FIELD, paddingLeft: 32, appearance: "none", paddingRight: 30 }}>
                    <option value="">— Sin empresa —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="vehicleTypeKey" style={LABEL}>Tipo de vehículo</label>
                <select id="vehicleTypeKey" name="vehicleTypeKey" defaultValue=""
                  style={{ ...FIELD, appearance: "none", paddingRight: 30 }}>
                  <option value="">— Sin tipo —</option>
                  {vehicleTypes.map(t => <option key={t.id} value={t.key}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="status" style={LABEL}>Estado inicial</label>
                <select id="status" name="status" defaultValue="activa"
                  style={{ ...FIELD, appearance: "none", paddingRight: 30 }}>
                  <option value="activa">Activa</option>
                  <option value="suspendida">Suspendida</option>
                </select>
              </div>
              <div>
                <label htmlFor="stops" style={LABEL}>
                  Paradas
                  {isUrban && waypoints.length > 0 && (
                    <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>
                      ({waypoints.length} en mapa)
                    </span>
                  )}
                </label>
                <input id="stops" name="stops" type="number" min={0}
                  placeholder={isUrban && waypoints.length > 0 ? String(waypoints.length) : "12"}
                  style={FIELD}
                />
              </div>
              <div>
                <label htmlFor="length" style={LABEL}>Longitud</label>
                <input id="length" name="length" placeholder={isUrban ? "8.5 km" : "1100 km"} style={FIELD} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="frequencies" style={LABEL}>
                  Frecuencias
                  <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>
                    (separadas por coma · útiles en urbanas)
                  </span>
                </label>
                <input id="frequencies" name="frequencies" placeholder="10 min, 15 min" style={FIELD} />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* UI condicional por scope */}
        {isUrban ? (
          <SectionCard
            icon={<Map size={14} color={INK6} />}
            title="Trazado en mapa"
            subtitle="Click para agregar paradas. Arrastra los puntos para ajustar."
          >
            {fieldErrors.waypoints && (
              <div style={{
                padding: "8px 12px", background: RED_BG, border: `1px solid ${RED_BD}`,
                borderRadius: 7, color: RED, fontSize: "0.75rem", marginBottom: 10,
              }}>
                {fieldErrors.waypoints}
              </div>
            )}
            <WaypointsEditor waypoints={waypoints} onChange={setWaypoints} height={420} />
          </SectionCard>
        ) : (
          <>
            <SectionCard
              icon={<Globe size={14} color={INK6} />}
              title="Origen y destino"
              subtitle="Selecciona los distritos extremos (UBIGEO)"
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="cols-2-responsive">
                <div>
                  <label htmlFor="originDistrictCode" style={LABEL}>
                    Distrito de origen <span style={{ color: RED, marginLeft: 3 }}>*</span>
                  </label>
                  <select id="originDistrictCode" value={originDistrictCode}
                    onChange={e => setOriginDistrictCode(e.target.value)}
                    style={{ ...FIELD, borderColor: fieldErrors.originDistrictCode ? RED : INK2, appearance: "none", paddingRight: 30 }}>
                    <option value="">— Seleccionar —</option>
                    {districts.map(d => (
                      <option key={d.code} value={d.code}>
                        {d.name} ({d.province}) · {d.code}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.originDistrictCode && <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED }}>{fieldErrors.originDistrictCode}</p>}
                </div>
                <div>
                  <label htmlFor="destinationDistrictCode" style={LABEL}>
                    Distrito de destino <span style={{ color: RED, marginLeft: 3 }}>*</span>
                  </label>
                  <select id="destinationDistrictCode" value={destinationDistrictCode}
                    onChange={e => setDestinationDistrictCode(e.target.value)}
                    style={{ ...FIELD, borderColor: fieldErrors.destinationDistrictCode ? RED : INK2, appearance: "none", paddingRight: 30 }}>
                    <option value="">— Seleccionar —</option>
                    {districts.map(d => (
                      <option key={d.code} value={d.code}>
                        {d.name} ({d.province}) · {d.code}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.destinationDistrictCode && <p style={{ marginTop: 5, fontSize: "0.75rem", color: RED }}>{fieldErrors.destinationDistrictCode}</p>}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={<MapPin size={14} color={INK6} />}
              title="Distritos que cruza"
              subtitle="Opcional · útil para inspecciones cruzadas en ruta"
            >
              <div style={{
                display: "grid", gap: 6,
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                maxHeight: 220, overflowY: "auto",
                padding: "4px 2px",
              }}>
                {districts.map(d => {
                  const checked = traversedDistrictCodes.includes(d.code);
                  return (
                    <label key={d.code} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 10px", borderRadius: 7,
                      border: `1px solid ${checked ? APTO_BD : INK2}`,
                      background: checked ? APTO_BG : "#fff",
                      cursor: "pointer", fontSize: "0.75rem", color: INK9,
                    }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleTraversed(d.code)}
                        style={{ accentColor: APTO }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.name}
                        </div>
                        <div style={{ fontSize: "0.625rem", color: INK5, fontFamily: "ui-monospace, monospace" }}>
                          {d.code}
                        </div>
                      </span>
                    </label>
                  );
                })}
              </div>
            </SectionCard>
          </>
        )}

        {/* Horarios de salida (común a interprovincial; opcional para urbano) */}
        <SectionCard
          icon={<Clock size={14} color={INK6} />}
          title="Horarios de salida"
          subtitle={isInterprov
            ? "Salidas programadas (HH:mm)."
            : "Opcional · usa esto si tu ruta urbana tiene salidas fijas en lugar de frecuencias."}
        >
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="time" value={scheduleDraft}
              onChange={e => setScheduleDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSchedule(); } }}
              placeholder="HH:mm"
              style={{ ...FIELD, width: 120 }}
            />
            <button type="button" onClick={addSchedule}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                height: 38, padding: "0 12px", borderRadius: 8,
                border: "none", background: INK9, color: "#fff",
                fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>
              <Plus size={12} />Agregar
            </button>
            {fieldErrors.schedule && (
              <span style={{ fontSize: "0.75rem", color: RED, fontWeight: 500 }}>{fieldErrors.schedule}</span>
            )}
          </div>
          {departureSchedules.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {departureSchedules.map(s => (
                <span key={s} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 6px 4px 10px",
                  background: INK1, border: `1px solid ${INK2}`, borderRadius: 999,
                  fontSize: "0.75rem", fontWeight: 600, color: INK9,
                  fontFamily: "ui-monospace, monospace", letterSpacing: "0.04em",
                }}>
                  {s}
                  <button type="button" onClick={() => removeSchedule(s)} style={{
                    width: 18, height: 18, borderRadius: "50%",
                    border: "none", background: "#fff", color: INK6, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
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
