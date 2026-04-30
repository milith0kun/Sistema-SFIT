import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, LogOut, Menu, Settings } from "lucide-react";
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

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "0 22px",
        background: "#FFFFFF",
        borderBottom: "1px solid #F0F0F1",
        minHeight: 62,
        flexShrink: 0,
      }}
    >
      {/* ── Left ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <button
          className="sfit-hamburger"
          onClick={onOpenSidebar}
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            border: "1.5px solid #E4E4E7",
            background: "#FFFFFF",
            color: "#52525B",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
          aria-label="Abrir menú"
        >
          <Menu size={17} strokeWidth={2} />
        </button>

        <div
          style={{ width: 1, height: 26, background: "#E4E4E7", flexShrink: 0 }}
          className="hidden-mobile"
        />

        {/* Breadcrumb desktop */}
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
              <span
                key={c.href}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {/* Date/time */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 11px",
            borderRadius: 9,
            background: "#F4F4F5",
            border: "1.5px solid #E4E4E7",
          }}
          className="hidden-mobile"
        >
          <CalendarDays size={12} color="#71717A" strokeWidth={2} />
          <span
            style={{
              fontSize: "0.8125rem",
              color: "#52525B",
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {dateStr}
          </span>
          <span style={{ width: 1, height: 13, background: "#D4D4D8" }} />
          <span
            style={{
              fontSize: "0.8125rem",
              color: "#71717A",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {timeStr}
          </span>
        </div>

        <NotificationsBell />

        <div style={{ width: 1, height: 26, background: "#E4E4E7" }} />

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
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 10px 4px 4px",
              borderRadius: 999,
              border: `1.5px solid ${open ? "#6C060655" : "#E4E4E7"}`,
              background: open ? "#FBEAEA" : "#FFFFFF",
              cursor: "pointer",
              transition: "all 150ms",
              outline: "none",
            }}
            onMouseEnter={e => {
              if (!open) {
                e.currentTarget.style.background = "#FAFAFA";
                e.currentTarget.style.borderColor = "#6C060644";
              }
            }}
            onMouseLeave={e => {
              if (!open) {
                e.currentTarget.style.background = "#FFFFFF";
                e.currentTarget.style.borderColor = "#E4E4E7";
              }
            }}
          >
            {/* Avatar */}
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                  border: "1.5px solid #E4E4E7",
                }}
              />
            ) : (
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: badge.bg,
                  color: badge.color,
                  border: `1.5px solid ${badge.border}`,
                  fontWeight: 700,
                  fontSize: "0.75rem",
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
              style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}
              className="hidden-mobile"
            >
              <span
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  color: "#09090B",
                  whiteSpace: "nowrap",
                  maxWidth: 130,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.name.split(" ")[0]}
              </span>
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: "#71717A",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </div>

            <ChevronDown
              size={13}
              strokeWidth={2.2}
              color="#A1A1AA"
              style={{
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 200ms",
                flexShrink: 0,
              }}
            />
          </div>

          {/* Dropdown */}
          {open && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                zIndex: 200,
                width: 256,
                background: "#FFFFFF",
                borderRadius: 14,
                border: "1.5px solid #E4E4E7",
                boxShadow: "0 10px 40px rgba(9,9,11,0.10), 0 2px 8px rgba(9,9,11,0.05)",
                overflow: "hidden",
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
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        objectFit: "cover",
                        flexShrink: 0,
                        border: "1.5px solid #E4E4E7",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: badge.bg,
                        color: badge.color,
                        border: `1.5px solid ${badge.border}`,
                        fontWeight: 700,
                        fontSize: "1rem",
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
                        fontSize: "0.9375rem",
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
                        fontSize: "0.75rem",
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
                {/* Badge rol */}
                <div style={{ marginTop: 10 }}>
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
                      fontSize: "0.6875rem",
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
                    <Settings size={14} color="#52525B" />
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
                    <LogOut size={14} color="#DC2626" />
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
