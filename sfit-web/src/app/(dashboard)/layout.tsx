"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  House,
  UserCheck,
  Users,
  MapPin,
  Building2,
  Truck,
  Car,
  ClipboardList,
  Route,
  Shield,
  Flag,
  TriangleAlert,
  ChartColumn,
  FileText,
  Bell,
  LogOut,
  ChevronDown,
  CalendarDays,
  MessageSquareWarning,
} from "lucide-react";
import { NotificationsBell } from "@/components/layout/NotificationsBell";

type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string;
  status?: string;
};

type NavSection =
  | "PANEL"
  | "GESTIÓN"
  | "TERRITORIO"
  | "OPERACIÓN"
  | "CIUDADANÍA"
  | "ANÁLISIS";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
  section: NavSection;
};

const NAV: NavItem[] = [
  { href: "/dashboard",       label: "Dashboard",           icon: House,          section: "PANEL",      roles: ["super_admin","admin_provincial","admin_municipal","fiscal","operador"] },
  { href: "/notificaciones",  label: "Notificaciones",      icon: Bell,           section: "PANEL",      roles: ["super_admin","admin_provincial","admin_municipal","fiscal","operador","conductor","ciudadano"] },

  { href: "/usuarios",        label: "Usuarios",            icon: Users,          section: "GESTIÓN",    roles: ["super_admin","admin_provincial","admin_municipal"] },
  { href: "/admin/users",     label: "Aprobaciones",        icon: UserCheck,      section: "GESTIÓN",    roles: ["super_admin","admin_provincial","admin_municipal"] },

  { href: "/provincias",      label: "Provincias",          icon: MapPin,         section: "TERRITORIO", roles: ["super_admin"] },
  { href: "/municipalidades", label: "Municipalidades",     icon: Building2,      section: "TERRITORIO", roles: ["super_admin","admin_provincial"] },

  { href: "/tipos-vehiculo",  label: "Tipos de vehículo",   icon: Truck,          section: "OPERACIÓN",  roles: ["admin_municipal"] },
  { href: "/empresas",        label: "Empresas",            icon: Building2,      section: "OPERACIÓN",  roles: ["admin_municipal"] },
  { href: "/conductores",     label: "Conductores",         icon: Users,          section: "OPERACIÓN",  roles: ["admin_municipal","operador","fiscal"] },
  { href: "/vehiculos",       label: "Vehículos / QR",      icon: Car,            section: "OPERACIÓN",  roles: ["admin_municipal","operador","fiscal"] },
  { href: "/flota",           label: "Flota del día",       icon: ClipboardList,  section: "OPERACIÓN",  roles: ["operador"] },
  { href: "/rutas",           label: "Rutas y zonas",       icon: Route,          section: "OPERACIÓN",  roles: ["admin_municipal","operador","fiscal"] },
  { href: "/viajes",          label: "Viajes",              icon: CalendarDays,   section: "OPERACIÓN",  roles: ["admin_municipal","operador","fiscal"] },
  { href: "/inspecciones",    label: "Inspecciones",        icon: Shield,              section: "OPERACIÓN",  roles: ["admin_municipal","fiscal"] },
  { href: "/apelaciones",     label: "Apelaciones",         icon: MessageSquareWarning, section: "OPERACIÓN",  roles: ["fiscal","admin_municipal","admin_provincial","super_admin"] },

  { href: "/reportes",        label: "Reportes ciudadanos", icon: Flag,           section: "CIUDADANÍA", roles: ["admin_municipal","fiscal"] },
  { href: "/sanciones",       label: "Sanciones",           icon: TriangleAlert,  section: "CIUDADANÍA", roles: ["admin_municipal","fiscal"] },

  { href: "/estadisticas",    label: "Estadísticas",        icon: ChartColumn,    section: "ANÁLISIS",   roles: ["super_admin","admin_provincial","admin_municipal","operador"] },
  { href: "/auditoria",       label: "Auditoría",           icon: FileText,       section: "ANÁLISIS",   roles: ["super_admin","admin_provincial","admin_municipal"] },
];

const SECTION_ORDER: NavSection[] = [
  "PANEL",
  "GESTIÓN",
  "TERRITORIO",
  "OPERACIÓN",
  "CIUDADANÍA",
  "ANÁLISIS",
];

const ROLE_LABELS: Record<string, string> = {
  super_admin:       "Super Admin",
  admin_provincial:  "Admin Provincial",
  admin_municipal:   "Admin Municipal",
  fiscal:            "Fiscal / Inspector",
  operador:          "Operador",
  conductor:         "Conductor",
  ciudadano:         "Ciudadano",
};

