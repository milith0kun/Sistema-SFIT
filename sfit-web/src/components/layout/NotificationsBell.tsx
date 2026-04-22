"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

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
  const [unread, setUnread] = useState<number>(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = () =>
    typeof window === "undefined" ? "" : localStorage.getItem("sfit_access_token") ?? "";

  const stopPolling = useRef<(() => void) | null>(null);

  const fetchUnread = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/notifications/unread-count", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        stopPolling.current?.();
        return;
      }
      if (!res.ok) return;
      const data: ApiResponse<{ count: number }> = await res.json();
      if (data.success && data.data) setUnread(data.data.count);
    } catch {
      // silent
    }
  }, []);

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
    void fetchUnread();
    const id = window.setInterval(fetchUnread, 30_000);
    stopPolling.current = () => window.clearInterval(id);
    return () => window.clearInterval(id);
  }, [fetchUnread]);

  useEffect(() => {
    if (open) void fetchRecent();
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

  // Lock body scroll when panel is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  async function markAllRead() {
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnread(0);
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
        setUnread((c) => Math.max(0, c - 1));
      }
    } catch {
      // silent
    }
  }

  return (
    <>
      {/* Bell button */}
      <button
        type="button"
        aria-label="Notificaciones"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "relative",
          width: 38,
          height: 38,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: open ? "#f4f4f5" : "transparent",
          border: "1.5px solid #e4e4e7",
          borderRadius: 10,
          cursor: "pointer",
          color: "#27272a",
          transition: "background 0.15s ease",
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
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 999,
              background: "#b91c1c",
              color: "#ffffff",
              fontSize: "0.6875rem",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #ffffff",
              lineHeight: 1,
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(9,9,11,0.45)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            zIndex: 999,
          }}
        />
      )}

      {/* Slide-in panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Panel de notificaciones"
          className="notif-panel-in"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: 420,
            maxWidth: "100vw",
            background: "#fff",
            borderLeft: "1.5px solid #e4e4e7",
            boxShadow: "-8px 0 40px rgba(9,9,11,0.14)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: "1px solid #e4e4e7",
              flexShrink: 0,
            }}
          >
            {/* Left: icon + title */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#18181b"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span style={{ fontWeight: 700, fontSize: "1rem", color: "#09090b" }}>Notificaciones</span>
              {unread > 0 && (
                <span style={{
                  minWidth: 20,
                  height: 20,
                  padding: "0 6px",
                  borderRadius: 999,
                  background: "#b91c1c",
                  color: "#fff",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </div>

            {/* Right: mark all + close */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unread === 0}
                style={{
                  background: "transparent",
                  border: "none",
                  color: unread === 0 ? "#a1a1aa" : "#52525b",
                  cursor: unread === 0 ? "default" : "pointer",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 6,
                  fontFamily: "inherit",
                }}
              >
                Marcar todo
              </button>
              <button
                type="button"
                aria-label="Cerrar panel"
                onClick={() => setOpen(false)}
                style={{
                  width: 32,
                  height: 32,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#f4f4f5",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  color: "#52525b",
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
              <div style={{ padding: 24, color: "#b91c1c", fontSize: "0.875rem", textAlign: "center" }}>
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
                        padding: "14px 20px",
                        borderBottom: "1px solid #f4f4f5",
                        background: n.read ? "#ffffff" : "#FDFAF2",
                        cursor: "pointer",
                        transition: "background 0.12s ease",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                    >
                      {/* Unread dot */}
                      <span style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#18181b",
                        opacity: n.read ? 0.25 : 1,
                        flexShrink: 0,
                        marginTop: 6,
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
            padding: "14px 20px",
            borderTop: "1px solid #e4e4e7",
            textAlign: "center",
            flexShrink: 0,
          }}>
            <Link
              href="/notificaciones"
              onClick={() => setOpen(false)}
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#0A1628",
                textDecoration: "none",
              }}
            >
              Ver todas las notificaciones →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
