"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Users,
  MapPin,
  Building2,
  ClipboardList,
  Truck,
  UserPlus,
  UserCheck,
  Shield,
  Flag,
  TriangleAlert,
  ChartColumn,
  FileText,
  Car,
  Route,
  CalendarDays,
  Bell,
  ClipboardCheck,
  AlertCircle,
  MessageSquareWarning,
  ArrowUpRight,
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { KPIStrip, type KPIItem } from "@/components/dashboard/KPIStrip";
import { FeatureCard } from "@/components/dashboard/FeatureCard";

type User = { name: string; email: string; role: string };

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

type OperadorStats = {
  totalVehicles: number;
  activeVehicles: number;
  vehiclesEnRuta: number;
  activeDrivers: number;
};

type FiscalStats = {
  inspectionsThisMonth: number;
  inspectionsPending: number;
  reportsPending: number;
  reportsNewThisMonth: number;
};

type ConductorStats = {
  status: "apto" | "riesgo" | "no_apto";
  continuousHours: number;
  restHours: number;
  reputationScore: number;
  tripsToday: number;
  currentVehicleId?: string;
};

type ActivityItem = {
  type: "inspeccion" | "reporte" | "apelacion" | "sancion";
  title: string;
  subtitle: string;
  date: string;
  href: string;
};

function subscribeUser(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === "sfit_user" || e.key === null) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

let __lastRawUser: string | null = null;
let __lastParsedUser: User | null = null;

function getClientUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("sfit_user");
  if (raw === __lastRawUser) return __lastParsedUser;
  __lastRawUser = raw;
  try {
    __lastParsedUser = raw ? (JSON.parse(raw) as User) : null;
  } catch {
    __lastParsedUser = null;
  }
  return __lastParsedUser;
}

function getServerUser(): User | null {
  return null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin_provincial: "Admin Provincial",
  admin_municipal: "Admin Municipal",
  fiscal: "Fiscal / Inspector",
  operador: "Operador",
  conductor: "Conductor",
  ciudadano: "Ciudadano",
};

