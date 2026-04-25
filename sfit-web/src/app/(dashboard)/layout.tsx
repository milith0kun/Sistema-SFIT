"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  House, UserCheck, Users, MapPin, Building2, Car, ClipboardList,
  Route, Shield, Flag, TriangleAlert, ChartColumn, LogOut, Bell,
  ChevronDown, CalendarDays, MessageSquareWarning, Gift, Settings, Menu, X,
} from "lucide-react";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { useUnreadCount } from "@/hooks/useUnreadCount";

type StoredUser = { id: string; name: string; email: string; role: string; image?: string; status?: string };
type NavSection = "PANEL" | "GESTIÓN" | "TERRITORIO" | "OPERACIÓN" | "CIUDADANÍA" | "ANÁLISIS" | "ADMINISTRACIÓN";
type NavItem = { href: string; label: string; icon: LucideIcon; roles: string[]; section: NavSection };

const NAV: NavItem[] = [
  // PANEL — todos los roles con acceso web
  { href: "/dashboard",       label: "Dashboard",           icon: House,                 section: "PANEL",          roles: ["super_admin","admin_provincial","admin_municipal","fiscal","operador"] },
  { href: "/notificaciones",  label: "Notificaciones",      icon: Bell,                  section: "PANEL",          roles: ["super_admin","admin_provincial","admin_municipal","fiscal","operador"] },
  // GESTIÓN — administración de cuentas
  { href: "/usuarios",        label: "Usuarios",            icon: Users,                 section: "GESTIÓN",        roles: ["super_admin","admin_provincial","admin_municipal"] },
  { href: "/admin/users",     label: "Aprobaciones",        icon: UserCheck,             section: "GESTIÓN",        roles: ["super_admin","admin_provincial","admin_municipal"] },

  // TERRITORIO — solo admins de jerarquía alta
  { href: "/provincias",      label: "Provincias",          icon: MapPin,                section: "TERRITORIO",     roles: ["super_admin"] },
  { href: "/municipalidades", label: "Municipalidades",     icon: Building2,             section: "TERRITORIO",     roles: ["super_admin","admin_provincial"] },

  // OPERACIÓN — gestión de la flota municipal
  { href: "/empresas",        label: "Empresas",            icon: Building2,             section: "OPERACIÓN",      roles: ["admin_municipal"] },
  { href: "/conductores",     label: "Conductores",         icon: Users,                 section: "OPERACIÓN",      roles: ["admin_municipal","operador","fiscal"] },
  { href: "/vehiculos",       label: "Vehículos / QR",      icon: Car,                   section: "OPERACIÓN",      roles: ["admin_municipal","operador","fiscal"] },
  { href: "/flota",           label: "Flota del día",       icon: ClipboardList,         section: "OPERACIÓN",      roles: ["operador"] },
  { href: "/rutas",           label: "Rutas y zonas",       icon: Route,                 section: "OPERACIÓN",      roles: ["admin_municipal","operador","fiscal"] },
  { href: "/viajes",          label: "Viajes",              icon: CalendarDays,          section: "OPERACIÓN",      roles: ["admin_municipal","operador","fiscal"] },
  { href: "/inspecciones",    label: "Inspecciones",        icon: Shield,                section: "OPERACIÓN",      roles: ["admin_municipal","fiscal"] },
  { href: "/apelaciones",     label: "Apelaciones",         icon: MessageSquareWarning,  section: "OPERACIÓN",      roles: ["admin_municipal","fiscal"] },

  // CIUDADANÍA — reportes y recompensas
  { href: "/reportes",        label: "Reportes ciudadanos", icon: Flag,                  section: "CIUDADANÍA",     roles: ["admin_municipal","fiscal"] },
  { href: "/sanciones",       label: "Sanciones",           icon: TriangleAlert,         section: "CIUDADANÍA",     roles: ["admin_municipal","fiscal"] },
  { href: "/recompensas",     label: "Recompensas",         icon: Gift,                  section: "CIUDADANÍA",     roles: ["super_admin","admin_municipal"] },

  // ANÁLISIS — estadísticas e inteligencia
  { href: "/estadisticas",    label: "Estadísticas",        icon: ChartColumn,           section: "ANÁLISIS",       roles: ["super_admin","admin_provincial","admin_municipal"] },

  // ADMINISTRACIÓN — auditoría
  { href: "/auditoria",       label: "Auditoría",           icon: Shield,                section: "ADMINISTRACIÓN", roles: ["super_admin","admin_provincial","admin_municipal"] },
];

