"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, Car, CalendarDays, UsersRound, Building2, ArrowUpRight,
  Plus, Activity, ClipboardList,
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { KPIStrip, type KPIItem } from "@/components/dashboard/KPIStrip";

/* Paleta sobria — alineada con el resto del proyecto */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO_BG = "#F0FDF4"; const APTO_BD = "#86EFAC";
const RED = "#6C0606";

interface OperatorUser {
  name: string;
  email: string;
  role: string;
  municipalityName?: string;
}

interface CompanyInfo {
  id: string;
  razonSocial: string;
  ruc: string;
  serviceScope?: string;
  active: boolean;
  vehicleTypeKeys?: string[];
}

interface TripBrief {
  id: string;
  vehicle?: { plate?: string };
  driver?: { name?: string };
  route?: { code: string; name: string } | null;
  startTime?: string | null;
  status: string;
  passengers?: number;
}

const SERVICE_SCOPE_LABEL: Record<string, string> = {
  urbano_distrital: "Urbano distrital",
  urbano_provincial: "Urbano provincial",
  interprovincial_regional: "Interprovincial regional",
  interregional_nacional: "Interregional nacional",
};

const STATUS_LABEL: Record<string, string> = {
  en_curso: "En curso",
  completado: "Completado",
  auto_cierre: "Auto-cierre",
  cerrado_automatico: "Auto-cierre",
  programado: "Programado",
};
const STATUS_COLOR: Record<string, { fg: string; bg: string; bd: string }> = {
  en_curso:           { fg: "#1E40AF", bg: "#EFF6FF", bd: "#BFDBFE" },
  completado:         { fg: "#15803d", bg: APTO_BG, bd: APTO_BD },
  auto_cierre:        { fg: "#B45309", bg: "#FFFBEB", bd: "#FDE68A" },
  cerrado_automatico: { fg: "#B45309", bg: "#FFFBEB", bd: "#FDE68A" },
  programado:         { fg: INK6, bg: INK1, bd: INK2 },
};

interface Props {
  user: OperatorUser;
}

