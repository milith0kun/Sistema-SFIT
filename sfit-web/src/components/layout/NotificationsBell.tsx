"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  useUnreadCount,
  decrementUnreadCount,
  setUnreadCountValue,
  refreshUnreadCount,
} from "@/hooks/useUnreadCount";

// Altura del topbar del dashboard (debe coincidir con minHeight del Topbar en (dashboard)/layout.tsx)
const TOPBAR_HEIGHT = 60;

type NotificationItem = {
  id: string;
  type?: string;
  category?: string;
  title: string;
  body?: string;
  link?: string;
  read?: boolean;
  createdAt: string;
};

type ApiResponse<T> = { success: boolean; data?: T; error?: string };

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

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = () =>
    typeof window === "undefined" ? "" : localStorage.getItem("sfit_access_token") ?? "";

  const fetchRecent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications?limit=10", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data: ApiResponse<{ items: NotificationItem[] }> = await res.json();
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

  useEffect(() => {
    if (open) {
      void fetchRecent();
      refreshUnreadCount();
    }
  }, [open, fetchRecent]);

  // Close panel on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Click-outside para cerrar (sin backdrop oscuro: la página detrás sigue visible e interactiva)
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  async function markAllRead() {
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCountValue(0);
      }
    } catch {
      // silent
    }
  }

  async function markOneRead(id: string) {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        decrementUnreadCount(1);
      }
    } catch {
      // silent
    }
  }

  return (
    <>
      {/* Bell button */}
      <button
        ref={buttonRef}
        type="button"
        aria-label="Notificaciones"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "relative",
          width: 38,
          height: 38,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: open ? "#f4f4f5" : "transparent",
          border: `1.5px solid ${open ? "#d4d4d8" : "#e4e4e7"}`,
          borderRadius: 10,
          cursor: "pointer",
          color: "#27272a",
          transition: "background 0.15s ease, border-color 0.15s ease",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 999,
              background: "#DC2626",
              color: "#ffffff",
              fontSize: "0.625rem",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              fontFeatureSettings: "\"tnum\"",
              letterSpacing: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 2px #ffffff, 0 1px 2px rgba(9,9,11,0.18)",
              lineHeight: 1,
              transform: "translateZ(0)",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Slide-in panel — minimalista, debajo del header, sin tapar contenido */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Panel de notificaciones"
          className="notif-panel-in"
          style={{
            position: "fixed",
            top: TOPBAR_HEIGHT,
            right: 0,
            bottom: 0,
            width: 380,
            maxWidth: "100vw",
            background: "#ffffff",
            borderLeft: "1px solid #e4e4e7",
            borderTop: "1px solid #e4e4e7",
            borderTopLeftRadius: 14,
            boxShadow: "-16px 0 48px -8px rgba(9,9,11,0.10), -2px 0 6px rgba(9,9,11,0.04)",
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header — minimalista */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px 12px 18px",
              borderBottom: "1px solid #f4f4f5",
              flexShrink: 0,
            }}
          >
            {/* Left: title + count */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
              <span style={{
                fontWeight: 700,
                fontSize: "0.9375rem",
                color: "#09090b",
                letterSpacing: "-0.01em",
              }}>
                Notificaciones
              </span>
              <span style={{
                fontSize: "0.75rem",
                color: "#a1a1aa",
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
              }}>
                {unread > 0 ? `${unread > 99 ? "99+" : unread} sin leer` : "al día"}
              </span>
            </div>

            {/* Right: mark all + close */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unread === 0}
                style={{
                  background: "transparent",
                  border: "none",
                  color: unread === 0 ? "#d4d4d8" : "#52525b",
                  cursor: unread === 0 ? "default" : "pointer",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  padding: "5px 9px",
                  borderRadius: 7,
                  fontFamily: "inherit",
                  transition: "color 120ms, background 120ms",
                }}
                onMouseEnter={(e) => { if (unread > 0) { e.currentTarget.style.color = "#09090b"; e.currentTarget.style.background = "#f4f4f5"; } }}
                onMouseLeave={(e) => { e.currentTarget.style.color = unread === 0 ? "#d4d4d8" : "#52525b"; e.currentTarget.style.background = "transparent"; }}
              >
                Marcar todas
              </button>
              <button
                type="button"
                aria-label="Cerrar panel"
                onClick={() => setOpen(false)}
                style={{
                  width: 28,
                  height: 28,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  borderRadius: 7,
                  cursor: "pointer",
                  color: "#71717a",
                  flexShrink: 0,
                  transition: "background 120ms, color 120ms",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f4f5"; e.currentTarget.style.color = "#09090b"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#71717a"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
                <div style={{
                  width: 24,
                  height: 24,
                  border: "2.5px solid #e4e4e7",
                  borderTopColor: "#18181b",
                  borderRadius: "50%",
                  animation: "spin 0.65s linear infinite",
                }} />
              </div>
            ) : error ? (
              <div style={{ padding: 24, color: "#DC2626", fontSize: "0.875rem", textAlign: "center" }}>
                {error}
              </div>
            ) : items.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 48, gap: 10, color: "#71717a" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span style={{ fontSize: "0.875rem" }}>Sin notificaciones.</span>
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {items.map((n) => {
                  const itemContent = (
                    <div
                      style={{
                        padding: "12px 18px",
                        borderBottom: "1px solid #f4f4f5",
                        background: "#ffffff",
                        borderLeft: `3px solid ${n.read ? "transparent" : "#6C0606"}`,
                        cursor: "pointer",
                        transition: "background 0.12s ease",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#fafafa"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
                    >
                      {/* Unread dot */}
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#6C0606",
                        opacity: n.read ? 0 : 1,
                        flexShrink: 0,
                        marginTop: 7,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <div style={{
                            fontSize: "0.875rem",
                            fontWeight: n.read ? 500 : 700,
                            color: "#09090b",
                            lineHeight: 1.35,
                          }}>
                            {n.title}
                          </div>
                          <div style={{ fontSize: "0.6875rem", color: "#71717a", whiteSpace: "nowrap", flexShrink: 0 }}>
                            {timeAgo(n.createdAt)}
                          </div>
                        </div>
                        {n.body && (
                          <div style={{
                            fontSize: "0.8125rem",
                            color: "#52525b",
                            marginTop: 3,
                            lineHeight: 1.45,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}>
                            {n.body}
                          </div>
                        )}
                      </div>
                    </div>
                  );

                  return (
                    <li key={n.id} onClick={() => !n.read && void markOneRead(n.id)}>
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => setOpen(false)}
                          style={{ textDecoration: "none", color: "inherit", display: "block" }}
                        >
                          {itemContent}
                        </Link>
                      ) : (
                        itemContent
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: "10px 18px",
            borderTop: "1px solid #f4f4f5",
            background: "#fafafa",
            textAlign: "center",
            flexShrink: 0,
          }}>
            <Link
              href="/notificaciones"
              onClick={() => setOpen(false)}
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#52525b",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 8px",
                borderRadius: 6,
                transition: "color 120ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#09090b"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#52525b"; }}
            >
              Ver todas
              <span aria-hidden style={{ fontSize: "0.875rem", lineHeight: 1 }}>→</span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