export default function DashboardPage() {
  const user = useSyncExternalStore(subscribeUser, getClientUser, getServerUser);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [operadorStats, setOperadorStats] = useState<OperadorStats | null>(null);
  const [fiscalStats, setFiscalStats] = useState<FiscalStats | null>(null);
  const [conductorStats, setConductorStats] = useState<ConductorStats | null>(null);
  const [actividad, setActividad] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSuperAdmin = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const headers = { Authorization: `Bearer ${token ?? ""}` };
      const sres = await fetch("/api/admin/stats/global", { headers });
      if (sres.ok) {
        const sdata: ApiResponse<GlobalStats> = await sres.json();
        if (sdata.success && sdata.data) setStats(sdata.data);
        else if (sdata.error) setError(sdata.error);
      } else if (sres.status !== 404) setError("No se pudieron cargar las estadísticas.");
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }, []);

  const loadOperador = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/admin/stats/operador", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.ok) {
        const data: ApiResponse<OperadorStats> = await res.json();
        if (data.success && data.data) setOperadorStats(data.data);
      } else if (res.status !== 404) setError("No se pudieron cargar las estadísticas de flota.");
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }, []);

  const loadFiscal = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/admin/stats/fiscal", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.ok) {
        const data: ApiResponse<FiscalStats> = await res.json();
        if (data.success && data.data) setFiscalStats(data.data);
      } else if (res.status !== 404) setError("No se pudieron cargar las estadísticas de inspecciones.");
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }, []);

  const loadConductor = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/admin/stats/conductor", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.ok) {
        const data: ApiResponse<ConductorStats> = await res.json();
        if (data.success && data.data) setConductorStats(data.data);
      } else if (res.status !== 404 && res.status !== 403) setError("No se pudieron cargar los datos del conductor.");
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }, []);

  const loadActividad = useCallback(async () => {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/admin/actividad", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.ok) {
        const data: ApiResponse<{ items: ActivityItem[] }> = await res.json();
        if (data.success && data.data) setActividad(data.data.items ?? []);
      }
    } catch { /* Silencioso */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (["super_admin", "admin_provincial", "admin_municipal"].includes(user.role)) {
      void loadSuperAdmin(); void loadActividad();
    } else if (user.role === "operador") {
      void loadOperador();
    } else if (user.role === "fiscal") {
      void loadFiscal(); void loadActividad();
    } else if (user.role === "conductor") {
      void loadConductor();
    }
  }, [user, loadSuperAdmin, loadOperador, loadFiscal, loadConductor, loadActividad]);

  if (!user) return null;

  const role = user.role;
  const roleLabel = ROLE_LABELS[role] ?? role;
  const firstName = user.name.split(" ")[0] ?? user.name;
  const greeting = (() => {
    if (typeof window === "undefined") return "Buenos días";
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  const heroPills = buildHeroPills(role, stats, operadorStats, fiscalStats, conductorStats);
  const kpiItems = buildKpiItemsFor(role, stats, operadorStats, fiscalStats, conductorStats, loading);
  const quickAction = buildQuickActionFor(role);
  const showActivity = ["super_admin", "admin_provincial", "admin_municipal", "fiscal"].includes(role);

  return (
    <div className="flex flex-col gap-3 animate-fade-in h-full">
      {/* ── Hero compacto ── */}
      <DashboardHero
        kicker={`${roleLabel} · SFIT`}
        title={`${greeting}, ${firstName}.`}
        pills={heroPills}
      />

      {error && (
        <div role="alert" style={{ background: "#FFF5F5", border: "1.5px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", color: "#b91c1c", fontSize: "0.875rem", fontWeight: 500 }}>
          {error}
        </div>
      )}

      {/* ── KPI strip — ancho completo ── */}
      {kpiItems.length > 0 && (
        <KPIStrip items={kpiItems} cols={kpiItems.length >= 4 ? 4 : (kpiItems.length as 3 | 4)} />
      )}

      {/* ── Contenido principal: izquierda + módulos derecha ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 animate-fade-up">
        {/* Columna izquierda: acción principal + actividad */}
        <div className="lg:col-span-8 flex flex-col gap-3 min-w-0">
          {quickAction && <QuickModuleLink {...quickAction} />}
          {showActivity
            ? <ActivityFeed items={actividad} />
            : <PlaceholderContent role={role} conductorStats={conductorStats} />
          }
        </div>

        {/* Columna derecha: todos los módulos agrupados */}
        <div className="lg:col-span-4 min-w-0">
          <AllModulesPanel role={role} stats={stats} />
        </div>
      </div>
    </div>
  );
}

/* ── Enlace de acción principal compacto (reemplaza HeroActionCard) ── */

type QuickActionDef = {
  icon: typeof Users;
  title: string;
  subtitle: string;
  href: string;
};

function QuickModuleLink({ icon: Icon, title, subtitle, href }: QuickActionDef) {
  return (
    <Link
      href={href}
      style={{
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 14px", borderRadius: 10,
        background: "#ffffff", border: "1px solid #e4e4e7",
        textDecoration: "none",
        transition: "border-color 150ms ease, background 150ms ease, box-shadow 150ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "#D4A827";
        (e.currentTarget as HTMLAnchorElement).style.background = "#FDFAF2";
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 2px 8px rgba(184,134,11,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "#e4e4e7";
        (e.currentTarget as HTMLAnchorElement).style.background = "#ffffff";
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
      }}
    >
      {/* Ícono watermark — grande para llenar el card, overflow:hidden lo adapta */}
      <div aria-hidden style={{ position: "absolute", right: -10, bottom: -10, color: "#B8860B", opacity: 0.16, pointerEvents: "none", lineHeight: 0 }}>
        <Icon size={64} strokeWidth={1.2} />
      </div>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: "#F4F0E6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative", zIndex: 1 }}>
        <Icon size={16} color="#926A09" strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#09090b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ fontSize: "0.6875rem", color: "#71717a", marginTop: 1 }}>{subtitle}</div>
      </div>
      <ArrowUpRight size={14} color="#a1a1aa" strokeWidth={2} style={{ position: "relative", zIndex: 1, flexShrink: 0 }} />
    </Link>
  );
}

