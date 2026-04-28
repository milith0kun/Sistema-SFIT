import Link from "next/link";
import type { NavItem } from "./nav";

export function SidebarLink({
  item,
  active,
  badge = 0,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
}) {
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
        background: active ? "rgba(108,6,6,0.18)" : "transparent",
        color: active ? "#FFFFFF" : "rgba(255,255,255,0.65)",
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
            background: active ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.10)",
            color: "#FFFFFF",
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
