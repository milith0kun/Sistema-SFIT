"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, X, ExternalLink, ShieldAlert, Camera } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";

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
  fraudScore: number;
  fraudLayers: FraudLayer[];
  assignedFiscal?: { _id: string; name: string } | null;
  createdAt: string;
};

type FiscalItem = { id: string; name: string };

// Color tokens
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const FRAUD_BAJO  = "#15803d";
const FRAUD_MEDIO = "#b45309";
const FRAUD_ALTO  = "#DC2626";

const STATUS_STYLE: Record<ReportStatus, { bg: string; color: string; border: string; label: string }> = {
  pendiente: { bg: "#f4f4f5", color: "#71717a", border: "#e4e4e7", label: "Pendiente" },
  revision:  { bg: "#FFFBEB", color: "#b45309", border: "#FCD34D", label: "En revisión" },
  validado:  { bg: "#F0FDF4", color: "#15803d", border: "#86EFAC", label: "Validado" },
  rechazado: { bg: "#FFF5F5", color: "#DC2626", border: "#FCA5A5", label: "Rechazado" },
};

const ALLOWED = ["fiscal", "admin_municipal", "admin_provincial", "super_admin"];
const CAN_ACT  = ["fiscal", "admin_municipal", "super_admin"];

interface Props { params: Promise<{ id: string }> }

function fraudColor(score: number) {
  if (score < 40)  return FRAUD_BAJO;
  if (score <= 70) return FRAUD_MEDIO;
  return FRAUD_ALTO;
}

function fraudLabel(score: number) {
  if (score < 40)  return "Bajo";
  if (score <= 70) return "Medio";
  return "Alto";
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(url);
}

