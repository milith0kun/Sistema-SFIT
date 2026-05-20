"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, X, ExternalLink, ShieldAlert, Camera,
  Flag, FileText, User as UserIcon, Hash, Car, Eye, BarChart3,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MetaRow } from "@/components/ui/MetaRow";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { INK1, INK2, INK3, INK5, INK6, INK9, RED, REDBG, REDBD, GRN, GRNBG, GRNBD, AMBER, AMBER_BG, AMBER_BD, INFO, INFO_BG, INFO_BD } from "@/lib/design-tokens";

import { hasWebPermission } from "@/lib/auth/roleMatrix";
import type { Role } from "@/lib/constants";
/* ── Tipos ── */
type ReportStatus = "pendiente" | "revision" | "validado" | "rechazado";
type FraudLayer = { layer: string; passed: boolean; detail: string };

type CitizenReport = {
  id: string;
  vehicle?: { _id: string; plate: string } | null;
  citizen?: { _id: string; name: string } | null;
  municipalityId: string;
  category: string;
  vehicleTypeKey?: string;
  citizenReputationLevel: number;
  status: ReportStatus;
  description: string;
  evidenceUrl?: string;
  imageUrls?: string[];
  fraudScore: number;
  fraudLayers: FraudLayer[];
  rejectionReason?: string;
  assignedFiscalId?: string;
  assignedFiscal?: { _id: string; name: string } | null;
  appealReason?: string | null;
  appealEvidence?: string[];
  appealedAt?: string | null;
  createdAt: string;
};

type FiscalItem = { id: string; name: string };

const STATUS_META: Record<ReportStatus, { label: string; color: string; bg: string; bd: string }> = {
  pendiente: { label: "Pendiente",   color: INK5, bg: INK1,  bd: INK2  },
  revision:  { label: "En revisión", color: AMBER,  bg: AMBER_BG, bd: AMBER_BD },
  validado:  { label: "Validado",    color: GRN,  bg: GRNBG, bd: GRNBD },
  rechazado: { label: "Rechazado",   color: RED,  bg: REDBG, bd: REDBD },
};
// Los 4 admins jerárquicos validan/cierran reportes ciudadanos desde web;
// fiscal lo hace desde la app móvil.
const CAN_ACT = ["super_admin", "admin_municipal"];

const LABEL_S: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase", color: INK5, marginBottom: 6,
};
const FIELD: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 12px", borderRadius: 8,
  border: `1px solid ${INK2}`, fontSize: "0.875rem",
  color: INK9, fontFamily: "inherit", outline: "none",
  background: "#fff", boxSizing: "border-box",
};
const BTN_PRIMARY: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  height: 32, padding: "0 14px", borderRadius: 7,
  border: "none", background: INK9, color: "#fff",
  fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
  fontFamily: "inherit",
};

/* ── Helpers ── */
function fraudColor(score: number) {
  if (score < 40) return GRN;
  if (score <= 70) return AMBER;
  return RED;
}
function fraudLabel(score: number) {
  if (score < 40) return "Bajo";
  if (score <= 70) return "Medio";
  return "Alto";
}
function isImageUrl(url: string) {
  // Soporta tanto URLs con extensión (.jpg, .png, .webp...) como las del
  // endpoint /api/uploads/files/<id> (sin extensión, siempre sirven imagen).
  return (
    /\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(url) ||
    /\/api\/uploads\/files\//i.test(url)
  );
}
interface Props { params: Promise<{ id: string }> }

