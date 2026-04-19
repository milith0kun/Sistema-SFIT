"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MapPin, Building2, Truck, Car, Download, FileCheck, AlertCircle, Users, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { KPIStrip } from "@/components/dashboard/KPIStrip";

type ApiResponse<T> = { success: boolean; data?: T; error?: string };

type GlobalStats = {
  provincesCount: number;
  municipalitiesCount: number;
  activeMunicipalities: number;
  usersByRole: Record<string, number>;
  usersPendingApproval: number;
  companiesCount: number;
  vehicleTypesCount: number;
  sanctionsThisMonth: number;
  reportsPending: number;
};

type Province = { id: string; name: string; active?: boolean };
type Municipality = { id: string; name: string; provinceId: string; active: boolean };

type AuditEntry = { id: string; createdAt: string; action: string };

type MunicipioRow = {
  municipioId: string;
  municipioNombre: string;
  inspecciones: number;
  aprobadas: number;
  aprobadasPct: number;
  reportes: number;
  sanciones: number;
};

// ── Tipos para el dashboard municipal (RF-19-01) ──────────────────────────────
type MunicipalKpis = {
  activeVehicles: number;
  activeDrivers: number;
  inspectionsThisMonth: number;
  reportsPending: number;
};

type InspeccionResultado = { result: string; count: number };

type LowRepVehicle = {
  _id: string;
  plate: string;
  brand: string;
  model: string;
  reputationScore: number;
  lastInspectionStatus: string;
  status: string;
};

type SancionItem = {
  _id: string;
  faultType: string;
  amountSoles: number;
  status: string;
  createdAt: string;
  vehicleId?: { plate?: string; brand?: string; model?: string };
};

type MunicipalStats = {
  kpis: MunicipalKpis;
  inspeccionesPorResultado: InspeccionResultado[];
  top5VehiculosBajaReputacion: LowRepVehicle[];
  ultimasSanciones: SancionItem[];
};

type StoredUser = { role: string; provinceId?: string; municipalityId?: string };

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin_provincial: "Admin Provincial",
  admin_municipal: "Admin Municipal",
  fiscal: "Fiscal / Inspector",
  operador: "Operador",
  conductor: "Conductor",
  ciudadano: "Ciudadano",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "#B8860B",
  admin_provincial: "#0A1628",
  admin_municipal: "#1D4ED8",
  fiscal: "#15803d",
  operador: "#b45309",
  conductor: "#52525b",
  ciudadano: "#a1a1aa",
};

function getToken(): string {
  return typeof window === "undefined" ? "" : localStorage.getItem("sfit_access_token") ?? "";
}

