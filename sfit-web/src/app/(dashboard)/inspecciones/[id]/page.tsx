"use client";

import { use as usePromise, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertCircle, ArrowLeft, Gavel } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";

/* ─── tipos ─────────────────────────────────────────────────────────── */
interface Props {
  params: Promise<{ id: string }>;
}

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

/* ─── colores ────────────────────────────────────────────────────────── */
const APTO   = "#15803d"; const APTOBG   = "#F0FDF4"; const APTOBD   = "#86EFAC";
const RIESGO = "#b45309"; const RIESGOBG = "#FFFBEB"; const RIESGOBD = "#FCD34D";
const NO     = "#b91c1c"; const NOBG     = "#FFF5F5"; const NOBD     = "#FCA5A5";
const INK1   = "#f4f4f5"; const INK2     = "#e4e4e7"; const INK5     = "#71717a";
const INK6   = "#52525b"; const INK9     = "#18181b";

const ALLOWED_VIEW = ["fiscal", "admin_municipal", "admin_provincial", "super_admin"];

/* ─── helpers ────────────────────────────────────────────────────────── */
function scoreColor(s: number) {
  if (s >= 80) return APTO;
  if (s >= 50) return RIESGO;
  return NO;
}
function resultColor(r: InspectionResult) {
  return r === "aprobada" ? APTO : r === "observada" ? RIESGO : NO;
}
function resultBg(r: InspectionResult) {
  return r === "aprobada" ? APTOBG : r === "observada" ? RIESGOBG : NOBG;
}
function resultBorder(r: InspectionResult) {
  return r === "aprobada" ? APTOBD : r === "observada" ? RIESGOBD : NOBD;
}
function resultLabel(r: InspectionResult) {
  return r === "aprobada" ? "APROBADA" : r === "observada" ? "OBSERVADA" : "RECHAZADA";
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-PE", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ResultBadge({ r }: { r: InspectionResult }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 12px", borderRadius: 999,
      fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase",
      background: resultBg(r), color: resultColor(r), border: `1.5px solid ${resultBorder(r)}`,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
      {resultLabel(r)}
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: INK5 }}>{label}</span>
      <span style={{ fontWeight: 600, color: INK9, fontSize: "0.9375rem" }}>{value}</span>
    </div>
  );
}