const SECTION_ORDER: NavSection[] = ["PANEL","GESTIÓN","TERRITORIO","OPERACIÓN","CIUDADANÍA","ANÁLISIS","ADMINISTRACIÓN"];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", admin_provincial: "Admin Provincial",
  admin_municipal: "Admin Municipal", fiscal: "Fiscal / Inspector",
  operador: "Operador", conductor: "Conductor", ciudadano: "Ciudadano",
};

const SEG_LABELS: Record<string, string> = {
  dashboard: "Dashboard", admin: "Administración", usuarios: "Usuarios",
  provincias: "Provincias", municipalidades: "Municipalidades",
  "tipos-vehiculo": "Tipos de vehículo", empresas: "Empresas", conductores: "Conductores",
  vehiculos: "Vehículos", flota: "Flota del día", rutas: "Rutas y zonas", viajes: "Viajes",
  inspecciones: "Inspecciones", apelaciones: "Apelaciones", reportes: "Reportes ciudadanos",
  sanciones: "Sanciones", estadisticas: "Estadísticas", auditoria: "Auditoría",
  notificaciones: "Notificaciones", recompensas: "Recompensas",
  perfil: "Mi perfil", users: "Aprobaciones",
};

function prettySegment(seg: string): string {
  if (SEG_LABELS[seg]) return SEG_LABELS[seg];
  // IDs/UUIDs/números → no embellecer
  if (/^[0-9a-f]{8,}$/i.test(seg) || /^\d+$/.test(seg)) return seg;
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

function subscribeUser(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => { if (e.key === "sfit_user" || e.key === null) onChange(); };
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
  try { __lastParsedUser = raw ? (JSON.parse(raw) as StoredUser) : null; } catch { __lastParsedUser = null; }
  return __lastParsedUser;
}
function getServerUser(): StoredUser | null { return null; }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useSyncExternalStore(subscribeUser, getClientUser, getServerUser);
  const unread = useUnreadCount();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-close sidebar on navigation
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Lock body scroll when mobile sidebar open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    try {
      const parsed = JSON.parse(raw) as StoredUser;
      if (parsed.status && parsed.status !== "activo") {
        router.replace(parsed.status === "rechazado" ? "/rejected" : "/pending");
      }
    } catch { router.replace("/login"); }
  }, [router]);

  function logout() {
    localStorage.clear();
    document.cookie = "sfit_access_token=; path=/; max-age=0";
    router.replace("/login");
  }

  const visible = useMemo(() => (user ? NAV.filter(n => n.roles.includes(user.role)) : []), [user]);
  const groupedBySection = useMemo(() => {
    const acc = new Map<NavSection, NavItem[]>();
    for (const item of visible) { const b = acc.get(item.section) ?? []; b.push(item); acc.set(item.section, b); }
    return acc;
  }, [visible]);

  if (!user) return null;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img src="/logo-horizontal.svg" alt="SFIT" style={{ width: 140, height: "auto", objectFit: "contain" }} />
        {/* Close button — only on mobile */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="sfit-hamburger"
          style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          aria-label="Cerrar menú"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Nav */}
      <nav className="sfit-sidebar-nav" style={{ flex: 1, padding: "10px 10px 14px", overflowY: "auto", minHeight: 0 }}>
        {SECTION_ORDER.map(section => {
          const items = groupedBySection.get(section);
          if (!items?.length) return null;
          return (
            <div key={section} style={{ marginBottom: 4 }}>
              <div className="kicker-sidebar">{section}</div>
              <div>
                {items.map(item => (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    active={pathname === item.href || (pathname?.startsWith(item.href + "/") ?? false)}
                    badge={item.href === "/notificaciones" ? unread : 0}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User + Logout + Versión */}
      <div style={{ padding: "10px 10px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Tarjeta de usuario — más jerárquica */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "10px 11px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(184,134,11,0.22)",
              color: "#D4A827",
              fontSize: "0.875rem", fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              fontFamily: "var(--font-inter)",
              border: "1.5px solid rgba(212,168,39,0.30)",
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                color: "#fff",
                fontSize: "0.8125rem",
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1.25,
              }}
            >
              {user.name}
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.50)",
                fontSize: "0.6875rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginTop: 2,
                fontWeight: 500,
              }}
              title={user.email}
            >
              {user.email}
            </div>
          </div>
        </div>

        {/* Pill de rol — debajo de la tarjeta */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", marginBottom: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 9px",
              borderRadius: 999,
              background: "rgba(184,134,11,0.14)",
              color: "#F0C75A",
              border: "1px solid rgba(212,168,39,0.28)",
              fontSize: "0.625rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#D4A827" }} />
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </div>

        {/* Logout — limpio, sin chip de fondo */}
        <button
          onClick={logout}
          className="sfit-sidebar-logout"
          aria-label="Cerrar sesión"
        >
          <LogOut size={15} strokeWidth={1.85} style={{ flexShrink: 0 }} />
          Cerrar sesión
        </button>

        {/* Versión SFIT — pie sutil */}
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.05)",
            textAlign: "center",
            fontSize: "0.625rem",
            color: "rgba(255,255,255,0.30)",
            fontWeight: 500,
            letterSpacing: "0.08em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          SFIT · v1.0.0
        </div>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", height: "100svh", background: "#F4F4F5", overflow: "hidden" }}>

      {/* ── CSS for responsive sidebar ── */}
      <style>{`
        .sfit-sidebar {
          /* Mobile: pegado al borde, slide-in completo, sin redondeo */
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 282px; z-index: 50;
          transform: translateX(-100%);
          transition: transform 280ms cubic-bezier(0.4,0,0.2,1);
          flex-direction: column;
          background: #0A1628;
        }
        .sfit-sidebar.open { transform: translateX(0); }
        @media (min-width: 1024px) {
          .sfit-sidebar {
            /* Desktop: tarjeta flotante con margen, redondeo y elevación */
            position: sticky !important; top: 12px !important;
            margin: 12px !important;
            height: calc(100svh - 24px) !important;
            transform: translateX(0) !important;
            display: flex !important; flex-shrink: 0;
            border-radius: 18px;
            overflow: hidden;
            border: 1px solid rgba(212, 168, 39, 0.14);
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.04),
              0 4px 12px rgba(9, 22, 40, 0.10),
              0 14px 32px rgba(9, 22, 40, 0.10);
          }
          .sfit-sidebar-backdrop { display: none !important; }
          .sfit-hamburger { display: none !important; }
        }

        /* ── Main shell — tarjeta flotante (mismo lenguaje del sidebar) ── */
        .sfit-main-shell {
          /* Mobile: pegado al borde, sin redondeo */
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
          position: relative;
          background: #FAFAFA;
        }
        @media (min-width: 1024px) {
          .sfit-main-shell {
            margin: 12px 12px 12px 0;
            border-radius: 18px;
            border: 1px solid #e4e4e7;
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.6),
              0 4px 12px rgba(9, 22, 40, 0.05),
              0 14px 32px rgba(9, 22, 40, 0.06);
            height: calc(100svh - 24px);
          }
        }

        /* ── Content scroll — mismo lenguaje que el sidebar nav, en gris cálido ── */
        .sfit-content-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(184, 134, 11, 0.22) transparent;
          scrollbar-gutter: stable;
          scroll-behavior: smooth;
        }
        .sfit-content-scroll::-webkit-scrollbar { width: 8px; }
        .sfit-content-scroll::-webkit-scrollbar-track { background: transparent; }
        .sfit-content-scroll::-webkit-scrollbar-thumb {
          background: rgba(184, 134, 11, 0.22);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
          transition: background-color 160ms ease;
        }
        .sfit-content-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(184, 134, 11, 0.42);
          background-clip: padding-box;
        }

        /* ── Sidebar nav scroll — sutil, dorado tenue ── */
        .sfit-sidebar-nav {
          scrollbar-width: thin;
          scrollbar-color: rgba(212, 168, 39, 0.18) transparent;
          scrollbar-gutter: stable;
        }
        .sfit-sidebar-nav::-webkit-scrollbar { width: 6px; }
        .sfit-sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .sfit-sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(212, 168, 39, 0.18);
          border-radius: 999px;
          transition: background 160ms ease;
        }
        .sfit-sidebar-nav::-webkit-scrollbar-thumb:hover {
          background: rgba(212, 168, 39, 0.38);
        }
        /* Sombras superior/inferior cuando hay overflow — pista visual del scroll */
        .sfit-sidebar-nav {
          background:
            linear-gradient(#0A1628 30%, transparent),
            linear-gradient(transparent, #0A1628 70%) bottom,
            radial-gradient(farthest-side at 50% 0, rgba(212, 168, 39, 0.10), transparent),
            radial-gradient(farthest-side at 50% 100%, rgba(212, 168, 39, 0.10), transparent) bottom;
          background-repeat: no-repeat;
          background-size: 100% 16px, 100% 16px, 100% 6px, 100% 6px;
          background-attachment: local, local, scroll, scroll;
        }
        .hidden-mobile { display: flex; }
        @media (max-width: 640px) {
          .hidden-mobile { display: none !important; }
        }

        /* ── Breadcrumb del topbar ── */
        .sfit-breadcrumb-mobile { display: none; }
        @media (max-width: 640px) {
          .sfit-breadcrumb-mobile { display: inline-block; }
        }

        .sfit-crumb-root {
          font-family: var(--font-syne, var(--font-inter, system-ui));
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #71717a;
          text-decoration: none;
          padding: 4px 6px;
          border-radius: 6px;
          transition: color 140ms ease, background 140ms ease;
          flex-shrink: 0;
        }
        .sfit-crumb-root:hover { color: #09090b; background: #f4f4f5; }
        .sfit-crumb-root:focus-visible {
          outline: 2px solid #B8860B; outline-offset: 2px;
        }

        .sfit-crumb-sep {
          color: #d4d4d8;
          font-weight: 400;
          font-size: 0.875rem;
          user-select: none;
          flex-shrink: 0;
        }

        .sfit-crumb-link {
          font-size: 0.875rem;
          font-weight: 500;
          color: #71717a;
          text-decoration: none;
          padding: 4px 8px;
          border-radius: 6px;
          transition: color 140ms ease, background 140ms ease;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 200px;
        }
        .sfit-crumb-link:hover { color: #09090b; background: #f4f4f5; }
        .sfit-crumb-link:focus-visible {
          outline: 2px solid #B8860B; outline-offset: 2px;
        }

        .sfit-crumb-mute {
          font-size: 0.875rem;
          font-weight: 500;
          color: #a1a1aa;
          padding: 4px 8px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 200px;
        }

        .sfit-crumb-current {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #09090b;
          padding: 4px 8px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 280px;
        }

        /* ── Sidebar nav links — pill style (estructura sin border-left) ── */
        .sfit-sidebar-link:hover:not([data-active]) {
          background: rgba(255, 255, 255, 0.05) !important;
          color: rgba(255, 255, 255, 0.92) !important;
        }
        .sfit-sidebar-link:focus-visible {
          outline: 2px solid #D4A827;
          outline-offset: -2px;
        }

        /* ── Sidebar logout button ── */
        .sfit-sidebar-logout {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 9px 12px;
          border-radius: 8px;
          width: 100%;
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.55);
          font-family: inherit;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 120ms ease, color 120ms ease;
          text-align: left;
        }
        .sfit-sidebar-logout:hover {
          background: rgba(239, 68, 68, 0.10);
          color: #FCA5A5;
        }
        .sfit-sidebar-logout:focus-visible {
          outline: 2px solid #FCA5A5;
          outline-offset: -2px;
        }
      `}</style>

      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="sfit-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(9,9,11,0.55)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
          aria-hidden
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sfit-sidebar${sidebarOpen ? " open" : ""}`}>
        {sidebarContent}
      </aside>

      {/* ── Main — shell flotante, mismo lenguaje del sidebar ── */}
      <main className="sfit-main-shell">
        {/* Topbar */}
        <Topbar
          user={user}
          pathname={pathname}
          onOpenSidebar={() => setSidebarOpen(true)}
          onLogout={logout}
        />

        <div className="sfit-content-scroll" style={{ flex: 1, overflowY: "auto", padding: "20px 24px 28px", maxWidth: "100%", background: "#FAFAFA" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ─── Topbar ─────────────────────────────────────────────────────────────── */
const NAV_ITEM_MAP = new Map(NAV.map(n => [n.href, n]));

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const ROLE_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  super_admin:      { bg: "#FDF8EC", color: "#926A09", border: "#E8D090" },
  admin_provincial: { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  admin_municipal:  { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  fiscal:           { bg: "#F0FDF4", color: "#15803d", border: "#86EFAC" },
  operador:         { bg: "#F4F4F5", color: "#52525b", border: "#E4E4E7" },
  conductor:        { bg: "#F4F4F5", color: "#52525b", border: "#E4E4E7" },
  ciudadano:        { bg: "#F4F4F5", color: "#52525b", border: "#E4E4E7" },
};

type Crumb = { label: string; href: string; isLink: boolean };

function buildCrumbs(pathname: string | null): Crumb[] {
  if (!pathname) return [];
  const parts = pathname.split("/").filter(Boolean);
  if (!parts.length) return [];
  const crumbs: Crumb[] = [];
  let acc = "";
  parts.forEach((part, idx) => {
    acc += `/${part}`;
    const navItem = NAV_ITEM_MAP.get(acc);
    const label = navItem?.label ?? prettySegment(part);
    const isLast = idx === parts.length - 1;
    // Sólo intermedios y reales (con label conocido o página de NAV) son navegables.
    const isLink = !isLast && (Boolean(navItem) || Boolean(SEG_LABELS[part]));
    crumbs.push({ label, href: acc, isLink });
  });
  return crumbs;
}

function Topbar({
  user, pathname, onOpenSidebar, onLogout,
}: {
  user: StoredUser; pathname: string | null;
  onOpenSidebar: () => void; onLogout: () => void;
}) {
  const now = useNow();
  const [open, setOpen] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Cerrar dropdown en navegación
  useEffect(() => { setOpen(false); }, [pathname]);

  const crumbs   = useMemo(() => buildCrumbs(pathname), [pathname]);
  const lastCrumb = crumbs[crumbs.length - 1]?.label ?? "Dashboard";

  const dateStr  = now.toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" });
  const timeStr  = now.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

  const initials = user.name.split(" ").map((w: string) => w[0] ?? "").slice(0, 2).join("").toUpperCase() || "?";
  const badge    = ROLE_BADGE[user.role] ?? ROLE_BADGE.ciudadano;

  // Estilos del dropdown item
  const dropItem: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 12px", borderRadius: 8, width: "100%",
    border: "none", background: "transparent", cursor: "pointer",
    fontSize: "0.875rem", fontWeight: 500, color: "#3f3f46",
    textDecoration: "none", transition: "background 120ms", textAlign: "left",
    fontFamily: "inherit",
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12, padding: "0 22px",
      background: "#fff", borderBottom: "1px solid #f0f0f1",
      minHeight: 62, flexShrink: 0,
    }}>

      {/* ── Left ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {/* Hamburger */}
        <button
          className="sfit-hamburger"
          onClick={onOpenSidebar}
          style={{
            width: 36, height: 36, borderRadius: 9, border: "1.5px solid #e4e4e7",
            background: "#fff", color: "#52525b", display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
          }}
          aria-label="Abrir menú"
        >
          <Menu size={17} strokeWidth={2} />
        </button>

        <div style={{ width: 1, height: 26, background: "#e4e4e7", flexShrink: 0 }} className="hidden-mobile" />

        {/* Breadcrumb navegable — desktop */}
        <nav
          aria-label="Migas de pan"
          className="sfit-breadcrumb hidden-mobile"
          style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, lineHeight: 1 }}
        >
          <Link href="/dashboard" className="sfit-crumb-root" aria-label="Inicio SFIT">
            SFIT
          </Link>
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={c.href} style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span className="sfit-crumb-sep" aria-hidden>/</span>
                {isLast ? (
                  <span className="sfit-crumb-current" aria-current="page" title={c.label}>
                    {c.label}
                  </span>
                ) : c.isLink ? (
                  <Link href={c.href} className="sfit-crumb-link" title={c.label}>
                    {c.label}
                  </Link>
                ) : (
                  <span className="sfit-crumb-mute" title={c.label}>{c.label}</span>
                )}
              </span>
            );
          })}
        </nav>

        {/* Página actual — mobile (sin navegación intermedia) */}
        <span
          className="sfit-breadcrumb-mobile"
          aria-current="page"
          style={{
            fontSize: "0.9375rem", fontWeight: 700, color: "#09090b",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
          }}
        >
          {lastCrumb}
        </span>
      </div>

      {/* ── Right ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

        {/* Date/time */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 11px", borderRadius: 9, background: "#f4f4f5", border: "1.5px solid #e4e4e7",
        }} className="hidden-mobile">
          <CalendarDays size={12} color="#71717a" strokeWidth={2} />
          <span style={{ fontSize: "0.8125rem", color: "#52525b", fontWeight: 600, textTransform: "capitalize" }}>{dateStr}</span>
          <span style={{ width: 1, height: 13, background: "#d4d4d8" }} />
          <span style={{ fontSize: "0.8125rem", color: "#71717a", fontVariantNumeric: "tabular-nums" }}>{timeStr}</span>
        </div>

        <NotificationsBell />

        <div style={{ width: 1, height: 26, background: "#e4e4e7" }} />

        {/* ── User pill + dropdown ── */}
        <div ref={pillRef} style={{ position: "relative" }}>
          <div
            role="button"
            tabIndex={0}
            aria-label="Perfil de usuario"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() => setOpen(o => !o)}
            onKeyDown={e => (e.key === "Enter" || e.key === " ") && setOpen(o => !o)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "4px 10px 4px 4px", borderRadius: 999,
              border: `1.5px solid ${open ? "#B8860B55" : "#e4e4e7"}`,
              background: open ? "#fffdf7" : "#fff",
              cursor: "pointer", transition: "all 150ms", outline: "none",
            }}
            onMouseEnter={e => { if (!open) { e.currentTarget.style.background = "#fafafa"; e.currentTarget.style.borderColor = "#B8860B44"; } }}
            onMouseLeave={e => { if (!open) { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#e4e4e7"; } }}
          >
            {/* Avatar */}
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt={user.name} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid #e4e4e7" }} />
            ) : (
              <span style={{
                width: 30, height: 30, borderRadius: "50%",
                background: badge.bg, color: badge.color, border: `1.5px solid ${badge.border}`,
                fontWeight: 800, fontSize: "0.75rem",
                display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {initials}
              </span>
            )}

            {/* Name + role */}
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }} className="hidden-mobile">
              <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#09090b", whiteSpace: "nowrap", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.name.split(" ")[0]}
              </span>
              <span style={{ fontSize: "0.6875rem", color: "#71717a", fontWeight: 500, whiteSpace: "nowrap" }}>
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </div>

            <ChevronDown
              size={13} strokeWidth={2.2} color="#a1a1aa"
              style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms", flexShrink: 0 }}
            />
          </div>

          {/* ── Dropdown panel ── */}
          {open && (
            <div
              role="menu"
              style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200,
                width: 256, background: "#fff", borderRadius: 14,
                border: "1.5px solid #e4e4e7",
                boxShadow: "0 10px 40px rgba(9,9,11,0.10), 0 2px 8px rgba(9,9,11,0.05)",
                overflow: "hidden",
              }}
            >
              {/* Header del perfil */}
              <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid #f4f4f5" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt={user.name} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid #e4e4e7" }} />
                  ) : (
                    <span style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: badge.bg, color: badge.color, border: `1.5px solid ${badge.border}`,
                      fontWeight: 800, fontSize: "1rem",
                      display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {initials}
                    </span>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#09090b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#71717a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                      {user.email}
                    </div>
                  </div>
                </div>
                {/* Role badge */}
                <div style={{ marginTop: 10 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 9px", borderRadius: 6,
                    background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                    fontSize: "0.6875rem", fontWeight: 700,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: badge.color }} />
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                </div>
              </div>

              {/* Acciones */}
              <div style={{ padding: "6px" }}>
                <Link
                  href="/perfil"
                  role="menuitem"
                  style={dropItem}
                  onMouseEnter={e => { e.currentTarget.style.background = "#f4f4f5"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ width: 28, height: 28, borderRadius: 7, background: "#f4f4f5", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Settings size={14} color="#52525b" />
                  </span>
                  Mi perfil
                </Link>

                <div style={{ height: 1, background: "#f4f4f5", margin: "4px 0" }} />

                <button
                  role="menuitem"
                  onClick={() => { setOpen(false); onLogout(); }}
                  style={{ ...dropItem, color: "#b91c1c" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#FFF5F5"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ width: 28, height: 28, borderRadius: 7, background: "#FFF5F5", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <LogOut size={14} color="#b91c1c" />
                  </span>
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ item, active, badge = 0 }: { item: NavItem; active: boolean; badge?: number }) {
  const { icon: Icon } = item;
  const showBadge = badge > 0;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className="sfit-sidebar-link"
      data-active={active || undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "8px 11px",
        borderRadius: 8,
        background: active ? "rgba(184,134,11,0.14)" : "transparent",
        color: active ? "#D4A827" : "rgba(255,255,255,0.65)",
        fontSize: "0.8125rem",
        fontWeight: active ? 600 : 500,
        textDecoration: "none",
        marginBottom: 2,
        transition: "background 120ms ease, color 120ms ease",
        position: "relative",
      }}
    >
      <Icon size={16} strokeWidth={active ? 2 : 1.75} style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
        {item.label}
      </span>
      {showBadge && (
        <span
          aria-label={`${badge} sin leer`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 20,
            height: 18,
            padding: "0 6px",
            borderRadius: 999,
            background: active ? "rgba(212,168,39,0.22)" : "rgba(255,255,255,0.10)",
            color: active ? "#F0C75A" : "rgba(255,255,255,0.85)",
            fontSize: "0.6875rem",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
