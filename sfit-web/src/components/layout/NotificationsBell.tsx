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
  const ref = useRef<HTMLDivElement | null>(null);

  const getToken = () =>
    typeof window === "undefined" ? "" : localStorage.getItem("sfit_access_token") ?? "";

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
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
    return () => window.clearInterval(id);
  }, [fetchUnread]);

  useEffect(() => {
    if (open) void fetchRecent();
  }, [open, fetchRecent]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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
    <div ref={ref} style={{ position: "relative" }}>
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

      {open && (
        <div
          role="dialog"
          aria-label="Panel de notificaciones"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 360,
            maxWidth: "92vw",
            background: "#ffffff",
            border: "1.5px solid #e4e4e7",
            borderRadius: 14,
            boxShadow: "0 12px 32px rgba(9, 9, 11, 0.12)",
            overflow: "hidden",
            zIndex: 40,
          }}
          className="animate-fade-up"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid #e4e4e7",
              background: "#fafafa",
            }}
          >
            <div style={{ fontFamily: "var(--font-inter)", fontWeight: 700, color: "#09090b", fontSize: "0.9375rem" }}>
              Notificaciones
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unread === 0}
              style={{
                background: "transparent",
                border: "none",
                color: unread === 0 ? "#a1a1aa" : "#0A1628",
                cursor: unread === 0 ? "default" : "pointer",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              Marcar todo como leído
            </button>
          </div>

          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 24, color: "#71717a", fontSize: "0.875rem", textAlign: "center" }}>
                Cargando…
              </div>
            ) : error ? (
              <div style={{ padding: 16, color: "#DC2626", fontSize: "0.875rem" }}>{error}</div>
            ) : items.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#71717a", fontSize: "0.875rem" }}>
                Sin notificaciones.
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {items.map((n) => {
                  const body = (
                    <div
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #f4f4f5",
                        background: n.read ? "#ffffff" : "#FDF8EC",
                        cursor: "pointer",
                        transition: "background 0.12s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: 700,
                            color: "#09090b",
                            lineHeight: 1.35,
                          }}
                        >
                          {n.title}
                        </div>
                        <div style={{ fontSize: "0.6875rem", color: "#71717a", whiteSpace: "nowrap" }}>
                          {timeAgo(n.createdAt)}
                        </div>
                      </div>
                      {n.body && (
                        <div
                          style={{
                            fontSize: "0.8125rem",
                            color: "#52525b",
                            marginTop: 4,
                            lineHeight: 1.45,
                          }}
                        >
                          {n.body}
                        </div>
                      )}
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
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div
            style={{
              padding: 12,
              borderTop: "1px solid #e4e4e7",
              background: "#fafafa",
              textAlign: "center",
            }}
          >
            <Link
              href="/notificaciones"
              onClick={() => setOpen(false)}
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#0A1628",
                textDecoration: "none",
              }}
            >
              Ver todas las notificaciones
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