export default function ReporteDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();

  const [report,   setReport]   = useState<CitizenReport | null>(null);
  const [fiscales, setFiscales] = useState<FiscalItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [userRole, setUserRole] = useState("");

  const [newStatus,     setNewStatus]     = useState<ReportStatus | "">("");
  const [fiscalId,      setFiscalId]      = useState("");
  const [updating,      setUpdating]      = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!hasWebPermission(u.role as Role, "reportes", "view")) { router.replace("/dashboard"); return; }
    setUserRole(u.role);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const h = { Authorization: `Bearer ${token ?? ""}` };
      const [rRes, fRes] = await Promise.all([
        fetch(`/api/reportes/${id}`, { headers: h }),
        fetch("/api/conductores?limit=100", { headers: h }),
      ]);
      if (rRes.status === 401) { router.replace("/login"); return; }
      if (rRes.status === 404) { setNotFound(true); return; }
      const data = await rRes.json();
      if (!rRes.ok || !data.success) { setError(data.error ?? "Error al cargar reporte."); return; }
      const r: CitizenReport = data.data;
      setReport(r);
      setNewStatus(r.status);
      setFiscalId(r.assignedFiscal?._id ?? r.assignedFiscalId ?? "");

      if (fRes.ok) {
        const fData = await fRes.json();
        if (fData.success && Array.isArray(fData.data?.items)) {
          setFiscales(fData.data.items);
        }
      }
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  async function handleUpdate() {
    setUpdating(true); setError(null); setUpdateSuccess(false);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const payload: Record<string, unknown> = {};
      if (newStatus) payload.status = newStatus;
      if (fiscalId)  payload.assignedFiscalId = fiscalId;

      const res = await fetch(`/api/reportes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al actualizar."); return; }
      setUpdateSuccess(true);
      void load();
    } catch { setError("Error de conexión."); }
    finally { setUpdating(false); }
  }

  async function handleQuickStatus(status: ReportStatus) {
    setUpdating(true); setError(null); setUpdateSuccess(false);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/reportes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al actualizar."); return; }
      setUpdateSuccess(true);
      void load();
    } catch { setError("Error de conexión."); }
    finally { setUpdating(false); }
  }

  const canAct = CAN_ACT.includes(userRole);

  const backBtn = (
    <Link href="/reportes">
      <button style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 36, padding: "0 14px", borderRadius: 9,
        border: `1.5px solid ${INK2}`, background: "#fff",
        color: INK6, fontSize: "0.875rem", fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit",
      }}>
        <ArrowLeft size={15} />Volver
      </button>
    </Link>
  );

  if (loading) {
    return (
      <div className="animate-fade-in flex flex-col gap-4">
        <PageHeader kicker="Ciudadanía · RF-12" title="Cargando reporte…" action={backBtn} />
        <div className="sfit-aside-layout">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[140, 180, 220].map((h, i) => (
              <div key={i} style={{ height: h, borderRadius: 10, background: "#fff", border: `1px solid ${INK2}`, overflow: "hidden", position: "relative" }}>
                <div className="skeleton-shimmer" style={{ position: "absolute", inset: 0 }} />
              </div>
            ))}
          </div>
          <div style={{ height: 280, borderRadius: 10, background: "#fff", border: `1px solid ${INK2}`, overflow: "hidden", position: "relative" }}>
            <div className="skeleton-shimmer" style={{ position: "absolute", inset: 0 }} />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="animate-fade-in flex flex-col gap-4">
        <PageHeader kicker="Ciudadanía · RF-12" title="Reporte no encontrado" action={backBtn} />
        <div role="alert" style={{ background: REDBG, border: `1.5px solid ${REDBD}`, borderRadius: 10, padding: 14, color: RED, fontSize: "0.875rem", fontWeight: 500 }}>
          El reporte ciudadano solicitado no existe o ya no está disponible.
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="animate-fade-in flex flex-col gap-4">
        <PageHeader kicker="Ciudadanía · RF-12" title="Error" action={backBtn} />
        <div role="alert" style={{ background: REDBG, border: `1.5px solid ${REDBD}`, borderRadius: 10, padding: 14, color: RED, fontSize: "0.875rem", fontWeight: 500 }}>
          {error}
        </div>
      </div>
    );
  }
  if (!report) return null;

  const fColor = fraudColor(report.fraudScore);
  const vehicleId = report.vehicle?._id ?? "";
  const reportMeta = STATUS_META[report.status];

  return (
    <div className="animate-fade-in flex flex-col gap-4" style={{ color: INK9 }}>
      <PageHeader
        kicker={`Reporte · RC-${report.id.slice(-6).toUpperCase()}`}
        title={report.category}
        subtitle={`Ciudadano nivel ${report.citizenReputationLevel} · ${fmtDate(report.createdAt)}`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            {/* Las sanciones se emiten desde la app móvil del fiscal; el CTA
                "Generar sanción" se retiró de la web. */}
            {backBtn}
          </div>
        }
      />

      {error && (
        <div style={{ padding: "11px 16px", background: REDBG, border: `1.5px solid ${REDBD}`, borderRadius: 10, color: RED, fontSize: "0.875rem", fontWeight: 500 }}>
          {error}
        </div>
      )}
      {updateSuccess && (
        <div style={{ padding: "11px 16px", background: GRNBG, border: `1.5px solid ${GRNBD}`, borderRadius: 10, color: GRN, fontSize: "0.875rem", fontWeight: 600 }}>
          Reporte actualizado correctamente.
        </div>
      )}

      <div className="sfit-aside-layout">
        {/* ─── Columna principal ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Información del reporte */}
          <SectionCard
            icon={<Flag size={14} color={INK6} />}
            title="Información del reporte"
            subtitle="Datos principales y contexto"
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ padding: 12, background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                <div style={LABEL_S}>Vehículo (placa)</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: INK9 }}>
                  {report.vehicle?.plate ? (
                    <span style={{ fontFamily: "ui-monospace,monospace", background: INK9, color: "#fff", padding: "2px 8px", borderRadius: 5, fontSize: "0.75rem" }}>
                      {report.vehicle.plate}
                    </span>
                  ) : <span style={{ color: INK5, fontWeight: 400 }}>No especificado</span>}
                </div>
              </div>
              <div style={{ padding: 12, background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                <div style={LABEL_S}>Categoría</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9 }}>{report.category}</div>
              </div>
              <div style={{ padding: 12, background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                <div style={LABEL_S}>Tipo vehículo</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9 }}>{report.vehicleTypeKey ?? "—"}</div>
              </div>
              <div style={{ padding: 12, background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                <div style={LABEL_S}>Fiscal asignado</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9 }}>
                  {report.assignedFiscal?.name ?? <span style={{ color: INK5, fontWeight: 400 }}>Sin asignar</span>}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Descripción */}
          <SectionCard
            icon={<FileText size={14} color={INK6} />}
            title="Descripción del ciudadano"
            subtitle="Texto enviado al reportar"
          >
            <p style={{ margin: 0, color: INK6, fontSize: "0.9375rem", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
              &ldquo;{report.description}&rdquo;
            </p>
          </SectionCard>

          {/* Motivo del rechazo (visible para fiscal y ciudadano) */}
          {report.status === "rechazado" && report.rejectionReason && (
            <SectionCard
              icon={<FileText size={14} color={RED} />}
              title="Motivo del rechazo"
              subtitle="Justificación del fiscal"
            >
              <div style={{
                padding: 12, background: REDBG, border: `1px solid ${REDBD}`,
                borderRadius: 8, color: INK6, fontSize: "0.9375rem", lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}>
                {report.rejectionReason}
              </div>
            </SectionCard>
          )}

          {/* Evidencia */}
          {(() => {
            const imgs: string[] = report.imageUrls && report.imageUrls.length > 0
              ? report.imageUrls
              : (report.evidenceUrl ? [report.evidenceUrl] : []);
            const hasEvidence = imgs.length > 0;
            return (
              <SectionCard
                icon={<Camera size={14} color={INK6} />}
                title="Evidencia"
                subtitle={hasEvidence
                  ? `${imgs.length} archivo${imgs.length !== 1 ? "s" : ""} adjuntado${imgs.length !== 1 ? "s" : ""} por el ciudadano`
                  : "Sin evidencia"}
              >
                {!hasEvidence ? (
                  <div style={{ padding: "28px 0", textAlign: "center", color: INK5, fontSize: "0.8125rem" }}>
                    <Camera size={24} style={{ margin: "0 auto 8px", display: "block", color: INK5 }} />
                    Sin evidencia adjunta
                  </div>
                ) : (
                  <div>
                    {/* Imagen principal */}
                    {isImageUrl(imgs[0]) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={imgs[0]}
                        alt="Evidencia del reporte"
                        style={{ width: "100%", maxHeight: 360, objectFit: "contain", borderRadius: 8, border: `1px solid ${INK2}`, background: INK1 }}
                      />
                    ) : (
                      <a href={imgs[0]} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: "flex", aspectRatio: "16/9", borderRadius: 8,
                          background: INK1, border: `1px solid ${INK2}`,
                          alignItems: "center", justifyContent: "center", color: INK6,
                          flexDirection: "column", gap: 8, textDecoration: "none",
                        }}>
                        <Camera size={28} />
                        <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>Ver evidencia adjunta</div>
                      </a>
                    )}
                    {/* Galería de fotos adicionales */}
                    {imgs.length > 1 && (
                      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                        {imgs.slice(1).map((u, i) => (
                          <a key={i} href={u} target="_blank" rel="noopener noreferrer"
                            style={{ width: 72, height: 72, borderRadius: 7, overflow: "hidden", border: `1px solid ${INK2}`, flexShrink: 0 }}>
                            {isImageUrl(u) ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={u} alt={`Foto ${i + 2}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: INK1 }}>
                                <Camera size={20} color={INK6} />
                              </div>
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                    <a href={imgs[0]} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, color: INK9, fontSize: "0.8125rem", fontWeight: 500, textDecoration: "underline" }}>
                      <ExternalLink size={12} />Abrir original
                    </a>
                  </div>
                )}
              </SectionCard>
            );
          })()}

          {/* Apelación del ciudadano — sólo si la presentó */}
          {report.appealReason && (
            <SectionCard
              icon={<ShieldAlert size={14} color={AMBER} />}
              title="Apelación del ciudadano"
              subtitle={
                report.appealedAt
                  ? `Presentada el ${fmtDate(report.appealedAt)}`
                  : "Presentada por el ciudadano"
              }
            >
              <div style={{
                padding: "12px 14px", borderRadius: 9,
                background: AMBER_BG, border: `1px solid ${AMBER_BD}`,
                color: "#92400E", fontSize: "0.875rem", lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}>
                {report.appealReason}
              </div>

              {report.appealEvidence && report.appealEvidence.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ ...LABEL_S, marginBottom: 8 }}>Evidencia adjunta</div>
                  <div style={{
                    display: "grid", gap: 8,
                    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  }}>
                    {report.appealEvidence.map((url, i) => {
                      const img = isImageUrl(url);
                      return img ? (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          style={{
                            display: "block", border: `1px solid ${INK2}`, borderRadius: 8,
                            overflow: "hidden", aspectRatio: "1/1", background: INK1,
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Evidencia ${i + 1}`}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </a>
                      ) : (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            padding: 14, border: `1px solid ${INK2}`, borderRadius: 8,
                            background: "#fff", color: INK9, textDecoration: "none",
                            aspectRatio: "1/1", gap: 6,
                          }}
                        >
                          <FileText size={20} strokeWidth={1.6} />
                          <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>Archivo {i + 1}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* Score de fraude (sobrio) */}
          <SectionCard
            icon={<BarChart3 size={14} color={INK6} />}
            title="Puntuación de fraude"
            subtitle={`Riesgo ${fraudLabel(report.fraudScore)}`}
            action={
              <span style={{ fontSize: "1rem", fontWeight: 800, color: INK9, fontVariantNumeric: "tabular-nums" }}>
                {report.fraudScore}<span style={{ fontSize: "0.75rem", color: INK5, fontWeight: 400 }}>/100</span>
              </span>
            }
          >
            <div style={{ height: 6, background: INK1, border: `1px solid ${INK2}`, borderRadius: 999, overflow: "hidden", marginBottom: 14 }}>
              <div style={{ height: "100%", width: `${report.fraudScore}%`, background: fColor, borderRadius: 999, transition: "width 0.4s ease" }} />
            </div>

            {report.fraudLayers.length > 0 && (
              <>
                <div style={{ ...LABEL_S, marginBottom: 8 }}>Capas anti-fraude</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {report.fraudLayers.map((l, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 8,
                      background: "#fff", border: `1px solid ${INK2}`,
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 6,
                        background: INK1, border: `1px solid ${INK2}`,
                        color: l.passed ? GRN : RED,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        {l.passed ? <Check size={13} /> : <X size={13} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: INK9, fontSize: "0.8125rem" }}>{l.layer}</div>
                        <div style={{ fontSize: "0.75rem", color: INK6, marginTop: 1 }}>{l.detail}</div>
                      </div>
                      <span style={{
                        fontSize: "0.625rem", fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                        background: "#fff",
                        color: l.passed ? GRN : RED,
                        border: `1px solid ${INK2}`,
                        textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0,
                      }}>
                        {l.passed ? "Pasó" : "Falló"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SectionCard>

          {/* Acciones del fiscal */}
          {canAct && (
            <SectionCard
              icon={<Eye size={14} color={INK6} />}
              title="Resolver reporte"
              subtitle="Cambiar estado y asignar fiscal"
              action={
                <button
                  onClick={handleUpdate}
                  disabled={updating}
                  style={{
                    ...BTN_PRIMARY, height: 28, padding: "0 12px", fontSize: "0.75rem",
                    opacity: updating ? 0.6 : 1, cursor: updating ? "not-allowed" : "pointer",
                  }}
                >
                  {updating ? "Guardando…" : "Guardar"}
                </button>
              }
            >
              {(report.status === "pendiente" || report.status === "revision") && (
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button
                    disabled={updating}
                    onClick={() => void handleQuickStatus("rechazado")}
                    style={{
                      flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                      height: 36, padding: "0 12px", borderRadius: 8,
                      border: `1px solid ${INK2}`, background: "#fff", color: INK6,
                      fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                      fontFamily: "inherit", opacity: updating ? 0.6 : 1,
                    }}
                  >
                    <X size={14} color={RED} />Rechazar
                  </button>
                  <button
                    disabled={updating}
                    onClick={() => void handleQuickStatus("validado")}
                    style={{
                      flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                      height: 36, padding: "0 12px", borderRadius: 8,
                      border: "none", background: INK9, color: "#fff",
                      fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                      fontFamily: "inherit", opacity: updating ? 0.6 : 1,
                    }}
                  >
                    <Check size={14} />Validar (+20 coins)
                  </button>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={LABEL_S}>Cambiar estado</label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value as ReportStatus)}
                    style={{ ...FIELD, paddingRight: 36, appearance: "auto" }}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="revision">En revisión</option>
                    <option value="validado">Validado</option>
                    <option value="rechazado">Rechazado</option>
                  </select>
                </div>
                <div>
                  <label style={LABEL_S}>Asignar fiscal <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(opcional)</span></label>
                  {fiscales.length > 0 ? (
                    <select
                      value={fiscalId}
                      onChange={e => setFiscalId(e.target.value)}
                      style={{ ...FIELD, paddingRight: 36, appearance: "auto" }}
                    >
                      <option value="">— Sin asignar —</option>
                      {fiscales.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  ) : (
                    <input
                      value={fiscalId}
                      onChange={e => setFiscalId(e.target.value)}
                      placeholder="ID del fiscal"
                      style={FIELD}
                    />
                  )}
                </div>
              </div>
            </SectionCard>
          )}
        </div>

        {/* ─── Sidebar derecha ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Tarjeta de identidad (sobria) */}
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "20px 16px 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 12,
                background: INK1, border: `1px solid ${INK2}`,
                color: INK6,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Flag size={28} strokeWidth={1.8} />
              </div>
              <div style={{ minWidth: 0, width: "100%" }}>
                <div style={{ fontFamily: "ui-monospace,monospace", fontWeight: 800, fontSize: "0.9375rem", color: INK9 }}>
                  RC-{report.id.slice(-6).toUpperCase()}
                </div>
                <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2 }}>
                  Reporte ciudadano
                </div>
                <div style={{ marginTop: 8 }}>
                  <StatusBadge status={report.status} statusMap={STATUS_META} />
                </div>
              </div>
            </div>
            <div>
              <MetaRow label="Vehículo" value={
                report.vehicle?.plate ? (
                  <span style={{ fontFamily: "ui-monospace,monospace", background: INK9, color: "#fff", padding: "2px 8px", borderRadius: 5, fontWeight: 700, fontSize: "0.75rem" }}>
                    {report.vehicle.plate}
                  </span>
                ) : <span style={{ color: INK5 }}>—</span>
              } />
              <MetaRow label="Categoría" value={report.category} />
              <MetaRow label="Score fraude" value={
                <span style={{ color: fColor, fontWeight: 800 }}>{report.fraudScore}/100</span>
              } />
              <MetaRow label="Reportado" value={fmtDate(report.createdAt)} />
            </div>
          </div>

          {/* Reputación del ciudadano */}
          <SectionCard
            icon={<UserIcon size={14} color={INK6} />}
            title="Reputación del ciudadano"
            subtitle={`Nivel ${report.citizenReputationLevel} de 5`}
          >
            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
              {[1, 2, 3, 4, 5].map(n => (
                <div key={n} style={{
                  width: 32, height: 32, borderRadius: 7,
                  background: n <= report.citizenReputationLevel ? INK9 : "#fff",
                  border: `1px solid ${n <= report.citizenReputationLevel ? INK9 : INK2}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.75rem", fontWeight: 800,
                  color: n <= report.citizenReputationLevel ? "#fff" : INK5,
                }}>
                  {n}
                </div>
              ))}
            </div>
            {report.citizen?.name && (
              <div style={{ textAlign: "center", marginTop: 10, fontSize: "0.8125rem", fontWeight: 600, color: INK9 }}>
                {report.citizen.name}
              </div>
            )}
          </SectionCard>

          {/* Información del registro */}
          <SectionCard
            icon={<Hash size={14} color={INK6} />}
            title="Información del registro"
            subtitle="Trazabilidad"
          >
            <div>
              <div style={LABEL_S}>ID interno</div>
              <code style={{
                display: "block", padding: "6px 10px", background: INK1,
                border: `1px solid ${INK2}`, borderRadius: 6,
                fontSize: "0.75rem", color: INK9,
                fontFamily: "ui-monospace,monospace",
                wordBreak: "break-all",
              }}>
                {report.id}
              </code>
            </div>
          </SectionCard>

          {/* Link al vehículo */}
          {vehicleId && (
            <Link href={`/vehiculos/${vehicleId}`}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 9,
                border: `1px solid ${INK2}`, background: "#fff",
                color: INK6, fontSize: "0.8125rem", fontWeight: 600,
                textDecoration: "none",
              }}>
              <Car size={14} />Ver vehículo {report.vehicle?.plate ?? ""} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
