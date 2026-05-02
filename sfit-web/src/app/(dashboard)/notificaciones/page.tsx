"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell, Check, TriangleAlert, CircleX, Info, BellOff,
  Search, CheckCheck, RefreshCw, Inbox, ArrowLeft,
} from "lucide-react";
import {
  setUnreadCountValue,
  refreshUnreadCount,
} from "@/hooks/useUnreadCount";
import { useMobileOverlayBack } from "@/hooks/useMobileOverlayBack";
import { useIsMobile } from "@/hooks/useIsMobile";
import { PageHeader } from "@/components/ui/PageHeader";

// ── Paleta sobria — gris uniforme, sólo rojo para errores ────────────────────
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK3 = "#d4d4d8";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const ERR = "#DC2626"; const ERRBG = "#FFF5F5"; const ERRBD = "#FCA5A5";

type Notification = {
  id: string; type?: string; category?: string;
  title: string; body?: string; link?: string;
  read?: boolean; createdAt: string;
};
type Tab = "all" | "unread" | "read";

function getToken() { return typeof window === "undefined" ? "" : (localStorage.getItem("sfit_access_token") ?? ""); }

// ── Utilidades ─────────────────────────────────────────────────────────────────
const MONTH_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "ahora mismo";
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = Math.floor(hr / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  const dt = new Date(iso);
  return `${dt.getDate()} ${MONTH_ABBR[dt.getMonth()]}`;
}

function groupLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (itemDay.getTime() === today.getTime()) return "Hoy";
  if (itemDay.getTime() === yesterday.getTime()) return "Ayer";
  if (itemDay.getTime() >= weekAgo.getTime()) return "Esta semana";
  return d.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
}

function TypeIcon({ type, size = 16 }: { type?: string; size?: number }) {
  const s = { strokeWidth: 1.9, size };
  const t = type ?? "";
  if (t.includes("warn") || t.includes("alert")) return <TriangleAlert {...s} />;
  if (t.includes("success") || t.includes("approved")) return <Check {...s} />;
  if (t.includes("error") || t.includes("rejected")) return <CircleX {...s} />;
  if (t.includes("info")) return <Info {...s} />;
  return <Bell {...s} />;
}

function priorityInfo(type?: string): { label: string; color: string; bg: string; border: string } {
  const t = type ?? "";
  if (t.includes("alert") || t.includes("error") || t.includes("rejected"))
    return { label: "CRÍTICA", color: ERR, bg: ERRBG, border: ERRBD };
  if (t.includes("warn"))
    return { label: "MEDIA", color: INK6, bg: INK1, border: INK2 };
  if (t.includes("success") || t.includes("approved"))
    return { label: "BAJA", color: INK6, bg: INK1, border: INK2 };
  return { label: "INFO", color: INK6, bg: INK1, border: INK2 };
}

