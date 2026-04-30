"use client";

import { useCallback, useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle, XCircle, Clock, FileText, Scale,
  Car, Shield, Calendar, User as UserIcon, Hash,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

/* ── Tipos ── */
type ApelacionStatus = "pendiente" | "aprobada" | "rechazada";
type Apelacion = {
  id: string;
  inspection: {
    id: string;
    date: string;
    result: string;
    score: number;
    vehicle?: { id: string; plate: string; brand?: string; model?: string } | null;
  } | null;
  vehicle?: { id: string; plate: string; brand?: string; model?: string } | null;
  submittedBy: { id: string; name: string; email?: string; role?: string } | null;
  reason: string;
  evidence: string[];
  status: ApelacionStatus;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: { id: string; name: string } | null;
  createdAt: string;
};

/* ── Design tokens (alineados con usuarios/[id]) ── */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const RED  = "#DC2626"; const REDBG = "#FFF5F5"; const REDBD = "#FCA5A5";
const GRN  = "#15803d"; const GRNBG = "#F0FDF4"; const GRNBD = "#86EFAC";
const AMB  = "#b45309"; const AMBBG = "#FFFBEB"; const AMBBD = "#FCD34D";

const ALLOWED_VIEW = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const CAN_RESOLVE  = ["admin_municipal", "super_admin"];

const STATUS_META: Record<ApelacionStatus, { label: string; color: string; bg: string; bd: string }> = {
  pendiente: { label: "Pendiente", color: AMB, bg: AMBBG, bd: AMBBD },
  aprobada:  { label: "Aprobada",  color: GRN, bg: GRNBG, bd: GRNBD },
  rechazada: { label: "Rechazada", color: RED, bg: REDBG, bd: REDBD },
};

const FIELD: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1px solid ${INK2}`, fontSize: "0.875rem",
  color: INK9, fontFamily: "inherit", outline: "none",
  background: "#fff", transition: "border-color 0.15s", boxSizing: "border-box",
};
const LABEL_S: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase", color: INK5, marginBottom: 6,
};
const BTN_PRIMARY: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  height: 32, padding: "0 14px", borderRadius: 7,
  border: "none", background: INK9, color: "#fff",
  fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
  fontFamily: "inherit", transition: "opacity 0.15s",
};

/* ── SectionCard (idéntica a usuarios/[id]) ── */
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

function StatusBadge({ s }: { s: ApelacionStatus }) {
  const m = STATUS_META[s];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 6,
      fontSize: "0.6875rem", fontWeight: 700,
      background: m.bg, color: m.color, border: `1px solid ${m.bd}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
      {m.label.toUpperCase()}
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ApelacionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [apel, setApel] = useState<Apelacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED_VIEW.includes(u.role)) { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const fetchApel = useCallback(async () => {
    if (!user) return;
    const token = localStorage.getItem("sfit_access_token");
    try {
      const res = await fetch(`/api/apelaciones/${id}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (data.success) {
        setApel(data.data as Apelacion);
        setError(null);
      } else {
        setError(data.error ?? "Error al cargar");
      }
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [id, user, router]);

  useEffect(() => { void fetchApel(); }, [fetchApel]);

  async function handleResolve(status: "aprobada" | "rechazada") {
    if (!resolution.trim() || resolution.length < 5) {
      setResolveError("La resolución debe tener al menos 5 caracteres");
      return;
    }
    setResolving(true); setResolveError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/apelaciones/${id}/resolver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ status, resolution }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchApel();
        setResolution("");
      } else {
        setResolveError(data.error ?? "Error al resolver");
      }
    } catch { setResolveError("Error de conexión"); }
    finally { setResolving(false); }
  }

  if (!user) return null;
  const canResolve = CAN_RESOLVE.includes(user.role);

  const backBtn = (
    <Link href="/apelaciones">
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

  /* Skeleton */
  if (loading) return (
    <div className="animate-fade-in flex flex-col gap-4">
      <PageHeader kicker="Operación · RF-12" title="Cargando apelación…" action={backBtn} />
      <div className="sfit-aside-layout">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[160, 140, 120].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 10, background: "#fff", border: `1px solid ${INK2}`, overflow: "hidden", position: "relative" }}>
              <div className="skeleton-shimmer" style={{ position: "absolute", inset: 0 }} />
            </div>
          ))}
        </div>
        <div style={{ height: 260, borderRadius: 10, background: "#fff", border: `1px solid ${INK2}`, overflow: "hidden", position: "relative" }}>
          <div className="skeleton-shimmer" style={{ position: "absolute", inset: 0 }} />
        </div>
      </div>
    </div>
  );

  /* Not found */
  if (!apel) return (
    <div className="animate-fade-in flex flex-col gap-4">
      <PageHeader kicker="Operación · RF-12" title="Apelación no encontrada" action={backBtn} />
      <p style={{ color: INK5, marginTop: 8 }}>{error ?? "No se encontró la apelación solicitada."}</p>
    </div>
  );

  const plate = apel.inspection?.vehicle?.plate ?? apel.vehicle?.plate ?? null;
  const submitterInitials = (apel.submittedBy?.name ?? "—")
    .split(" ").map(w => w[0] ?? "").slice(0, 2).join("").toUpperCase();

  return (
    <div className="animate-fade-in flex flex-col gap-4" style={{ color: INK9 }}>
      <PageHeader
        kicker="Operación · RF-12"
        title={`Apelación ${id.slice(-8).toUpperCase()}`}
        subtitle="Revisión de impugnación de acta de inspección"
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

          {/* Estado */}
          <SectionCard
            icon={<Shield size={14} color={INK6} />}
            title="Estado de apelación"
            subtitle="Estado actual y datos de presentación"
            action={<StatusBadge s={apel.status} />}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div style={{ padding: 12, background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                <div style={LABEL_S}>Presentada por</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9, wordBreak: "break-word" }}>
                  {apel.submittedBy?.name ?? "—"}
                </div>
              </div>
              <div style={{ padding: 12, background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                <div style={LABEL_S}>Fecha</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9 }}>
                  {fmtDate(apel.createdAt)}
                </div>
              </div>
              <div style={{ padding: 12, background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                <div style={LABEL_S}>Acta relacionada</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: INK9, fontFamily: "ui-monospace,monospace" }}>
                  {apel.inspection ? `A-${apel.inspection.id.slice(-10).toUpperCase()}` : "—"}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Motivo de impugnación */}
          <SectionCard
            icon={<FileText size={14} color={INK6} />}
            title="Motivo de impugnación"
            subtitle={`${apel.evidence.length} evidencia${apel.evidence.length !== 1 ? "s" : ""} adjunta${apel.evidence.length !== 1 ? "s" : ""}`}
          >
            <p style={{ margin: 0, fontSize: "0.9375rem", color: INK6, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {apel.reason}
            </p>
            {apel.evidence.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${INK1}` }}>
                <div style={{ ...LABEL_S, marginBottom: 8 }}>Evidencias adjuntas</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {apel.evidence.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: "0.8125rem", color: INK9, textDecoration: "underline", fontWeight: 500 }}>
                      Evidencia {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Resolución (si ya está resuelta) */}
          {apel.status !== "pendiente" && apel.resolution && (
            <SectionCard
              icon={apel.status === "aprobada"
                ? <CheckCircle size={14} color={GRN} />
                : <XCircle size={14} color={RED} />}
              title={apel.status === "aprobada" ? "Resolución: aprobada" : "Resolución: rechazada"}
              subtitle={apel.resolvedAt
                ? `Resuelta el ${fmtDate(apel.resolvedAt)}${apel.resolvedBy ? ` por ${apel.resolvedBy.name}` : ""}`
                : undefined}
            >
              <div style={{
                padding: "12px 14px", borderRadius: 8,
                background: apel.status === "aprobada" ? GRNBG : REDBG,
                border: `1px solid ${apel.status === "aprobada" ? GRNBD : REDBD}`,
              }}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: INK9, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {apel.resolution}
                </p>
              </div>
            </SectionCard>
          )}

          {/* Resolver apelación (si pendiente y permisos) */}
          {canResolve && apel.status === "pendiente" && (
            <SectionCard
              icon={<Scale size={14} color={INK6} />}
              title="Resolver apelación"
              subtitle="La decisión queda registrada y notifica al operador"
            >
              <label style={LABEL_S}>Resolución <span style={{ color: RED }}>*</span></label>
              <textarea
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                rows={4}
                placeholder="Describe el resultado de la revisión y la decisión tomada…"
                style={{ ...FIELD, resize: "vertical", lineHeight: 1.5, minHeight: 90 }}
                onFocus={e => { e.currentTarget.style.borderColor = INK9; }}
                onBlur={e => { e.currentTarget.style.borderColor = INK2; }}
              />
              {resolveError && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: REDBG, border: `1px solid ${REDBD}`, borderRadius: 8, color: RED, fontSize: "0.8125rem" }}>
                  {resolveError}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => { void handleResolve("aprobada"); }}
                  disabled={resolving}
                  style={{
                    ...BTN_PRIMARY, flex: 1, justifyContent: "center", height: 36,
                    background: GRN, opacity: resolving ? 0.6 : 1,
                  }}
                >
                  <CheckCircle size={14} />Aprobar
                </button>
                <button
                  onClick={() => { void handleResolve("rechazada"); }}
                  disabled={resolving}
                  style={{
                    ...BTN_PRIMARY, flex: 1, justifyContent: "center", height: 36,
                    background: "#fff", color: RED, border: `1.5px solid ${REDBD}`,
                    opacity: resolving ? 0.6 : 1,
                  }}
                >
                  <XCircle size={14} />Rechazar
                </button>
              </div>
            </SectionCard>
          )}

          {/* Aviso si pendiente y no tiene permisos */}
          {!canResolve && apel.status === "pendiente" && (
            <div style={{
              background: AMBBG, border: `1px solid ${AMBBD}`, borderRadius: 10,
              padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
            }}>
              <Clock size={18} color={AMB} />
              <div>
                <div style={{ fontWeight: 700, color: AMB, fontSize: "0.875rem" }}>En revisión</div>
                <div style={{ fontSize: "0.8125rem", color: INK6, marginTop: 2 }}>
                  Esta apelación está siendo revisada por el equipo competente.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Sidebar derecha ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Tarjeta de identidad — operador que presentó */}
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "20px 16px 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: STATUS_META[apel.status].bg,
                border: `2px solid ${STATUS_META[apel.status].bd}`,
                color: STATUS_META[apel.status].color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: "1.375rem",
              }}>
                {submitterInitials || "—"}
              </div>
              <div style={{ minWidth: 0, width: "100%" }}>
                <div style={{ fontWeight: 800, fontSize: "0.9375rem", color: INK9, lineHeight: 1.3, wordBreak: "break-word" }}>
                  {apel.submittedBy?.name ?? "Operador desconocido"}
                </div>
                {apel.submittedBy?.email && (
                  <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2, wordBreak: "break-all" }}>
                    {apel.submittedBy.email}
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <StatusBadge s={apel.status} />
                </div>
              </div>
            </div>
            <div>
              <MetaRow label="Vehículo" value={
                plate ? (
                  <span style={{ fontFamily: "ui-monospace,monospace", background: INK9, color: "#fff", padding: "2px 8px", borderRadius: 5, fontWeight: 700, fontSize: "0.75rem" }}>
                    {plate}
                  </span>
                ) : <span style={{ color: INK5 }}>—</span>
              } />
              <MetaRow label="Presentada" value={fmtDate(apel.createdAt)} />
              {apel.resolvedAt && <MetaRow label="Resuelta" value={fmtDate(apel.resolvedAt)} />}
              {apel.resolvedBy && <MetaRow label="Resuelto por" value={apel.resolvedBy.name} />}
            </div>
          </div>

          {/* Acta de inspección */}
          {apel.inspection && (
            <SectionCard
              icon={<Car size={14} color={INK6} />}
              title="Acta de inspección"
              subtitle="Inspección impugnada"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ padding: "10px 12px", background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <Hash size={11} color={INK5} />
                    <span style={{ ...LABEL_S, marginBottom: 0 }}>Código</span>
                  </div>
                  <div style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.875rem", color: INK9 }}>
                    A-{apel.inspection.id.slice(-10).toUpperCase()}
                  </div>
                </div>
                <div style={{ padding: "10px 12px", background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <Calendar size={11} color={INK5} />
                    <span style={{ ...LABEL_S, marginBottom: 0 }}>Fecha</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: INK9 }}>
                    {fmtDate(apel.inspection.date)}
                  </div>
                </div>
                <div style={{ padding: "10px 12px", background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                  <div style={{ ...LABEL_S, marginBottom: 3 }}>Score</div>
                  <div style={{ fontWeight: 800, fontSize: "1rem", color: INK9, fontVariantNumeric: "tabular-nums" }}>
                    {apel.inspection.score}<span style={{ color: INK5, fontWeight: 500, fontSize: "0.75rem" }}>/100</span>
                  </div>
                </div>
                <div style={{ padding: "10px 12px", background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                  <div style={{ ...LABEL_S, marginBottom: 3 }}>Resultado</div>
                  <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: INK9, textTransform: "capitalize" }}>
                    {apel.inspection.result}
                  </div>
                </div>
              </div>
              <Link
                href={`/inspecciones/${apel.inspection.id}`}
                style={{
                  display: "block", marginTop: 12, padding: "9px 12px",
                  textAlign: "center", borderRadius: 8,
                  border: `1px solid ${INK2}`, background: "#fff",
                  color: INK6, fontSize: "0.8125rem", fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Ver acta completa →
              </Link>
            </SectionCard>
          )}

          {/* Información del registro */}
          <SectionCard
            icon={<UserIcon size={14} color={INK6} />}
            title="Información del registro"
            subtitle="Trazabilidad"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <div style={LABEL_S}>ID de apelación</div>
                <code style={{
                  display: "block", padding: "6px 10px", background: INK1,
                  border: `1px solid ${INK2}`, borderRadius: 6,
                  fontSize: "0.75rem", color: INK9,
                  fontFamily: "ui-monospace,monospace", letterSpacing: "0.02em",
                  wordBreak: "break-all",
                }}>
                  {apel.id}
                </code>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