export default function ReporteDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();

  const [report,   setReport]   = useState<CitizenReport | null>(null);
  const [fiscales, setFiscales] = useState<FiscalItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [userRole, setUserRole] = useState("");

  // Action state
  const [newStatus,      setNewStatus]      = useState<ReportStatus | "">("");
  const [fiscalId,       setFiscalId]       = useState("");
  const [updating,       setUpdating]       = useState(false);
  const [updateSuccess,  setUpdateSuccess]  = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
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
        fetch("/api/conductores?limit=100", { headers: h }), // reuse conductor endpoint or use /api/usuarios?role=fiscal if available
      ]);
      if (rRes.status === 401) { router.replace("/login"); return; }
      if (rRes.status === 404) { setNotFound(true); return; }
      const data = await rRes.json();
      if (!rRes.ok || !data.success) { setError(data.error ?? "Error al cargar reporte."); return; }
      const r: CitizenReport = data.data;
      setReport(r);
      setNewStatus(r.status);
      setFiscalId(r.assignedFiscal?._id ?? "");

      // Try to get fiscales list (best-effort)
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

  async function handleUpdateStatus(status: ReportStatus) {
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

  if (loading) {
    return (
      <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <PageHeader kicker="Reportes" title="Cargando reporte…" />
        <LoadingState rows={5} />
      </div>
    );
  }
  if (notFound) return (
    <ErrorState
      title="Reporte no encontrado"
      message="El reporte ciudadano solicitado no existe o ya no está disponible. Verifique el enlace o regrese al listado."
      action={<Link href="/reportes"><Button variant="primary" size="sm">Volver a Reportes</Button></Link>}
    />
  );
  if (error && !report) return (
    <div style={{ padding: "12px 16px", background: "#FFF5F5", border: "1px solid #FCA5A5", borderRadius: 10, color: "#DC2626" }}>{error}</div>
  );
  if (!report) return null;

  const st = STATUS_STYLE[report.status];
  const fColor = fraudColor(report.fraudScore);
  const vehicleId = report.vehicle?._id ?? "";

  return (
    <div className="space-y-8 animate-fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/reportes" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: INK5, textDecoration: "none", fontSize: "0.875rem" }}>
          <ArrowLeft size={16} /> Reportes ciudadanos
        </Link>
      </div>

      <PageHeader
        kicker={`Reporte · RC-${report.id.slice(-6).toUpperCase()}`}
        title={report.category}
        subtitle={`Ciudadano nivel ${report.citizenReputationLevel} de reputación · ${new Date(report.createdAt).toLocaleDateString("es-PE", { dateStyle: "long" })}`}
        action={
          vehicleId ? (
            <Link href={`/sanciones/nueva?vehicleId=${vehicleId}&reportId=${id}`}>
              <Button variant="danger" size="md">
                <ShieldAlert size={16} />
                Generar sanción
              </Button>
            </Link>
          ) : undefined
        }
      />

      {error && (
        <div role="alert" style={{ background: "#FFF5F5", border: "1.5px solid #FCA5A5", borderRadius: 12, padding: 16, color: "#DC2626", fontSize: "0.9375rem", fontWeight: 500 }}>
          {error}
        </div>
      )}
      {updateSuccess && (
        <div style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 12, padding: 16, color: "#15803d", fontSize: "0.9375rem", fontWeight: 500 }}>
          Reporte actualizado correctamente.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Left column */}
        <div className="space-y-6">
          {/* Info summary */}
          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>Información del reporte</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { label: "Vehículo (placa)", value: report.vehicle?.plate ?? "No especificado" },
                { label: "Categoría",        value: report.category },
                { label: "Tipo vehículo",    value: report.vehicleTypeKey ?? "—" },
                { label: "Fiscal asignado",  value: report.assignedFiscal?.name ?? "Sin asignar" },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: 14, background: INK1, borderRadius: 10 }}>
                  <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: INK5, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 600, color: INK9 }}>{value}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Description */}
          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 12 }}>Descripción</h3>
            <p style={{ color: INK6, fontSize: "0.9375rem", lineHeight: 1.65, margin: 0 }}>
              &ldquo;{report.description}&rdquo;
            </p>
          </Card>

          {/* Evidence */}
          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>Evidencia</h3>
            {report.evidenceUrl ? (
              <div>
                {isImageUrl(report.evidenceUrl) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={report.evidenceUrl}
                    alt="Evidencia del reporte"
                    style={{ width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 10, border: `1px solid ${INK2}`, background: INK1 }}
                  />
                ) : (
                  <div style={{ aspectRatio: "16/9", borderRadius: 10, background: "repeating-linear-gradient(135deg,#E8EEF5 0 10px,#DCE5EF 10px 20px)", border: `1px solid ${INK2}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: INK5 }}>
                    <Camera size={28} />
                    <div style={{ fontSize: "0.75rem", fontFamily: "ui-monospace,monospace" }}>evidencia_RC-{report.id.slice(-6).toUpperCase()}</div>
                  </div>
                )}
                <a
                  href={report.evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, color: "#1e40af", fontSize: "0.875rem", fontWeight: 500, textDecoration: "none" }}
                >
                  <ExternalLink size={14} /> Ver evidencia original
                </a>
              </div>
            ) : (
              <div style={{ padding: "28px 0", textAlign: "center", color: INK5, fontSize: "0.875rem" }}>
                <Camera size={24} style={{ margin: "0 auto 8px", display: "block" }} />
                Sin evidencia adjunta
              </div>
            )}
          </Card>

          {/* Fraud score */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, margin: 0 }}>Puntuación de fraude</h3>
              <span style={{ fontSize: "1.5rem", fontWeight: 800, color: fColor, fontVariantNumeric: "tabular-nums" }}>
                {report.fraudScore}<span style={{ fontSize: "0.875rem", color: INK5, fontWeight: 400 }}>/100</span>
              </span>
            </div>

            {/* Bar */}
            <div style={{ height: 10, background: INK1, borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${report.fraudScore}%`, background: fColor, borderRadius: 999, transition: "width 0.4s ease" }} />
            </div>
            <p style={{ fontSize: "0.8125rem", color: fColor, fontWeight: 600, marginBottom: 20 }}>
              Riesgo {fraudLabel(report.fraudScore)}
            </p>

            {/* Fraud layers table */}
            {report.fraudLayers.length > 0 && (
              <>
                <p className="kicker" style={{ marginBottom: 10 }}>Capas anti-fraude</p>
                <div style={{ border: `1px solid ${INK2}`, borderRadius: 10, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                    <thead>
                      <tr style={{ background: "#FAFAFA" }}>
                        {["Capa", "Resultado", "Detalle"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, borderBottom: `1px solid ${INK2}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.fraudLayers.map((l, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                          <td style={{ padding: "10px 14px", borderBottom: `1px solid ${INK1}`, fontWeight: 600, color: INK9 }}>{l.layer}</td>
                          <td style={{ padding: "10px 14px", borderBottom: `1px solid ${INK1}` }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, background: l.passed ? "#F0FDF4" : "#FFF5F5", color: l.passed ? "#15803d" : "#DC2626", border: `1px solid ${l.passed ? "#86EFAC" : "#FCA5A5"}` }}>
                              {l.passed ? <Check size={10} /> : <X size={10} />}
                              {l.passed ? "Pasó" : "Falló"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px", borderBottom: `1px solid ${INK1}`, color: INK6 }}>{l.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Status badge */}
          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>Estado del reporte</h3>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: st.bg, border: `1.5px solid ${st.border}`, marginBottom: canAct ? 20 : 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.color }} />
              <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: st.color }}>{st.label}</span>
            </div>

            {/* Quick actions for actionable statuses */}
            {canAct && (report.status === "pendiente" || report.status === "revision") && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button
                  disabled={updating}
                  onClick={() => { setNewStatus("rechazado"); void handleUpdateStatus("rechazado"); }}
                  style={{
                    flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                    height: 36, padding: "0 12px", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600,
                    cursor: "pointer", border: "1.5px solid #FCA5A5", background: "#FFF5F5", color: "#DC2626",
                    fontFamily: "inherit", opacity: updating ? 0.6 : 1,
                  }}
                >
                  <X size={14} /> Rechazar
                </button>
                <button
                  disabled={updating}
                  onClick={() => { setNewStatus("validado"); void handleUpdateStatus("validado"); }}
                  style={{
                    flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                    height: 36, padding: "0 12px", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600,
                    cursor: "pointer", border: "none", background: "#15803d", color: "#fff",
                    fontFamily: "inherit", opacity: updating ? 0.6 : 1,
                  }}
                >
                  <Check size={14} /> Validar reporte (+20 coins)
                </button>
              </div>
            )}

            {/* Action panel — full form for advanced updates */}
            {canAct && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: "0.875rem", fontWeight: 500 }}>Cambiar estado</label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value as ReportStatus)}
                    className="field"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="revision">En revisión</option>
                    <option value="validado">Validado</option>
                    <option value="rechazado">Rechazado</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="fiscalId" style={{ display: "block", marginBottom: 8, fontSize: "0.875rem", fontWeight: 500 }}>
                    Asignar fiscal <span style={{ color: INK5, fontSize: "0.8125rem", fontWeight: 400 }}>(opcional)</span>
                  </label>
                  {fiscales.length > 0 ? (
                    <select
                      id="fiscalId"
                      value={fiscalId}
                      onChange={e => setFiscalId(e.target.value)}
                      className="field"
                    >
                      <option value="">— Sin asignar —</option>
                      {fiscales.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="fiscalId"
                      type="text"
                      value={fiscalId}
                      onChange={e => setFiscalId(e.target.value)}
                      className="field"
                      placeholder="ID del fiscal"
                    />
                  )}
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleUpdate}
                  loading={updating}
                  style={{ width: "100%" }}
                >
                  Guardar cambios
                </Button>
              </div>
            )}
          </Card>

          {/* Citizen reputation */}
          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>Reputación del ciudadano</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <div
                    key={n}
                    style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: n <= report.citizenReputationLevel ? "#6C0606" : INK1,
                      border: `1.5px solid ${n <= report.citizenReputationLevel ? "#4A0303" : INK2}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.6875rem", fontWeight: 800,
                      color: n <= report.citizenReputationLevel ? "#fff" : INK5,
                    }}
                  >
                    {n}
                  </div>
                ))}
              </div>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: INK6 }}>Nivel {report.citizenReputationLevel}</span>
            </div>
          </Card>

          {/* Generate sanction CTA */}
          {vehicleId && (
            <Card style={{ background: "#FFF5F5", border: "1.5px solid #FCA5A5" }}>
              <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 8, color: "#DC2626" }}>Acción disciplinaria</h3>
              <p style={{ fontSize: "0.8125rem", color: "#DC2626", marginBottom: 14, lineHeight: 1.5 }}>
                Si el reporte es válido, puedes generar una sanción formal al vehículo infractor.
              </p>
              <Link href={`/sanciones/nueva?vehicleId=${vehicleId}&reportId=${id}`} style={{ display: "block" }}>
                <Button variant="danger" size="sm" style={{ width: "100%" }}>
                  <ShieldAlert size={14} />
                  Generar sanción
                </Button>
              </Link>
            </Card>
          )}

          {/* Report ID */}
          <Card>
            <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 12 }}>Identificador</h3>
            <div style={{ padding: "10px 12px", background: INK1, borderRadius: 8, fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", fontWeight: 700, color: INK6, wordBreak: "break-all" }}>
              {report.id}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
