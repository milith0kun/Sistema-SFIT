"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Check, TriangleAlert, CircleX, Info, BellOff, BellRing } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { KPIStrip } from "@/components/dashboard/KPIStrip";

type ApiResponse<T> = { success: boolean; data?: T; error?: string };

type Notification = {
  id: string;
  type?: string;
  category?: string;
  title: string;
  body?: string;
  link?: string;
  read?: boolean;
  createdAt: string;
};

type Tab = "all" | "unread" | "category";

function getToken(): string {
  return typeof window === "undefined" ? "" : (localStorage.getItem("sfit_access_token") ?? "");
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-PE");
}

function iconForType(type?: string): React.ReactNode {
  const size = 18;
  const stroke = 1.8;
  if (!type || type.includes("info")) return <Info size={size} strokeWidth={stroke} />;
  if (type.includes("warn") || type.includes("alert")) return <TriangleAlert size={size} strokeWidth={stroke} />;
  if (type.includes("success") || type.includes("approved")) return <Check size={size} strokeWidth={stroke} />;
  if (type.includes("error") || type.includes("rejected")) return <CircleX size={size} strokeWidth={stroke} />;
  return <Bell size={size} strokeWidth={stroke} />;
}

function iconBg(type?: string): { bg: string; color: string; border: string } {
  if (!type || type.includes("info")) return { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" };
  if (type.includes("warn") || type.includes("alert")) return { bg: "#FFFBEB", color: "#b45309", border: "#FCD34D" };
  if (type.includes("success") || type.includes("approved")) return { bg: "#F0FDF4", color: "#15803d", border: "#86EFAC" };
  if (type.includes("error") || type.includes("rejected")) return { bg: "#FFF5F5", color: "#b91c1c", border: "#FCA5A5" };
  return { bg: "#FDF8EC", color: "#926A09", border: "#E8D090" };
}

export default function NotificacionesPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [category, setCategory] = useState<string>("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notificaciones", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data: ApiResponse<{ items: Notification[] }> = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudieron cargar las notificaciones.");
        setItems([]);
        return;
      }
      setItems(data.data?.items ?? []);
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    items.forEach((n) => n.category && s.add(n.category));
    return Array.from(s).sort();
  }, [items]);

  async function markAllRead() {
    try {
      const res = await fetch("/api/notificaciones", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* silent */ }
  }

  async function markRead(id: string) {
    try {
      const res = await fetch(`/api/notificaciones/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch { /* silent */ }
  }

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);
  const categoryCount = useMemo(() => categories.length, [categories]);

  const visibleItems = useMemo(() => {
    let list = items;
    if (tab === "unread") list = list.filter((n) => !n.read);
    if (tab === "category" && category) list = list.filter((n) => n.category === category);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.body ?? "").toLowerCase().includes(q) ||
          (n.category ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, tab, category, search]);

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <DashboardHero
        kicker="Centro de avisos"
        rfCode="RF-18"
        title="Notificaciones"
        pills={[
          { label: "No leídas", value: unreadCount, warn: unreadCount > 0 },
          { label: "Categorías", value: categoryCount },
        ]}
      />

      <KPIStrip
        cols={3}
        items={[
          {
            label: "TOTAL",
            value: loading ? "—" : items.length,
            subtitle: "recibidas",
            accent: "#0A1628",
            icon: Bell,
          },
          {
            label: "NO LEÍDAS",
            value: loading ? "—" : unreadCount,
            subtitle: "pendientes",
            accent: unreadCount > 0 ? "#b45309" : "#71717a",
            icon: BellRing,
          },
          {
            label: "CATEGORÍAS",
            value: loading ? "—" : categoryCount,
            subtitle: "distintas",
            accent: "#1D4ED8",
            icon: BellOff,
          },
        ]}
      />

      {/* Toolbar: tabs + búsqueda + marcar todo */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderBottom: "1.5px solid #e4e4e7" }}>
          {(
            [
              { id: "all", label: "Todas" },
              { id: "unread", label: `No leídas${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
              { id: "category", label: "Por categoría" },
            ] as { id: Tab; label: string }[]
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  padding: "10px 14px", background: "transparent", border: "none",
                  borderBottom: active ? "2px solid #B8860B" : "2px solid transparent",
                  color: active ? "#09090b" : "#52525b",
                  fontWeight: active ? 700 : 500, fontSize: "0.875rem",
                  cursor: "pointer", transition: "color 0.12s ease",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Búsqueda */}
          <div style={{ position: "relative" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar notificación…"
              style={{
                height: 34, padding: "0 12px 0 10px", border: "1.5px solid #e4e4e7",
                borderRadius: 8, fontSize: "0.8125rem", fontFamily: "inherit",
                color: "#18181b", outline: "none", width: 220,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#B8860B"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e4e4e7"; }}
            />
          </div>
          <Button
            variant="outline"
            size="md"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            Marcar todas como leídas
          </Button>
        </div>
      </div>

      {/* Filtro por categoría */}
      {tab === "category" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", background: "#fff", border: "1.5px solid #e4e4e7", borderRadius: 12 }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "#18181b" }}>Categoría:</label>
          <select
            className="field"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ maxWidth: 280 }}
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            background: "#FFF5F5", border: "1.5px solid #FCA5A5",
            borderRadius: 12, padding: 16, color: "#b91c1c",
            fontSize: "0.9375rem", fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ background: "#fff", border: "1.5px solid #e4e4e7", borderRadius: 14, padding: 24 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: i < 3 ? "1px solid #f4f4f5" : "none" }}>
              <div className="skeleton-shimmer" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton-shimmer" style={{ height: 14, width: "60%", borderRadius: 6, marginBottom: 8 }} />
                <div className="skeleton-shimmer" style={{ height: 11, width: "80%", borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title="Sin notificaciones"
          subtitle={search ? `No hay resultados para "${search}".` : "No tienes notificaciones en esta vista."}
        />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {visibleItems.map((n) => {
            const ibg = iconBg(n.type);
            const content = (
              <div
                style={{
                  display: "flex", alignItems: "flex-start", gap: 14,
                  padding: "15px 18px",
                  background: n.read ? "#ffffff" : "#FDF8EC",
                  border: `1.5px solid ${n.read ? "#e4e4e7" : "#E8D090"}`,
                  borderRadius: 13,
                  cursor: n.link ? "pointer" : "default",
                  transition: "border-color 0.12s ease, background 0.12s ease",
                }}
              >
                {/* Ícono */}
                <div
                  aria-hidden
                  style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: ibg.bg, border: `1px solid ${ibg.border}`,
                    color: ibg.color, display: "inline-flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                >
                  {iconForType(n.type)}
                </div>

                {/* Contenido */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#09090b" }}>
                      {n.title}
                      {!n.read && (
                        <span style={{
                          display: "inline-block", width: 7, height: 7, borderRadius: "50%",
                          background: "#B8860B", marginLeft: 8, verticalAlign: "middle",
                        }} aria-label="No leída" />
                      )}
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {n.category && <Badge variant="info">{n.category}</Badge>}
                      <span style={{ fontSize: "0.6875rem", color: "#71717a" }}>{timeAgo(n.createdAt)}</span>
                    </div>
                  </div>
                  {n.body && (
                    <div style={{ color: "#52525b", fontSize: "0.875rem", marginTop: 4, lineHeight: 1.5 }}>
                      {n.body}
                    </div>
                  )}
                  {!n.read && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); void markRead(n.id); }}
                      style={{
                        marginTop: 10, background: "transparent", border: "none",
                        color: "#0A1628", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", padding: 0,
                      }}
                    >
                      Marcar leída
                    </button>
                  )}
                </div>
              </div>
            );

            return (
              <li key={n.id} onClick={() => !n.read && void markRead(n.id)}>
                {n.link ? (
                  <Link href={n.link} style={{ textDecoration: "none", color: "inherit" }}>{content}</Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Contador de resultados */}
      {!loading && visibleItems.length > 0 && (
        <div style={{ color: "#71717a", fontSize: "0.8125rem", textAlign: "right" }}>
          Mostrando <strong style={{ color: "#18181b" }}>{visibleItems.length}</strong> notificación{visibleItems.length !== 1 ? "es" : ""}
        </div>
      )}
    </div>
  );
}
