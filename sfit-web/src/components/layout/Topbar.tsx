import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays, ChevronDown, LogOut, Menu, Settings,
  Wifi, Search, ArrowLeft,
} from "lucide-react";
import { NotificationsBell } from "@/components/layout/NotificationsBell";
import { buildCrumbs, ROLE_BADGE, ROLE_LABELS } from "./nav";
import type { StoredUser } from "./user-storage";
import { useBreadcrumbTitle } from "@/hooks/useBreadcrumbTitle";

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Hook que obtiene el nombre de la municipalidad del usuario logueado. */
function useMunicipalityName(): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("sfit_user");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.municipalityName) { setName(parsed.municipalityName); return; }
      if (parsed.provinceName) { setName(parsed.provinceName); return; }
    } catch { /* silent */ }
  }, []);
  return name;
}

export function Topbar({
  user,
  pathname,
  onOpenSidebar,
  onLogout,
}: {
  user: StoredUser;
  pathname: string | null;
  onOpenSidebar: () => void;
  onLogout: () => void;
}) {
  const router = useRouter();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const municipalityName = useMunicipalityName();

  // Detectar si la ruta actual es un "detalle" (subpágina con segmentos
  // adicionales o una ruta de creación/edición). En esos casos mostramos
  // un botón de back en mobile, sticky en el topbar, para que el usuario
  // pueda volver al listado sin tener que scrollear hasta el header del
  // form (donde está el botón "Volver" del PageHeader).
  const isDetailPage = useMemo(() => {
    if (!pathname) return false;
    const segs = pathname.split("/").filter(Boolean);
    if (segs.length < 2) return false;
    // Excluir rutas raíz que naturalmente tienen 2 segmentos (ej. /admin/users)
    const ROOT_TWO_SEG = new Set([
      "/admin/users",
      "/admin/red-nacional",
      "/admin/empresas",
      "/tipos-vehiculo",
      "/red-nacional",
    ]);
    if (ROOT_TWO_SEG.has(pathname)) return false;
    // Considera detalle: cualquier ruta con 2+ segmentos que no sea raíz
    return true;
  }, [pathname]);

  // Calcula la posición del dropdown relativa al viewport
  // Esto permite usar position: fixed y evitar que el overflow:hidden
  // de .sfit-main-shell recorte el dropdown o lo deje detrás del contenido.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!pillRef.current) return;
      const rect = pillRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  // Cerrar dropdown al hacer click fuera (incluye el dropdown ahora que está
  // fuera del DOM tree del pill por usar position: fixed).
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      const insidePill = pillRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insidePill && !insideDropdown) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Cerrar dropdown en navegación
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const baseCrumbs = useMemo(() => buildCrumbs(pathname), [pathname]);
  const dynamicTitle = useBreadcrumbTitle();
  // Si la página de detalle inyecta un nombre real, reemplaza el último crumb.
  const crumbs = useMemo(() => {
    if (!dynamicTitle || baseCrumbs.length === 0) return baseCrumbs;
    return baseCrumbs.map((c, i) =>
      i === baseCrumbs.length - 1 ? { ...c, label: dynamicTitle } : c
    );
  }, [baseCrumbs, dynamicTitle]);
  const lastCrumb = crumbs[crumbs.length - 1]?.label ?? "Dashboard";

  const dateStr = now.toLocaleDateString("es-PE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeStr = now.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const initials =
    user.name
      .split(" ")
      .map(w => w[0] ?? "")
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  const badge = ROLE_BADGE[user.role] ?? ROLE_BADGE.ciudadano;

  const dropItem: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 8,
    width: "100%",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#3F3F46",
    textDecoration: "none",
    transition: "background 120ms",
    textAlign: "left",
    fontFamily: "inherit",
  };

  // Contexto territorial del usuario
  const contextLabel = useMemo(() => {
    if (user.role === "super_admin") return "Plataforma Nacional";
    if (user.role === "admin_provincial") return municipalityName ?? "Provincia";
    if (user.role === "admin_municipal") return municipalityName ?? "Municipalidad";
    if (user.role === "fiscal") return municipalityName ?? "Jurisdicción";
    if (user.role === "operador") return municipalityName ?? "Empresa";
    return null;
  }, [user.role, municipalityName]);

  return (
    <div
      className="sfit-topbar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "0 20px",
        background: "#FFFFFF",
        borderBottom: "1px solid #F0F0F1",
        minHeight: 60,
        flexShrink: 0,
      }}
    >
      {/* ── Left ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
        {/* Botón "atrás" — sólo en mobile y sólo en páginas de detalle.
            Como el topbar es sticky, este botón siempre está visible aunque
            el usuario esté scrolleado adentro de un form largo, evitando
            tener que volver al inicio para encontrar el "Volver" del
            PageHeader. Click llama a router.back() (o al fallback). */}
        {isDetailPage && (
          <button
            className="sfit-topbar-back show-mobile-only"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.back();
              } else {
                router.push("/dashboard");
              }
            }}
            aria-label="Volver atrás"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "none",
              background: "#FFFFFF",
              color: "#0A1628",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              boxShadow: "inset 0 0 0 1.5px #E4E4E7",
              transition: "background 140ms, transform 100ms",
            }}
          >
            <ArrowLeft size={20} strokeWidth={2.2} />
          </button>
        )}

        <button
          className="sfit-hamburger"
          onClick={onOpenSidebar}
          aria-label="Abrir menú lateral"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            border: "none",
            background: "#0A1628",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            transition: "background 140ms, transform 100ms",
            boxShadow: "0 2px 6px rgba(9, 22, 40, 0.20)",
          }}
        >
          <Menu size={20} strokeWidth={2.2} />
        </button>

        <div
          style={{ width: 1, height: 24, background: "#E4E4E7", flexShrink: 0 }}
          className="hidden-mobile"
        />

        {/* Breadcrumb desktop */}
        <nav
          aria-label="Migas de pan"
          className="sfit-breadcrumb hidden-mobile"
          style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, lineHeight: 1 }}
        >
          <Link href="/dashboard" className="sfit-crumb-root" aria-label="Inicio SFIT">
            SFIT
          </Link>
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span
                key={c.href}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}
              >
                <span className="sfit-crumb-sep" aria-hidden>
                  /
                </span>
                {isLast ? (
                  <span className="sfit-crumb-current" aria-current="page" title={c.label}>
                    {c.label}
                  </span>
                ) : c.isLink ? (
                  <Link href={c.href} className="sfit-crumb-link" title={c.label}>
                    {c.label}
                  </Link>
                ) : (
                  <span className="sfit-crumb-mute" title={c.label}>
                    {c.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>

        {/* Página actual — móvil */}
        <span
          className="sfit-breadcrumb-mobile"
          aria-current="page"
          style={{
            fontSize: "0.9375rem",
            fontWeight: 700,
            color: "#09090B",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {lastCrumb}
        </span>
      </div>

      {/* ── Right ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {/* Contexto territorial */}
        {contextLabel && (
          <div
            className="hidden-mobile"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 7,
              background: "#FBEAEA",
              border: "1px solid #D9B0B0",
              maxWidth: 180,
            }}
          >
            <Wifi size={10} color="#6C0606" strokeWidth={2.5} />
            <span
              style={{
                fontSize: "0.6875rem",
                color: "#4A0303",
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {contextLabel}
            </span>
          </div>
        )}

        {/* Date/time */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 8,
            background: "#F4F4F5",
            border: "1px solid #E4E4E7",
          }}
          className="hidden-mobile"
        >
          <CalendarDays size={11} color="#71717A" strokeWidth={2} />
          <span
            style={{
              fontSize: "0.75rem",
              color: "#52525B",
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {dateStr}
          </span>
          <span style={{ width: 1, height: 12, background: "#D4D4D8" }} />
          <span
            style={{
              fontSize: "0.75rem",
              color: "#71717A",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {timeStr}
          </span>
        </div>

        {/* Búsqueda rápida */}
        <button
          className="sfit-search-btn hidden-mobile"
          aria-label="Buscar"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "1px solid #E4E4E7",
            background: "#fff",
            color: "#71717A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            transition: "border-color 140ms, color 140ms, background 140ms",
          }}
        >
          <Search size={14} strokeWidth={2} />
        </button>

        <NotificationsBell />

        <div style={{ width: 1, height: 24, background: "#E4E4E7" }} className="hidden-mobile" />

        {/* User pill + dropdown */}
        <div ref={pillRef} style={{ position: "relative" }}>
          <div
            role="button"
            tabIndex={0}
            aria-label="Perfil de usuario"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() => setOpen(o => !o)}
            onKeyDown={e => (e.key === "Enter" || e.key === " ") && setOpen(o => !o)}
            className="sfit-user-pill"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "3px 9px 3px 3px",
              borderRadius: 999,
              border: `1.5px solid ${open ? "#6C060655" : "#E4E4E7"}`,
              background: open ? "#FBEAEA" : "#FFFFFF",
              cursor: "pointer",
              transition: "all 150ms",
              outline: "none",
            }}
          >
            {/* Avatar */}
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                  border: "1.5px solid #E4E4E7",
                }}
              />
            ) : (
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: badge.bg,
                  color: badge.color,
                  border: `1.5px solid ${badge.border}`,
                  fontWeight: 700,
                  fontSize: "0.6875rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {initials}
              </span>
            )}

            {/* Name + role */}
            <div
              style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}
              className="hidden-mobile"
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#09090B",
                  whiteSpace: "nowrap",
                  maxWidth: 120,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.name.split(" ")[0]}
              </span>
              <span
                style={{
                  fontSize: "0.625rem",
                  color: "#71717A",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </div>

            <ChevronDown
              size={12}
              strokeWidth={2.2}
              color="#A1A1AA"
              style={{
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 200ms",
                flexShrink: 0,
              }}
            />
          </div>

          {/* Dropdown — render via portal a document.body para escapar del
              containing block creado por backdrop-filter:blur(12px) en el
              .sfit-topbar (transform/filter/backdrop-filter rompen position:
              fixed haciendo que se posicione relativo al ancestor en vez del
              viewport). */}
          {open && coords && typeof document !== "undefined" && createPortal(
            <div
              ref={dropdownRef}
              role="menu"
              className="sfit-user-dropdown"
              style={{
                position: "fixed",
                top: coords.top,
                right: coords.right,
                zIndex: 1000,
                width: 260,
                background: "#FFFFFF",
                borderRadius: 14,
                border: "1.5px solid #E4E4E7",
                boxShadow: "0 10px 40px rgba(9,9,11,0.12), 0 2px 8px rgba(9,9,11,0.06)",
                overflow: "hidden",
                animation: "fadeUp 160ms cubic-bezier(0.16,1,0.3,1) forwards",
              }}
            >
              {/* Header del perfil */}
              <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid #F4F4F5" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image}
                      alt={user.name}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        objectFit: "cover",
                        flexShrink: 0,
                        border: "1.5px solid #E4E4E7",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        background: badge.bg,
                        color: badge.color,
                        border: `1.5px solid ${badge.border}`,
                        fontWeight: 700,
                        fontSize: "0.9375rem",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </span>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.875rem",
                        color: "#09090B",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {user.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        color: "#71717A",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginTop: 1,
                      }}
                    >
                      {user.email}
                    </div>
                  </div>
                </div>
                {/* Badge rol + contexto territorial */}
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "3px 9px",
                      borderRadius: 6,
                      background: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      fontSize: "0.625rem",
                      fontWeight: 700,
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: badge.color,
                      }}
                    />
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                  {/* Estado online */}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: "#F0FDF4",
                      color: "#15803D",
                      border: "1px solid #86EFAC",
                      fontSize: "0.625rem",
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#15803D" }} />
                    En línea
                  </span>
                </div>
              </div>

              {/* Acciones */}
              <div style={{ padding: "6px" }}>
                <Link
                  href="/perfil"
                  role="menuitem"
                  style={dropItem}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "#F4F4F5";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: "#F4F4F5",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Settings size={13} color="#52525B" />
                  </span>
                  Mi perfil
                </Link>

                <div style={{ height: 1, background: "#F4F4F5", margin: "4px 0" }} />

                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onLogout();
                  }}
                  style={{ ...dropItem, color: "#DC2626" }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "#FEF2F2";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: "#FEF2F2",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <LogOut size={13} color="#DC2626" />
                  </span>
                  Cerrar sesión
                </button>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
}
