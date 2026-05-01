"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";

const INK1 = "#f4f4f5";
const INK2 = "#e4e4e7";
const INK4 = "#a1a1aa";
const INK5 = "#71717a";
const INK6 = "#52525b";
const INK8 = "#27272a";
const INK9 = "#18181b";
const GRANATE = "#6C0606";

const TYPE_LABELS: Record<string, string> = {
  transporte_publico: "Transporte público",
  limpieza_residuos: "Limpieza y residuos",
  emergencia: "Emergencia",
  maquinaria: "Maquinaria",
  municipal_general: "Municipal",
};

type QrData = {
  payload: { sig: string };
  pngDataUrl: string;
  plate: string;
  vehicleTypeKey: string;
};

export default function PrintQrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<QrData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = localStorage.getItem("sfit_access_token");
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        const res = await fetch(`/api/vehiculos/${id}/qr`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const body = await res.json();
        if (!res.ok || !body.success) {
          if (!cancelled) setError(body.error ?? "No se pudo generar el QR");
          return;
        }
        if (!cancelled) setData(body.data as QrData);
      } catch {
        if (!cancelled) setError("Error de conexión");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  return (
    <div style={{ minHeight: "100vh", background: INK1, color: INK9 }}>
      <style>{printStyles}</style>

      {/* Toolbar — oculta al imprimir */}
      <div
        className="no-print"
        style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "#fff", borderBottom: `1px solid ${INK2}`,
          padding: "10px 16px", display: "flex",
          alignItems: "center", justifyContent: "space-between", gap: 12,
        }}
      >
        <button
          onClick={() => window.close()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 34, padding: "0 12px", borderRadius: 7,
            border: `1px solid ${INK2}`, background: "#fff", color: INK6,
            fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <ArrowLeft size={14} />Cerrar
        </button>
        <div style={{ fontSize: "0.8125rem", color: INK5, fontWeight: 600 }}>
          Etiqueta para impresión
        </div>
        <button
          onClick={() => window.print()}
          disabled={!data}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 34, padding: "0 14px", borderRadius: 7, border: "none",
            background: INK9, color: "#fff",
            fontSize: "0.8125rem", fontWeight: 600,
            cursor: data ? "pointer" : "not-allowed", opacity: data ? 1 : 0.5,
            fontFamily: "inherit",
          }}
        >
          <Printer size={14} />Imprimir
        </button>
      </div>

      {/* Contenido imprimible — centrado, A4 */}
      <div
        style={{
          maxWidth: 720, margin: "0 auto", padding: "32px 24px",
          display: "flex", flexDirection: "column", alignItems: "center",
        }}
      >
        {error ? (
          <ErrorState message={error} />
        ) : !data ? (
          <LoadingState />
        ) : (
          <PrintLabel data={data} />
        )}
      </div>
    </div>
  );
}

function PrintLabel({ data }: { data: QrData }) {
  const typeLabel = TYPE_LABELS[data.vehicleTypeKey] ?? "Vehículo municipal";
  return (
    <div
      className="print-card"
      style={{
        background: "#fff", border: `2px solid ${INK9}`, borderRadius: 12,
        padding: "28px 32px 24px", width: "100%", maxWidth: 520,
        display: "flex", flexDirection: "column", alignItems: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* Cabecera institucional */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div
          style={{
            width: 28, height: 28, borderRadius: 6,
            background: GRANATE, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: "0.75rem", letterSpacing: "0.05em",
          }}
        >
          SF
        </div>
        <div
          style={{
            fontWeight: 800, fontSize: "0.875rem", color: INK9,
            letterSpacing: "0.04em",
          }}
        >
          SFIT · Sistema de Fiscalización Inteligente
        </div>
      </div>
      <div
        style={{
          fontSize: "0.6875rem", color: INK5,
          letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
          marginBottom: 22,
        }}
      >
        {typeLabel}
      </div>

      {/* QR — protagonista */}
      <div
        style={{
          background: "#fff", padding: 14, border: `1px solid ${INK2}`,
          borderRadius: 10,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.pngDataUrl}
          alt={`QR ${data.plate}`}
          style={{ display: "block", width: 360, height: 360, imageRendering: "pixelated" }}
        />
      </div>

      {/* Placa enorme */}
      <div
        style={{
          marginTop: 24,
          padding: "10px 22px", borderRadius: 8,
          background: INK9, color: "#fff",
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
          fontWeight: 800, fontSize: "2.25rem", letterSpacing: "0.08em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {data.plate}
      </div>

      {/* Instrucciones para el ciudadano */}
      <div
        style={{
          marginTop: 22, paddingTop: 18, borderTop: `1px dashed ${INK2}`,
          width: "100%", textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "1rem", fontWeight: 700, color: INK9, marginBottom: 4,
          }}
        >
          Reporta este vehículo
        </div>
        <div style={{ fontSize: "0.875rem", color: INK6, lineHeight: 1.5 }}>
          Apunta tu cámara o usa la app <strong>SFIT Ciudadano</strong>
          <br />
          para escanear este código y enviar tu reporte.
        </div>
      </div>

      {/* Firma criptográfica */}
      <div
        style={{
          marginTop: 18, fontSize: "0.625rem", color: INK4,
          fontFamily: "ui-monospace, monospace", letterSpacing: "0.02em",
          textAlign: "center",
        }}
      >
        sha256:{data.payload.sig.slice(0, 24)}…
      </div>
      <div
        style={{
          marginTop: 4, fontSize: "0.625rem", color: INK4,
          fontStyle: "italic",
        }}
      >
        Documento firmado · No despegar ni alterar
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        padding: "80px 0", color: INK5,
      }}
    >
      <Loader2 size={28} style={{ animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>
        Generando etiqueta...
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        padding: "60px 24px", color: "#DC2626",
        background: "#FFF5F5", border: "1px solid #FCA5A5",
        borderRadius: 10, maxWidth: 460, textAlign: "center",
      }}
    >
      <AlertTriangle size={28} />
      <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: INK8 }}>
        No se pudo generar la etiqueta
      </div>
      <div style={{ fontSize: "0.8125rem", color: INK6 }}>{message}</div>
    </div>
  );
}

const printStyles = `
  @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
  @media print {
    .no-print { display: none !important; }
    body { background: #fff !important; }
    .print-card {
      box-shadow: none !important;
      border: 2px solid #000 !important;
      page-break-inside: avoid;
    }
  }
  @page {
    size: A4 portrait;
    margin: 18mm;
  }
`;
