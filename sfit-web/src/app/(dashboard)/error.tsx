"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * Error boundary del segmento `(dashboard)`.
 * Atrapa cualquier excepción no controlada en pages anidadas y permite
 * reintentar sin perder el shell (Sidebar/Topbar).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Hook de observabilidad — en producción enviar a Sentry/Logtail.
    if (process.env.NODE_ENV !== "production") {
      console.error("[dashboard:error]", error);
    }
  }, [error]);

  const isNetwork = /fetch|network|timeout|ECONNREFUSED/i.test(error.message ?? "");

  return (
    <div className="animate-fade-in" style={{ padding: "20px 4px" }}>
      <ErrorState
        title={isNetwork ? "No se pudo conectar con el servidor" : "Ocurrió un error inesperado"}
        message={
          isNetwork
            ? "Verifique su conexión a internet o intente nuevamente en unos instantes."
            : (error.message || "El sistema no pudo procesar la solicitud. Intente nuevamente o contacte con soporte si el problema persiste.")
        }
        onRetry={reset}
        showBack
      />
      {error.digest && (
        <p style={{
          marginTop: 12,
          fontSize: "0.75rem",
          color: "#a1a1aa",
          textAlign: "center",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}>
          Código de incidente: {error.digest}
        </p>
      )}
    </div>
  );
}