function titleFromPath(path: string | null): string {
  if (!path) return "";
  const seg = path.split("/").filter(Boolean)[0];
  if (!seg) return "";
  const map: Record<string, string> = {
    dashboard: "Dashboard",
    admin: "Administración",
    usuarios: "Usuarios",
    provincias: "Provincias",
    municipalidades: "Municipalidades",
    "tipos-vehiculo": "Tipos de vehículo",
    empresas: "Empresas",
    conductores: "Conductores",
    vehiculos: "Vehículos",
    flota: "Flota del día",
    rutas: "Rutas y zonas",
    viajes: "Viajes",
    inspecciones: "Inspecciones",
    apelaciones: "Apelaciones",
    reportes: "Reportes ciudadanos",
    sanciones: "Sanciones",
    estadisticas: "Estadísticas",
    auditoria: "Auditoría",
    notificaciones: "Notificaciones",
  };
  return map[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
}

// ── Store sincronizado con localStorage para leer `sfit_user` sin setState en efecto.
function subscribeUser(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === "sfit_user" || e.key === null) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

let __lastRawUser: string | null = null;
let __lastParsedUser: StoredUser | null = null;

function getClientUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("sfit_user");
  if (raw === __lastRawUser) return __lastParsedUser;
  __lastRawUser = raw;
  try {
    __lastParsedUser = raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    __lastParsedUser = null;
  }
  return __lastParsedUser;
}

function getServerUser(): StoredUser | null {
  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useSyncExternalStore(subscribeUser, getClientUser, getServerUser);

  // Redirecciones si falta el user o si el status no es activo.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("sfit_user");
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as StoredUser;
      if (parsed.status && parsed.status !== "activo") {
        router.replace(parsed.status === "rechazado" ? "/rejected" : "/pending");
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  function logout() {
    localStorage.clear();
    document.cookie = "sfit_access_token=; path=/; max-age=0";
    router.replace("/login");
  }

  const visible = useMemo(
    () => (user ? NAV.filter((n) => n.roles.includes(user.role)) : []),
    [user]
  );

  const groupedBySection = useMemo(() => {
    const acc = new Map<NavSection, NavItem[]>();
    for (const item of visible) {
      const bucket = acc.get(item.section) ?? [];
      bucket.push(item);
      acc.set(item.section, bucket);
    }
    return acc;
  }, [visible]);

  const crumb = titleFromPath(pathname);

  if (!user) return null;

  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  return (
    <div className="flex h-screen" style={{ background: "#F4F4F5" }}>
      {/* ── Sidebar ── */}
      <aside
        className="w-64 shrink-0 flex flex-col"
        style={{ background: "#0A1628" }}
      >
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <img src="/logo-horizontal.svg" alt="SFIT Admin" className="w-[180px] h-auto object-contain" />
        </div>

        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {SECTION_ORDER.map((section) => {
            const items = groupedBySection.get(section);
            if (!items || items.length === 0) return null;
            return (
              <div key={section}>
                <div className="kicker-sidebar">{section}</div>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <SidebarLink
                      key={item.href}
                      item={item}
                      active={
                        pathname === item.href ||
                        (pathname?.startsWith(item.href + "/") ?? false)
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div
          className="px-3 py-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="flex items-center gap-3 px-2 py-2 rounded-lg"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: "rgba(184,134,11,0.22)",
                color: "#D4A827",
                fontSize: "0.875rem",
                fontWeight: 700,
                fontFamily: "var(--font-inter)",
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="truncate"
                style={{
                  color: "#ffffff",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                }}
              >
                {user.name}
              </div>
              <div
                className="truncate"
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: "0.6875rem",
                }}
              >
                {roleLabel}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2 mt-2 w-full rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2"
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#ffffff";
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.55)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "currentColor",
              }}
            >
              <LogOut size={14} strokeWidth={1.8} />
            </span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* ── Topbar: breadcrumb + bell + profile ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "12px 28px",
            background: "#ffffff",
            borderBottom: "1px solid #e4e4e7",
            minHeight: 60,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-inter), Inter, sans-serif",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "#52525b",
            }}
          >
            <span
              style={{
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#a1a1aa",
                fontSize: "0.6875rem",
                fontWeight: 700,
              }}
            >
              SFIT
            </span>
            <span style={{ color: "#d4d4d8" }}>/</span>
            <span style={{ color: "#09090b" }}>{crumb}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <NotificationsBell />
            <div
              role="button"
              tabIndex={0}
              aria-label="Perfil de usuario"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px 6px 6px",
                borderRadius: 999,
                border: "1px solid #e4e4e7",
                background: "#ffffff",
                cursor: "pointer",
                transition: "background 150ms ease, border-color 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fafafa";
                e.currentTarget.style.borderColor = "#d4d4d8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.borderColor = "#e4e4e7";
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#FDF8EC",
                  color: "#926A09",
                  border: "1px solid #E8D090",
                  fontFamily: "var(--font-inter)",
                  fontWeight: 800,
                  fontSize: "0.75rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#09090b",
                  maxWidth: 140,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.name.split(" ")[0]}
              </span>
              <ChevronDown size={14} strokeWidth={2} color="#71717a" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

function SidebarLink({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  const { icon: Icon } = item;
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-2.5 pl-3 pr-3 py-2 rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A827]"
      style={{
        background: active ? "rgba(184,134,11,0.12)" : "transparent",
        color: active ? "#D4A827" : "rgba(255,255,255,0.6)",
        fontSize: "0.8125rem",
        fontWeight: 500,
        borderLeft: active ? "2px solid #D4A827" : "2px solid transparent",
        fontFamily: "var(--font-inter), Inter, sans-serif",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: active ? "rgba(184,134,11,0.2)" : "transparent",
          color: "currentColor",
          flexShrink: 0,
        }}
      >
        <Icon size={16} strokeWidth={1.8} />
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}


