import type { Metadata } from "next";

/**
 * Layout dedicado a vistas imprimibles (etiquetas QR, certificados, etc.).
 * Sin sidebar/topbar del dashboard — se renderiza solo el contenido para
 * que el usuario pueda imprimir directamente sin chrome.
 *
 * El auth lo sigue cubriendo el middleware (redirige a /login si no hay token).
 */

export const metadata: Metadata = {
  title: "Imprimir · SFIT",
};

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
