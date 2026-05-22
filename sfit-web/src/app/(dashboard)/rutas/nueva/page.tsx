"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, AlertTriangle, MapPin, Building2, Briefcase, Loader2, Map,
  Globe, RefreshCw,
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { SectionCard } from "@/components/ui/SectionCard";
import { WaypointsEditor, type Waypoint } from "@/components/ui/WaypointsEditor";
import { INK1, INK2, INK5, INK6, INK9, RED, REDBG, REDBD, GRN, GRNBG, GRNBD } from "@/lib/design-tokens";
import { FIELD, LABEL } from "@/lib/form-styles";
import { hasWebPermission } from "@/lib/auth/roleMatrix";
import type { Role } from "@/lib/constants";
import {
  ACTIVE_DISTRICTS,
  ACTIVE_PROVINCE_NAME,
  INTERPROV_DESTINATIONS,
} from "@/lib/scope";

type Company = { id: string; razonSocial: string };
type VehicleType = { id: string; key: string; name: string; active: boolean };
type StoredUser = { role: string };

type ServiceScope = "urbano" | "interprovincial";

const SCOPE_LABEL: Record<ServiceScope, string> = {
  urbano: "Urbano",
  interprovincial: "Interprovincial",
};
const SCOPE_DESC: Record<ServiceScope, string> = {
  urbano: "Rutas dentro de los 6 distritos de Cotabambas · con paraderos",
  interprovincial: "Rutas a otras provincias / regiones (Cusco, Abancay, Arequipa)",
};
const URBAN_SCOPES = new Set<ServiceScope>(["urbano"]);
const INTERPROV_SCOPES = new Set<ServiceScope>(["interprovincial"]);

/**
 * Catálogo de distritos para el form de rutas.
 *
 * Orígenes (urbanas e interprovinciales): los 6 distritos de Cotabambas.
 * Destinos interprovinciales: Cusco / Arequipa / Abancay (ver lib/scope.ts).
 *
 * Los `traversedDistrictCodes` para rutas interprov solo cubren tramos
 * dentro de Cotabambas (paraderos intermedios antes de salir de la
 * provincia), por eso reutilizamos ACTIVE_DISTRICTS para esa lista.
 */
const ORIGIN_DISTRICTS = ACTIVE_DISTRICTS.map((d) => ({
  code: d.code,
  name: d.name,
  province: ACTIVE_PROVINCE_NAME,
}));
const DESTINATION_DISTRICTS = INTERPROV_DESTINATIONS.map((d) => ({
  code: d.code,
  name: d.name,
  province: d.province,
}));

const APTO = GRN; const APTO_BG = GRNBG; const APTO_BD = GRNBD;
const RED_BG = REDBG; const RED_BD = REDBD;

