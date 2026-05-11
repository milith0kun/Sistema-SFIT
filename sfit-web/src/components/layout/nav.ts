import type { LucideIcon } from "lucide-react";
import {
  House, UserCheck, Users, MapPin, Building2, Car, ClipboardList,
  Route, Shield, Flag, TriangleAlert, ChartColumn, Bell,
  CalendarDays, MessageSquareWarning, Gift, CircleUserRound,
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

// Navegación del sidebar web. Solo los 4 admins jerárquicos
// (super_admin → admin_regional → admin_provincial → admin_municipal)
// acceden a la web; fiscal, operador, conductor y ciudadano son redirigidos
// a MobileOnlyScreen por (dashboard)/layout.tsx.
export const NAV: NavItem[] = [
  // PANEL — todos los admins web
  { href: "/dashboard",       label: "Dashboard",           icon: House,                 section: "PANEL",          roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },
  { href: "/notificaciones",  label: "Notificaciones",      icon: Bell,                  section: "PANEL",          roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },

  // GESTIÓN — administración de cuentas
  { href: "/usuarios",        label: "Usuarios",            icon: Users,                 section: "GESTIÓN",        roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },
  { href: "/admin/users",     label: "Aprobaciones",        icon: UserCheck,             section: "GESTIÓN",        roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },

  // RED NACIONAL — jerarquía geográfica (regiones / provincias / municipalidades)
  { href: "/admin/red-nacional", label: "Red nacional",     icon: MapPin,                section: "RED NACIONAL",   roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },
  { href: "/admin/regiones",  label: "Regiones",            icon: MapPin,                section: "RED NACIONAL",   roles: ["super_admin","admin_regional"] },
  { href: "/municipalidades", label: "Municipalidades",     icon: Building2,             section: "RED NACIONAL",   roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },
  { href: "/admin/empresas",  label: "Empresas nacionales", icon: Building2,             section: "RED NACIONAL",   roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },

  // OPERACIÓN — gestión cross-empresa dentro del scope geográfico del admin
  { href: "/empresas",        label: "Empresas",            icon: Building2,             section: "OPERACIÓN",      roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },
  { href: "/conductores",     label: "Conductores",         icon: Users,                 section: "OPERACIÓN",      roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },
  { href: "/vehiculos",       label: "Vehículos / QR",      icon: Car,                   section: "OPERACIÓN",      roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },
  { href: "/flota",           label: "Flota del día",       icon: ClipboardList,         section: "OPERACIÓN",      roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },
  { href: "/rutas",           label: "Rutas y zonas",       icon: Route,                 section: "OPERACIÓN",      roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },
  { href: "/viajes",          label: "Viajes",              icon: CalendarDays,          section: "OPERACIÓN",      roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },
  // Inspecciones y apelaciones: read-only para los admins; emisión queda en
  // la app móvil del fiscal. Resolución de apelaciones se hace desde la web.
  { href: "/inspecciones",    label: "Inspecciones",        icon: Shield,                section: "OPERACIÓN",      roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },
  { href: "/apelaciones",     label: "Apelaciones",         icon: MessageSquareWarning,  section: "OPERACIÓN",      roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },

  // CIUDADANÍA — reportes ciudadanos, sanciones (read-only) y recompensas
  { href: "/reportes",        label: "Reportes ciudadanos", icon: Flag,                  section: "CIUDADANÍA",     roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },
  { href: "/sanciones",       label: "Sanciones",           icon: TriangleAlert,         section: "CIUDADANÍA",     roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },
  { href: "/recompensas",     label: "Recompensas",         icon: Gift,                  section: "CIUDADANÍA",     roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },

  // ANÁLISIS — estadísticas e inteligencia
  { href: "/estadisticas",    label: "Estadísticas",        icon: ChartColumn,           section: "ANÁLISIS",       roles: ["super_admin","admin_regional","admin_provincial","admin_municipal"] },

  // MI CUENTA — datos personales del usuario autenticado.
  // `/perfil` también es accesible para roles móviles (fiscal, operador,
  // conductor, ciudadano) como excepción en (dashboard)/layout.tsx, para
  // que puedan ajustar su perfil sin caer en MobileOnlyScreen.
  { href: "/perfil",          label: "Mi perfil",           icon: CircleUserRound,       section: "MI CUENTA",      roles: ["super_admin","admin_regional","admin_provincial","admin_municipal","fiscal","operador","conductor","ciudadano"] },
];

export const SECTION_ORDER: NavSection[] = [
  "PANEL", "GESTIÓN", "RED NACIONAL", "OPERACIÓN", "CIUDADANÍA", "ANÁLISIS", "MI CUENTA",
];

export const ROLE_LABELS: Record<string, string> = {
  super_admin:      "Super Administrador",
  admin_regional:   "Administrador Regional",
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
  regiones: "Regiones",
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
  "mi-empresa": "Mi empresa",
  users: "Aprobaciones",
};

export type RoleBadgeStyle = { bg: string; color: string; border: string };

export const ROLE_BADGE: Record<string, RoleBadgeStyle> = {
  super_admin:      { bg: "#FBEAEA", color: "#4A0303", border: "#D9B0B0" },
  admin_regional:   { bg: "#EEF2FF", color: "#3730A3", border: "#C7D2FE" },
  admin_provincial: { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  admin_municipal:  { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  fiscal:           { bg: "#F0FDF4", color: "#15803D", border: "#86EFAC" },
  operador:         { bg: "#F4F4F5", color: "#52525B", border: "#E4E4E7" },
  conductor:        { bg: "#F4F4F5", color: "#52525B", border: "#E4E4E7" },
  ciudadano:        { bg: "#F4F4F5", color: "#52525B", border: "#E4E4E7" },
};

/** Mapa de "padre del segmento detalle" → etiqueta legible cuando el segmento
 * actual es un ID/UUID. Se usa para que /usuarios/abc123... muestre
 * "Detalle de usuario" en lugar del UUID crudo. */
const PARENT_DETAIL_LABELS: Record<string, string> = {
  usuarios:           "Detalle de usuario",
  empresas:           "Detalle de empresa",
  municipalidades:    "Detalle de municipalidad",
  regiones:           "Detalle de región",
  conductores:        "Detalle de conductor",
  vehiculos:          "Detalle de vehículo",
  rutas:              "Detalle de ruta",
  inspecciones:       "Detalle de inspección",
  reportes:           "Detalle de reporte",
  apelaciones:        "Detalle de apelación",
  sanciones:          "Detalle de sanción",
  viajes:             "Detalle de viaje",
  notificaciones:     "Detalle de notificación",
  recompensas:        "Detalle de recompensa",
  flota:              "Detalle de flota",
  "tipos-vehiculo":   "Detalle de tipo",
  users:              "Detalle de aprobación",
};

function isIdSegment(seg: string): boolean {
  return /^[0-9a-f]{8,}$/i.test(seg) || /^\d+$/.test(seg);
}

/** Convierte un segmento de URL a una etiqueta legible.
 *  Para IDs sin contexto de padre devuelve "Detalle" como fallback. */
export function prettySegment(seg: string, parent?: string): string {
  if (SEG_LABELS[seg]) return SEG_LABELS[seg];
  if (isIdSegment(seg)) {
    if (parent && PARENT_DETAIL_LABELS[parent]) return PARENT_DETAIL_LABELS[parent];
    return "Detalle";
  }
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
    const parent = idx > 0 ? parts[idx - 1] : undefined;
    const label = navItem?.label ?? prettySegment(part, parent);
    const isLast = idx === parts.length - 1;
    const isLink = !isLast && (Boolean(navItem) || Boolean(SEG_LABELS[part]));
    crumbs.push({ label, href: acc, isLink });
  });
  return crumbs;
}
