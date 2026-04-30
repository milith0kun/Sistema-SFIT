"use client";

import { use as usePromise, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, XCircle, AlertCircle, Gavel,
  Shield, ClipboardList, FileText, Car, User as UserIcon,
  Calendar, Hash,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

/* ── Tipos ── */
type InspectionResult = "aprobada" | "observada" | "rechazada";

type ChecklistResultItem = {
  item: string;
  passed: boolean;
  notes?: string;
};

type Inspection = {
  id: string;
  vehicleId: string;
  vehiclePlate?: string;
  driverId?: string;
  driverName?: string;
  fiscalId: string;
  fiscalName?: string;
  vehicleTypeKey: string;
  checklistResults: ChecklistResultItem[];
  score: number;
  result: InspectionResult;
  observations?: string;
  evidenceUrls: string[];
  date: string;
  createdAt: string;
};

type StoredUser = { role: string };

/* ── Tokens ── */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const RED  = "#DC2626"; const REDBG = "#FFF5F5"; const REDBD = "#FCA5A5";
const GRN  = "#15803d"; const GRNBG = "#F0FDF4"; const GRNBD = "#86EFAC";
const AMB  = "#b45309"; const AMBBG = "#FFFBEB"; const AMBBD = "#FCD34D";

const ALLOWED_VIEW = ["fiscal", "admin_municipal", "admin_provincial", "super_admin"];

const RESULT_META: Record<InspectionResult, { label: string; color: string; bg: string; bd: string }> = {
  aprobada:  { label: "Aprobada",  color: GRN, bg: GRNBG, bd: GRNBD },
  observada: { label: "Observada", color: AMB, bg: AMBBG, bd: AMBBD },
  rechazada: { label: "Rechazada", color: RED, bg: REDBG, bd: REDBD },
};

const LABEL_S: React.CSSProperties = {
  display: "block", fontSize: "0.6875rem", fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase", color: INK5, marginBottom: 6,
};

/* ── Helpers ── */
function scoreColor(s: number) {
  if (s >= 80) return GRN;
  if (s >= 50) return AMB;
  return RED;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

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

function ResultBadge({ r }: { r: InspectionResult }) {
  const m = RESULT_META[r];
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

export default function InspeccionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as StoredUser;
    if (!ALLOWED_VIEW.includes(u.role)) { router.replace("/dashboard"); return; }
  }, [router]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("sfit_access_token") ?? "";
        const res = await fetch(`/api/inspecciones/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) { router.replace("/login"); return; }
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error ?? "No se encontró la inspección.");
          return;
        }
        setInspection(data.data);
      } catch {
        setError("Error de conexión.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const backBtn = (
    <Link href="/inspecciones">
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
        <PageHeader kicker="Operación · RF-11" title="Cargando inspección…" action={backBtn} />
        <div className="sfit-aside-layout">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[120, 180, 220].map((h, i) => (
              <div key={i} style={{ height: h, borderRadius: 10, background: "#fff", border: `1px solid ${INK2}`, position: "relative", overflow: "hidden" }}>
                <div className="skeleton-shimmer" style={{ position: "absolute", inset: 0 }} />
              </div>
            ))}
          </div>
          <div style={{ height: 280, borderRadius: 10, background: "#fff", border: `1px solid ${INK2}`, position: "relative", overflow: "hidden" }}>
            <div className="skeleton-shimmer" style={{ position: "absolute", inset: 0 }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !inspection) {
    return (
      <div className="animate-fade-in flex flex-col gap-4">
        <PageHeader kicker="Operación · RF-11" title="Inspección no encontrada" action={backBtn} />
        <div role="alert" style={{ background: REDBG, border: `1.5px solid ${REDBD}`, borderRadius: 10, padding: 14, color: RED, fontSize: "0.875rem", fontWeight: 500 }}>
          {error ?? "Inspección no encontrada."}
        </div>
      </div>
    );
  }

  const insp = inspection;
  const totalItems = insp.checklistResults.length;
  const passedItems = insp.checklistResults.filter(r => r.passed).length;
  const needsSancion = insp.result === "rechazada" || insp.result === "observada";
  const resultMeta = RESULT_META[insp.result];

  return (
    <div className="animate-fade-in flex flex-col gap-4" style={{ color: INK9 }}>
      <PageHeader
        kicker={`Operación · Acta A-${insp.id.slice(-10).toUpperCase()}`}
        title="Detalle de inspección"
        subtitle="Vista de solo lectura. Las inspecciones son inmutables una vez registradas."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            {needsSancion && (
              <button
                onClick={() => router.push(`/sanciones/nueva?vehicleId=${insp.vehicleId}&inspectionId=${insp.id}`)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  height: 36, padding: "0 14px", borderRadius: 9,
                  border: "none", background: INK9, color: "#fff",
                  fontSize: "0.875rem", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <Gavel size={14} />Generar sanción
              </button>
            )}
            {backBtn}
          </div>
        }
      />

      <div className="sfit-aside-layout">
        {/* ─── Columna principal ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Resultado y score (sobrio) */}
          <SectionCard
            icon={<Shield size={14} color={INK6} />}
            title="Resultado de inspección"
            subtitle={`${passedItems} de ${totalItems} ítems aprobados`}
            action={<ResultBadge r={insp.result} />}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ padding: 12, background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: INK5, marginBottom: 6 }}>Resultado</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: resultMeta.color, flexShrink: 0 }} />
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: INK9 }}>{resultMeta.label}</span>
                </div>
              </div>
              <div style={{ padding: 12, background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: INK5 }}>Score</span>
                  <span style={{ fontWeight: 800, fontSize: "1.125rem", color: INK9, fontVariantNumeric: "tabular-nums" }}>
                    {insp.score}<span style={{ color: INK5, fontWeight: 500, fontSize: "0.75rem" }}>/100</span>
                  </span>
                </div>
                <div style={{ height: 5, background: "#fff", border: `1px solid ${INK2}`, borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 999, background: scoreColor(insp.score), width: `${insp.score}%` }} />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Checklist */}
          <SectionCard
            icon={<ClipboardList size={14} color={INK6} />}
            title="Checklist de inspección"
            subtitle={`${passedItems}/${totalItems} aprobados`}
          >
            {insp.checklistResults.length === 0 ? (
              <p style={{ color: INK5, fontSize: "0.875rem", margin: 0 }}>Sin ítems de checklist registrados.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {insp.checklistResults.map((row, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "10px 12px", borderRadius: 8,
                      border: `1px solid ${INK2}`,
                      background: "#fff",
                    }}
                  >
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: INK1, border: `1px solid ${INK2}`,
                      color: row.passed ? GRN : RED,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {row.passed ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, color: INK9, fontSize: "0.875rem" }}>{row.item}</span>
                      {row.notes && (
                        <p style={{ margin: "3px 0 0", fontSize: "0.8125rem", color: INK6, lineHeight: 1.5 }}>{row.notes}</p>
                      )}
                    </div>
                    <span style={{
                      fontSize: "0.6875rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                      background: "#fff", border: `1px solid ${INK2}`,
                      color: row.passed ? GRN : RED, flexShrink: 0,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>
                      {row.passed ? "OK" : "Falla"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Observaciones */}
          {insp.observations && (
            <SectionCard
              icon={<FileText size={14} color={INK6} />}
              title="Observaciones del fiscal"
              subtitle="Notas adicionales del acta"
            >
              <p style={{ margin: 0, color: INK6, lineHeight: 1.65, fontSize: "0.9375rem", whiteSpace: "pre-wrap" }}>
                {insp.observations}
              </p>
            </SectionCard>
          )}

          {/* Evidencias */}
          {insp.evidenceUrls.length > 0 && (
            <SectionCard
              icon={<FileText size={14} color={INK6} />}
              title="Evidencias adjuntas"
              subtitle={`${insp.evidenceUrls.length} archivo${insp.evidenceUrls.length !== 1 ? "s" : ""}`}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {insp.evidenceUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "0.8125rem", color: INK9, textDecoration: "underline", fontWeight: 500 }}>
                    Evidencia {i + 1}
                  </a>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Aviso inmutable */}
          <div style={{
            padding: "12px 16px", borderRadius: 10,
            background: INK1, border: `1px solid ${INK2}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: "0.8125rem", color: INK6 }}>
              Las inspecciones son registros inmutables. Para corregir errores, contacta a un administrador municipal.
            </span>
          </div>
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
                <Shield size={28} strokeWidth={1.8} />
              </div>
              <div style={{ minWidth: 0, width: "100%" }}>
                <div style={{ fontFamily: "ui-monospace,monospace", fontWeight: 800, fontSize: "0.9375rem", color: INK9, lineHeight: 1.3 }}>
                  A-{insp.id.slice(-10).toUpperCase()}
                </div>
                <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2 }}>
                  Acta de inspección
                </div>
                <div style={{ marginTop: 8 }}>
                  <ResultBadge r={insp.result} />
                </div>
              </div>
            </div>
            <div>
              <MetaRow label="Vehículo" value={
                insp.vehiclePlate ? (
                  <span style={{ fontFamily: "ui-monospace,monospace", background: INK9, color: "#fff", padding: "2px 8px", borderRadius: 5, fontWeight: 700, fontSize: "0.75rem" }}>
                    {insp.vehiclePlate}
                  </span>
                ) : <span style={{ color: INK5 }}>—</span>
              } />
              <MetaRow label="Tipo" value={insp.vehicleTypeKey} />
              <MetaRow label="Fecha" value={fmtDateShort(insp.date)} />
            </div>
          </div>

          {/* Personas involucradas */}
          <SectionCard
            icon={<UserIcon size={14} color={INK6} />}
            title="Personas"
            subtitle="Fiscal y conductor"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ padding: "10px 12px", background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                <div style={{ ...LABEL_S, marginBottom: 3 }}>Fiscal</div>
                <div style={{ fontWeight: 600, color: INK9, fontSize: "0.875rem" }}>
                  {insp.fiscalName ?? <span style={{ color: INK5, fontWeight: 400 }}>—</span>}
                </div>
              </div>
              <div style={{ padding: "10px 12px", background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
                <div style={{ ...LABEL_S, marginBottom: 3 }}>Conductor</div>
                <div style={{ fontWeight: 600, color: INK9, fontSize: "0.875rem" }}>
                  {insp.driverName ?? <span style={{ color: INK5, fontWeight: 400 }}>No especificado</span>}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Información del registro */}
          <SectionCard
            icon={<Hash size={14} color={INK6} />}
            title="Información del registro"
            subtitle="Trazabilidad"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={LABEL_S}>Registrado</div>
                <div style={{ fontSize: "0.8125rem", color: INK9, fontWeight: 600 }}>
                  {fmtDate(insp.createdAt)}
                </div>
              </div>
              <div>
                <div style={LABEL_S}>ID interno</div>
                <code style={{
                  display: "block", padding: "6px 10px", background: INK1,
                  border: `1px solid ${INK2}`, borderRadius: 6,
                  fontSize: "0.75rem", color: INK9,
                  fontFamily: "ui-monospace,monospace", letterSpacing: "0.02em",
                  wordBreak: "break-all",
                }}>
                  {insp.id}
                </code>
              </div>
            </div>
          </SectionCard>

          {/* Vehículo: link a su detalle */}
          <Link
            href={`/vehiculos/${insp.vehicleId}`}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 9,
              border: `1px solid ${INK2}`, background: "#fff",
              color: INK6, fontSize: "0.8125rem", fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Car size={14} />Ver vehículo {insp.vehiclePlate ?? ""} →
          </Link>
        </div>
      </div>
    </div>
  );
}
