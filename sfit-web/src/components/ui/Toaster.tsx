"use client";

import { Check, X, AlertTriangle, Info } from "lucide-react";
import { useToastQueue, type ToastVariant } from "@/hooks/useToast";

const VARIANT_STYLES: Record<ToastVariant, { bg: string; bd: string; color: string; icon: typeof Check }> = {
  success: { bg: "#F0FDF4", bd: "#86EFAC", color: "#15803d", icon: Check },
  error:   { bg: "#FFF5F5", bd: "#FCA5A5", color: "#DC2626", icon: X },
  info:    { bg: "#EFF6FF", bd: "#BFDBFE", color: "#1D4ED8", icon: Info },
  warn:    { bg: "#FFFBEB", bd: "#FDE68A", color: "#92400e", icon: AlertTriangle },
};

/**
 * Renderiza la cola de toasts en la esquina inferior-derecha (desktop) y
 * inferior-centro (mobile). Se monta una sola vez en el layout del dashboard
 * y escucha el bus global de useToast.
 */
export function Toaster() {
  const { toasts, dismiss } = useToastQueue();

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notificaciones"
      className="sfit-toaster"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 1100,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: "min(380px, calc(100vw - 32px))",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        const v = VARIANT_STYLES[t.variant];
        const Icon = v.icon;
        return (
          <div
            key={t.id}
            role="status"
            style={{
              pointerEvents: "auto",
              background: "#fff",
              border: `1.5px solid ${v.bd}`,
              borderLeft: `4px solid ${v.color}`,
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              boxShadow: "0 8px 24px rgba(9,9,11,0.10), 0 1px 2px rgba(9,9,11,0.06)",
              animation: "fadeUp 200ms cubic-bezier(0.16,1,0.3,1) both",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: v.bg,
                color: v.color,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={13} strokeWidth={2.5} />
            </span>
            <span style={{ fontSize: "0.875rem", color: "#09090b", fontWeight: 500, flex: 1, lineHeight: 1.4 }}>
              {t.message}
            </span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar"
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                border: "none",
                background: "transparent",
                color: "#71717a",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <X size={13} strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
