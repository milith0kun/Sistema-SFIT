"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Gavel, Mail, Phone, Bell, FileText,
  Car, User as UserIcon, Building2, Hash, CheckCircle, XCircle, Ban,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

/* ── Tipos ── */
type SanctionStatus = "emitida" | "notificada" | "apelada" | "confirmada" | "anulada";
type Notification = { channel: string; target: string; status: string; sentAt?: string };

type Sanction = {
  id: string;
  vehicle: { _id: string; plate: string };
  driver?: { _id: string; name: string };
  company?: { _id: string; razonSocial: string };
  inspectionId?: string;
  reportId?: string;
  faultType: string;
  amountSoles: number;
  amountUIT: string;
  status: SanctionStatus;
  notifications: Notification[];
  appealNotes?: string;
  resolvedAt?: string;
  createdAt: string;
};

/* ── Tokens ── */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const RED  = "#DC2626"; const REDBG = "#FFF5F5"; const REDBD = "#FCA5A5";
const GRN  = "#15803d"; const GRNBG = "#F0FDF4"; const GRNBD = "#86EFAC";
const AMB  = "#b45309"; const AMBBG = "#FFFBEB"; const AMBBD = "#FCD34D";
const INFO = "#1d4ed8"; const INFOBG = "#EFF6FF"; const INFOBD = "#93C5FD";
const G    = "#6C0606"; const GBG = "#FBEAEA"; const GBR = "#D9B0B0";

const STATUS_META: Record<SanctionStatus, { label: string; color: string; bg: string; bd: string }> = {
  emitida:    { label: "Emitida",    color: G,    bg: GBG,    bd: GBR    },
  notificada: { label: "Notificada", color: AMB,  bg: AMBBG,  bd: AMBBD  },
  apelada:    { label: "Apelada",    color: INFO, bg: INFOBG, bd: INFOBD },
  confirmada: { label: "Confirmada", color: GRN,  bg: GRNBG,  bd: GRNBD  },
  anulada:    { label: "Anulada",    color: INK5, bg: INK1,   bd: INK2   },
};

const FAULT_LABELS: Record<string, string> = {
  soat_vencido: "SOAT vencido",
  revision_tecnica_vencida: "Revisión técnica vencida",
  exceso_velocidad: "Exceso de velocidad",
  conduccion_temeraria: "Conducción temeraria",
  cobro_excesivo: "Cobro excesivo",
  ruta_no_autorizada: "Ruta no autorizada",
  documentacion_irregular: "Documentación irregular",
  estado_mecanico_deficiente: "Estado mecánico deficiente",
  conduccion_bajo_influencia: "Conducción bajo influencia",
  otro: "Otro",
};

const ALLOWED = ["fiscal", "admin_municipal", "admin_provincial", "super_admin"];

const LABEL_S: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase", color: INK5, marginBottom: 6,
};
const BTN_PRIMARY: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  height: 32, padding: "0 14px", borderRadius: 7,
  border: "none", background: INK9, color: "#fff",
  fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
  fontFamily: "inherit",
};

