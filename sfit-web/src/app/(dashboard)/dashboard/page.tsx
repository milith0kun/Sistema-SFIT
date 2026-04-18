"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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

  useEffect(() => {
    if (!user) return;
    if (user.role === "super_admin" || user.role === "admin_provincial" || user.role === "admin_municipal") {
      void loadSuperAdmin();
    }
  }, [user, loadSuperAdmin]);

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

  const heroPills = buildHeroPills(role, stats);

  return (
    <div className="space-y-6 animate-fade-in">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-up delay-100">
        {/* Columna principal */}
        <div className="lg:col-span-8 space-y-6 min-w-0">
          <PrimarySection role={role} stats={stats} loading={loading} />
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
  loading,
}: {
  role: string;
  stats: GlobalStats | null;
  loading: boolean;
}) {
  const items = buildKpiItemsFor(role, stats, loading);
  const hero = buildHeroActionFor(role);
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
    </>
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

function buildKpiItemsFor(role: string, stats: GlobalStats | null, loading: boolean): KPIItem[] {
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
    return [
      { label: "VEHÍCULOS", value: "—", subtitle: "activos hoy", accent: "#B8860B", icon: Car },
      { label: "CONDUCTORES", value: "—", subtitle: "aptos", accent: "#15803d", icon: Users },
      { label: "RUTAS", value: "—", subtitle: "asignadas", accent: "#0A1628", icon: Route },
      { label: "VIAJES", value: "—", subtitle: "del día", accent: "#B45309", icon: CalendarDays },
    ];
  }
  if (role === "fiscal") {
    return [
      { label: "INSPECCIONES", value: "—", subtitle: "del día", accent: "#15803d", icon: Shield },
      { label: "VEHÍCULOS", value: "—", subtitle: "escaneados", accent: "#B8860B", icon: Car },
      { label: "REPORTES", value: "—", subtitle: "ciudadanos", accent: "#B45309", icon: Flag },
      { label: "SANCIONES", value: "—", subtitle: "registradas", accent: "#b91c1c", icon: TriangleAlert },
    ];
  }
  // fallback
  return [
    { label: "NOTIFICACIONES", value: "—", subtitle: "sin leer", accent: "#B8860B", icon: Bell },
    { label: "HISTORIAL", value: "—", subtitle: "registros", accent: "#0A1628", icon: FileText },
  ];
}

function buildHeroPills(role: string, stats: GlobalStats | null) {
  if (!stats) return undefined;
  if (role === "super_admin") {
    return [
      { label: "Provincias", value: stats.provincesCount },
      { label: "Municipios", value: stats.activeMunicipalities },
      { label: "Pendientes", value: stats.usersPendingApproval, warn: stats.usersPendingApproval > 0 },
    ];
  }
  if (role === "admin_provincial") {
    return [
      { label: "Municipios", value: stats.activeMunicipalities },
      { label: "Aprobaciones", value: stats.usersPendingApproval, warn: stats.usersPendingApproval > 0 },
      { label: "Sanciones", value: stats.sanctionsThisMonth },
    ];
  }
  if (role === "admin_municipal") {
    return [
      { label: "Empresas", value: stats.companiesCount },
      { label: "Reportes", value: stats.reportsPending, warn: stats.reportsPending > 0 },
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
    <div className="space-y-5">
      <SectionTabs
        tabs={tabs.map((t) => ({ key: t.key, label: t.label }))}
        value={active}
        onChange={setActive}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
