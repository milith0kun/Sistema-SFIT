import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Consulta pública de vehículos — SFIT",
  description: "Verifica el estado de habilitación, última inspección y conductor asignado de cualquier vehículo registrado en el sistema SFIT.",
};

export default function ConsultaPublicaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