export default function EstadisticasPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [municipiosRows, setMunicipiosRows] = useState<MunicipioRow[]>([]);
  const [sortKey, setSortKey] = useState<keyof MunicipioRow>("inspecciones");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Estado municipal ──────────────────────────────────────────────────────
  const [municipalStats, setMunicipalStats] = useState<MunicipalStats | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (raw) setUser(JSON.parse(raw) as StoredUser);
  }, []);

  const load = useCallback(async (currentUser: StoredUser, range: 7 | 30 | 90) => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const [sres, pres, mres, ares, munires] = await Promise.all([
        fetch("/api/admin/stats/global", { headers }),
        fetch("/api/provincias", { headers }),
        fetch("/api/municipalidades", { headers }),
        fetch(
          `/api/admin/audit-log?limit=500&from=${new Date(
            Date.now() - range * 24 * 60 * 60 * 1000
          ).toISOString()}`,
          { headers }
        ),
        fetch("/api/admin/stats/municipios", { headers }),
      ]);

      if (sres.ok) {
        const sdata: ApiResponse<GlobalStats> = await sres.json();
        if (sdata.success && sdata.data) setStats(sdata.data);
      }
      if (pres.ok) {
        const pdata: ApiResponse<{ items: Province[] }> = await pres.json();
        if (pdata.success && pdata.data) {
          const items = pdata.data.items ?? [];
          const scoped =
            currentUser.role === "admin_provincial" && currentUser.provinceId
              ? items.filter((p) => p.id === currentUser.provinceId)
              : items;
          setProvinces(scoped);
        }
      }
      if (mres.ok) {
        const mdata: ApiResponse<{ items: Municipality[] }> = await mres.json();
        if (mdata.success && mdata.data) {
          const items = mdata.data.items ?? [];
          const scoped =
            currentUser.role === "admin_provincial" && currentUser.provinceId
              ? items.filter((m) => m.provinceId === currentUser.provinceId)
              : items;
          setMunicipalities(scoped);
        }
      }
      if (ares.ok) {
        const adata: ApiResponse<{ items: AuditEntry[] }> = await ares.json();
        if (adata.success && adata.data) setAudit(adata.data.items ?? []);
      }
      if (munires.ok) {
        const mdata: ApiResponse<{ rows: MunicipioRow[] }> = await munires.json();
        if (mdata.success && mdata.data) setMunicipiosRows(mdata.data.rows ?? []);
      }
    } catch {
      setError("Error de conexión al cargar estadísticas.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMunicipal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const res = await fetch("/api/admin/stats/municipal", { headers });
      if (res.ok) {
        const data: ApiResponse<MunicipalStats> = await res.json();
        if (data.success && data.data) setMunicipalStats(data.data);
      } else {
        const data: ApiResponse<null> = await res.json();
        setError(data.error ?? "Error al cargar estadísticas municipales.");
      }
    } catch {
      setError("Error de conexión al cargar estadísticas municipales.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role === "super_admin" || user.role === "admin_provincial") {
      void load(user, days);
    } else if (user.role === "admin_municipal") {
      void loadMunicipal();
    } else {
      setLoading(false);
    }
  }, [user, days, load, loadMunicipal]);

  const pieData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.usersByRole ?? {})
      .filter(([, v]) => v > 0)
      .map(([role, count]) => ({
        name: ROLE_LABELS[role] ?? role,
        value: count,
        color: ROLE_COLORS[role] ?? "#71717a",
      }));
  }, [stats]);

  const barData = useMemo(() => {
    const byProvince = new Map<string, { name: string; activas: number; inactivas: number }>();
    provinces.forEach((p) => byProvince.set(p.id, { name: p.name, activas: 0, inactivas: 0 }));
    municipalities.forEach((m) => {
      const entry = byProvince.get(m.provinceId);
      if (!entry) return;
      if (m.active) entry.activas += 1;
      else entry.inactivas += 1;
    });
    return Array.from(byProvince.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [provinces, municipalities]);

  const lineData = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      map.set(key, 0);
    }
    audit.forEach((a) => {
      const key = new Date(a.createdAt).toISOString().slice(0, 10);
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([date, count]) => ({
      date: date.slice(5),
      count,
    }));
  }, [audit, days]);

  const sortedMunicipios = useMemo(() => {
    return [...municipiosRows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "desc" ? bv - av : av - bv;
      }
      const as = String(av);
      const bs = String(bv);
      return sortDir === "desc" ? bs.localeCompare(as) : as.localeCompare(bs);
    });
  }, [municipiosRows, sortKey, sortDir]);

  function toggleSort(key: keyof MunicipioRow) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function exportUsersCsv() {
    if (!stats) return;
    const rows: string[] = ["Rol,Cantidad"];
    Object.entries(stats.usersByRole ?? {}).forEach(([role, count]) => {
      rows.push(`${ROLE_LABELS[role] ?? role},${count}`);
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sfit-usuarios-por-rol-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (!user) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader kicker="Cargando" title="Estadísticas" />
        <Card>
          <div style={{ color: "#71717a" }}>Cargando…</div>
        </Card>
      </div>
    );
  }

  if (
    user.role !== "super_admin" &&
    user.role !== "admin_provincial" &&
    user.role !== "admin_municipal"
  ) {
    return <ComingSoon title="Estadísticas" rf="RF-19" />;
  }

  // ── Vista municipal ────────────────────────────────────────────────────────
  if (user.role === "admin_municipal") {
    return <MunicipalDashboard loading={loading} error={error} data={municipalStats} />;
  }

  const totalUsers = stats ? Object.values(stats.usersByRole ?? {}).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardHero
        kicker={user.role === "super_admin" ? "Panel global" : "Panel provincial"}
        rfCode="RF-19"
        title="Estadísticas"
        subtitle={
          user.role === "super_admin"
            ? "Visión global de la plataforma: usuarios, municipalidades y actividad."
            : "Indicadores de tu provincia y municipalidades asociadas."
        }
        pills={
          stats
            ? [
                { label: "Usuarios", value: totalUsers },
                { label: "Provincias", value: provinces.length },
                { label: "Municipios", value: municipalities.filter((m) => m.active).length },
              ]
            : undefined
        }
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="outline" size="md" onClick={exportUsersCsv}>
          <Download size={16} strokeWidth={1.8} />
          Exportar CSV
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            background: "#FFF5F5",
            border: "1.5px solid #FCA5A5",
            borderRadius: 12,
            padding: 16,
            color: "#b91c1c",
            fontSize: "0.9375rem",
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <Card>
          <div style={{ color: "#71717a" }}>Cargando…</div>
        </Card>
      ) : !stats ? (
        <Card>
          <div style={{ color: "#71717a" }}>No hay datos disponibles todavía.</div>
        </Card>
      ) : (
        <>
          {/* KPI bar */}
          <KPIStrip
            cols={4}
            items={[
              { label: "PROVINCIAS", value: provinces.length, subtitle: "en jurisdicción", accent: "#B8860B", icon: MapPin },
              { label: "MUNICIPIOS", value: municipalities.length, subtitle: `${municipalities.filter((m) => m.active).length} activas`, accent: "#15803d", icon: Building2 },
              { label: "EMPRESAS", value: stats.companiesCount, subtitle: "registradas", accent: "#0A1628", icon: Truck },
              { label: "TIPOS VEHÍC.", value: stats.vehicleTypesCount, subtitle: "configurados", accent: "#B45309", icon: Car },
            ]}
          />

          {/* Pie + Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up delay-100">
            <Card>
              <h3
                style={{
                  fontFamily: "var(--font-inter)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#09090b",
                  letterSpacing: "-0.01em",
                  margin: 0,
                  marginBottom: 8,
                }}
              >
                Usuarios por rol
              </h3>
              <p style={{ color: "#71717a", fontSize: "0.8125rem", marginBottom: 12 }}>
                Distribución total de cuentas en la plataforma.
              </p>
              <div style={{ width: "100%", height: 260 }}>
                {pieData.length === 0 ? (
                  <div style={{ color: "#71717a", fontSize: "0.875rem" }}>Sin datos.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50}>
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card>
              <h3
                style={{
                  fontFamily: "var(--font-inter)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#09090b",
                  letterSpacing: "-0.01em",
                  margin: 0,
                  marginBottom: 8,
                }}
              >
                Municipalidades por provincia
              </h3>
              <p style={{ color: "#71717a", fontSize: "0.8125rem", marginBottom: 12 }}>
                Activas vs. inactivas.
              </p>
              <div style={{ width: "100%", height: 260 }}>
                {barData.length === 0 ? (
                  <div style={{ color: "#71717a", fontSize: "0.875rem" }}>Sin datos.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#52525b" }}
                        angle={-20}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#52525b" }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                      <Bar dataKey="activas" stackId="a" fill="#15803d" name="Activas" />
                      <Bar dataKey="inactivas" stackId="a" fill="#b91c1c" name="Inactivas" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          {/* Line chart */}
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <h3
                  style={{
                    fontFamily: "var(--font-inter)",
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#09090b",
                    letterSpacing: "-0.01em",
                    margin: 0,
                  }}
                >
                  Actividad reciente
                </h3>
                <p style={{ color: "#71717a", fontSize: "0.8125rem", marginTop: 4 }}>
                  Acciones registradas en el audit-log agrupadas por día.
                </p>
              </div>
              <div style={{ display: "inline-flex", gap: 6 }}>
                {[7, 30, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d as 7 | 30 | 90)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1.5px solid " + (days === d ? "#0A1628" : "#e4e4e7"),
                      background: days === d ? "#0A1628" : "#ffffff",
                      color: days === d ? "#ffffff" : "#27272a",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Últimos {d} días
                  </button>
                ))}
              </div>
            </div>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#52525b" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#52525b" }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#B8860B"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#B8860B" }}
                    name="Acciones"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Tabla usuarios por rol (para CSV — informativa) */}
          <Card>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
              <h3
                style={{
                  fontFamily: "var(--font-inter)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#09090b",
                  letterSpacing: "-0.01em",
                  margin: 0,
                }}
              >
                Detalle por rol
              </h3>
              <span style={{ color: "#71717a", fontSize: "0.75rem" }}>
                {Object.values(stats.usersByRole ?? {}).reduce((a, b) => a + b, 0)} usuarios
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
              {Object.entries(stats.usersByRole ?? {}).map(([role, count]) => (
                <div
                  key={role}
                  style={{
                    background: "#fafafa",
                    border: "1px solid #e4e4e7",
                    borderRadius: 10,
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <Badge variant={role === "super_admin" ? "gold" : "info"}>
                    {ROLE_LABELS[role] ?? role}
                  </Badge>
                  <span
                    className="num"
                    style={{
                      fontFamily: "var(--font-inter)",
                      fontSize: "1.125rem",
                      fontWeight: 700,
                      color: "#09090b",
                      letterSpacing: "-0.015em",
                    }}
                  >
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* ── Tabla por municipio ─────────────────────────────── */}
          {sortedMunicipios.length > 0 && (
            <Card>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <h3
                    style={{
                      fontFamily: "var(--font-inter)",
                      fontSize: "1rem",
                      fontWeight: 700,
                      color: "#09090b",
                      letterSpacing: "-0.01em",
                      margin: 0,
                    }}
                  >
                    Estadísticas por municipio
                  </h3>
                  <p style={{ color: "#71717a", fontSize: "0.8125rem", marginTop: 4 }}>
                    Haz clic en una columna para ordenar.
                  </p>
                </div>
                <span style={{ color: "#71717a", fontSize: "0.75rem" }}>
                  {sortedMunicipios.length} municipios
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ background: "#fafafa" }}>
                      {(
                        [
                          { key: "municipioNombre", label: "Municipio" },
                          { key: "inspecciones",    label: "Inspecciones" },
                          { key: "aprobadasPct",    label: "Aprobadas %" },
                          { key: "reportes",        label: "Reportes" },
                          { key: "sanciones",       label: "Sanciones" },
                        ] as { key: keyof MunicipioRow; label: string }[]
                      ).map(({ key, label }) => (
                        <th
                          key={key}
                          onClick={() => toggleSort(key)}
                          style={{
                            textAlign: "left",
                            padding: "11px 14px",
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: sortKey === key ? "#09090b" : "#71717a",
                            borderBottom: "1px solid #e4e4e7",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            userSelect: "none",
                          }}
                        >
                          {label}{" "}
                          {sortKey === key ? (sortDir === "desc" ? "↓" : "↑") : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMunicipios.map((row, i) => (
                      <tr
                        key={row.municipioId}
                        style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                      >
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f4f4f5", fontWeight: 600, color: "#09090b" }}>
                          {row.municipioNombre}
                        </td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f4f4f5", fontVariantNumeric: "tabular-nums" }}>
                          {row.inspecciones}
                        </td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f4f4f5" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 64, height: 6, background: "#e4e4e7", borderRadius: 999, overflow: "hidden" }}>
                              <div
                                style={{
                                  height: "100%",
                                  width: `${row.aprobadasPct}%`,
                                  background: row.aprobadasPct >= 70 ? "#15803d" : row.aprobadasPct >= 40 ? "#b45309" : "#b91c1c",
                                  borderRadius: 999,
                                }}
                              />
                            </div>
                            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: row.aprobadasPct >= 70 ? "#15803d" : row.aprobadasPct >= 40 ? "#b45309" : "#b91c1c" }}>
                              {row.aprobadasPct}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f4f4f5", fontVariantNumeric: "tabular-nums" }}>
                          {row.reportes}
                        </td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #f4f4f5", fontVariantNumeric: "tabular-nums" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: "0.8125rem",
                              fontWeight: 700,
                              background: row.sanciones > 0 ? "#FFF5F5" : "#f4f4f5",
                              color: row.sanciones > 0 ? "#b91c1c" : "#71717a",
                            }}
                          >
                            {row.sanciones}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Dashboard Municipal (RF-19-01) ─────────────────────────────────────────────
const INSPECCION_COLORS: Record<string, string> = {
  aprobada: "#15803d",
  observada: "#b45309",
  rechazada: "#b91c1c",
};

const INSPECCION_LABELS: Record<string, string> = {
  aprobada: "Aprobada",
  observada: "Observada",
  rechazada: "Rechazada",
};

const SANCION_STATUS_LABELS: Record<string, string> = {
  emitida: "Emitida",
  notificada: "Notificada",
  apelada: "Apelada",
  confirmada: "Confirmada",
  anulada: "Anulada",
};

const INSPECCION_STATUS_COLORS: Record<string, string> = {
  aprobada: "#15803d",
  observada: "#b45309",
  rechazada: "#b91c1c",
  pendiente: "#71717a",
};

function MunicipalDashboard({
  loading,
  error,
  data,
}: {
  loading: boolean;
  error: string | null;
  data: MunicipalStats | null;
}) {
  const pieData = useMemo(() => {
    if (!data) return [];
    return data.inspeccionesPorResultado
      .filter((r) => r.count > 0)
      .map((r) => ({
        name: INSPECCION_LABELS[r.result] ?? r.result,
        value: r.count,
        color: INSPECCION_COLORS[r.result] ?? "#71717a",
      }));
  }, [data]);

  const totalInspecciones = useMemo(
    () => pieData.reduce((s, r) => s + r.value, 0),
    [pieData],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardHero
        kicker="Panel municipal"
        rfCode="RF-19-01"
        title="Estadísticas"
        subtitle="Indicadores de tu municipalidad: vehículos, conductores, inspecciones y reportes."
        pills={
          data
            ? [
                { label: "Vehículos activos", value: data.kpis.activeVehicles },
                { label: "Conductores", value: data.kpis.activeDrivers },
                { label: "Inspecciones del mes", value: data.kpis.inspectionsThisMonth },
              ]
            : undefined
        }
      />

      {error && (
        <div
          role="alert"
          style={{
            background: "#FFF5F5",
            border: "1.5px solid #FCA5A5",
            borderRadius: 12,
            padding: 16,
            color: "#b91c1c",
            fontSize: "0.9375rem",
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <Card>
          <div style={{ color: "#71717a" }}>Cargando…</div>
        </Card>
      ) : !data ? (
        <Card>
          <div style={{ color: "#71717a" }}>No hay datos disponibles todavía.</div>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <KPIStrip
            cols={4}
            items={[
              {
                label: "VEHÍCULOS ACTIVOS",
                value: data.kpis.activeVehicles,
                subtitle: "en la municipalidad",
                accent: "#0A1628",
                icon: Truck,
              },
              {
                label: "CONDUCTORES",
                value: data.kpis.activeDrivers,
                subtitle: "activos",
                accent: "#1D4ED8",
                icon: Users,
              },
              {
                label: "INSPECCIONES",
                value: data.kpis.inspectionsThisMonth,
                subtitle: "este mes",
                accent: "#15803d",
                icon: FileCheck,
              },
              {
                label: "REPORTES PEND.",
                value: data.kpis.reportsPending,
                subtitle: "ciudadanos pendientes",
                accent: data.kpis.reportsPending > 0 ? "#b91c1c" : "#71717a",
                icon: AlertCircle,
              },
            ]}
          />

          {/* Pie de inspecciones + tabla de baja reputación */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up delay-100">
            {/* Gráfico pie */}
            <Card>
              <h3
                style={{
                  fontFamily: "var(--font-inter)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#09090b",
                  letterSpacing: "-0.01em",
                  margin: 0,
                  marginBottom: 4,
                }}
              >
                Inspecciones por resultado
              </h3>
              <p style={{ color: "#71717a", fontSize: "0.8125rem", marginBottom: 12 }}>
                {totalInspecciones > 0
                  ? `${totalInspecciones} inspecciones registradas este mes.`
                  : "Sin inspecciones registradas este mes."}
              </p>
              <div style={{ width: "100%", height: 240 }}>
                {pieData.length === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: "#71717a",
                      fontSize: "0.875rem",
                    }}
                  >
                    Sin datos este mes.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={90}
                        innerRadius={52}
                        paddingAngle={2}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [value, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Top 5 baja reputación */}
            <Card>
              <h3
                style={{
                  fontFamily: "var(--font-inter)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#09090b",
                  letterSpacing: "-0.01em",
                  margin: 0,
                  marginBottom: 4,
                }}
              >
                Vehículos con menor reputación
              </h3>
              <p style={{ color: "#71717a", fontSize: "0.8125rem", marginBottom: 12 }}>
                Top 5 que requieren atención prioritaria.
              </p>
              {data.top5VehiculosBajaReputacion.length === 0 ? (
                <div style={{ color: "#71717a", fontSize: "0.875rem" }}>Sin vehículos activos.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.top5VehiculosBajaReputacion.map((v, i) => (
                    <div
                      key={v._id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        background: "#fafafa",
                        border: "1px solid #e4e4e7",
                        borderRadius: 10,
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: i === 0 ? "#b91c1c" : "#e4e4e7",
                          color: i === 0 ? "#fff" : "#52525b",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "0.875rem",
                            color: "#09090b",
                          }}
                        >
                          {v.plate}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#71717a" }}>
                          {[v.brand, v.model].filter(Boolean).join(" ")}
                        </div>
                      </div>
                      {/* Barra de reputación */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, minWidth: 72 }}>
                        <span
                          style={{
                            fontSize: "0.8125rem",
                            fontWeight: 700,
                            fontVariantNumeric: "tabular-nums",
                            color:
                              v.reputationScore >= 70
                                ? "#15803d"
                                : v.reputationScore >= 40
                                ? "#b45309"
                                : "#b91c1c",
                          }}
                        >
                          {v.reputationScore}
                          <span style={{ fontWeight: 400, color: "#a1a1aa", fontSize: "0.6875rem" }}>/100</span>
                        </span>
                        <div
                          style={{
                            width: 64,
                            height: 5,
                            background: "#e4e4e7",
                            borderRadius: 999,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${v.reputationScore}%`,
                              background:
                                v.reputationScore >= 70
                                  ? "#15803d"
                                  : v.reputationScore >= 40
                                  ? "#b45309"
                                  : "#b91c1c",
                              borderRadius: 999,
                            }}
                          />
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: 999,
                          background:
                            INSPECCION_STATUS_COLORS[v.lastInspectionStatus] + "1a",
                          color: INSPECCION_STATUS_COLORS[v.lastInspectionStatus],
                          border: `1px solid ${INSPECCION_STATUS_COLORS[v.lastInspectionStatus]}33`,
                          textTransform: "capitalize",
                        }}
                      >
                        {v.lastInspectionStatus}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Últimas sanciones */}
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-inter)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#09090b",
                  letterSpacing: "-0.01em",
                  margin: 0,
                }}
              >
                Últimas infracciones / sanciones
              </h3>
              <span style={{ fontSize: "0.75rem", color: "#71717a" }}>últimas 5</span>
            </div>
            {data.ultimasSanciones.length === 0 ? (
              <div style={{ color: "#71717a", fontSize: "0.875rem" }}>
                No hay sanciones registradas.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {data.ultimasSanciones.map((s, i) => {
                  const plate =
                    typeof s.vehicleId === "object" && s.vehicleId
                      ? s.vehicleId.plate ?? "—"
                      : "—";
                  return (
                    <div
                      key={s._id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "12px 2px",
                        borderBottom:
                          i < data.ultimasSanciones.length - 1
                            ? "1px solid #f4f4f5"
                            : "none",
                      }}
                    >
                      <ClipboardList
                        size={16}
                        strokeWidth={1.8}
                        style={{ color: "#a1a1aa", flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            color: "#09090b",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.faultType}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#71717a" }}>
                          Vehículo{" "}
                          <strong style={{ color: "#52525b" }}>{plate}</strong>
                          {" · "}
                          {new Date(s.createdAt).toLocaleDateString("es-PE", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "0.875rem",
                            fontVariantNumeric: "tabular-nums",
                            color: "#09090b",
                          }}
                        >
                          S/{s.amountSoles.toLocaleString("es-PE")}
                        </span>
                        <Badge variant={s.status === "anulada" ? "inactivo" : s.status === "confirmada" ? "activo" : "pendiente"}>
                          {SANCION_STATUS_LABELS[s.status] ?? s.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