/* ── Helpers ── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}
function faultLabel(t: string) {
  return FAULT_LABELS[t] ?? t;
}
function notifIcon(ch: string, size = 14) {
  if (ch === "email") return <Mail size={size} />;
  if (ch === "whatsapp") return <Phone size={size} />;
  return <Bell size={size} />;
}
function notifChannelLabel(ch: string) {
  if (ch === "email") return "Correo a empresa";
  if (ch === "whatsapp") return "WhatsApp al operador";
  return "Push al conductor";
}

/* ── SectionCard ── */
function SectionCard({ icon, title, subtitle, children, action }: {
  icon: React.ReactNode; title: string; subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${INK1}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: INK1, border: `1px solid ${INK2}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9, lineHeight: 1.25 }}>{title}</div>
          {subtitle && <div style={{ fontSize: "0.75rem", color: INK5, lineHeight: 1.3, marginTop: 1 }}>{subtitle}</div>}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
      <div style={{ padding: "16px 18px" }}>{children}</div>
    </div>
  );
}

function StatusBadge({ s }: { s: SanctionStatus }) {
  const m = STATUS_META[s];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 6,
      fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em",
      background: "#fff", color: INK9, border: `1px solid ${INK2}`,
      textTransform: "uppercase",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12, padding: "9px 14px", borderTop: `1px solid ${INK1}`,
    }}>
      <span style={{ fontSize: "0.75rem", color: INK5, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9, textAlign: "right", wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  );
}

interface Props { params: Promise<{ id: string }> }

export default function SancionDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [sanction, setSanction] = useState<Sanction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState<SanctionStatus | "">("");
  const [showAnular, setShowAnular] = useState(false);
  const [anularReason, setAnularReason] = useState("");
  const [anulando, setAnulando] = useState(false);

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
      const res = await fetch(`/api/sanciones/${id}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar sanción."); return; }
      setSanction(data.data);
      setNewStatus(data.data.status);
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  async function handleStatusUpdate() {
    if (!newStatus || newStatus === sanction?.status) return;
    setUpdating(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/sanciones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al actualizar."); return; }
      void load();
    } catch { setError("Error de conexión."); }
    finally { setUpdating(false); }
  }

  const canEdit = ["fiscal", "admin_municipal", "super_admin"].includes(userRole);
  const canAnular = canEdit && sanction
    && sanction.status !== "anulada"
    && sanction.status !== "confirmada";

  async function handleAnular() {
    if (anularReason.trim().length < 5) return;
    setAnulando(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/sanciones/${id}/anular`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ reason: anularReason.trim() }),
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al anular."); return; }
      setShowAnular(false);
      setAnularReason("");
      void load();
    } catch { setError("Error de conexión."); }
    finally { setAnulando(false); }
  }

  const backBtn = (
    <Link href="/sanciones">
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
        <PageHeader kicker="Ciudadanía · RF-13" title="Cargando sanción…" action={backBtn} />
        <div className="sfit-aside-layout">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[140, 180, 160].map((h, i) => (
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
        <PageHeader kicker="Ciudadanía · RF-13" title="Sanción no encontrada" action={backBtn} />
        <div role="alert" style={{ background: REDBG, border: `1.5px solid ${REDBD}`, borderRadius: 10, padding: 14, color: RED, fontSize: "0.875rem", fontWeight: 500 }}>
          La sanción solicitada no existe o ya no está disponible.
        </div>
      </div>
    );
  }

  if (error && !sanction) {
    return (
      <div className="animate-fade-in flex flex-col gap-4">
        <PageHeader kicker="Ciudadanía · RF-13" title="Error" action={backBtn} />
        <div role="alert" style={{ background: REDBG, border: `1.5px solid ${REDBD}`, borderRadius: 10, padding: 14, color: RED, fontSize: "0.875rem", fontWeight: 500 }}>
          {error}
        </div>
      </div>
    );
  }
  if (!sanction) return null;

  const sanctionMeta = STATUS_META[sanction.status];

  return (
    <div className="animate-fade-in flex flex-col gap-4" style={{ color: INK9 }}>
      <PageHeader
        kicker={`Sanción · ${sanction.vehicle?.plate ?? "—"}`}
        title={faultLabel(sanction.faultType)}
        subtitle={`Emitida el ${fmtDate(sanction.createdAt)}`}
        action={backBtn}
      />

      {error && (
        <div style={{ padding: "11px 16px", background: REDBG, border: `1.5px solid ${REDBD}`, borderRadius: 10, color: RED, fontSize: "0.875rem", fontWeight: 500 }}>
          {error}
        </div>
      )}

      <div className="sfit-aside-layout">
        {/* ─── Columna principal ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Infractor */}
          <SectionCard
            icon={<Gavel size={14} color={INK6} />}
            title="Datos del infractor"
            subtitle="Vehículo, conductor y empresa"
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ padding: 12, background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                <div style={LABEL_S}>Vehículo</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: INK9 }}>
                  <span style={{ fontFamily: "ui-monospace,monospace", background: INK9, color: "#fff", padding: "2px 8px", borderRadius: 5, fontSize: "0.75rem" }}>
                    {sanction.vehicle?.plate ?? "—"}
                  </span>
                </div>
              </div>
              <div style={{ padding: 12, background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                <div style={LABEL_S}>Conductor</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9, wordBreak: "break-word" }}>
                  {sanction.driver?.name ?? <span style={{ color: INK5, fontWeight: 400 }}>No especificado</span>}
                </div>
              </div>
              <div style={{ padding: 12, background: INK1, borderRadius: 8, border: `1px solid ${INK2}`, gridColumn: "span 2" }}>
                <div style={LABEL_S}>Empresa</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9, wordBreak: "break-word" }}>
                  {sanction.company?.razonSocial ?? <span style={{ color: INK5, fontWeight: 400 }}>No especificada</span>}
                </div>
              </div>
              <div style={{ padding: 12, background: INK1, borderRadius: 8, border: `1px solid ${INK2}`, gridColumn: "span 2" }}>
                <div style={LABEL_S}>Tipo de infracción</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9 }}>{faultLabel(sanction.faultType)}</div>
              </div>
            </div>
          </SectionCard>

          {/* Monto */}
          <SectionCard
            icon={<FileText size={14} color={INK6} />}
            title="Monto de la sanción"
            subtitle="Importe en soles y equivalencia UIT"
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ padding: 16, background: INK1, border: `1px solid ${INK2}`, borderRadius: 10 }}>
                <div style={{ ...LABEL_S, marginBottom: 4 }}>Monto en soles</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: INK9, fontVariantNumeric: "tabular-nums" }}>
                  S/ {sanction.amountSoles.toLocaleString("es-PE")}
                </div>
              </div>
              <div style={{ padding: 16, background: INK1, border: `1px solid ${INK2}`, borderRadius: 10 }}>
                <div style={{ ...LABEL_S, marginBottom: 4 }}>Equivalente UIT</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: INK9 }}>
                  {sanction.amountUIT}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Notificaciones */}
          {sanction.notifications.length > 0 && (
            <SectionCard
              icon={<Bell size={14} color={INK6} />}
              title="Notificaciones"
              subtitle={`${sanction.notifications.length} canal${sanction.notifications.length !== 1 ? "es" : ""} configurado${sanction.notifications.length !== 1 ? "s" : ""}`}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sanction.notifications.map((n, i) => {
                  const sent = n.status === "enviado" || n.status === "entregado" || n.status === "leido";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 7, background: "#fff",
                        border: `1px solid ${INK2}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: INK6, flexShrink: 0,
                      }}>
                        {notifIcon(n.channel)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: INK9 }}>{notifChannelLabel(n.channel)}</div>
                        <div style={{ fontSize: "0.75rem", color: INK5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {n.target}
                        </div>
                      </div>
                      <span style={{
                        fontSize: "0.625rem", fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                        background: sent ? GRNBG : INK1,
                        color: sent ? GRN : INK5,
                        border: `1px solid ${sent ? GRNBD : INK2}`,
                        textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0,
                      }}>
                        {n.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Notas de apelación */}
          {sanction.appealNotes && (
            <SectionCard
              icon={<FileText size={14} color={INK6} />}
              title="Notas de apelación"
              subtitle="Aporte del operador"
            >
              <p style={{ margin: 0, color: INK6, lineHeight: 1.65, fontSize: "0.9375rem", whiteSpace: "pre-wrap" }}>
                {sanction.appealNotes}
              </p>
            </SectionCard>
          )}

          {/* Anular sanción — atajo con motivo (RF-13) */}
          {canAnular && (
            <SectionCard
              icon={<Ban size={14} color={RED} />}
              title="Anular sanción"
              subtitle="Cancela la sanción dejando registro del motivo. Acción irreversible."
              action={
                !showAnular ? (
                  <button
                    onClick={() => setShowAnular(true)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      height: 28, padding: "0 12px", borderRadius: 7,
                      border: `1.5px solid ${REDBD}`, background: REDBG,
                      color: RED, fontSize: "0.75rem", fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <Ban size={13} /> Anular
                  </button>
                ) : null
              }
            >
              {showAnular && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={LABEL_S}>Motivo de la anulación</label>
                    <textarea
                      value={anularReason}
                      onChange={(e) => setAnularReason(e.target.value)}
                      placeholder="Explique el motivo (mínimo 5 caracteres)"
                      rows={3}
                      style={{
                        width: "100%", padding: "10px 12px",
                        borderRadius: 7, border: `1px solid ${INK2}`,
                        fontSize: "0.875rem", fontFamily: "inherit",
                        resize: "vertical", color: INK9, background: "#fff",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => { setShowAnular(false); setAnularReason(""); }}
                      disabled={anulando}
                      style={{
                        height: 32, padding: "0 14px", borderRadius: 7,
                        border: `1.5px solid ${INK2}`, background: "#fff",
                        color: INK6, fontSize: "0.8125rem", fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >Cancelar</button>
                    <button
                      onClick={handleAnular}
                      disabled={anulando || anularReason.trim().length < 5}
                      style={{
                        height: 32, padding: "0 14px", borderRadius: 7,
                        border: "none", background: RED, color: "#fff",
                        fontSize: "0.8125rem", fontWeight: 700,
                        cursor: anulando || anularReason.trim().length < 5 ? "not-allowed" : "pointer",
                        opacity: anulando || anularReason.trim().length < 5 ? 0.5 : 1,
                        fontFamily: "inherit",
                      }}
                    >{anulando ? "Anulando…" : "Confirmar anulación"}</button>
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* Cambio de estado */}
          {canEdit && (
            <SectionCard
              icon={<Gavel size={14} color={INK6} />}
              title="Cambiar estado"
              subtitle="Avanza la sanción en el flujo (notificada → apelada → confirmada/anulada)"
              action={
                <button
                  onClick={handleStatusUpdate}
                  disabled={updating || !newStatus || newStatus === sanction.status}
                  style={{
                    ...BTN_PRIMARY, height: 28, padding: "0 12px", fontSize: "0.75rem",
                    opacity: (updating || newStatus === sanction.status) ? 0.5 : 1,
                    cursor: (updating || newStatus === sanction.status) ? "not-allowed" : "pointer",
                  }}
                >
                  {updating ? "Guardando…" : "Aplicar"}
                </button>
              }
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6 }}>
                {(["emitida", "notificada", "apelada", "confirmada", "anulada"] as SanctionStatus[]).map(s => {
                  const active = newStatus === s;
                  const m = STATUS_META[s];
                  return (
                    <button
                      key={s}
                      onClick={() => setNewStatus(s)}
                      style={{
                        padding: "8px 10px", borderRadius: 7,
                        border: active ? `1.5px solid ${INK9}` : `1px solid ${INK2}`,
                        background: active ? INK9 : "#fff",
                        color: active ? "#fff" : INK6,
                        fontSize: "0.75rem", fontWeight: active ? 700 : 500,
                        cursor: "pointer", fontFamily: "inherit",
                        textAlign: "center",
                        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                      }}
                    >
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: active ? "#fff" : m.color }} />
                      {m.label}
                    </button>
                  );
                })}
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
                <Gavel size={28} strokeWidth={1.8} />
              </div>
              <div style={{ minWidth: 0, width: "100%" }}>
                <div style={{ fontFamily: "ui-monospace,monospace", fontWeight: 800, fontSize: "0.9375rem", color: INK9 }}>
                  S-{sanction.id.slice(-10).toUpperCase()}
                </div>
                <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2 }}>
                  Sanción
                </div>
                <div style={{ marginTop: 8 }}>
                  <StatusBadge s={sanction.status} />
                </div>
              </div>
            </div>
            <div>
              <MetaRow label="Placa" value={
                <span style={{ fontFamily: "ui-monospace,monospace", background: INK9, color: "#fff", padding: "2px 8px", borderRadius: 5, fontWeight: 700, fontSize: "0.75rem" }}>
                  {sanction.vehicle?.plate ?? "—"}
                </span>
              } />
              <MetaRow label="Monto" value={`S/ ${sanction.amountSoles.toLocaleString("es-PE")}`} />
              <MetaRow label="UIT" value={sanction.amountUIT} />
              <MetaRow label="Emitida" value={fmtDateShort(sanction.createdAt)} />
              {sanction.resolvedAt && <MetaRow label="Resuelta" value={fmtDateShort(sanction.resolvedAt)} />}
            </div>
          </div>

          {/* Personas y empresa */}
          <SectionCard
            icon={<UserIcon size={14} color={INK6} />}
            title="Relacionados"
            subtitle="Conductor, empresa y origen"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sanction.driver && (
                <div style={{ padding: "10px 12px", background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                  <div style={{ ...LABEL_S, marginBottom: 3 }}>Conductor</div>
                  <div style={{ fontWeight: 600, color: INK9, fontSize: "0.875rem" }}>{sanction.driver.name}</div>
                </div>
              )}
              {sanction.company && (
                <div style={{ padding: "10px 12px", background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <Building2 size={11} color={INK5} />
                    <span style={{ ...LABEL_S, marginBottom: 0 }}>Empresa</span>
                  </div>
                  <div style={{ fontWeight: 600, color: INK9, fontSize: "0.875rem" }}>{sanction.company.razonSocial}</div>
                </div>
              )}
              {sanction.inspectionId && (
                <Link href={`/inspecciones/${sanction.inspectionId}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 12px", borderRadius: 8,
                    background: "#fff", border: `1px solid ${INK2}`,
                    color: INK6, fontSize: "0.8125rem", fontWeight: 600,
                    textDecoration: "none",
                  }}>
                  <FileText size={14} />Ver inspección vinculada →
                </Link>
              )}
            </div>
          </SectionCard>

          {/* Acciones rápidas según estado */}
          {canEdit && sanction.status !== "confirmada" && sanction.status !== "anulada" && (
            <SectionCard
              icon={<CheckCircle size={14} color={INK6} />}
              title="Acciones rápidas"
              subtitle="Avanzar el flujo o anular"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sanction.status === "emitida" && (
                  <button onClick={() => { setNewStatus("notificada"); void handleStatusUpdate(); }} disabled={updating}
                    style={{ ...BTN_PRIMARY, height: 36, justifyContent: "center", opacity: updating ? 0.6 : 1 }}>
                    <Bell size={14} />Marcar notificada
                  </button>
                )}
                {sanction.status === "notificada" && (
                  <button onClick={() => { setNewStatus("apelada"); void handleStatusUpdate(); }} disabled={updating}
                    style={{ ...BTN_PRIMARY, height: 36, justifyContent: "center", opacity: updating ? 0.6 : 1 }}>
                    <FileText size={14} />Registrar apelación
                  </button>
                )}
                {sanction.status === "apelada" && (
                  <button onClick={() => { setNewStatus("confirmada"); void handleStatusUpdate(); }} disabled={updating}
                    style={{ ...BTN_PRIMARY, height: 36, justifyContent: "center", opacity: updating ? 0.6 : 1 }}>
                    <CheckCircle size={14} />Confirmar
                  </button>
                )}
                <button onClick={() => { setNewStatus("anulada"); void handleStatusUpdate(); }} disabled={updating}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                    height: 36, padding: "0 14px", borderRadius: 7,
                    border: `1px solid ${INK2}`, background: "#fff", color: INK6,
                    fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                    fontFamily: "inherit", opacity: updating ? 0.6 : 1,
                  }}>
                  <XCircle size={14} color={RED} />Anular sanción
                </button>
              </div>
            </SectionCard>
          )}

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
                {sanction.id}
              </code>
            </div>
          </SectionCard>

          {/* Link al vehículo */}
          {sanction.vehicle?._id && (
            <Link href={`/vehiculos/${sanction.vehicle._id}`}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 9,
                border: `1px solid ${INK2}`, background: "#fff",
                color: INK6, fontSize: "0.8125rem", fontWeight: 600,
                textDecoration: "none",
              }}>
              <Car size={14} />Ver vehículo {sanction.vehicle.plate ?? ""} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