// Convierte slugs/snake_case del backend en labels legibles con tildes castellanas.
const HUMANIZE_MAP: Record<string, string> = {
  aprobacion: "Aprobación",
  apelacion: "Apelación",
  sancion: "Sanción",
  inspeccion: "Inspección",
  fatiga: "Fatiga",
  reporte: "Reporte",
  sistema: "Sistema",
  conductor: "Conductor",
  vehiculo: "Vehículo",
  ruta: "Ruta",
  action_required: "Acción requerida",
  info: "Información",
  warn: "Advertencia",
  warning: "Advertencia",
  alert: "Alerta",
  error: "Error",
  success: "Confirmación",
  approved: "Aprobado",
  rejected: "Rechazado",
};
function humanize(s?: string): string {
  if (!s) return "";
  const k = s.toLowerCase().trim();
  if (HUMANIZE_MAP[k]) return HUMANIZE_MAP[k];
  const cleaned = k.replace(/_/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// ── Detail Panel ───────────────────────────────────────────────────────────────
function DetailPanel({ notif, onClose, onMarkRead }: {
  notif: Notification; onClose: () => void; onMarkRead: (id: string) => void;
}) {
  const prio = priorityInfo(notif.type);
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{
      background: "#fff",
      border: `1.5px solid ${INK2}`,
      borderRadius: 14,
      position: "sticky",
      top: 16,
      overflow: "hidden",
    }}>
      {/* ── Header neutro ──────────────────────────────────────────────── */}
      <div style={{
        background: "#fff",
        borderBottom: `1px solid ${INK2}`,
        padding: "14px 16px 12px",
        position: "relative",
      }}>
        {/* Fila superior: pills + cerrar */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
            <span style={{
              display: "inline-flex", padding: "3px 9px", borderRadius: 6,
              fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.08em",
              background: prio.bg, color: prio.color, border: `1px solid ${prio.border}`,
            }}>
              {prio.label}
            </span>
            {notif.category && (
              <span style={{
                display: "inline-flex", padding: "3px 9px", borderRadius: 6,
                fontSize: "0.6875rem", fontWeight: 700,
                background: "#ffffff", color: INK9,
                border: `1px solid ${INK2}`,
                textTransform: "uppercase", letterSpacing: "0.04em",
              }}>
                {humanize(notif.category)}
              </span>
            )}
            {notif.type && (
              <span style={{
                display: "inline-flex", padding: "3px 9px", borderRadius: 6,
                fontSize: "0.6875rem", fontWeight: 600,
                background: INK1, color: INK6, border: `1px solid ${INK2}`,
              }}>
                {humanize(notif.type)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar detalle"
            style={{
              width: 28, height: 28, borderRadius: 7,
              border: `1px solid ${INK2}`, background: "#fff",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: INK5, fontSize: 16, flexShrink: 0, fontFamily: "inherit",
              transition: "background 120ms, color 120ms, border-color 120ms",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = INK1; e.currentTarget.style.color = INK9; e.currentTarget.style.borderColor = INK3; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = INK5; e.currentTarget.style.borderColor = INK2; }}
          >×</button>
        </div>

        {/* Título principal con icono */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "#ffffff", border: `1px solid ${INK2}`,
            color: INK9,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <TypeIcon type={notif.type} size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 800, fontSize: "1.0625rem",
              color: INK9, lineHeight: 1.3, letterSpacing: "-0.01em",
              wordBreak: "break-word",
            }}>
              {notif.title}
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginTop: 6,
              fontSize: "0.75rem", color: INK6,
            }}>
              <span style={{ fontWeight: 600 }}>{timeAgo(notif.createdAt)}</span>
              <span style={{ color: INK3 }}>·</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatDate(notif.createdAt)}</span>
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8,
              fontSize: "0.6875rem", color: notif.read ? INK5 : INK9,
              fontWeight: 600, letterSpacing: "0.04em",
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: notif.read ? INK3 : INK9,
                display: "inline-block",
              }} />
              {notif.read ? "LEÍDA" : "SIN LEER"}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "18px 18px 20px" }}>
        {/* Description */}
        {notif.body && (
          <div style={{
            fontSize: "0.875rem", color: INK6, lineHeight: 1.65, marginBottom: 20,
            padding: "12px 14px", background: INK1, borderRadius: 10,
            whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {notif.body}
          </div>
        )}

        {/* Identificador de soporte — única información que no aparece arriba */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 8, padding: "8px 12px", borderRadius: 8,
          border: `1px dashed ${INK2}`, background: INK1, marginBottom: 14,
        }}>
          <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: INK5 }}>
            ID de soporte
          </span>
          <code style={{ fontSize: "0.75rem", color: INK9, fontWeight: 600, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
            {notif.id.slice(-8).toUpperCase()}
          </code>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {!notif.read && (
            <button
              onClick={() => onMarkRead(notif.id)}
              style={{
                flex: 1, height: 38, borderRadius: 9, border: "none",
                background: INK9, color: "#fff",
                fontFamily: "inherit", fontWeight: 700, fontSize: "0.875rem",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "background 120ms",
                boxShadow: "0 1px 2px rgba(108,6,6,0.20)",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = INK9; }}
              onMouseLeave={e => { e.currentTarget.style.background = INK9; }}
            >
              <Check size={14} strokeWidth={2.5} /> Marcar leída
            </button>
          )}
          {notif.link && (
            <a
              href={notif.link}
              style={{
                flex: 1, height: 38, borderRadius: 9,
                border: `1.5px solid ${notif.read ? INK2 : INK2}`,
                background: "#fff", color: notif.read ? INK9 : INK6,
                fontFamily: "inherit", fontWeight: 600, fontSize: "0.875rem",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                textDecoration: "none",
                transition: "background 120ms, border-color 120ms",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = INK1; e.currentTarget.style.borderColor = INK9; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = notif.read ? INK2 : INK2; }}
            >
              Ver detalle →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function NotificacionesPage() {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [exiting, setExiting] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Notification | null>(null);

  // load NO depende de isMobile — sólo fetchea. Si dependiera, la primera
  // ejecución usaría el valor inicial false del useIsMobile (porque el
  // hook se hidrata después del primer render) y el auto-select correría
  // antes de que isMobile se actualizara, abriendo el overlay en mobile.
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/notificaciones", { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar."); setItems([]); return; }
      const fetched: Notification[] = data.data?.items ?? [];
      setItems(fetched);
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Auto-seleccionar el primer item NO leído (o el primero) SÓLO en desktop.
  // Vive en su propio effect que espera a que tanto items como isMobile
  // estén estables. En mobile esto sigue siendo skip → overlay no aparece.
  useEffect(() => {
    if (isMobile) return;
    if (items.length === 0) return;
    setSelected(prev => {
      if (prev) return prev;
      return items.find(n => !n.read) ?? items[0] ?? null;
    });
  }, [items, isMobile]);

  // Resincroniza el badge global cada vez que cambia el conjunto de items.
  useEffect(() => {
    setUnreadCountValue(items.filter(n => !n.read).length);
  }, [items]);

  // Refresca el conteo global al montar la página por primera vez.
  useEffect(() => { refreshUnreadCount(); }, []);

  // Back del navegador en mobile cierra el overlay en lugar de salir.
  useMobileOverlayBack(
    Boolean(selected),
    useCallback(() => setSelected(null), []),
    "notificacion-detail"
  );

  // Si el usuario rota a mobile con una notificación abierta, la cerramos
  // para no dejar el overlay tapando el listado.
  useEffect(() => {
    if (isMobile && selected) setSelected(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  const unread = useMemo(() => items.filter(n => !n.read).length, [items]);
  const categories = useMemo(() => {
    const s = new Set<string>();
    items.forEach(n => n.category && s.add(n.category));
    return Array.from(s).sort();
  }, [items]);

  const visible = useMemo(() => {
    let list = items;
    if (tab === "unread") list = list.filter(n => !n.read);
    if (tab === "read") list = list.filter(n => n.read);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(n => n.title.toLowerCase().includes(q) || (n.body ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [items, tab, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Notification[]>();
    visible.forEach(n => {
      const lbl = groupLabel(n.createdAt);
      const arr = map.get(lbl) ?? [];
      arr.push(n);
      map.set(lbl, arr);
    });
    return Array.from(map.entries());
  }, [visible]);

  async function markRead(id: string) {
    setExiting(prev => new Set(prev).add(id));
    try {
      await fetch(`/api/notificaciones/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${getToken()}` } });
      setTimeout(() => {
        setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        setExiting(prev => { const s = new Set(prev); s.delete(id); return s; });
      }, 280);
    } catch { setExiting(prev => { const s = new Set(prev); s.delete(id); return s; }); }
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notificaciones", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) setItems(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* silent */ }
    finally { setMarkingAll(false); }
  }

  return (
    <div className="flex flex-col gap-3 animate-fade-in">

      <PageHeader
        kicker="Centro de avisos"
        title="Notificaciones"
        subtitle={loading ? undefined : `${items.length} total · ${unread} sin leer`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => void load()}
              title="Actualizar"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 40, padding: "0 14px", borderRadius: 9,
                border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
                fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <RefreshCw size={15} strokeWidth={2} />Actualizar
            </button>
          </div>
        }
      />

      {/* ── Grid: lista + detail panel ──────────────────────────────────────
          .notif-grid: 1fr 400px en desktop, 1fr (single col) en ≤900px.
          En mobile el detail se muestra como overlay fullscreen abajo. */}
      <div className="notif-grid">

        {/* Columna izquierda: toolbar + lista */}
        <div style={{ minWidth: 0 }}>

          {/* ── Toolbar (sticky para no perderse al hacer scroll) ────────── */}
          <div className="notif-toolbar" style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "saturate(140%) blur(8px)",
            WebkitBackdropFilter: "saturate(140%) blur(8px)",
            border: `1px solid ${INK2}`,
            borderRadius: 14,
            padding: "12px 14px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            position: "sticky",
            top: 8,
            zIndex: 10,
          }}>
            <div className="notif-tabs" style={{ display: "flex", gap: 4, background: INK1, borderRadius: 10, padding: 4 }}>
              {([
                { id: "all" as Tab, label: "Todas", count: items.length },
                { id: "unread" as Tab, label: "No leídas", count: unread },
                { id: "read" as Tab, label: "Leídas", count: items.length - unread },
              ]).map(t => {
                const active = tab === t.id;
                const showDark = active && t.id === "unread" && unread > 0;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7, border: "none", background: active ? "#fff" : "transparent", color: active ? INK9 : INK5, fontWeight: active ? 700 : 500, fontSize: "0.8125rem", cursor: "pointer", fontFamily: "inherit", boxShadow: active ? "0 1px 4px rgba(0,0,0,.08)" : "none", transition: "all 150ms" }}
                  >
                    {t.label}
                    {t.count > 0 && (
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, borderRadius: 999, background: showDark ? INK9 : INK2, color: showDark ? "#fff" : INK6, fontSize: "0.6875rem", fontWeight: 700, padding: "0 5px" }}>
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="notif-toolbar-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="notif-search-wrap" style={{ position: "relative" }}>
                <Search size={14} color={INK5} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  className="notif-search-input"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar…"
                  style={{ height: 36, paddingLeft: 32, paddingRight: 12, border: `1.5px solid ${INK2}`, borderRadius: 9, fontSize: "0.8125rem", fontFamily: "inherit", color: INK9, outline: "none", width: 180, background: "#fff" }}
                  onFocus={e => { e.target.style.borderColor = INK3; }}
                  onBlur={e => { e.target.style.borderColor = INK2; }}
                />
              </div>
              <button
                className="notif-markall-btn"
                onClick={() => void markAllRead()}
                disabled={unread === 0 || markingAll}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 14px", borderRadius: 9, border: `1.5px solid ${INK2}`, background: "#fff", color: unread > 0 ? INK6 : INK5, fontWeight: 600, fontSize: "0.8125rem", cursor: unread > 0 ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: unread === 0 ? 0.45 : 1, transition: "all 150ms", whiteSpace: "nowrap" }}
                onMouseEnter={e => { if (unread > 0) { e.currentTarget.style.borderColor = INK9; e.currentTarget.style.color = INK9; } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = INK2; e.currentTarget.style.color = unread > 0 ? INK6 : INK5; }}
              >
                <CheckCheck size={14} strokeWidth={2} />
                <span className="notif-markall-label">{markingAll ? "Marcando…" : "Marcar todas leídas"}</span>
              </button>
            </div>
          </div>

          {/* ── Categories row ──────────────────────────────────────────── */}
          {categories.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSearch(cat)}
                  style={{ display: "inline-flex", alignItems: "center", height: 26, padding: "0 10px", borderRadius: 999, border: `1px solid ${INK2}`, background: "#fff", color: INK6, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = INK9; e.currentTarget.style.color = INK9; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = INK2; e.currentTarget.style.color = INK6; }}
                >
                  {humanize(cat)}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div role="alert" style={{ padding: "12px 16px", background: ERRBG, border: `1px solid ${ERRBD}`, borderRadius: 10, color: ERR, fontWeight: 500, fontSize: "0.875rem", marginBottom: 14 }}>
              {error}
            </div>
          )}

          {/* ── Loading skeleton ──────────────────────────────────────── */}
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 13, padding: "16px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div className="skeleton-shimmer" style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-shimmer" style={{ height: 14, width: "55%", borderRadius: 6, marginBottom: 9 }} />
                    <div className="skeleton-shimmer" style={{ height: 11, width: "80%", borderRadius: 6, marginBottom: 6 }} />
                    <div className="skeleton-shimmer" style={{ height: 11, width: "40%", borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>

          /* ── Empty state ─────────────────────────────────────────────── */
          ) : visible.length === 0 ? (
            <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 16, padding: "60px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: INK1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {tab === "unread" ? <BellOff size={28} color={INK5} strokeWidth={1.5} /> : <Inbox size={28} color={INK5} strokeWidth={1.5} />}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: INK9, marginBottom: 4 }}>
                  {search ? `Sin resultados para "${search}"` : tab === "unread" ? "Todo al día" : "Sin notificaciones"}
                </div>
                <div style={{ fontSize: "0.875rem", color: INK5 }}>
                  {search ? "Prueba con otro término de búsqueda." : tab === "unread" ? "No tienes notificaciones pendientes." : "Aquí aparecerán tus avisos y alertas."}
                </div>
              </div>
              {search && (
                <button onClick={() => setSearch("")} style={{ height: 34, padding: "0 16px", borderRadius: 8, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", fontFamily: "inherit" }}>
                  Limpiar búsqueda
                </button>
              )}
            </div>

          /* ── Lista agrupada ──────────────────────────────────────────── */
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {grouped.map(([label, notifications]) => (
                <div key={label}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: INK5 }}>{label}</span>
                    <div style={{ flex: 1, height: 1, background: INK2 }} />
                    <span style={{ fontSize: "0.6875rem", color: INK5, fontVariantNumeric: "tabular-nums" }}>{notifications.length}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {notifications.map(n => {
                      const isExiting = exiting.has(n.id);
                      const isSelected = selected?.id === n.id;
                      const card = (
                        <div
                          style={{
                            display: "flex", alignItems: "flex-start", gap: 14,
                            padding: "14px 18px",
                            background: isSelected ? INK1 : (n.read ? "#fff" : "#FAFAFA"),
                            borderTop:    `1.5px solid ${isSelected ? INK9 : INK2}`,
                            borderRight:  `1.5px solid ${isSelected ? INK9 : INK2}`,
                            borderBottom: `1.5px solid ${isSelected ? INK9 : INK2}`,
                            borderLeft:   `4px solid ${isSelected ? INK9 : n.read ? INK2 : INK6}`,
                            borderRadius: 13,
                            cursor: "pointer",
                            transition: "all 200ms ease",
                            opacity: isExiting ? 0.4 : 1,
                            transform: isExiting ? "translateX(8px)" : "none",
                            boxShadow: isSelected ? `0 0 0 3px rgba(108,6,6,0.10)` : "none",
                          }}
                          onMouseEnter={e => { if (!isExiting && !isSelected) { const el = e.currentTarget as HTMLElement; el.style.boxShadow = "0 4px 16px rgba(0,0,0,.06)"; el.style.transform = "translateY(-1px)"; } }}
                          onMouseLeave={e => {
                            const el = e.currentTarget as HTMLElement;
                            el.style.boxShadow = isSelected ? `0 0 0 3px rgba(108,6,6,0.10)` : "none";
                            el.style.transform = "none";
                          }}
                        >
                          {/* Icon chip — gold cuando seleccionado */}
                          <div style={{
                            width: 40, height: 40, borderRadius: 11,
                            background: isSelected ? "#FFFFFF" : INK1,
                            border: `1px solid ${isSelected ? INK2 : INK2}`,
                            color: isSelected ? INK9 : INK6,
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}>
                            <TypeIcon type={n.type} />
                          </div>

                          {/* Body */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: n.body ? 4 : 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {!n.read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: INK9, display: "inline-block", flexShrink: 0 }} />}
                                <span style={{
                                  fontSize: "0.9375rem",
                                  fontWeight: n.read ? 500 : 700,
                                  color: isSelected ? INK9 : INK9,
                                  lineHeight: 1.35,
                                }}>{n.title}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                {n.category && (
                                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: INK1, color: INK6, border: `1px solid ${INK2}` }}>{humanize(n.category)}</span>
                                )}
                                <span style={{ fontSize: "0.6875rem", color: INK5, whiteSpace: "nowrap" }}>{timeAgo(n.createdAt)}</span>
                              </div>
                            </div>
                            {n.body && (
                              <div style={{
                                fontSize: "0.8125rem", color: INK6, lineHeight: 1.55, marginTop: 3,
                                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                                overflow: "hidden", wordBreak: "break-word",
                              }}>{n.body}</div>
                            )}
                            {!n.read && (
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); e.preventDefault(); void markRead(n.id); }}
                                style={{ marginTop: 9, display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 10px", borderRadius: 7, border: `1px solid ${INK2}`, background: "#fff", color: INK6, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 150ms" }}
                                onMouseEnter={e => { e.currentTarget.style.background = INK9; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = INK9; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = INK6; e.currentTarget.style.borderColor = INK2; }}
                              >
                                <Check size={11} strokeWidth={2.5} /> Marcar leída
                              </button>
                            )}
                          </div>
                        </div>
                      );

                      return (
                        <div
                          key={n.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => { setSelected(n); if (!n.read) void markRead(n.id); }}
                          onKeyDown={e => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelected(n);
                              if (!n.read) void markRead(n.id);
                            }
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          {card}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Footer */}
              <div style={{ textAlign: "center", padding: "6px 0 2px", fontSize: "0.8125rem", color: INK5 }}>
                {visible.length} notificación{visible.length !== 1 ? "es" : ""}
                {unread > 0 && tab !== "read" && <> · <span style={{ color: INK9, fontWeight: 700 }}>{unread} sin leer</span></>}
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha — desktop only (≥901px). En mobile la columna
            se colapsa por .notif-grid y el detalle se muestra como overlay. */}
        <div className="notif-detail-desktop">
          {selected ? (
            <DetailPanel notif={selected} onClose={() => setSelected(null)} onMarkRead={markRead} />
          ) : (
            <div style={{ background: "#fff", border: `1.5px solid ${INK2}`, borderRadius: 14, padding: "60px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center", position: "sticky", top: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: INK1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bell size={22} color={INK5} strokeWidth={1.5} />
              </div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9 }}>Seleccione una notificación</div>
              <div style={{ fontSize: "0.8125rem", color: INK5 }}>Haz clic en cualquier aviso para ver su detalle aquí.</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Overlay mobile (≤900px) ─────────────────────────────────────────
          Cuando se selecciona una notificación en mobile, el DetailPanel se
          muestra como sheet fullscreen sobre el listado para ver el contenido
          completo (cuerpo, IDs, acciones) sin el cramping de un grid de 2 cols. */}
      {selected && typeof document !== "undefined" && createPortal(
        <div className="notif-detail-mobile-overlay" role="dialog" aria-modal="true" aria-label="Detalle de notificación">
          {/* Toolbar superior con back button */}
          <div style={{
            position: "sticky", top: 0, zIndex: 2,
            background: "#fff", borderBottom: `1px solid ${INK2}`,
            padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <button
              onClick={() => setSelected(null)}
              aria-label="Volver al listado"
              style={{
                width: 38, height: 38, borderRadius: 9,
                border: `1.5px solid ${INK2}`, background: "#fff",
                color: INK9, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ArrowLeft size={18} strokeWidth={2} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: "0.6875rem", fontWeight: 700,
                color: INK5, letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}>Detalle de notificación</div>
              <div style={{
                fontSize: "0.8125rem", color: INK9, fontWeight: 600,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                marginTop: 2,
              }}>{selected.title}</div>
            </div>
          </div>

          {/* Contenido scrollable */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 24px" }}>
            <DetailPanel notif={selected} onClose={() => setSelected(null)} onMarkRead={markRead} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