export default function NuevaRutaPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [serviceScope, setServiceScope] = useState<ServiceScope>("urbano");
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [originDistrictCode, setOriginDistrictCode] = useState("");
  const [destinationDistrictCode, setDestinationDistrictCode] = useState("");
  const [traversedDistrictCodes, setTraversedDistrictCodes] = useState<string[]>([]);
  const [suggestingCode, setSuggestingCode] = useState(false);
  const [polylineColor, setPolylineColor] = useState("#18181b");

  const codeInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-generar nombre de ruta: Origen – Destino a partir de los waypoints.
  useEffect(() => {
    if (waypoints.length >= 2) {
      const first = waypoints[0];
      const last = waypoints[waypoints.length - 1];
      const originLabel = first?.label?.trim() || "Origen";
      const destLabel = last?.label?.trim() || "Destino";
      const suggested = `${originLabel} – ${destLabel}`;
      if (nameInputRef.current) {
        // Solo sobrescribe si está vacío o coincide con algún auto-generado previo.
        const current = nameInputRef.current.value.trim();
        if (!current || current.includes(" – ")) {
          nameInputRef.current.value = suggested;
        }
      }
    } else if (waypoints.length === 1 && nameInputRef.current) {
      const label = waypoints[0]?.label?.trim();
      if (label && !nameInputRef.current.value.trim()) {
        nameInputRef.current.value = label;
      }
    }
  }, [waypoints]);

  const isUrban = URBAN_SCOPES.has(serviceScope);
  const isInterprov = INTERPROV_SCOPES.has(serviceScope);

  const suggestCode = useCallback(async () => {
    setSuggestingCode(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/rutas/suggest-code?scope=${serviceScope}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (res.ok && data.success && codeInputRef.current) {
        codeInputRef.current.value = data.data.code;
      }
    } catch { /* silent */ }
    finally { setSuggestingCode(false); }
  }, [serviceScope, router]);

  // Auto-suggest code on mount and when scope changes
  useEffect(() => {
    void suggestCode();
  }, [suggestCode]);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    try {
      const u = JSON.parse(raw) as StoredUser;
      if (!hasWebPermission(u.role as Role, "rutas", "create")) { router.replace("/dashboard"); return; }
    } catch { router.replace("/login"); return; }
  }, [router]);

  useEffect(() => {
    void loadCompanies();
    void loadVehicleTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceScope]);

  async function loadCompanies() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/empresas?limit=100&scope=${serviceScope}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (res.ok && data.success) setCompanies(data.data.items ?? []);
    } catch { /* silent */ }
  }

  async function loadVehicleTypes() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/tipos-vehiculo?limit=100&scope=${serviceScope}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
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
    const status = (form.get("status") as string) || "activa";

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
    payload.companyId = companyId || null;
    if (vehicleTypeKey) payload.vehicleTypeKey = vehicleTypeKey;

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
                <div style={{ display: "flex", gap: 6 }}>
                  <input id="code" name="code" ref={codeInputRef} placeholder="U-001"
                    style={{ ...FIELD, flex: 1, borderColor: fieldErrors.code ? RED : INK2 }}
                  />
                  <button type="button" disabled={suggestingCode}
                    onClick={() => { void suggestCode(); }}
                    title="Generar código"
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 36, height: 36, borderRadius: 7,
                      border: `1px solid ${INK2}`, background: "#fff", color: INK5,
                      cursor: suggestingCode ? "not-allowed" : "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <RefreshCw size={13} style={suggestingCode ? { animation: "spin 0.7s linear infinite" } : undefined} />
                  </button>
                </div>
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
                <input id="name" name="name" ref={nameInputRef}
                  placeholder={isUrban ? "Terminal – Plaza de Armas" : "Cusco – Lima"}
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
            </div>
          </SectionCard>
        </div>

        {/* Trazado en mapa — visible para ambas modalidades */}
        <SectionCard
          icon={<Map size={14} color={INK6} />}
          title="Trazado en mapa"
          subtitle={isUrban
            ? "Click para agregar paradas. Arrastra los puntos para ajustar."
            : "Busca origen y destino, luego traza los paraderos en el mapa."}
        >
          {fieldErrors.waypoints && (
            <div style={{
              padding: "8px 12px", background: RED_BG, border: `1px solid ${RED_BD}`,
              borderRadius: 7, color: RED, fontSize: "0.75rem", marginBottom: 10,
            }}>
              {fieldErrors.waypoints}
            </div>
          )}
          <WaypointsEditor
            waypoints={waypoints}
            onChange={setWaypoints}
            height={420}
            showSearch
            polylineColor={polylineColor}
            onPolylineColorChange={setPolylineColor}
          />
        </SectionCard>

        {/* Distritos — solo para interprovincial (metadata UBIGEO) */}
        {isInterprov && (
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
                    {ORIGIN_DISTRICTS.map(d => (
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
                    {DESTINATION_DISTRICTS.map(d => (
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
                {ORIGIN_DISTRICTS.map(d => {
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

      </form>
    </div>
  );
}