export function OperatorDashboard({ user }: Props) {
  const [activeDrivers, setActiveDrivers] = useState<number | null>(null);
  const [totalVehicles, setTotalVehicles] = useState<number | null>(null);
  const [tripsToday, setTripsToday] = useState<number | null>(null);
  const [passengersMonth, setPassengersMonth] = useState<number | null>(null);
  const [recentTrips, setRecentTrips] = useState<TripBrief[]>([]);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("sfit_access_token") : null;
    const headers = { Authorization: `Bearer ${token ?? ""}` };

    // Conductores activos
    void (async () => {
      try {
        const r = await fetch("/api/conductores?active=true&limit=1", { headers });
        if (r.ok) {
          const d = await r.json();
          setActiveDrivers(d.data?.total ?? d.data?.items?.length ?? 0);
        }
      } catch { /* silent */ }
    })();

    // Vehículos en flota
    void (async () => {
      try {
        const r = await fetch("/api/vehiculos?limit=1", { headers });
        if (r.ok) {
          const d = await r.json();
          setTotalVehicles(d.data?.total ?? d.data?.items?.length ?? 0);
        }
      } catch { /* silent */ }
    })();

    // Viajes de hoy + lista reciente (paralelo, una sola consulta)
    void (async () => {
      try {
        // Hoy: el endpoint acepta `period=hoy`
        const r = await fetch("/api/viajes?period=hoy&limit=20", { headers });
        if (r.ok) {
          const d = await r.json();
          const items: TripBrief[] = d.data?.items ?? [];
          setTripsToday(d.data?.total ?? items.length);
          // Top 5 más recientes (por startTime desc o id desc)
          setRecentTrips(items.slice(0, 5));
          // Pasajeros del mes — sumamos lo del listado de hoy como aproximación
          // si no hay endpoint específico (el backend track A no expone ese KPI).
          if (passengersMonth == null) {
            const sum = items.reduce((s, t) => s + (t.passengers ?? 0), 0);
            setPassengersMonth(sum);
          }
        }
      } catch { /* silent */ }
    })();

    // Empresa del operador
    void (async () => {
      try {
        const r = await fetch("/api/operador/mi-empresa", { headers });
        if (r.ok) {
          const d = await r.json();
          setCompany(d.data ?? null);
        }
      } catch { /* silent */ }
    })();

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const firstName = user.name?.split(" ")[0] ?? user.name;
  const greeting = (() => {
    if (typeof window === "undefined") return "Buenos días";
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  const kpiItems: KPIItem[] = [
    {
      label: "CONDUCTORES",
      value: activeDrivers ?? (loading ? "…" : 0),
      subtitle: "activos",
      icon: Users,
    },
    {
      label: "VEHÍCULOS",
      value: totalVehicles ?? (loading ? "…" : 0),
      subtitle: "en flota",
      icon: Car,
    },
    {
      label: "VIAJES HOY",
      value: tripsToday ?? (loading ? "…" : 0),
      subtitle: "programados / curso",
      icon: CalendarDays,
    },
    {
      label: "PASAJEROS",
      value: passengersMonth ?? (loading ? "…" : 0),
      subtitle: "transportados (mes)",
      icon: UsersRound,
    },
  ];

  return (
    <div className="flex flex-col gap-4 animate-fade-in h-full">
      {/* Hero */}
      <DashboardHero
        kicker="Operador · SFIT"
        title={`${greeting}, ${firstName}.`}
        pills={[
          { label: "Conductores", value: activeDrivers ?? "—" },
          { label: "Vehículos", value: totalVehicles ?? "—" },
          { label: "Viajes hoy", value: tripsToday ?? "—" },
        ]}
      />

      {/* KPIs */}
      <KPIStrip items={kpiItems} cols={4} />

      {/* Layout de 2 columnas: izquierda (acciones + viajes), derecha (empresa) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        <div className="lg:col-span-8 flex flex-col gap-4 min-w-0">
          {/* CTAs rápidas */}
          <QuickActions />

          {/* Últimos viajes */}
          <RecentTrips trips={recentTrips} loading={loading} />
        </div>

        <div className="lg:col-span-4 min-w-0">
          <CompanyCard company={company} loading={loading} />
        </div>
      </div>
    </div>
  );
}

/* ── Sub-componentes ── */

function QuickActions() {
  const ACTIONS: { label: string; subtitle: string; href: string; icon: typeof Plus }[] = [
    { label: "Nuevo viaje",     subtitle: "Inicia un viaje y asigna pasajeros", href: "/viajes/nueva",       icon: CalendarDays },
    { label: "Nuevo conductor", subtitle: "Registra al personal de tu empresa", href: "/conductores/nuevo",  icon: Users },
    { label: "Nuevo vehículo",  subtitle: "Suma una unidad a tu flota",         href: "/vehiculos/nuevo",    icon: Car },
  ];
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 10,
    }}>
      {ACTIONS.map(a => (
        <Link key={a.href} href={a.href}
          style={{
            position: "relative", overflow: "hidden",
            background: "#fff", border: `1.5px solid ${INK2}`,
            borderRadius: 12, padding: "14px 16px",
            textDecoration: "none",
            display: "flex", alignItems: "center", gap: 12,
            transition: "border-color 150ms, box-shadow 150ms, transform 150ms",
            minHeight: 76,
          }}
          className="sfit-quick-action"
        >
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: INK1, border: `1px solid ${INK2}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: INK6, flexShrink: 0,
          }}>
            <a.icon size={18} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: "0.625rem", fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase",
              color: INK5, marginBottom: 2,
            }}>
              Acción rápida
            </div>
            <div style={{
              fontSize: "0.9375rem", fontWeight: 700, color: INK9,
              lineHeight: 1.2, letterSpacing: "-0.005em",
            }}>
              {a.label}
            </div>
            <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2, lineHeight: 1.3 }}>
              {a.subtitle}
            </div>
          </div>
          <ArrowUpRight size={14} color={INK6} style={{ flexShrink: 0 }} />
        </Link>
      ))}
    </div>
  );
}

function RecentTrips({ trips, loading }: { trips: TripBrief[]; loading: boolean }) {
  return (
    <div style={{
      background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 12,
      overflow: "hidden", flex: 1,
    }}>
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${INK2}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{
            fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase", color: INK5, marginBottom: 1,
          }}>
            Operación · Hoy
          </div>
          <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: INK9, margin: 0 }}>
            Últimos viajes
          </h3>
        </div>
        <Link href="/viajes" style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: "0.75rem", color: INK6, textDecoration: "none", fontWeight: 600,
        }}>
          Ver todos <ArrowUpRight size={11} />
        </Link>
      </div>

      {loading && trips.length === 0 ? (
        <div style={{ padding: "24px 16px", color: INK5, fontSize: "0.8125rem", textAlign: "center" }}>
          Cargando viajes…
        </div>
      ) : trips.length === 0 ? (
        <div style={{ padding: "32px 16px", textAlign: "center", color: INK5, fontSize: "0.8125rem" }}>
          <CalendarDays size={22} color={INK5} style={{ marginBottom: 6, opacity: 0.5 }} />
          <div style={{ fontWeight: 600, color: INK6, marginBottom: 4 }}>
            Sin viajes hoy
          </div>
          <div style={{ fontSize: "0.75rem" }}>
            Cuando inicies un viaje aparecerá listado aquí.
          </div>
        </div>
      ) : (
        <div>
          {trips.map((t, idx) => {
            const meta = STATUS_COLOR[t.status] ?? STATUS_COLOR.programado;
            const label = STATUS_LABEL[t.status] ?? t.status;
            return (
              <Link key={t.id} href={`/viajes/${t.id}`}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 16px",
                  borderBottom: idx < trips.length - 1 ? `1px solid ${INK1}` : undefined,
                  textDecoration: "none", color: "inherit",
                  transition: "background 120ms",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = INK1; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: INK1, border: `1px solid ${INK2}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, color: INK6,
                }}>
                  <Activity size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "0.8125rem", fontWeight: 700, color: INK9,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {t.route ? `${t.route.code} · ${t.route.name}` : `Viaje ${t.id.slice(-6).toUpperCase()}`}
                  </div>
                  <div style={{
                    fontSize: "0.75rem", color: INK5, marginTop: 2,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {t.vehicle?.plate ?? "—"}
                    {t.driver?.name ? ` · ${t.driver.name.split(" ")[0]}` : ""}
                    {t.startTime ? ` · ${fmtTime(t.startTime)}` : ""}
                  </div>
                </div>
                <span style={{
                  fontSize: "0.6875rem", fontWeight: 700,
                  padding: "3px 8px", borderRadius: 999,
                  background: meta.bg, color: meta.fg,
                  border: `1px solid ${meta.bd}`,
                  flexShrink: 0,
                }}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CompanyCard({ company, loading }: { company: CompanyInfo | null; loading: boolean }) {
  if (loading && !company) {
    return (
      <div style={{
        background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 12,
        padding: "20px 16px", color: INK5, fontSize: "0.8125rem",
      }}>
        Cargando empresa…
      </div>
    );
  }

  if (!company) {
    return (
      <div style={{
        background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 12,
        padding: "20px 16px",
      }}>
        <div style={{
          fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: INK5, marginBottom: 6,
        }}>
          Mi empresa
        </div>
        <div style={{ fontSize: "0.8125rem", color: INK6, marginBottom: 8 }}>
          Aún no tienes una empresa asignada.
        </div>
        <div style={{ fontSize: "0.75rem", color: INK5 }}>
          Pide al administrador municipal que te asigne a una empresa para gestionar su flota.
        </div>
      </div>
    );
  }

  const scopeLabel = company.serviceScope
    ? SERVICE_SCOPE_LABEL[company.serviceScope] ?? company.serviceScope
    : null;

  return (
    <div style={{
      background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 12,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${INK1}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "#FBEAEA", border: "1px solid #D9B0B0",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#4A0303", flexShrink: 0,
        }}>
          <Building2 size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase", color: RED, marginBottom: 1,
          }}>
            Mi empresa
          </div>
          <div style={{
            fontSize: "0.875rem", fontWeight: 700, color: INK9,
            lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {company.razonSocial}
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <Row k="RUC" v={company.ruc} mono />
        {scopeLabel && <Row k="Modalidad" v={scopeLabel} />}
        <Row
          k="Estado"
          v={company.active ? "Operativa" : "Suspendida"}
          tone={company.active ? "apto" : "red"}
        />
        {company.vehicleTypeKeys && company.vehicleTypeKeys.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
            {company.vehicleTypeKeys.slice(0, 6).map(k => (
              <span key={k} style={{
                fontSize: "0.6875rem", fontWeight: 600, color: INK6,
                background: INK1, border: `1px solid ${INK2}`,
                borderRadius: 999, padding: "2px 8px",
              }}>{k}</span>
            ))}
            {company.vehicleTypeKeys.length > 6 && (
              <span style={{ fontSize: "0.6875rem", color: INK5, padding: "2px 4px" }}>
                +{company.vehicleTypeKeys.length - 6}
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{
        padding: "10px 16px", borderTop: `1px solid ${INK1}`, background: INK1,
        display: "flex", gap: 6,
      }}>
        <Link href="/mi-empresa" style={{
          flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          height: 32, padding: "0 12px", borderRadius: 7,
          border: `1px solid ${INK2}`, background: "#fff", color: INK9,
          fontSize: "0.75rem", fontWeight: 700, textDecoration: "none",
        }}>
          <Building2 size={12} />Ver empresa
        </Link>
        <Link href="/flota" style={{
          flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          height: 32, padding: "0 12px", borderRadius: 7,
          border: "none", background: INK9, color: "#fff",
          fontSize: "0.75rem", fontWeight: 700, textDecoration: "none",
        }}>
          <ClipboardList size={12} />Ver flota
        </Link>
      </div>
    </div>
  );
}

function Row({
  k, v, mono, tone,
}: { k: string; v: string; mono?: boolean; tone?: "apto" | "red" }) {
  const color = tone === "apto" ? "#15803d" : tone === "red" ? "#DC2626" : INK9;
  const bg = tone === "apto" ? APTO_BG : tone === "red" ? "#FFF5F5" : INK1;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 10px", borderRadius: 6, background: bg, gap: 8,
    }}>
      <span style={{ fontSize: "0.75rem", color: INK5, flexShrink: 0 }}>{k}</span>
      <span style={{
        fontSize: "0.8125rem", fontWeight: 700, color,
        textAlign: "right",
        fontFamily: mono ? "ui-monospace, monospace" : "inherit",
        letterSpacing: mono ? "0.04em" : 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{v}</span>
    </div>
  );
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

