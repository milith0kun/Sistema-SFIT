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
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { HeroActionCard } from "@/components/dashboard/HeroActionCard";
import { KPIStrip, type KPIItem } from "@/components/dashboard/KPIStrip";
import { FeatureCard } from "@/components/dashboard/FeatureCard";
import { SectionTabs } from "@/components/dashboard/SectionTabs";

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

/* ── Store sincronizado con localStorage para leer sfit_user sin setState en efecto ── */
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
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const headers = { Authorization: `Bearer ${token ?? ""}` };

      const sres = await fetch("/api/admin/stats/global", { headers });
      if (sres.ok) {
        const sdata: ApiResponse<GlobalStats> = await sres.json();
        if (sdata.success && sdata.data) setStats(sdata.data);
        else if (sdata.error) setError(sdata.error);
      } else if (sres.status !== 404) {
        setError("No se pudieron cargar las estadísticas.");
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOperador = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const headers = { Authorization: `Bearer ${token ?? ""}` };
      const res = await fetch("/api/admin/stats/operador", { headers });
      if (res.ok) {
        const data: ApiResponse<OperadorStats> = await res.json();
        if (data.success && data.data) setOperadorStats(data.data);
        else if (data.error) setError(data.error);
      } else if (res.status !== 404) {
        setError("No se pudieron cargar las estadísticas de flota.");
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFiscal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const headers = { Authorization: `Bearer ${token ?? ""}` };
      const res = await fetch("/api/admin/stats/fiscal", { headers });
      if (res.ok) {
        const data: ApiResponse<FiscalStats> = await res.json();
        if (data.success && data.data) setFiscalStats(data.data);
        else if (data.error) setError(data.error);
      } else if (res.status !== 404) {
        setError("No se pudieron cargar las estadísticas de inspecciones.");
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConductor = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const headers = { Authorization: `Bearer ${token ?? ""}` };
      const res = await fetch("/api/admin/stats/conductor", { headers });
      if (res.ok) {
        const data: ApiResponse<ConductorStats> = await res.json();
        if (data.success && data.data) setConductorStats(data.data);
        // 404 = conductor sin registro en la BD, no es un error crítico
      } else if (res.status !== 404 && res.status !== 403) {
        setError("No se pudieron cargar los datos del conductor.");
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActividad = useCallback(async () => {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/admin/actividad", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.ok) {
        const data: ApiResponse<{ items: ActivityItem[] }> = await res.json();
        if (data.success && data.data) setActividad(data.data.items ?? []);
      }
    } catch {
      // Silencioso: el feed de actividad no bloquea la página
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role === "super_admin" || user.role === "admin_provincial" || user.role === "admin_municipal") {
      void loadSuperAdmin();
      void loadActividad();
    } else if (user.role === "operador") {
      void loadOperador();
    } else if (user.role === "fiscal") {
      void loadFiscal();
      void loadActividad();
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

  return (
    <div className="space-y-4 animate-fade-in">
      <DashboardHero
        kicker={`${roleLabel} · SFIT`}
        title={`${greeting}, ${firstName}.`}
        subtitle="Panel operativo. Accede a tus módulos desde la columna derecha."
        pills={heroPills}
      />

      {error && (
        <div
          className="animate-fade-up"
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-fade-up delay-100">
        {/* Columna principal */}
        <div className="lg:col-span-8 space-y-4 min-w-0">
          <PrimarySection
            role={role}
            stats={stats}
            operadorStats={operadorStats}
            fiscalStats={fiscalStats}
            conductorStats={conductorStats}
            actividad={actividad}
            loading={loading}
          />
        </div>

        {/* Columna lateral */}
        <div className="lg:col-span-4 min-w-0">
          <SideSection role={role} stats={stats} />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   Sección principal: Hero + 2x2 StatCards
   ────────────────────────────────────────── */

function PrimarySection({
  role,
  stats,
  operadorStats,
  fiscalStats,
  conductorStats,
  actividad,
  loading,
}: {
  role: string;
  stats: GlobalStats | null;
  operadorStats: OperadorStats | null;
  fiscalStats: FiscalStats | null;
  conductorStats: ConductorStats | null;
  actividad: ActivityItem[];
  loading: boolean;
}) {
  const items = buildKpiItemsFor(role, stats, operadorStats, fiscalStats, conductorStats, loading);
  const hero = buildHeroActionFor(role);
  const showActivity = ["super_admin", "admin_provincial", "admin_municipal", "fiscal"].includes(role);
  return (
    <>
      {hero && (
        <HeroActionCard
          icon={hero.icon}
          title={hero.title}
          subtitle={hero.subtitle}
          href={hero.href}
          accent={hero.accent}
        />
      )}
      {items.length > 0 && <KPIStrip items={items} cols={items.length >= 4 ? 4 : 3} />}
      {showActivity && <ActivityFeed items={actividad} />}
    </>
  );
}

/* ──────────────────────────────────────────
   Feed de actividad reciente
   ────────────────────────────────────────── */

const ACTIVITY_ICON: Record<ActivityItem["type"], typeof Users> = {
  inspeccion: ClipboardCheck,
  reporte: Flag,
  apelacion: MessageSquareWarning,
  sancion: AlertCircle,
};

const ACTIVITY_COLOR: Record<ActivityItem["type"], string> = {
  inspeccion: "#15803d",
  reporte: "#B8860B",
  apelacion: "#1e40af",
  sancion: "#b91c1c",
};

const ACTIVITY_BG: Record<ActivityItem["type"], string> = {
  inspeccion: "#F0FDF4",
  reporte: "#FDF8EC",
  apelacion: "#EFF6FF",
  sancion: "#FFF5F5",
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
  if (items.length === 0) return null;

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e4e4e7",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid #e4e4e7",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#71717a",
              marginBottom: 2,
            }}
          >
            Sistema
          </div>
          <h3
            style={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              color: "#09090b",
              margin: 0,
              fontFamily: "var(--font-inter)",
            }}
          >
            Actividad reciente
          </h3>
        </div>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: "#71717a",
            background: "#f4f4f5",
            borderRadius: 999,
            padding: "3px 8px",
          }}
        >
          {items.length} eventos
        </span>
      </div>

      <div style={{ padding: "8px 0" }}>
        {items.map((item, idx) => {
          const Icon = ACTIVITY_ICON[item.type];
          const color = ACTIVITY_COLOR[item.type];
          const bg = ACTIVITY_BG[item.type];
          return (
            <Link
              key={idx}
              href={item.href}
              style={{ textDecoration: "none", display: "block" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "11px 20px",
                  borderBottom: idx < items.length - 1 ? "1px solid #f4f4f5" : "none",
                  transition: "background 120ms ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#fafafa"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    background: bg,
                    color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  <Icon size={16} strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      color: "#09090b",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#71717a",
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.subtitle}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    color: "#a1a1aa",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    paddingTop: 2,
                  }}
                >
                  {fmtRelative(item.date)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

type HeroActionDef = {
  icon: typeof Users;
  title: string;
  subtitle: string;
  href: string;
  accent: "gold" | "navy";
};

function buildHeroActionFor(role: string): HeroActionDef | null {
  switch (role) {
    case "super_admin":
      return {
        icon: Users,
        title: "Gestión de Usuarios y Roles",
        subtitle: "Designar accesos y permisos en toda la plataforma.",
        href: "/usuarios",
        accent: "gold",
      };
    case "admin_provincial":
      return {
        icon: Building2,
        title: "Municipalidades de tu provincia",
        subtitle: "Supervisa la gestión de cada municipalidad.",
        href: "/municipalidades",
        accent: "navy",
      };
    case "admin_municipal":
      return {
        icon: UserCheck,
        title: "Aprobaciones pendientes",
        subtitle: "Revisa nuevos usuarios y sus permisos.",
        href: "/admin/users",
        accent: "gold",
      };
    case "operador":
      return {
        icon: ClipboardList,
        title: "Flota del día",
        subtitle: "Asignaciones, conductores y despacho de la jornada.",
        href: "/flota",
        accent: "gold",
      };
    case "fiscal":
      return {
        icon: Shield,
        title: "Inspecciones en campo",
        subtitle: "Levanta actas digitales y escanea QR de vehículos.",
        href: "/inspecciones",
        accent: "navy",
      };
    default:
      return {
        icon: Bell,
        title: "Tus notificaciones",
        subtitle: "Mantente al día con novedades de la plataforma.",
        href: "/notificaciones",
        accent: "navy",
      };
  }
}

const FATIGUE_LABELS: Record<string, string> = {
  apto: "Apto",
  riesgo: "Riesgo",
  no_apto: "No apto",
};

function buildKpiItemsFor(
  role: string,
  stats: GlobalStats | null,
  operadorStats: OperadorStats | null,
  fiscalStats: FiscalStats | null,
  conductorStats: ConductorStats | null,
  loading: boolean,
): KPIItem[] {
  const val = (n: number | undefined) => (typeof n === "number" ? n : loading ? "…" : 0);

  if (role === "super_admin") {
    return [
      { label: "PROVINCIAS", value: val(stats?.provincesCount), subtitle: "registradas", accent: "#B8860B", icon: MapPin },
      { label: "MUNICIPALIDADES", value: stats ? stats.activeMunicipalities : loading ? "…" : 0, subtitle: stats ? `activas de ${stats.municipalitiesCount}` : "sin datos", accent: "#15803d", icon: Building2 },
      { label: "PENDIENTES", value: val(stats?.usersPendingApproval), subtitle: "por aprobar", accent: "#B45309", icon: UserPlus },
      { label: "EMPRESAS", value: val(stats?.companiesCount), subtitle: "registradas", accent: "#0A1628", icon: Truck },
    ];
  }
  if (role === "admin_provincial") {
    return [
      { label: "MUNICIPALIDADES", value: stats ? stats.activeMunicipalities : loading ? "…" : 0, subtitle: stats ? `activas de ${stats.municipalitiesCount}` : "sin datos", accent: "#15803d", icon: Building2 },
      { label: "APROBACIONES", value: val(stats?.usersPendingApproval), subtitle: "pendientes", accent: "#B45309", icon: UserCheck },
      { label: "SANCIONES", value: val(stats?.sanctionsThisMonth), subtitle: "este mes", accent: "#b91c1c", icon: TriangleAlert },
      { label: "REPORTES", value: val(stats?.reportsPending), subtitle: "ciudadanos", accent: "#B8860B", icon: Flag },
    ];
  }
  if (role === "admin_municipal") {
    return [
      { label: "EMPRESAS", value: val(stats?.companiesCount), subtitle: "registradas", accent: "#B8860B", icon: Truck },
      { label: "INSPECCIONES", value: "—", subtitle: "próximamente", accent: "#15803d", icon: Shield },
      { label: "REPORTES", value: val(stats?.reportsPending), subtitle: "pendientes", accent: "#B45309", icon: Flag },
      { label: "SANCIONES", value: val(stats?.sanctionsThisMonth), subtitle: "este mes", accent: "#b91c1c", icon: TriangleAlert },
    ];
  }
  if (role === "operador") {
    const ov = (n: number | undefined) => (typeof n === "number" ? n : loading ? "…" : "—");
    return [
      {
        label: "VEHÍCULOS",
        value: ov(operadorStats?.totalVehicles),
        subtitle: operadorStats ? `${operadorStats.activeVehicles} activos` : "de la municipalidad",
        accent: "#B8860B",
        icon: Car,
      },
      {
        label: "EN RUTA",
        value: ov(operadorStats?.vehiclesEnRuta),
        subtitle: "vehículos en ruta",
        accent: "#0A1628",
        icon: Route,
      },
      {
        label: "CONDUCTORES",
        value: ov(operadorStats?.activeDrivers),
        subtitle: "aptos hoy",
        accent: "#15803d",
        icon: Users,
      },
      {
        label: "FLOTA ACTIVA",
        value: ov(operadorStats?.activeVehicles),
        subtitle: "disponibles + en ruta",
        accent: "#B45309",
        icon: CalendarDays,
      },
    ];
  }
  if (role === "fiscal") {
    const fv = (n: number | undefined) => (typeof n === "number" ? n : loading ? "…" : "—");
    return [
      {
        label: "INSPECCIONES",
        value: fv(fiscalStats?.inspectionsThisMonth),
        subtitle: "este mes",
        accent: "#15803d",
        icon: Shield,
      },
      {
        label: "PENDIENTES",
        value: fv(fiscalStats?.inspectionsPending),
        subtitle: "con observaciones",
        accent: "#B8860B",
        icon: Car,
      },
      {
        label: "REPORTES",
        value: fv(fiscalStats?.reportsPending),
        subtitle: "ciudadanos activos",
        accent: "#B45309",
        icon: Flag,
      },
      {
        label: "NUEVOS",
        value: fv(fiscalStats?.reportsNewThisMonth),
        subtitle: "reportes este mes",
        accent: "#b91c1c",
        icon: TriangleAlert,
      },
    ];
  }
  if (role === "conductor") {
    const cv = (n: number | undefined) => (typeof n === "number" ? n : loading ? "…" : "—");
    return [
      {
        label: "ESTADO",
        value: conductorStats ? (FATIGUE_LABELS[conductorStats.status] ?? conductorStats.status) : loading ? "…" : "—",
        subtitle: conductorStats ? `${conductorStats.continuousHours}h continuas` : "fatiga",
        accent: conductorStats?.status === "apto" ? "#15803d" : conductorStats?.status === "riesgo" ? "#B45309" : "#b91c1c",
        icon: Shield,
      },
      {
        label: "DESCANSO",
        value: conductorStats ? `${conductorStats.restHours}h` : loading ? "…" : "—",
        subtitle: "horas de descanso",
        accent: "#0A1628",
        icon: CalendarDays,
      },
      {
        label: "VIAJES HOY",
        value: cv(conductorStats?.tripsToday),
        subtitle: "realizados hoy",
        accent: "#B8860B",
        icon: Route,
      },
      {
        label: "REPUTACIÓN",
        value: cv(conductorStats?.reputationScore),
        subtitle: "puntos",
        accent: "#B8860B",
        icon: ChartColumn,
      },
    ];
  }
  // fallback
  return [
    { label: "NOTIFICACIONES", value: "—", subtitle: "sin leer", accent: "#B8860B", icon: Bell },
    { label: "HISTORIAL", value: "—", subtitle: "registros", accent: "#0A1628", icon: FileText },
  ];
}

function buildHeroPills(
  role: string,
  stats: GlobalStats | null,
  operadorStats: OperadorStats | null,
  fiscalStats: FiscalStats | null,
  conductorStats: ConductorStats | null,
) {
  if (role === "super_admin" && stats) {
    return [
      { label: "Provincias", value: stats.provincesCount },
      { label: "Municipios", value: stats.activeMunicipalities },
      { label: "Pendientes", value: stats.usersPendingApproval, warn: stats.usersPendingApproval > 0 },
    ];
  }
  if (role === "admin_provincial" && stats) {
    return [
      { label: "Municipios", value: stats.activeMunicipalities },
      { label: "Aprobaciones", value: stats.usersPendingApproval, warn: stats.usersPendingApproval > 0 },
      { label: "Sanciones", value: stats.sanctionsThisMonth },
    ];
  }
  if (role === "admin_municipal" && stats) {
    return [
      { label: "Empresas", value: stats.companiesCount },
      { label: "Reportes", value: stats.reportsPending, warn: stats.reportsPending > 0 },
    ];
  }
  if (role === "operador" && operadorStats) {
    return [
      { label: "Vehículos", value: operadorStats.totalVehicles },
      { label: "En ruta", value: operadorStats.vehiclesEnRuta, warn: operadorStats.vehiclesEnRuta === 0 },
      { label: "Conductores aptos", value: operadorStats.activeDrivers },
    ];
  }
  if (role === "fiscal" && fiscalStats) {
    return [
      { label: "Inspecciones", value: fiscalStats.inspectionsThisMonth },
      { label: "Observadas", value: fiscalStats.inspectionsPending, warn: fiscalStats.inspectionsPending > 0 },
      { label: "Reportes", value: fiscalStats.reportsPending, warn: fiscalStats.reportsPending > 0 },
    ];
  }
  if (role === "conductor" && conductorStats) {
    return [
      { label: "Estado", value: FATIGUE_LABELS[conductorStats.status] ?? conductorStats.status, warn: conductorStats.status !== "apto" },
      { label: "Horas continuas", value: conductorStats.continuousHours },
      { label: "Viajes hoy", value: conductorStats.tripsToday },
    ];
  }
  return undefined;
}

/* ──────────────────────────────────────────
   Sección lateral: Tabs + FeatureCards
   ────────────────────────────────────────── */

type TabConfig = { key: string; label: string; items: FeatureItem[] };
type FeatureItem = {
  title: string;
  subtitle: string;
  href: string;
  icon: typeof Users;
  badge?: string;
};

function SideSection({ role, stats }: { role: string; stats: GlobalStats | null }) {
  const tabs = useMemo(() => buildTabsFor(role, stats), [role, stats]);
  const [active, setActive] = useState<string>(tabs[0]?.key ?? "default");

  // Si cambia el rol (tabs.length/claves) y el activo ya no existe, usamos el primero
  // directamente en render — evitamos setState en effect. El estado se corregirá
  // la próxima vez que el usuario interactúe con las tabs.
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  if (!current) return null;

  return (
    <div className="space-y-3">
      <SectionTabs
        tabs={tabs.map((t) => ({ key: t.key, label: t.label }))}
        value={active}
        onChange={setActive}
      />
      <div className="grid grid-cols-2 gap-2">
        {current.items.map((it) => (
          <FeatureCard
            key={it.href + it.title}
            icon={it.icon}
            title={it.title}
            subtitle={it.subtitle}
            href={it.href}
            badge={it.badge}
          />
        ))}
      </div>
    </div>
  );
}

function buildTabsFor(role: string, stats: GlobalStats | null): TabConfig[] {
  const pending = stats?.usersPendingApproval ?? 0;

  if (role === "super_admin") {
    return [
      {
        key: "accesos",
        label: "Accesos",
        items: [
          { title: "Usuarios",      subtitle: "Listado y roles", href: "/usuarios",    icon: Users },
          { title: "Aprobaciones",  subtitle: "Revisar pendientes", href: "/admin/users", icon: UserCheck, badge: pending > 0 ? `${pending}` : undefined },
        ],
      },
      {
        key: "territorio",
        label: "Territorio",
        items: [
          { title: "Provincias",       subtitle: "Red nacional",   href: "/provincias",       icon: MapPin },
          { title: "Municipalidades",  subtitle: "Estado y actividad", href: "/municipalidades", icon: Building2 },
        ],
      },
      {
        key: "analisis",
        label: "Análisis",
        items: [
          { title: "Estadísticas", subtitle: "Métricas globales",   href: "/estadisticas", icon: ChartColumn },
          { title: "Auditoría",    subtitle: "Trazabilidad",        href: "/auditoria",    icon: FileText },
        ],
      },
    ];
  }

  if (role === "admin_provincial") {
    return [
      {
        key: "gestion",
        label: "Gestión",
        items: [
          { title: "Municipalidades", subtitle: "De tu provincia", href: "/municipalidades", icon: Building2 },
          { title: "Usuarios",        subtitle: "Provincial",      href: "/usuarios",        icon: Users },
          { title: "Aprobaciones",    subtitle: "Pendientes",      href: "/admin/users",     icon: UserCheck, badge: pending > 0 ? `${pending}` : undefined },
        ],
      },
      {
        key: "analisis",
        label: "Análisis",
        items: [
          { title: "Estadísticas", subtitle: "Provincia", href: "/estadisticas", icon: ChartColumn },
          { title: "Auditoría",    subtitle: "Actividad", href: "/auditoria",    icon: FileText },
        ],
      },
      {
        key: "campo",
        label: "Campo",
        items: [
          { title: "Sanciones", subtitle: "Mensuales",  href: "/sanciones", icon: TriangleAlert },
          { title: "Reportes",  subtitle: "Ciudadanos", href: "/reportes",  icon: Flag },
        ],
      },
    ];
  }

  if (role === "admin_municipal") {
    return [
      {
        key: "operacion",
        label: "Operación",
        items: [
          { title: "Empresas",          subtitle: "De transporte",  href: "/empresas",         icon: Truck },
          { title: "Tipos de vehículo", subtitle: "Catálogo local", href: "/tipos-vehiculo",   icon: Car },
          { title: "Conductores",       subtitle: "Registro",       href: "/conductores",      icon: Users },
          { title: "Vehículos / QR",    subtitle: "Emisión",        href: "/vehiculos",        icon: Car },
        ],
      },
      {
        key: "ciudadania",
        label: "Ciudadanía",
        items: [
          { title: "Reportes",  subtitle: "Ciudadanos",  href: "/reportes",  icon: Flag },
          { title: "Sanciones", subtitle: "Aplicadas",   href: "/sanciones", icon: TriangleAlert },
          { title: "Inspecciones", subtitle: "Actas",    href: "/inspecciones", icon: Shield },
        ],
      },
      {
        key: "analisis",
        label: "Análisis",
        items: [
          { title: "Estadísticas", subtitle: "Municipales", href: "/estadisticas", icon: ChartColumn },
          { title: "Auditoría",    subtitle: "Trazabilidad", href: "/auditoria",   icon: FileText },
        ],
      },
    ];
  }

  if (role === "operador") {
    return [
      {
        key: "flota",
        label: "Flota",
        items: [
          { title: "Flota del día", subtitle: "Asignaciones",  href: "/flota",       icon: ClipboardList },
          { title: "Vehículos",     subtitle: "Registro",      href: "/vehiculos",   icon: Car },
          { title: "Conductores",   subtitle: "Disponibles",   href: "/conductores", icon: Users },
        ],
      },
      {
        key: "operacion",
        label: "Operación",
        items: [
          { title: "Rutas",  subtitle: "Y zonas", href: "/rutas",  icon: Route },
          { title: "Viajes", subtitle: "Del día", href: "/viajes", icon: CalendarDays },
        ],
      },
    ];
  }

  if (role === "fiscal") {
    return [
      {
        key: "campo",
        label: "Campo",
        items: [
          { title: "Inspecciones", subtitle: "Actas",        href: "/inspecciones", icon: Shield },
          { title: "Vehículos",    subtitle: "Escanear QR",  href: "/vehiculos",    icon: Car },
          { title: "Conductores",  subtitle: "Consulta",     href: "/conductores",  icon: Users },
        ],
      },
      {
        key: "ciudadania",
        label: "Ciudadanía",
        items: [
          { title: "Reportes",  subtitle: "Ciudadanos",  href: "/reportes",  icon: Flag },
          { title: "Sanciones", subtitle: "Registradas", href: "/sanciones", icon: TriangleAlert },
        ],
      },
    ];
  }

  return [
    {
      key: "inicio",
      label: "Inicio",
      items: [
        { title: "Notificaciones", subtitle: "Centro de avisos", href: "/notificaciones", icon: Bell },
      ],
    },
  ];
}