/* ── Actividad reciente ── */

const ACTIVITY_ICON: Record<ActivityItem["type"], typeof Users> = {
  inspeccion: ClipboardCheck, reporte: Flag, apelacion: MessageSquareWarning, sancion: AlertCircle,
};
const ACTIVITY_COLOR: Record<ActivityItem["type"], string> = {
  inspeccion: "#15803d", reporte: "#B8860B", apelacion: "#1e40af", sancion: "#b91c1c",
};
const ACTIVITY_BG: Record<ActivityItem["type"], string> = {
  inspeccion: "#F0FDF4", reporte: "#FDF8EC", apelacion: "#EFF6FF", sancion: "#FFF5F5",
};

function fmtRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e4e4e7", borderRadius: 12, overflow: "hidden", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #e4e4e7" }}>
        <div>
          <div style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#71717a", marginBottom: 1 }}>Sistema</div>
          <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#09090b", margin: 0, fontFamily: "var(--font-inter)" }}>Actividad reciente</h3>
        </div>
        {items.length > 0 && (
          <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "#71717a", background: "#f4f4f5", borderRadius: 999, padding: "2px 7px" }}>
            {items.length} eventos
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "32px 20px", textAlign: "center", color: "#a1a1aa", fontSize: "0.8125rem" }}>
          Sin actividad reciente
        </div>
      ) : (
        <div style={{ padding: "4px 0" }}>
          {items.map((item, idx) => {
            const Icon = ACTIVITY_ICON[item.type];
            const color = ACTIVITY_COLOR[item.type];
            const bg = ACTIVITY_BG[item.type];
            return (
              <Link key={idx} href={item.href} style={{ textDecoration: "none", display: "block" }}>
                <div
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 16px", borderBottom: idx < items.length - 1 ? "1px solid #f4f4f5" : "none", transition: "background 120ms ease" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#fafafa"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <Icon size={14} strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#09090b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                    <div style={{ fontSize: "0.6875rem", color: "#71717a", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.subtitle}</div>
                  </div>
                  <div style={{ fontSize: "0.625rem", color: "#a1a1aa", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0, paddingTop: 2 }}>
                    {fmtRelative(item.date)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Placeholder para roles sin feed de actividad ── */
function PlaceholderContent({ role, conductorStats }: { role: string; conductorStats: ConductorStats | null }) {
  if (role === "conductor" && conductorStats) {
    const statusColor = conductorStats.status === "apto" ? "#15803d" : conductorStats.status === "riesgo" ? "#B45309" : "#b91c1c";
    const statusBg = conductorStats.status === "apto" ? "#F0FDF4" : conductorStats.status === "riesgo" ? "#FEF3C7" : "#FFF5F5";
    return (
      <div style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: 12, padding: "20px" }}>
        <div style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#71717a", marginBottom: 8 }}>Fatiga y estado</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 100, background: statusBg, border: `1px solid ${statusColor}30`, borderRadius: 9, padding: "12px 14px" }}>
            <div style={{ fontSize: "0.6875rem", color: statusColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Estado</div>
            <div style={{ fontSize: "1.125rem", fontWeight: 800, color: statusColor, marginTop: 2 }}>
              {conductorStats.status === "apto" ? "Apto" : conductorStats.status === "riesgo" ? "En riesgo" : "No apto"}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 100, background: "#F8F8F8", border: "1px solid #e4e4e7", borderRadius: 9, padding: "12px 14px" }}>
            <div style={{ fontSize: "0.6875rem", color: "#71717a", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>H. continuas</div>
            <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "#09090b", marginTop: 2 }}>{conductorStats.continuousHours}h</div>
          </div>
          <div style={{ flex: 1, minWidth: 100, background: "#F8F8F8", border: "1px solid #e4e4e7", borderRadius: 9, padding: "12px 14px" }}>
            <div style={{ fontSize: "0.6875rem", color: "#71717a", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Viajes hoy</div>
            <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "#09090b", marginTop: 2 }}>{conductorStats.tripsToday}</div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

/* ── Panel derecho: todos los módulos agrupados sin tabs ── */

type TabConfig = { key: string; label: string; items: FeatureItem[] };
type FeatureItem = { title: string; subtitle: string; href: string; icon: typeof Users; badge?: string };

function AllModulesPanel({ role, stats }: { role: string; stats: GlobalStats | null }) {
  const groups = useMemo(() => buildTabsFor(role, stats), [role, stats]);

  if (groups.length === 0) return null;

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e4e4e7", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #e4e4e7" }}>
        <div style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#71717a", marginBottom: 1 }}>Navegación</div>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#09090b", margin: 0, fontFamily: "var(--font-inter)" }}>Módulos disponibles</h3>
      </div>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
        {groups.map((group) => (
          <div key={group.key}>
            <div style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#a1a1aa", marginBottom: 6, paddingLeft: 2 }}>
              {group.label}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
              {group.items.map((it) => (
                <FeatureCard key={it.href + it.title} icon={it.icon} title={it.title} subtitle={it.subtitle} href={it.href} badge={it.badge} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Builders ── */

function buildQuickActionFor(role: string): QuickActionDef | null {
  switch (role) {
    case "super_admin":      return { icon: Users,       title: "Gestión de Usuarios y Roles",     subtitle: "Designar accesos y permisos en toda la plataforma.", href: "/usuarios" };
    case "admin_provincial": return { icon: Building2,   title: "Municipalidades de tu provincia", subtitle: "Supervisa la gestión de cada municipalidad.",         href: "/municipalidades" };
    case "admin_municipal":  return { icon: UserCheck,   title: "Aprobaciones pendientes",          subtitle: "Revisa nuevos usuarios y sus permisos.",             href: "/admin/users" };
    case "operador":         return { icon: ClipboardList, title: "Flota del día",                 subtitle: "Asignaciones, conductores y despacho.",               href: "/flota" };
    case "fiscal":           return { icon: Shield,      title: "Inspecciones en campo",            subtitle: "Levanta actas digitales y escanea QR.",              href: "/inspecciones" };
    default:                 return { icon: Bell,        title: "Notificaciones",                   subtitle: "Mantente al día con novedades.",                     href: "/notificaciones" };
  }
}

const FATIGUE_LABELS: Record<string, string> = { apto: "Apto", riesgo: "Riesgo", no_apto: "No apto" };

function buildKpiItemsFor(
  role: string,
  stats: GlobalStats | null,
  operadorStats: OperadorStats | null,
  fiscalStats: FiscalStats | null,
  conductorStats: ConductorStats | null,
  loading: boolean,
): KPIItem[] {
  const val = (n: number | undefined) => (typeof n === "number" ? n : loading ? "…" : 0);

  if (role === "super_admin") return [
    { label: "PROVINCIAS",    value: val(stats?.provincesCount),       subtitle: "registradas",                                          accent: "#B8860B", icon: MapPin    },
    { label: "MUNICIPIOS",    value: stats ? stats.activeMunicipalities : loading ? "…" : 0, subtitle: stats ? `activas de ${stats.municipalitiesCount}` : "sin datos", accent: "#15803d", icon: Building2 },
    { label: "PENDIENTES",    value: val(stats?.usersPendingApproval), subtitle: "por aprobar",                                          accent: "#B45309", icon: UserPlus  },
    { label: "EMPRESAS",      value: val(stats?.companiesCount),       subtitle: "registradas",                                          accent: "#0A1628", icon: Truck     },
  ];
  if (role === "admin_provincial") return [
    { label: "MUNICIPIOS",    value: stats ? stats.activeMunicipalities : loading ? "…" : 0, subtitle: stats ? `activas de ${stats.municipalitiesCount}` : "sin datos", accent: "#15803d", icon: Building2 },
    { label: "APROBACIONES",  value: val(stats?.usersPendingApproval), subtitle: "pendientes",  accent: "#B45309", icon: UserCheck      },
    { label: "SANCIONES",     value: val(stats?.sanctionsThisMonth),   subtitle: "este mes",    accent: "#b91c1c", icon: TriangleAlert  },
    { label: "REPORTES",      value: val(stats?.reportsPending),       subtitle: "ciudadanos",  accent: "#B8860B", icon: Flag           },
  ];
  if (role === "admin_municipal") return [
    { label: "EMPRESAS",      value: val(stats?.companiesCount),       subtitle: "registradas", accent: "#B8860B", icon: Truck          },
    { label: "INSPECCIONES",  value: "—",                              subtitle: "próximamente",accent: "#15803d", icon: Shield         },
    { label: "REPORTES",      value: val(stats?.reportsPending),       subtitle: "pendientes",  accent: "#B45309", icon: Flag           },
    { label: "SANCIONES",     value: val(stats?.sanctionsThisMonth),   subtitle: "este mes",    accent: "#b91c1c", icon: TriangleAlert  },
  ];
  if (role === "operador") {
    const ov = (n: number | undefined) => (typeof n === "number" ? n : loading ? "…" : "—");
    return [
      { label: "VEHÍCULOS",   value: ov(operadorStats?.totalVehicles),   subtitle: operadorStats ? `${operadorStats.activeVehicles} activos` : "de la municipalidad", accent: "#B8860B", icon: Car        },
      { label: "EN RUTA",     value: ov(operadorStats?.vehiclesEnRuta),  subtitle: "en circulación",  accent: "#0A1628", icon: Route       },
      { label: "CONDUCTORES", value: ov(operadorStats?.activeDrivers),   subtitle: "aptos hoy",       accent: "#15803d", icon: Users       },
      { label: "FLOTA ACTIVA",value: ov(operadorStats?.activeVehicles),  subtitle: "disponibles",     accent: "#B45309", icon: CalendarDays},
    ];
  }
  if (role === "fiscal") {
    const fv = (n: number | undefined) => (typeof n === "number" ? n : loading ? "…" : "—");
    return [
      { label: "INSPECCIONES",value: fv(fiscalStats?.inspectionsThisMonth), subtitle: "este mes",          accent: "#15803d", icon: Shield      },
      { label: "OBSERVADAS",  value: fv(fiscalStats?.inspectionsPending),   subtitle: "con observaciones", accent: "#B8860B", icon: Car         },
      { label: "REPORTES",    value: fv(fiscalStats?.reportsPending),       subtitle: "activos",           accent: "#B45309", icon: Flag        },
      { label: "NUEVOS",      value: fv(fiscalStats?.reportsNewThisMonth),  subtitle: "reportes mes",      accent: "#b91c1c", icon: TriangleAlert},
    ];
  }
  if (role === "conductor") {
    const cv = (n: number | undefined) => (typeof n === "number" ? n : loading ? "…" : "—");
    return [
      { label: "ESTADO",      value: conductorStats ? (FATIGUE_LABELS[conductorStats.status] ?? conductorStats.status) : loading ? "…" : "—", subtitle: conductorStats ? `${conductorStats.continuousHours}h continuas` : "fatiga", accent: conductorStats?.status === "apto" ? "#15803d" : conductorStats?.status === "riesgo" ? "#B45309" : "#b91c1c", icon: Shield },
      { label: "DESCANSO",    value: conductorStats ? `${conductorStats.restHours}h` : loading ? "…" : "—", subtitle: "horas de descanso", accent: "#0A1628", icon: CalendarDays },
      { label: "VIAJES HOY",  value: cv(conductorStats?.tripsToday),     subtitle: "realizados",       accent: "#B8860B", icon: Route       },
      { label: "REPUTACIÓN",  value: cv(conductorStats?.reputationScore),subtitle: "puntos",           accent: "#B8860B", icon: ChartColumn },
    ];
  }
  return [
    { label: "NOTIFICACIONES", value: "—", subtitle: "sin leer", accent: "#B8860B", icon: Bell     },
    { label: "HISTORIAL",      value: "—", subtitle: "registros", accent: "#0A1628", icon: FileText },
  ];
}

function buildHeroPills(
  role: string,
  stats: GlobalStats | null,
  operadorStats: OperadorStats | null,
  fiscalStats: FiscalStats | null,
  conductorStats: ConductorStats | null,
) {
  if (role === "super_admin" && stats) return [
    { label: "Provincias", value: stats.provincesCount },
    { label: "Municipios", value: stats.activeMunicipalities },
    { label: "Pendientes", value: stats.usersPendingApproval, warn: stats.usersPendingApproval > 0 },
  ];
  if (role === "admin_provincial" && stats) return [
    { label: "Municipios",   value: stats.activeMunicipalities },
    { label: "Aprobaciones", value: stats.usersPendingApproval, warn: stats.usersPendingApproval > 0 },
    { label: "Sanciones",    value: stats.sanctionsThisMonth },
  ];
  if (role === "admin_municipal" && stats) return [
    { label: "Empresas",  value: stats.companiesCount },
    { label: "Reportes",  value: stats.reportsPending, warn: stats.reportsPending > 0 },
  ];
  if (role === "operador" && operadorStats) return [
    { label: "Vehículos",         value: operadorStats.totalVehicles },
    { label: "En ruta",           value: operadorStats.vehiclesEnRuta, warn: operadorStats.vehiclesEnRuta === 0 },
    { label: "Conductores aptos", value: operadorStats.activeDrivers },
  ];
  if (role === "fiscal" && fiscalStats) return [
    { label: "Inspecciones", value: fiscalStats.inspectionsThisMonth },
    { label: "Observadas",   value: fiscalStats.inspectionsPending, warn: fiscalStats.inspectionsPending > 0 },
    { label: "Reportes",     value: fiscalStats.reportsPending, warn: fiscalStats.reportsPending > 0 },
  ];
  if (role === "conductor" && conductorStats) return [
    { label: "Estado",         value: FATIGUE_LABELS[conductorStats.status] ?? conductorStats.status, warn: conductorStats.status !== "apto" },
    { label: "Horas continuas",value: conductorStats.continuousHours },
    { label: "Viajes hoy",     value: conductorStats.tripsToday },
  ];
  return undefined;
}

function buildTabsFor(role: string, stats: GlobalStats | null): TabConfig[] {
  const pending = stats?.usersPendingApproval ?? 0;

  if (role === "super_admin") return [
    { key: "accesos",    label: "Accesos",    items: [
      { title: "Usuarios",     subtitle: "Listado y roles",    href: "/usuarios",    icon: Users                                                               },
      { title: "Aprobaciones", subtitle: "Revisar pendientes", href: "/admin/users", icon: UserCheck, badge: pending > 0 ? `${pending}` : undefined           },
    ]},
    { key: "territorio", label: "Territorio", items: [
      { title: "Provincias",      subtitle: "Red nacional",       href: "/provincias",       icon: MapPin    },
      { title: "Municipalidades", subtitle: "Estado y actividad", href: "/municipalidades",  icon: Building2 },
    ]},
    { key: "analisis",   label: "Análisis",   items: [
      { title: "Estadísticas", subtitle: "Métricas globales", href: "/estadisticas", icon: ChartColumn },
      { title: "Auditoría",    subtitle: "Trazabilidad",      href: "/auditoria",    icon: FileText    },
    ]},
  ];

  if (role === "admin_provincial") return [
    { key: "gestion",  label: "Gestión",  items: [
      { title: "Municipalidades", subtitle: "De tu provincia", href: "/municipalidades", icon: Building2                                                         },
      { title: "Usuarios",        subtitle: "Provincial",      href: "/usuarios",        icon: Users                                                             },
      { title: "Aprobaciones",    subtitle: "Pendientes",      href: "/admin/users",     icon: UserCheck, badge: pending > 0 ? `${pending}` : undefined          },
    ]},
    { key: "analisis", label: "Análisis", items: [
      { title: "Estadísticas", subtitle: "Provincia", href: "/estadisticas", icon: ChartColumn },
      { title: "Auditoría",    subtitle: "Actividad", href: "/auditoria",    icon: FileText    },
    ]},
    { key: "campo",    label: "Campo",    items: [
      { title: "Sanciones", subtitle: "Mensuales",  href: "/sanciones", icon: TriangleAlert },
      { title: "Reportes",  subtitle: "Ciudadanos", href: "/reportes",  icon: Flag          },
    ]},
  ];

  if (role === "admin_municipal") return [
    { key: "operacion",  label: "Operación",  items: [
      { title: "Empresas",          subtitle: "De transporte",  href: "/empresas",       icon: Truck     },
      { title: "Tipos de vehículo", subtitle: "Catálogo local", href: "/tipos-vehiculo", icon: Car       },
      { title: "Conductores",       subtitle: "Registro",       href: "/conductores",    icon: Users     },
      { title: "Vehículos / QR",    subtitle: "Emisión",        href: "/vehiculos",      icon: Car       },
    ]},
    { key: "ciudadania", label: "Ciudadanía", items: [
      { title: "Reportes",     subtitle: "Ciudadanos",  href: "/reportes",     icon: Flag          },
      { title: "Sanciones",    subtitle: "Aplicadas",   href: "/sanciones",    icon: TriangleAlert },
      { title: "Inspecciones", subtitle: "Actas",       href: "/inspecciones", icon: Shield        },
    ]},
    { key: "analisis",   label: "Análisis",   items: [
      { title: "Estadísticas", subtitle: "Municipales",  href: "/estadisticas", icon: ChartColumn },
      { title: "Auditoría",    subtitle: "Trazabilidad", href: "/auditoria",    icon: FileText    },
    ]},
  ];

  if (role === "operador") return [
    { key: "flota",     label: "Flota",     items: [
      { title: "Flota del día", subtitle: "Asignaciones", href: "/flota",       icon: ClipboardList },
      { title: "Vehículos",     subtitle: "Registro",     href: "/vehiculos",   icon: Car           },
      { title: "Conductores",   subtitle: "Disponibles",  href: "/conductores", icon: Users         },
    ]},
    { key: "operacion", label: "Operación", items: [
      { title: "Rutas",  subtitle: "Y zonas", href: "/rutas",  icon: Route        },
      { title: "Viajes", subtitle: "Del día", href: "/viajes", icon: CalendarDays },
    ]},
  ];

  if (role === "fiscal") return [
    { key: "campo",     label: "Campo",     items: [
      { title: "Inspecciones", subtitle: "Actas",       href: "/inspecciones", icon: Shield },
      { title: "Vehículos",    subtitle: "Escanear QR", href: "/vehiculos",    icon: Car    },
      { title: "Conductores",  subtitle: "Consulta",    href: "/conductores",  icon: Users  },
    ]},
    { key: "ciudadania",label: "Ciudadanía",items: [
      { title: "Reportes",  subtitle: "Ciudadanos",  href: "/reportes",  icon: Flag          },
      { title: "Sanciones", subtitle: "Registradas", href: "/sanciones", icon: TriangleAlert },
    ]},
  ];

  return [{ key: "inicio", label: "Inicio", items: [
    { title: "Notificaciones", subtitle: "Centro de avisos", href: "/notificaciones", icon: Bell },
  ]}];
}
