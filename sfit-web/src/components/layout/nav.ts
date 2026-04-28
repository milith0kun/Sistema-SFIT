import type { LucideIcon } from "lucide-react";
import {
  House, UserCheck, Users, MapPin, Building2, Car, ClipboardList,
  Route, Shield, Flag, TriangleAlert, ChartColumn, Bell,
  CalendarDays, MessageSquareWarning, Gift,
} from "lucide-react";

export type NavSection =
  | "PANEL"
  | "GESTIÓN"
  | "RED NACIONAL"
  | "OPERACIÓN"
  | "CIUDADANÍA"
  | "ANÁLISIS"
  | "MI CUENTA";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
  section: NavSection;
};

export const NAV: NavItem[] = [
  // PANEL — todos los roles con acceso web
  { href: "/dashboard",       label: "Dashboard",           icon: House,                 section: "PANEL",          roles: ["super_admin","admin_provincial","admin_municipal","fiscal","operador"] },
  { href: "/notificaciones",  label: "Notificaciones",      icon: Bell,                  section: "PANEL",          roles: ["super_admin","admin_provincial","admin_municipal","fiscal","operador"] },

  // GESTIÓN — administración de cuentas
  { href: "/usuarios",        label: "Usuarios",            icon: Users,                 section: "GESTIÓN",        roles: ["super_admin","admin_provincial","admin_municipal"] },
  { href: "/admin/users",     label: "Aprobaciones",        icon: UserCheck,             section: "GESTIÓN",        roles: ["super_admin","admin_provincial","admin_municipal"] },

  // RED NACIONAL — vista cross-tenant del super_admin
  { href: "/admin/red-nacional", label: "Red nacional",     icon: MapPin,                section: "RED NACIONAL",   roles: ["super_admin"] },
  { href: "/municipalidades", label: "Municipalidades",     icon: Building2,             section: "RED NACIONAL",   roles: ["super_admin","admin_provincial"] },
  { href: "/admin/empresas",  label: "Empresas nacionales", icon: Building2,             section: "RED NACIONAL",   roles: ["super_admin","admin_provincial"] },

  // OPERACIÓN — gestión de la flota municipal
  { href: "/empresas",        label: "Empresas",            icon: Building2,             section: "OPERACIÓN",      roles: ["super_admin","admin_provincial","admin_municipal"] },
  { href: "/conductores",     label: "Conductores",         icon: Users,                 section: "OPERACIÓN",      roles: ["super_admin","admin_provincial","admin_municipal","operador","fiscal"] },
  { href: "/vehiculos",       label: "Vehículos / QR",      icon: Car,                   section: "OPERACIÓN",      roles: ["super_admin","admin_provincial","admin_municipal","operador","fiscal"] },
  { href: "/flota",           label: "Flota del día",       icon: ClipboardList,         section: "OPERACIÓN",      roles: ["super_admin","admin_provincial","admin_municipal","operador"] },
  { href: "/rutas",           label: "Rutas y zonas",       icon: Route,                 section: "OPERACIÓN",      roles: ["super_admin","admin_provincial","admin_municipal","operador","fiscal"] },
  { href: "/viajes",          label: "Viajes",              icon: CalendarDays,          section: "OPERACIÓN",      roles: ["super_admin","admin_provincial","admin_municipal","operador","fiscal"] },
  { href: "/inspecciones",    label: "Inspecciones",        icon: Shield,                section: "OPERACIÓN",      roles: ["super_admin","admin_provincial","admin_municipal","fiscal"] },
  { href: "/apelaciones",     label: "Apelaciones",         icon: MessageSquareWarning,  section: "OPERACIÓN",      roles: ["super_admin","admin_provincial","admin_municipal"] },

  // CIUDADANÍA — reportes y recompensas
  { href: "/reportes",        label: "Reportes ciudadanos", icon: Flag,                  section: "CIUDADANÍA",     roles: ["super_admin","admin_provincial","admin_municipal","fiscal"] },
  { href: "/sanciones",       label: "Sanciones",           icon: TriangleAlert,         section: "CIUDADANÍA",     roles: ["super_admin","admin_provincial","admin_municipal","fiscal"] },
  { href: "/recompensas",     label: "Recompensas",         icon: Gift,                  section: "CIUDADANÍA",     roles: ["admin_municipal"] },

  // ANÁLISIS — estadísticas e inteligencia
  { href: "/estadisticas",    label: "Estadísticas",        icon: ChartColumn,           section: "ANÁLISIS",       roles: ["super_admin","admin_provincial","admin_municipal"] },

  // MI CUENTA — datos personales del usuario autenticado
  { href: "/perfil",          label: "Mi perfil",           icon: UserCheck,             section: "MI CUENTA",      roles: ["super_admin","admin_provincial","admin_municipal","fiscal","operador","conductor","ciudadano"] },
];

export const SECTION_ORDER: NavSection[] = [
  "PANEL", "GESTIÓN", "RED NACIONAL", "OPERACIÓN", "CIUDADANÍA", "ANÁLISIS", "MI CUENTA",
];

export const ROLE_LABELS: Record<string, string> = {
  super_admin:      "Super Administrador",
  admin_provincial: "Administrador Provincial",
  admin_municipal:  "Administrador Municipal",
  fiscal:           "Fiscal / Inspector",
  operador:         "Operador",
  conductor:        "Conductor",
  ciudadano:        "Ciudadano",
};

export const SEG_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  admin: "Administración",
  "red-nacional": "Red nacional",
  usuarios: "Usuarios",
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
  notificaciones: "Notificaciones",
  recompensas: "Recompensas",
  perfil: "Mi perfil",
  users: "Aprobaciones",
};

export type RoleBadgeStyle = { bg: string; color: string; border: string };

export const ROLE_BADGE: Record<string, RoleBadgeStyle> = {
  super_admin:      { bg: "#FBEAEA", color: "#4A0303", border: "#D9B0B0" },
  admin_provincial: { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  admin_municipal:  { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  fiscal:           { bg: "#F0FDF4", color: "#15803D", border: "#86EFAC" },
  operador:         { bg: "#F4F4F5", color: "#52525B", border: "#E4E4E7" },
  conductor:        { bg: "#F4F4F5", color: "#52525B", border: "#E4E4E7" },
  ciudadano:        { bg: "#F4F4F5", color: "#52525B", border: "#E4E4E7" },
};

/** Convierte un segmento de URL a una etiqueta legible. IDs/UUIDs se devuelven sin modificar. */
export function prettySegment(seg: string): string {
  if (SEG_LABELS[seg]) return SEG_LABELS[seg];
  if (/^[0-9a-f]{8,}$/i.test(seg) || /^\d+$/.test(seg)) return seg;
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

export type Crumb = { label: string; href: string; isLink: boolean };

const NAV_ITEM_MAP = new Map(NAV.map(n => [n.href, n]));

export function buildCrumbs(pathname: string | null): Crumb[] {
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
    const isLink = !isLast && (Boolean(navItem) || Boolean(SEG_LABELS[part]));
    crumbs.push({ label, href: acc, isLink });
  });
  return crumbs;
}
