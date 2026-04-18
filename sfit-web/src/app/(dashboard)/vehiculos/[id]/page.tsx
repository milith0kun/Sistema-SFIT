"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, QrCode, Download, Car, User, CalendarCheck, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";

// ─── paleta del proyecto ────────────────────────────────────────────────────
const G = "#B8860B"; const GD = "#926A09"; const GBG = "#FDF8EC"; const GBR = "#E8D090";
const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const RIESGO = "#b45309"; const RIESGOBG = "#FFFBEB"; const RIESGOBD = "#FCD34D";
const NO = "#b91c1c"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const INFO = "#1e40af"; const INFOBG = "#EFF6FF"; const INFOBD = "#BFDBFE";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

// ─── tipos ───────────────────────────────────────────────────────────────────
type VehicleStatus = "disponible" | "en_ruta" | "en_mantenimiento" | "fuera_de_servicio";
type InspectionStatus = "aprobada" | "observada" | "rechazada" | "pendiente";

type VehicleDetail = {
  id: string;
  plate: string;
  vehicleTypeKey: string;
  brand: string;
  model: string;
  year: number;
  status: VehicleStatus;
  companyId?: string;
  companyName?: string;
  currentDriverId?: string;
  currentDriverName?: string;
  lastInspectionStatus?: InspectionStatus;
  reputationScore: number;
  soatExpiry?: string;
  qrHmac?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type QrData = {
  pngDataUrl: string;
  payload: { sig: string; plate: string };
};

// ─── helpers de estilo ────────────────────────────────────────────────────────
const vehicleStatusStyle = (s: VehicleStatus) => ({
  disponible:        { bg: APTOBG, color: APTO, border: APTOBD, label: "DISPONIBLE" },
  en_ruta:           { bg: INFOBG, color: INFO, border: INFOBD, label: "EN RUTA" },
  en_mantenimiento:  { bg: RIESGOBG, color: RIESGO, border: RIESGOBD, label: "MANTENIMIENTO" },
  fuera_de_servicio: { bg: NOBG, color: NO, border: NOBD, label: "FUERA DE SERVICIO" },
}[s]);

const inspectionStyle = (s?: InspectionStatus) => {
  if (s === "aprobada")  return { bg: APTOBG, color: APTO, border: APTOBD, label: "Aprobada" };
  if (s === "observada") return { bg: RIESGOBG, color: RIESGO, border: RIESGOBD, label: "Observada" };
  if (s === "rechazada") return { bg: NOBG, color: NO, border: NOBD, label: "Rechazada" };
  return { bg: INK1, color: INK5, border: INK2, label: "Pendiente" };
};

const scoreColor = (n: number) =>
  n >= 80 ? APTO : n >= 60 ? RIESGO : NO;

const TYPE_LABELS: Record<string, string> = {
  transporte_publico: "Transporte público",
  limpieza_residuos: "Limpieza",
  emergencia: "Emergencia",
  maquinaria: "Maquinaria",
  municipal_general: "Municipal",
};

// ─── sub-componentes ──────────────────────────────────────────────────────────
function StateBadge({ s }: { s: VehicleStatus }) {
  const st = vehicleStatusStyle(s);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
      {st.label}
    </span>
  );
}

function InspectionBadge({ s }: { s?: InspectionStatus }) {
  const st = inspectionStyle(s);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
      {st.label}
    </span>
  );
}

function Plate({ p }: { p: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 12px", borderRadius: 7, background: GBG, color: INK9, border: `1.5px solid ${GBR}`, fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "1rem", letterSpacing: "0.07em" }}>
      {p}
    </span>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "9px 0", borderBottom: `1px solid ${INK1}`, alignItems: "center" }}>
      <span style={{ color: INK5, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, width: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ color: INK9, fontWeight: 500, fontSize: "0.875rem" }}>{children}</span>
    </div>
  );
}

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];

// ─── página ───────────────────────────────────────────────────────────────────
interface Props { params: Promise<{ id: string }> }

