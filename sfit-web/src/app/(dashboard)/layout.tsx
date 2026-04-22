"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  House, UserCheck, Users, MapPin, Building2, Car, ClipboardList,
  Route, Shield, Flag, TriangleAlert, ChartColumn, Bell, LogOut,
  ChevronDown, CalendarDays, MessageSquareWarning, Gift, Settings, Menu, X,
} from "lucide-react";
import { NotificationsBell } from "@/components/layout/NotificationsBell";

type StoredUser = { id: string; name: string; email: string; role: string; image?: string; status?: string };
type NavSection = "PANEL" | "GESTIÓN" | "TERRITORIO" | "OPERACIÓN" | "CIUDADANÍA" | "ANÁLISIS" | "ADMINISTRACIÓN";
type NavItem = { href: string; label: string; icon: LucideIcon; roles: string[]; section: NavSection };

const NAV: NavItem[] = [
  // PANEL — todos los roles con acceso web
  { href: "/dashboard",       label: "Dashboard",           icon: House,                 section: "PANEL",          roles: ["super_admin","admin_provincial","admin_municipal","fiscal","operador"] },
  { href: "/notificaciones",  label: "Notificaciones",      icon: Bell,                  section: "PANEL",          roles: ["super_admin","admin_provincial","admin_municipal","fiscal","operador","conductor","ciudadano"] },

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

  // ADMINISTRACIÓN — auditoría y configuración
  { href: "/auditoria",       label: "Auditoría",           icon: Shield,                section: "ADMINISTRACIÓN", roles: ["super_admin","admin_provincial","admin_municipal"] },
  { href: "/configuracion",   label: "Configuración",       icon: Settings,              section: "ADMINISTRACIÓN", roles: ["super_admin","admin_municipal"] },
];

const SECTION_ORDER: NavSection[] = ["PANEL","GESTIÓN","TERRITORIO","OPERACIÓN","CIUDADANÍA","ANÁLISIS","ADMINISTRACIÓN"];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", admin_provincial: "Admin Provincial",
  admin_municipal: "Admin Municipal", fiscal: "Fiscal / Inspector",
  operador: "Operador", conductor: "Conductor", ciudadano: "Ciudadano",
};

function titleFromPath(path: string | null): string {
  if (!path) return "";
  const seg = path.split("/").filter(Boolean)[0];
  if (!seg) return "";
  const map: Record<string, string> = {
    dashboard: "Dashboard", admin: "Administración", usuarios: "Usuarios",
    provincias: "Provincias", municipalidades: "Municipalidades",
    "tipos-vehiculo": "Tipos de vehículo", empresas: "Empresas", conductores: "Conductores",
    vehiculos: "Vehículos", flota: "Flota del día", rutas: "Rutas y zonas", viajes: "Viajes",
    inspecciones: "Inspecciones", apelaciones: "Apelaciones", reportes: "Reportes ciudadanos",
    sanciones: "Sanciones", estadisticas: "Estadísticas", auditoria: "Auditoría",
    configuracion: "Configuración", notificaciones: "Notificaciones", recompensas: "Recompensas",
  };
  return map[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
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

  const crumb = titleFromPath(pathname);
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
      <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
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
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div style={{ padding: "12px 12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.04)", marginBottom: 6 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(184,134,11,0.22)", color: "#D4A827", fontSize: "0.875rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "var(--font-inter)" }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: "#fff", fontSize: "0.8125rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.6875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ROLE_LABELS[user.role] ?? user.role}</div>
          </div>
        </div>
        <button
          onClick={logout}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, width: "100%", border: "none", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", transition: "all 150ms" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.background = "transparent"; }}
        >
          <span style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,0.05)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <LogOut size={13} strokeWidth={1.8} />
          </span>
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", height: "100svh", background: "#F4F4F5", overflow: "hidden" }}>

      {/* ── CSS for responsive sidebar ── */}
      <style>{`
        .sfit-sidebar {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 224px; z-index: 50;
          transform: translateX(-100%);
          transition: transform 280ms cubic-bezier(0.4,0,0.2,1);
          flex-direction: column; background: #0A1628;
        }
        .sfit-sidebar.open { transform: translateX(0); }
        @media (min-width: 1024px) {
          .sfit-sidebar {
            position: sticky !important; top: 0 !important;
            height: 100svh !important; transform: translateX(0) !important;
            display: flex !important; flex-shrink: 0;
          }
          .sfit-sidebar-backdrop { display: none !important; }
          .sfit-hamburger { display: none !important; }
        }
        .hidden-mobile { display: flex; }
        @media (max-width: 640px) {
          .hidden-mobile { display: none !important; }
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

      {/* ── Main ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, position: "relative" }}>
        {/* Topbar */}
        <Topbar
          user={user}
          crumb={crumb}
          pathname={pathname}
          onOpenSidebar={() => setSidebarOpen(true)}
          onLogout={logout}
        />

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px", maxWidth: "100%" }}>
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

const CONFIG_ROLES = new Set(["super_admin", "admin_municipal"]);

function Topbar({
  user, crumb, pathname, onOpenSidebar, onLogout,
}: {
  user: StoredUser; crumb: string; pathname: string | null;
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

  const seg      = pathname?.split("/").filter(Boolean)[0] ?? "";
  const navMatch = NAV_ITEM_MAP.get(`/${seg}`);
  const PageIcon = navMatch?.icon;

  const dateStr  = now.toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" });
  const timeStr  = now.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

  const initials = user.name.split(" ").map((w: string) => w[0] ?? "").slice(0, 2).join("").toUpperCase() || "?";
  const badge    = ROLE_BADGE[user.role] ?? ROLE_BADGE.ciudadano;
  const canConfig = CONFIG_ROLES.has(user.role);

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
      gap: 12, padding: "0 20px",
      background: "#fff", borderBottom: "1.5px solid #e4e4e7",
      minHeight: 60, flexShrink: 0,
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

        {/* Page context */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          {PageIcon && (
            <span style={{
              width: 32, height: 32, borderRadius: 8, background: "#F4F4F5",
              border: "1.5px solid #E4E4E7", display: "inline-flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <PageIcon size={15} color="#52525b" strokeWidth={1.9} />
            </span>
          )}
          <div style={{ minWidth: 0 }} className="hidden-mobile">
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a1a1aa" }}>
                SFIT
              </span>
              <span style={{ color: "#d4d4d8" }}>/</span>
              <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#09090b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {crumb || "Dashboard"}
              </span>
            </div>
          </div>
        </div>
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
                {canConfig && (
                  <Link
                    href="/configuracion"
                    role="menuitem"
                    style={dropItem}
                    onMouseEnter={e => { e.currentTarget.style.background = "#f4f4f5"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ width: 28, height: 28, borderRadius: 7, background: "#f4f4f5", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Settings size={14} color="#52525b" />
                    </span>
                    Configuración
                  </Link>
                )}

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

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const { icon: Icon } = item;
  return (
    <Link
      href={item.href}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8,
        background: active ? "rgba(184,134,11,0.12)" : "transparent",
        color: active ? "#D4A827" : "rgba(255,255,255,0.62)",
        fontSize: "0.8125rem", fontWeight: active ? 600 : 500,
        borderLeft: `2px solid ${active ? "#D4A827" : "transparent"}`,
        textDecoration: "none", marginBottom: 1, transition: "all 120ms",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ width: 28, height: 28, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", background: active ? "rgba(184,134,11,0.2)" : "transparent", color: "currentColor", flexShrink: 0 }}>
        <Icon size={15} strokeWidth={1.9} />
      </span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
    </Link>
  );
}