/* ─── componente ─────────────────────────────────────────────────────── */
export default function InspeccionDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  /* autenticación */
  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as StoredUser;
    if (!ALLOWED_VIEW.includes(u.role)) { router.replace("/dashboard"); return; }
  }, [router]);

  /* fetch inspección */
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

  /* ── UI ─────────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ padding: 64, textAlign: "center", color: INK5 }}>Cargando inspección…</div>
    );
  }

  if (error || !inspection) {
    return (
      <div>
        <div role="alert" style={{ background: NOBG, border: `1.5px solid ${NOBD}`, borderRadius: 12, padding: 16, color: NO, marginBottom: 20 }}>
          {error ?? "Inspección no encontrada."}
        </div>
        <Button variant="outline" onClick={() => router.push("/inspecciones")}>
          <ArrowLeft size={16} /> Volver a Inspecciones
        </Button>
      </div>
    );
  }

  const insp = inspection;
  const totalItems  = insp.checklistResults.length;
  const pasadosItems = insp.checklistResults.filter(r => r.passed).length;
  const needsSancion = insp.result === "rechazada" || insp.result === "observada";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker={`Inspecciones · Acta A-${insp.id.slice(-10).toUpperCase()}`}
        title="Detalle de inspección"
        subtitle="Vista de solo lectura del acta de inspección. Las inspecciones son inmutables una vez registradas."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            {needsSancion && (
              <Button
                variant="danger"
                onClick={() => router.push(`/sanciones/nueva?vehicleId=${insp.vehicleId}&inspectionId=${insp.id}`)}
              >
                <Gavel size={16} />
                Generar sanción
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push("/inspecciones")}>
              <ArrowLeft size={16} />
              Volver a Inspecciones
            </Button>
          </div>
        }
      />

      {/* ── Score y resultado ── */}
      <div style={{
        padding: "20px 24px", borderRadius: 14,
        background: resultBg(insp.result), border: `1.5px solid ${resultBorder(insp.result)}`,
        display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {insp.result === "aprobada"  && <CheckCircle2 size={32} color={APTO}   strokeWidth={2} />}
          {insp.result === "observada" && <AlertCircle  size={32} color={RIESGO} strokeWidth={2} />}
          {insp.result === "rechazada" && <XCircle      size={32} color={NO}     strokeWidth={2} />}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: resultColor(insp.result) }}>Resultado</div>
            <ResultBadge r={insp.result} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "0.8125rem", color: resultColor(insp.result), fontWeight: 600 }}>Score</span>
            <span style={{ fontWeight: 800, fontSize: "1.375rem", color: scoreColor(insp.score), fontVariantNumeric: "tabular-nums" }}>
              {insp.score}/100
            </span>
          </div>
          <div style={{ height: 10, background: "rgba(0,0,0,0.08)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 999, background: scoreColor(insp.score), width: `${insp.score}%` }} />
          </div>
          <div style={{ marginTop: 6, fontSize: "0.8125rem", color: resultColor(insp.result) }}>
            {pasadosItems} de {totalItems} ítems aprobados
          </div>
        </div>
      </div>

      {/* ── Metadatos ── */}
      <Card>
        <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, margin: "0 0 20px" }}>
          Información general
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 }}>
          <MetaRow
            label="Vehículo"
            value={
              insp.vehiclePlate
                ? <span style={{ fontFamily: "ui-monospace,monospace", background: INK9, color: "#fff", padding: "3px 10px", borderRadius: 6, fontWeight: 700, fontSize: "0.9375rem" }}>{insp.vehiclePlate}</span>
                : <span style={{ color: INK5 }}>—</span>
            }
          />
          <MetaRow label="Tipo de vehículo" value={insp.vehicleTypeKey} />
          <MetaRow label="Conductor" value={insp.driverName ?? <span style={{ color: INK5 }}>No especificado</span>} />
          <MetaRow label="Fiscal" value={insp.fiscalName ?? <span style={{ color: INK5 }}>—</span>} />
          <MetaRow label="Fecha de inspección" value={fmtDate(insp.date)} />
          <MetaRow label="Registrado" value={fmtDate(insp.createdAt)} />
        </div>
      </Card>

      {/* ── Checklist ── */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, margin: 0 }}>
            Checklist de inspección
          </h3>
          <span style={{ fontSize: "0.8125rem", color: INK5, fontWeight: 600 }}>
            {pasadosItems}/{totalItems} aprobados
          </span>
        </div>

        {insp.checklistResults.length === 0 ? (
          <p style={{ color: INK5 }}>Sin ítems de checklist registrados.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {insp.checklistResults.map((row, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  border: `1.5px solid ${row.passed ? APTOBD : NOBD}`,
                  background: row.passed ? APTOBG : NOBG,
                }}
              >
                <div style={{ color: row.passed ? APTO : NO, flexShrink: 0, marginTop: 1 }}>
                  {row.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: INK9 }}>{row.item}</span>
                  {row.notes && (
                    <p style={{ margin: "6px 0 0", fontSize: "0.8125rem", color: INK6 }}>{row.notes}</p>
                  )}
                </div>
                <span style={{
                  fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase",
                  color: row.passed ? APTO : NO, flexShrink: 0, marginTop: 2,
                }}>
                  {row.passed ? "OK" : "FALLA"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Observaciones ── */}
      {insp.observations && (
        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, margin: "0 0 12px" }}>
            Observaciones
          </h3>
          <p style={{ color: INK6, lineHeight: 1.65, fontSize: "0.9375rem", margin: 0 }}>
            {insp.observations}
          </p>
        </Card>
      )}

      {/* ── Aviso inspección inmutable ── */}
      <div style={{ padding: "12px 16px", borderRadius: 10, background: INK1, border: `1px solid ${INK2}`, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: "0.8125rem", color: INK5 }}>
          Las inspecciones son registros inmutables. Para corregir errores, contacta a un administrador municipal o super admin.
        </span>
      </div>

      {/* ── Acciones inferiores ── */}
      <div style={{ display: "flex", gap: 10 }}>
        {needsSancion && (
          <Button
            variant="danger"
            size="lg"
            onClick={() => router.push(`/sanciones/nueva?vehicleId=${insp.vehicleId}&inspectionId=${insp.id}`)}
          >
            <Gavel size={16} />
            Generar sanción
          </Button>
        )}
        <Button variant="outline" size="lg" onClick={() => router.push("/inspecciones")}>
          <ArrowLeft size={16} />
          Volver a Inspecciones
        </Button>
      </div>
    </div>
  );
}