export default function VehiculoDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [qr, setQr] = useState<QrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    void loadVehicle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function loadVehicle() {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/vehiculos/${id}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar el vehículo"); return; }
      setVehicle(data.data);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  async function loadQr() {
    setQrLoading(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/vehiculos/${id}/qr`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setQr(data.data);
    } catch {
      // silent
    } finally {
      setQrLoading(false);
    }
  }

  function downloadQr() {
    if (!qr || !vehicle) return;
    const a = document.createElement("a");
    a.href = qr.pngDataUrl;
    a.download = `QR_${vehicle.plate}.png`;
    a.click();
  }

  // ─── estados de carga / error ─────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader kicker="Vehículos" title="Vehículo no encontrado"
          action={<Link href="/vehiculos"><Button variant="outline" size="md"><ArrowLeft size={16} strokeWidth={1.8} />Volver</Button></Link>} />
        <Card><p style={{ color: INK5 }}>No existe un vehículo con el ID indicado.</p></Card>
      </div>
    );
  }

  if (loading || !vehicle) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader kicker="Vehículos" title="Cargando…" />
        <Card><p style={{ color: INK5 }}>Cargando datos del vehículo…</p></Card>
      </div>
    );
  }

  const sc = scoreColor(vehicle.reputationScore);
  const typeLabel = TYPE_LABELS[vehicle.vehicleTypeKey] ?? vehicle.vehicleTypeKey;

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <PageHeader
        kicker="Vehículos · Detalle"
        title={`${vehicle.brand} ${vehicle.model}`}
        subtitle={`${typeLabel} · ${vehicle.year} · ${vehicle.companyName ?? "Sin empresa asignada"}`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/vehiculos">
              <Button variant="outline" size="md">
                <ArrowLeft size={16} strokeWidth={1.8} />
                Volver
              </Button>
            </Link>
            <Link href={`/vehiculos/${id}/editar`}>
              <Button variant="primary" size="md">
                <Pencil size={15} strokeWidth={1.8} />
                Editar
              </Button>
            </Link>
          </div>
        }
      />

      {/* Badges de estado rápido */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Plate p={vehicle.plate} />
        <StateBadge s={vehicle.status} />
        {!vehicle.active && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", background: NOBG, color: NO, border: `1px solid ${NOBD}` }}>
            Inactivo
          </span>
        )}
      </div>

      {error && (
        <div role="alert" style={{ background: NOBG, border: `1.5px solid ${NOBD}`, borderRadius: 12, padding: 16, color: NO, fontSize: "0.9375rem", fontWeight: 500 }}>
          {error}
        </div>
      )}

      {/* Grid principal */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* ── Columna izquierda ───────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Info básica */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: INK1, color: INK6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Car size={18} />
              </div>
              <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, color: INK9, margin: 0 }}>
                Información del vehículo
              </h3>
            </div>
            <InfoRow label="Placa"><Plate p={vehicle.plate} /></InfoRow>
            <InfoRow label="Marca">{vehicle.brand}</InfoRow>
            <InfoRow label="Modelo">{vehicle.model}</InfoRow>
            <InfoRow label="Año">{vehicle.year}</InfoRow>
            <InfoRow label="Tipo">{typeLabel}</InfoRow>
            <InfoRow label="Empresa">{vehicle.companyName ?? "—"}</InfoRow>
            <InfoRow label="Estado"><StateBadge s={vehicle.status} /></InfoRow>
            {vehicle.soatExpiry && (
              <InfoRow label="SOAT vence">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <ShieldCheck size={14} color={APTO} />
                  {new Date(vehicle.soatExpiry).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </InfoRow>
            )}
          </Card>

          {/* Última inspección */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: inspectionStyle(vehicle.lastInspectionStatus).bg, color: inspectionStyle(vehicle.lastInspectionStatus).color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CalendarCheck size={18} />
              </div>
              <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, color: INK9, margin: 0 }}>
                Última inspección
              </h3>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
              <span style={{ color: INK6, fontSize: "0.875rem" }}>Resultado</span>
              <InspectionBadge s={vehicle.lastInspectionStatus} />
            </div>
          </Card>

          {/* Conductor actual */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: vehicle.currentDriverId ? GBG : INK1, color: vehicle.currentDriverId ? GD : INK5, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={18} />
              </div>
              <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, color: INK9, margin: 0 }}>
                Conductor asignado
              </h3>
            </div>
            {vehicle.currentDriverId ? (
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: GBG, color: GD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "1rem", flexShrink: 0 }}>
                  {vehicle.currentDriverName?.charAt(0).toUpperCase() ?? "?"}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: INK9 }}>{vehicle.currentDriverName}</div>
                  <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2, fontFamily: "ui-monospace,monospace" }}>
                    ID: {vehicle.currentDriverId}
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: INK5, fontSize: "0.875rem", margin: 0 }}>Sin conductor asignado</p>
            )}
          </Card>
        </div>

        {/* ── Columna derecha ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Score de reputación */}
          <Card>
            <p className="kicker" style={{ marginBottom: 14 }}>Score de reputación</p>
            <div style={{ padding: 20, background: INK1, borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <span style={{ fontSize: "0.875rem", color: INK6 }}>Puntuación</span>
                <span className="num" style={{ fontWeight: 800, fontSize: "1.75rem", color: sc }}>
                  {vehicle.reputationScore}
                  <span style={{ fontSize: "0.875rem", color: INK5, fontWeight: 500 }}>/100</span>
                </span>
              </div>
              <div style={{ height: 8, background: INK2, borderRadius: 999, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", borderRadius: 999, background: sc, width: `${vehicle.reputationScore}%`, transition: "width 0.5s ease" }} />
              </div>
              <div style={{ marginTop: 10, fontSize: "0.75rem", color: INK5 }}>
                {vehicle.reputationScore >= 80 ? "Vehículo con buena reputación operacional"
                  : vehicle.reputationScore >= 60 ? "Reputación moderada — revisar historial"
                  : "Reputación baja — requiere atención"}
              </div>
            </div>
          </Card>

          {/* QR */}
          <Card>
            <p className="kicker" style={{ marginBottom: 14 }}>QR firmado HMAC-SHA256</p>

            {!qr ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", padding: "28px 0" }}>
                <div style={{ width: 64, height: 64, borderRadius: 14, background: INK1, color: INK5, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <QrCode size={30} />
                </div>
                <p style={{ color: INK5, fontSize: "0.875rem", textAlign: "center", margin: 0 }}>
                  El QR se genera al momento de solicitarlo para garantizar la firma HMAC actualizada.
                </p>
                <Button variant="primary" size="md" loading={qrLoading} onClick={loadQr}>
                  <QrCode size={16} />
                  Generar QR
                </Button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                {/* imagen PNG real del servidor */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qr.pngDataUrl}
                  alt={`QR del vehículo ${vehicle.plate}`}
                  style={{ width: 200, height: 200, borderRadius: 12, border: `2px solid ${INK9}`, objectFit: "contain", background: "#fff" }}
                />
                <div style={{ textAlign: "center", fontSize: "0.75rem", color: INK5, fontFamily: "ui-monospace,monospace" }}>
                  sha256: {qr.payload.sig.slice(0, 14)}…
                </div>
                <div style={{ display: "flex", gap: 8, width: "100%" }}>
                  <Button variant="outline" size="sm" style={{ flex: 1 }} onClick={downloadQr}>
                    <Download size={14} />
                    Descargar PNG
                  </Button>
                  <Button variant="ghost" size="sm" style={{ flex: 1 }} loading={qrLoading} onClick={loadQr}>
                    Re-emitir QR
                  </Button>
                </div>
              </div>
            )}

            {vehicle.qrHmac && !qr && (
              <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: GBG, border: `1px solid ${GBR}`, fontSize: "0.75rem", color: GD, fontFamily: "ui-monospace,monospace" }}>
                Último HMAC: {vehicle.qrHmac.slice(0, 16)}…
              </div>
            )}
          </Card>

          {/* Metadatos */}
          {(vehicle.createdAt ?? vehicle.updatedAt) && (
            <Card>
              <p className="kicker" style={{ marginBottom: 12 }}>Registro</p>
              {vehicle.createdAt && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", padding: "6px 0", borderBottom: `1px solid ${INK1}` }}>
                  <span style={{ color: INK6 }}>Creado</span>
                  <strong>{new Date(vehicle.createdAt).toLocaleString("es-PE")}</strong>
                </div>
              )}
              {vehicle.updatedAt && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", padding: "6px 0" }}>
                  <span style={{ color: INK6 }}>Actualizado</span>
                  <strong>{new Date(vehicle.updatedAt).toLocaleString("es-PE")}</strong>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
