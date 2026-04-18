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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { PageHeader } from "@/components/ui/PageHeader";

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

type StoredUser = { role: string; provinceId?: string };

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
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (raw) setUser(JSON.parse(raw) as StoredUser);
  }, []);

  const load = useCallback(async (currentUser: StoredUser, range: 7 | 30 | 90) => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const [sres, pres, mres, ares] = await Promise.all([
        fetch("/api/admin/stats/global", { headers }),
        fetch("/api/provincias", { headers }),
        fetch("/api/municipalidades", { headers }),
        fetch(
          `/api/admin/audit-log?limit=500&from=${new Date(
            Date.now() - range * 24 * 60 * 60 * 1000
          ).toISOString()}`,
          { headers }
        ),
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
    } catch {
      setError("Error de conexión al cargar estadísticas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role === "super_admin" || user.role === "admin_provincial") {
      void load(user, days);
    } else {
      setLoading(false);
    }
  }, [user, days, load]);

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

  if (user.role !== "super_admin" && user.role !== "admin_provincial") {
    return <ComingSoon title="Estadísticas" rf="RF-19" />;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker={user.role === "super_admin" ? "Panel global · RF-19" : "Panel provincial · RF-19"}
        title="Estadísticas"
        subtitle={
          user.role === "super_admin"
            ? "Visión global de la plataforma: usuarios, municipalidades y actividad."
            : "Indicadores de tu provincia y municipalidades asociadas."
        }
        action={
          <Button variant="outline" size="md" onClick={exportUsersCsv}>
            Exportar CSV
          </Button>
        }
      />

      {error && (
        <div
          style={{
            background: "#FFF5F5",
            border: "1.5px solid #FCA5A5",
            borderRadius: 12,
            padding: 16,
            color: "#DC2626",
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up">
            <Kpi label="Provincias" value={provinces.length} />
            <Kpi
              label="Municipalidades"
              value={municipalities.length}
              sub={`${municipalities.filter((m) => m.active).length} activas`}
            />
            <Kpi label="Empresas" value={stats.companiesCount} />
            <Kpi label="Tipos de vehículo" value={stats.vehicleTypesCount} />
          </div>

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
                    style={{
                      fontFamily: "var(--font-inter)",
                      fontSize: "1.125rem",
                      fontWeight: 800,
                      color: "#09090b",
                    }}
                  >
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card>
      <div
        style={{
          fontFamily: "var(--font-inter)",
          fontSize: "2rem",
          fontWeight: 900,
          color: "#09090b",
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ color: "#52525b", fontSize: "0.8125rem", fontWeight: 500, marginTop: 8 }}>
        {label}
      </div>
      {sub && (
        <div style={{ color: "#71717a", fontSize: "0.6875rem", marginTop: 2 }}>{sub}</div>
      )}
    </Card>
  );
}
