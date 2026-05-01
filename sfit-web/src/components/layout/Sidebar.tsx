import { useMemo } from "react";
import { LogOut, X } from "lucide-react";
import { SidebarLink } from "./SidebarLink";
import {
  NAV,
  SECTION_ORDER,
  ROLE_LABELS,
  type NavItem,
  type NavSection,
} from "./nav";
import type { StoredUser } from "./user-storage";

export function Sidebar({
  user,
  pathname,
  unread,
  onClose,
  onLogout,
}: {
  user: StoredUser;
  pathname: string | null;
  unread: number;
  onClose: () => void;
  onLogout: () => void;
}) {
  const visible = useMemo(() => NAV.filter(n => n.roles.includes(user.role)), [user.role]);
  const groupedBySection = useMemo(() => {
    const acc = new Map<NavSection, NavItem[]>();
    for (const item of visible) {
      const bucket = acc.get(item.section) ?? [];
      bucket.push(item);
      acc.set(item.section, bucket);
    }
    return acc;
  }, [visible]);

  return (
    <>
      {/* ── Logo ── */}
      <div
        style={{
          padding: "16px 16px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <img
          src="/logo-horizontal.svg"
          alt="SFIT"
          style={{ width: 140, height: "auto", objectFit: "contain" }}
        />
        {/* Close button — solo móvil */}
        <button
          onClick={onClose}
          className="sfit-hamburger"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "none",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
          aria-label="Cerrar menú"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      {/* ── Navegación ── */}
      <nav
        className="sfit-sidebar-nav"
        style={{ flex: 1, padding: "10px 10px 14px", overflowY: "auto", minHeight: 0 }}
      >
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

      {/* ── Usuario + Logout + Versión ── */}
      <div style={{ padding: "10px 10px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Tarjeta de usuario + pill de rol — sólo desktop. En mobile esta
            info ya está en el dropdown del avatar del Topbar, así que la
            ocultamos para dar más espacio a las opciones del nav. */}
        <div className="sfit-sidebar-user-info">
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
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(108,6,6,0.28)",
                color: "#FFFFFF",
                fontSize: "0.875rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: "1.5px solid rgba(139,20,20,0.40)",
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  color: "#FFFFFF",
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

          {/* Pill de rol */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 4px",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 9px",
                borderRadius: 999,
                background: "rgba(108,6,6,0.18)",
                color: "#FFFFFF",
                border: "1px solid rgba(139,20,20,0.35)",
                fontSize: "0.625rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              <span
                style={{ width: 5, height: 5, borderRadius: "50%", background: "#8B1414" }}
              />
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
        </div>

        {/* Logout */}
        <button onClick={onLogout} className="sfit-sidebar-logout" aria-label="Cerrar sesión">
          <LogOut size={15} strokeWidth={1.85} style={{ flexShrink: 0 }} />
          Cerrar sesión
        </button>

        {/* Versión */}
        <div
          className="sfit-sidebar-version"
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
}
