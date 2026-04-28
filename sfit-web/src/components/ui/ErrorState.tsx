"use client";

import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  /** Título visible (formal, sin tuteo). */
  title?: string;
  /** Mensaje secundario — puede ser un Error.message o un texto institucional. */
  message?: string;
  /** Acción principal. Si se omite y hay `onRetry`, se renderiza un botón "Reintentar". */
  action?: ReactNode;
  /** Callback opcional para reintentar (genera el botón estándar). */
  onRetry?: () => void;
  /** Si es `true`, muestra un enlace "Volver" además del retry. */
  showBack?: boolean;
}

/**
 * Estado de error estandarizado SFIT.
 * Para fallos de carga, errores de red o respuestas no exitosas del API.
 */
export function ErrorState({
  title = "No se pudo cargar la información",
  message = "Ocurrió un problema al obtener los datos. Intente nuevamente o contacte con soporte si el problema persiste.",
  action,
  onRetry,
  showBack = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: "48px 24px",
        textAlign: "center",
        background: "#ffffff",
        border: "1.5px solid #FCA5A5",
        borderRadius: 16,
      }}
    >
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: "#FFF5F5",
        color: "#DC2626",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <AlertTriangle size={22} />
      </div>

      <div>
        <h3 style={{
          fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
          fontSize: "1.125rem",
          fontWeight: 700,
          color: "#09090b",
          letterSpacing: "-0.015em",
          margin: 0,
        }}>
          {title}
        </h3>
        <p style={{
          color: "#52525b",
          fontSize: "0.9375rem",
          lineHeight: 1.55,
          maxWidth: 480,
          margin: "6px auto 0",
        }}>
          {message}
        </p>
      </div>

      {(action || onRetry || showBack) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4 }}>
          {action}
          {onRetry && !action && (
            <Button variant="primary" size="sm" onClick={onRetry}>
              <RefreshCw size={14} /> Reintentar
            </Button>
          )}
          {showBack && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (typeof window !== "undefined") window.history.back();
              }}
            >
              <ArrowLeft size={14} /> Volver
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
