"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MapPin, Building2, Truck, Car, Download, FileCheck, AlertCircle, Users, ClipboardList } from "lucide-react";
import { type ColumnDef, DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { PageHeader } from "@/components/ui/PageHeader";
import { KPIStrip } from "@/components/dashboard/KPIStrip";

// ── Paleta SFIT ────────────────────────────────────────────────────────────────
const G = "#6C0606"; const GD = "#4A0303"; const GBG = "#FBEAEA"; const GBR = "#D9B0B0";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d";
const NO = "#DC2626"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const INFO = "#1D4ED8";
const WARN = "#b45309";

// ── Types ──────────────────────────────────────────────────────────────────────
type ApiResponse<T> = { success: boolean; data?: T; error?: string };
type GlobalStats = {
  provincesCount: number; municipalitiesCount: number; activeMunicipalities: number;
  usersByRole: Record<string, number>; usersPendingApproval: number;
  companiesCount: number; vehicleTypesCount: number;
  sanctionsThisMonth: number; reportsPending: number;
};
type Province = { id: string; name: string; active?: boolean };
type Municipality = { id: string; name: string; provinceId: string; active: boolean };
type MunicipioRow = { municipioId: string; municipioNombre: string; inspecciones: number; aprobadas: number; aprobadasPct: number; reportes: number; sanciones: number };
type MunicipalKpis = { activeVehicles: number; activeDrivers: number; inspectionsThisMonth: number; reportsPending: number };
type InspeccionResultado = { result: string; count: number };
type LowRepVehicle = { _id: string; plate: string; brand: string; model: string; reputationScore: number; lastInspectionStatus: string; status: string };
type SancionItem = { _id: string; faultType: string; amountSoles: number; status: string; createdAt: string; vehicleId?: { plate?: string; brand?: string; model?: string } };
type MunicipalStats = { kpis: MunicipalKpis; inspeccionesPorResultado: InspeccionResultado[]; top5VehiculosBajaReputacion: LowRepVehicle[]; ultimasSanciones: SancionItem[] };
type StoredUser = { role: string; provinceId?: string; municipalityId?: string };

const ROLE_LABELS: Record<string, string> = { super_admin: "Super Administrador", admin_provincial: "Administrador Provincial", admin_municipal: "Administrador Municipal", fiscal: "Fiscal / Inspector", operador: "Operador", conductor: "Conductor", ciudadano: "Ciudadano" };
const ROLE_COLORS: Record<string, string> = { super_admin: G, admin_provincial: INK9, admin_municipal: INFO, fiscal: APTO, operador: WARN, conductor: INK6, ciudadano: "#a1a1aa" };

function getToken(): string { return typeof window === "undefined" ? "" : localStorage.getItem("sfit_access_token") ?? ""; }

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: INK9, border: "none", borderRadius: 10, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,.22)" }}>
      {label && <div style={{ fontSize: "0.6875rem", color: INK5, marginBottom: 6, fontWeight: 600, letterSpacing: "0.08em" }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block" }} />
          <span style={{ fontSize: "0.8125rem", color: "#e4e4e7", fontWeight: 600 }}>{p.name}:</span>
          <span style={{ fontSize: "0.8125rem", color: "#fff", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Section header util ────────────────────────────────────────────────────────
function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
      <div>
        <div style={{ fontSize: "1rem", fontWeight: 700, color: INK9, letterSpacing: "-0.01em" }}>{title}</div>
        {sub && <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export default function EstadisticasPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [municipiosRows, setMunicipiosRows] = useState<MunicipioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [municipalStats, setMunicipalStats] = useState<MunicipalStats | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (raw) setUser(JSON.parse(raw) as StoredUser);
  }, []);

  const load = useCallback(async (currentUser: StoredUser) => {
    setLoading(true); setError(null);
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const [sres, pres, mres, munires] = await Promise.all([
        fetch("/api/admin/stats/global", { headers }),
        fetch("/api/provincias", { headers }),
        fetch("/api/municipalidades", { headers }),
        fetch("/api/admin/stats/municipios", { headers }),
      ]);
      if (sres.ok) { const d: ApiResponse<GlobalStats> = await sres.json(); if (d.success && d.data) setStats(d.data); }
      if (pres.ok) { const d: ApiResponse<{ items: Province[] }> = await pres.json(); if (d.success && d.data) { const items = d.data.items ?? []; setProvinces(currentUser.role === "admin_provincial" && currentUser.provinceId ? items.filter(p => p.id === currentUser.provinceId) : items); } }
      if (mres.ok) { const d: ApiResponse<{ items: Municipality[] }> = await mres.json(); if (d.success && d.data) { const items = d.data.items ?? []; setMunicipalities(currentUser.role === "admin_provincial" && currentUser.provinceId ? items.filter(m => m.provinceId === currentUser.provinceId) : items); } }
      if (munires.ok) { const d: ApiResponse<{ rows: MunicipioRow[] }> = await munires.json(); if (d.success && d.data) setMunicipiosRows(d.data.rows ?? []); }
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }, []);

  const loadMunicipal = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/stats/municipal", { headers: { Authorization: `Bearer ${getToken()}` } });
      const data: ApiResponse<MunicipalStats> = await res.json();
      if (res.ok && data.success && data.data) setMunicipalStats(data.data);
      else setError(data.error ?? "Error al cargar estadísticas.");
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role === "super_admin" || user.role === "admin_provincial") void load(user);
    else if (user.role === "admin_municipal") void loadMunicipal();
    else setLoading(false);
  }, [user, load, loadMunicipal]);

  const pieData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.usersByRole ?? {}).filter(([, v]) => v > 0).map(([role, count]) => ({ name: ROLE_LABELS[role] ?? role, value: count, color: ROLE_COLORS[role] ?? INK5 }));
  }, [stats]);

  const barData = useMemo(() => {
    const map = new Map<string, { name: string; activas: number; inactivas: number }>();
    provinces.forEach(p => map.set(p.id, { name: p.name, activas: 0, inactivas: 0 }));
    municipalities.forEach(m => { const e = map.get(m.provinceId); if (!e) return; if (m.active) e.activas++; else e.inactivas++; });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [provinces, municipalities]);

  const municipiosColumns = useMemo<ColumnDef<MunicipioRow, unknown>[]>(() => [
    { accessorKey: "municipioNombre", header: "Municipio", cell: ({ getValue }) => <span style={{ fontWeight: 600, color: INK9 }}>{getValue() as string}</span> },
    { accessorKey: "inspecciones", header: "Inspecciones", cell: ({ getValue }) => <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{getValue() as number}</span> },
    {
      accessorKey: "aprobadasPct", header: "Aprobadas %",
      cell: ({ getValue }) => {
        const pct = getValue() as number;
        const color = pct >= 70 ? APTO : pct >= 40 ? WARN : NO;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 64, height: 5, background: INK2, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999 }} />
            </div>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color, fontSize: "0.8125rem" }}>{pct}%</span>
          </div>
        );
      },
    },
    { accessorKey: "reportes", header: "Reportes", cell: ({ getValue }) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{getValue() as number}</span> },
    { accessorKey: "sanciones", header: "Sanciones", cell: ({ getValue }) => { const v = getValue() as number; return <Badge variant={v > 0 ? "suspendido" : "inactivo"}>{v}</Badge>; } },
  ], []);

  function exportUsersCsv() {
    if (!stats) return;
    const rows = ["Rol,Cantidad", ...Object.entries(stats.usersByRole ?? {}).map(([r, c]) => `${ROLE_LABELS[r] ?? r},${c}`)];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" }));
    a.download = `sfit-usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  if (!user) return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader kicker="Cargando" title="Estadísticas" />
      <div style={{ padding: 24, color: INK5 }}>Cargando…</div>
    </div>
  );

  if (user.role !== "super_admin" && user.role !== "admin_provincial" && user.role !== "admin_municipal") return <ComingSoon title="Estadísticas" rf="RF-19" />;
  if (user.role === "admin_municipal") return <MunicipalDashboard loading={loading} error={error} data={municipalStats} />;

  const totalUsers = stats ? Object.values(stats.usersByRole ?? {}).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${INK9} 0%, #2a2a2e 100%)`, borderRadius: 16, padding: "24px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: G, marginBottom: 6 }}>
            {user.role === "super_admin" ? "Panel global · RF-19" : "Panel provincial · RF-19"}
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.03em" }}>Estadísticas</h1>
          <p style={{ fontSize: "0.875rem", color: "#a1a1aa", marginTop: 6, margin: 0 }}>
            {loading ? "Cargando datos…" : `${provinces.length} provincias · ${municipalities.filter(m => m.active).length} municipios activos · ${totalUsers} usuarios`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <Button variant="outline" size="md" onClick={exportUsersCsv} style={{ background: "rgba(255,255,255,.08)", border: "1.5px solid rgba(255,255,255,.15)", color: "#fff" }}>
            <Download size={15} strokeWidth={1.8} />Exportar CSV
          </Button>
        </div>
      </div>

      {error && <div role="alert" style={{ background: NOBG, border: `1.5px solid ${NOBD}`, borderRadius: 12, padding: 14, color: NO, fontSize: "0.9rem", fontWeight: 500 }}>{error}</div>}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          {[0, 1, 2, 3].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 96, borderRadius: 12 }} />)}
        </div>
      ) : !stats ? (
        <div style={{ padding: "40px 24px", textAlign: "center", color: INK5, background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14 }}>No hay datos disponibles todavía.</div>
      ) : (
        <>
          {/* KPI Strip */}
          <KPIStrip cols={4} items={[
            { label: "PROVINCIAS", value: provinces.length, subtitle: "en jurisdicción", accent: G, icon: MapPin },
            { label: "MUNICIPIOS", value: municipalities.length, subtitle: `${municipalities.filter(m => m.active).length} activas`, accent: APTO, icon: Building2 },
            { label: "EMPRESAS", value: stats.companiesCount, subtitle: "registradas", accent: INK9, icon: Truck },
            { label: "TIPOS VEHÍC.", value: stats.vehicleTypesCount, subtitle: "configurados", accent: WARN, icon: Car },
          ]} />

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Donut — usuarios por rol */}
            <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, padding: "20px 22px" }}>
              <SectionTitle title="Usuarios por rol" sub="Distribución total de cuentas en la plataforma" />
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ width: "55%", height: 220 }}>
                  {pieData.length === 0 ? <div style={{ color: INK5, fontSize: "0.875rem", paddingTop: 60 }}>Sin datos.</div> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={56} paddingAngle={2} startAngle={90} endAngle={450}>
                          {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  {pieData.map((e, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: e.color, flexShrink: 0 }} />
                      <span style={{ fontSize: "0.75rem", color: INK6, flex: 1, lineHeight: 1.3 }}>{e.name}</span>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: INK9 }}>{e.value}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, padding: "8px 10px", background: GBG, border: `1px solid ${GBR}`, borderRadius: 8 }}>
                    <span style={{ fontSize: "0.75rem", color: GD, fontWeight: 600 }}>Total: </span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 800, color: G }}>{totalUsers}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bar — municipios por provincia */}
            <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, padding: "20px 22px" }}>
              <SectionTitle title="Municipalidades por provincia" sub="Activas vs. inactivas" />
              <div style={{ width: "100%", height: 220 }}>
                {barData.length === 0 ? <div style={{ color: INK5, fontSize: "0.875rem" }}>Sin datos.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 4, right: 4, left: -16, bottom: 24 }} barCategoryGap="35%">
                      <CartesianGrid strokeDasharray="3 3" stroke={INK2} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: INK5 }} angle={-18} textAnchor="end" height={44} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: INK5 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: INK1 }} />
                      <Legend wrapperStyle={{ fontSize: "0.75rem", paddingTop: 4 }} />
                      <Bar dataKey="activas" stackId="a" fill={APTO} name="Activas" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="inactivas" stackId="a" fill={NO} name="Inactivas" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Detalle por rol */}
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, padding: "20px 22px" }}>
            <SectionTitle title="Detalle por rol" sub={`${totalUsers} usuarios totales en la plataforma`} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
              {Object.entries(stats.usersByRole ?? {}).map(([role, count]) => {
                const color = ROLE_COLORS[role] ?? INK6;
                const pct = totalUsers ? Math.round((count / totalUsers) * 100) : 0;
                return (
                  <div key={role} style={{ background: INK1, border: `1px solid ${INK2}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color, letterSpacing: "0.03em" }}>{ROLE_LABELS[role] ?? role}</span>
                      <span style={{ fontSize: "1.25rem", fontWeight: 800, color: INK9, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{count}</span>
                    </div>
                    <div style={{ height: 4, background: INK2, borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999, transition: "width 0.6s ease" }} />
                    </div>
                    <div style={{ fontSize: "0.6875rem", color: INK5, marginTop: 5, fontVariantNumeric: "tabular-nums" }}>{pct}% del total</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabla por municipio */}
          {municipiosRows.length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, padding: "20px 22px" }}>
              <SectionTitle
                title="Estadísticas por municipio"
                sub={`${municipiosRows.length} municipios — haz clic en columna para ordenar`}
              />
              <DataTable columns={municipiosColumns} data={municipiosRows} loading={loading} searchPlaceholder="Buscar municipio…" emptyTitle="Sin datos" emptyDescription="No hay estadísticas por municipio disponibles." defaultPageSize={10} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Dashboard Municipal ────────────────────────────────────────────────────────
const INSP_COLORS: Record<string, string> = { aprobada: APTO, observada: WARN, rechazada: NO };
const INSP_LABELS: Record<string, string> = { aprobada: "Aprobada", observada: "Observada", rechazada: "Rechazada" };
const SANC_LABELS: Record<string, string> = { emitida: "Emitida", notificada: "Notificada", apelada: "Apelada", confirmada: "Confirmada", anulada: "Anulada" };

function MunicipalDashboard({ loading, error, data }: { loading: boolean; error: string | null; data: MunicipalStats | null }) {
  const pieData = useMemo(() => {
    if (!data) return [];
    return data.inspeccionesPorResultado.filter(r => r.count > 0).map(r => ({ name: INSP_LABELS[r.result] ?? r.result, value: r.count, color: INSP_COLORS[r.result] ?? INK5 }));
  }, [data]);

  const totalInsp = useMemo(() => pieData.reduce((s, r) => s + r.value, 0), [pieData]);
  const aprobadasPct = totalInsp ? Math.round(((pieData.find(p => p.name === "Aprobada")?.value ?? 0) / totalInsp) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${INK9} 0%, #2a2a2e 100%)`, borderRadius: 16, padding: "24px 28px" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: G, marginBottom: 6 }}>Panel municipal · RF-19-01</div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.03em" }}>Estadísticas</h1>
        {data?.kpis && <p style={{ fontSize: "0.875rem", color: "#a1a1aa", marginTop: 6, margin: 0 }}>{data.kpis.activeVehicles} vehículos · {data.kpis.activeDrivers} conductores · {data.kpis.inspectionsThisMonth} inspecciones este mes</p>}
      </div>

      {error && <div role="alert" style={{ background: NOBG, border: `1.5px solid ${NOBD}`, borderRadius: 12, padding: 14, color: NO, fontWeight: 500 }}>{error}</div>}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          {[0, 1, 2, 3].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 96, borderRadius: 12 }} />)}
        </div>
      ) : !data ? (
        <div style={{ padding: "40px 24px", textAlign: "center", color: INK5, background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14 }}>No hay datos disponibles.</div>
      ) : (
        <>
          <KPIStrip cols={4} items={[
            { label: "VEHÍCULOS ACTIVOS", value: data.kpis?.activeVehicles ?? 0, subtitle: "en la municipalidad", accent: INK9, icon: Truck },
            { label: "CONDUCTORES", value: data.kpis?.activeDrivers ?? 0, subtitle: "activos", accent: INFO, icon: Users },
            { label: "INSPECCIONES", value: data.kpis?.inspectionsThisMonth ?? 0, subtitle: "este mes", accent: APTO, icon: FileCheck },
            { label: "REPORTES PEND.", value: data.kpis?.reportsPending ?? 0, subtitle: "ciudadanos", accent: (data.kpis?.reportsPending ?? 0) > 0 ? NO : INK5, icon: AlertCircle },
          ]} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Donut inspecciones */}
            <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, padding: "20px 22px" }}>
              <SectionTitle title="Inspecciones por resultado" sub={totalInsp > 0 ? `${totalInsp} inspecciones este mes` : "Sin inspecciones este mes"} />
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: "55%", height: 200, position: "relative" }}>
                  {pieData.length === 0 ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: INK5, fontSize: "0.875rem" }}>Sin datos.</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={84} innerRadius={52} paddingAngle={2} startAngle={90} endAngle={450}>
                            {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: INK9, letterSpacing: "-0.03em" }}>{aprobadasPct}%</div>
                        <div style={{ fontSize: "0.6875rem", color: INK5, fontWeight: 600 }}>aprobadas</div>
                      </div>
                    </>
                  )}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  {pieData.map((e, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: INK1, borderRadius: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: e.color, flexShrink: 0 }} />
                      <span style={{ fontSize: "0.75rem", color: INK6, flex: 1 }}>{e.name}</span>
                      <span style={{ fontSize: "0.875rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: INK9 }}>{e.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top 5 baja reputación */}
            <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, padding: "20px 22px" }}>
              <SectionTitle title="Vehículos con menor reputación" sub="Top 5 que requieren atención prioritaria" />
              {data.top5VehiculosBajaReputacion.length === 0 ? (
                <div style={{ color: INK5, fontSize: "0.875rem" }}>Sin vehículos activos.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {data.top5VehiculosBajaReputacion.map((v, i) => {
                    const sc = v.reputationScore;
                    const color = sc >= 70 ? APTO : sc >= 40 ? WARN : NO;
                    return (
                      <div key={v._id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: i === 0 ? NOBG : INK1, border: `1px solid ${i === 0 ? NOBD : INK2}`, borderRadius: 10 }}>
                        <span style={{ width: 22, height: 22, borderRadius: "50%", background: i === 0 ? NO : INK2, color: i === 0 ? "#fff" : INK6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6875rem", fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9 }}>{v.plate}</div>
                          <div style={{ fontSize: "0.6875rem", color: INK5 }}>{[v.brand, v.model].filter(Boolean).join(" ")}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, minWidth: 64 }}>
                          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{sc}<span style={{ fontWeight: 400, color: "#a1a1aa", fontSize: "0.6875rem" }}>/100</span></span>
                          <div style={{ width: 56, height: 4, background: INK2, borderRadius: 999, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${sc}%`, background: color, borderRadius: 999 }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Últimas sanciones */}
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, padding: "20px 22px" }}>
            <SectionTitle title="Últimas infracciones / sanciones" sub="últimas 5 registradas" />
            {data.ultimasSanciones.length === 0 ? (
              <div style={{ color: INK5, fontSize: "0.875rem" }}>No hay sanciones registradas.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {data.ultimasSanciones.map((s, i) => {
                  const plate = typeof s.vehicleId === "object" && s.vehicleId ? s.vehicleId.plate ?? "—" : "—";
                  return (
                    <div key={s._id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 2px", borderBottom: i < data.ultimasSanciones.length - 1 ? `1px solid ${INK1}` : "none" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: NOBG, border: `1px solid ${NOBD}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <ClipboardList size={16} strokeWidth={1.8} color={NO} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: INK9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.faultType}</div>
                        <div style={{ fontSize: "0.75rem", color: INK5 }}>Vehículo <strong style={{ color: INK6 }}>{plate}</strong> · {new Date(s.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: "0.9375rem", fontVariantNumeric: "tabular-nums", color: INK9 }}>S/{s.amountSoles.toLocaleString("es-PE")}</span>
                        <Badge variant={s.status === "anulada" ? "inactivo" : s.status === "confirmada" ? "activo" : "pendiente"}>{SANC_LABELS[s.status] ?? s.status}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

