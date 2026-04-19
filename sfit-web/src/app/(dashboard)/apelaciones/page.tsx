"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquareWarning, Clock, CheckCircle, XCircle, Filter } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type ApelacionStatus = "pendiente" | "aprobada" | "rechazada";

type Apelacion = {
  id: string;
  inspection: { result: string; date: string; score: number } | null;
  vehicle: { plate: string; vehicleTypeKey: string; brand: string; model: string } | null;
  submittedBy: { name: string; email: string } | null;
  reason: string;
  evidence: string[];
  status: ApelacionStatus;
  resolvedBy?: { name: string } | null;
  resolvedAt?: string;
  resolution?: string;
  createdAt: string;
};

// ── Palette tokens (consistent with rest of dashboard) ──────────────────────
const INK1 = "#f4f4f5";
const INK2 = "#e4e4e7";
const INK5 = "#71717a";
const INK6 = "#52525b";
const INK9 = "#18181b";

const PEND_BG = "#FFFBEB"; const PEND_C = "#b45309"; const PEND_BD = "#FCD34D";
const APRO_BG = "#F0FDF4"; const APRO_C = "#15803d"; const APRO_BD = "#86EFAC";
const RECH_BG = "#FFF5F5"; const RECH_C = "#b91c1c"; const RECH_BD = "#FCA5A5";

const ALLOWED = ["fiscal", "admin_municipal", "admin_provincial", "super_admin"];

const btnInk: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 16px",
  borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
  border: "none", background: INK9, color: "#fff", fontFamily: "inherit",
};
const btnOut: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 16px",
  borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
  border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit",
};

function StatusBadge({ s }: { s: ApelacionStatus }) {
  const map: Record<ApelacionStatus, { bg: string; color: string; border: string; label: string }> = {
    pendiente: { bg: PEND_BG, color: PEND_C, border: PEND_BD, label: "PENDIENTE" },
    aprobada:  { bg: APRO_BG, color: APRO_C, border: APRO_BD, label: "APROBADA"  },
    rechazada: { bg: RECH_BG, color: RECH_C, border: RECH_BD, label: "RECHAZADA" },
  };
  const st = map[s];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px",
      borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase",
      background: st.bg, color: st.color, border: `1px solid ${st.border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
      {st.label}
    </span>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Modal de resolución ──────────────────────────────────────────────────────
function ResolveModal({
  apelacion,
  onClose,
  onResolved,
}: {
  apelacion: Apelacion;
  onClose: () => void;
  onResolved: (updated: Apelacion) => void;
}) {
  const [status, setStatus] = useState<"aprobada" | "rechazada">("aprobada");
  const [resolution, setResolution] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (resolution.trim().length < 5) { setError("La resolución debe tener al menos 5 caracteres."); return; }
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/apelaciones/${apelacion.id}/resolver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ status, resolution: resolution.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al resolver"); return; }
      onResolved(data.data as Apelacion);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(9,9,11,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, overflow: "hidden", boxShadow: "0 24px 48px rgba(0,0,0,0.18)" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${INK2}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: INK9 }}>Resolver apelación</div>
            <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>
              Vehículo: {apelacion.vehicle?.plate ?? "—"} · {apelacion.submittedBy?.name ?? "—"}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${INK2}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: INK5, fontSize: 18 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          {/* Motivo de la apelación */}
          <div style={{ marginBottom: 20, padding: 14, background: INK1, borderRadius: 10, borderLeft: `3px solid ${INK2}` }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: INK5, marginBottom: 6 }}>Motivo del operador</div>
            <div style={{ fontSize: "0.875rem", color: INK6, lineHeight: 1.6 }}>{apelacion.reason}</div>
            {apelacion.inspection && (
              <div style={{ marginTop: 8, fontSize: "0.75rem", color: INK5 }}>
                Inspección con resultado: <strong>{apelacion.inspection.result}</strong> · Score: {apelacion.inspection.score}/100
              </div>
            )}
          </div>

          {/* Decisión */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9, marginBottom: 8 }}>Decisión</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setStatus("aprobada")}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                  fontWeight: 600, fontSize: "0.875rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  border: status === "aprobada" ? `2px solid ${APRO_C}` : `1.5px solid ${INK2}`,
                  background: status === "aprobada" ? APRO_BG : "#fff",
                  color: status === "aprobada" ? APRO_C : INK6,
                }}
              >
                <CheckCircle size={16} />Aprobar
              </button>
              <button
                onClick={() => setStatus("rechazada")}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                  fontWeight: 600, fontSize: "0.875rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  border: status === "rechazada" ? `2px solid ${RECH_C}` : `1.5px solid ${INK2}`,
                  background: status === "rechazada" ? RECH_BG : "#fff",
                  color: status === "rechazada" ? RECH_C : INK6,
                }}
              >
                <XCircle size={16} />Rechazar
              </button>
            </div>
          </div>

          {/* Comentario del revisor */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK9, marginBottom: 6 }}>
              Resolución <span style={{ color: RECH_C }}>*</span>
            </label>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Describa el motivo de su decisión…"
              rows={4}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${INK2}`,
                fontSize: "0.875rem", color: INK9, fontFamily: "inherit", resize: "vertical",
                outline: "none", boxSizing: "border-box",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = INK6; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = INK2; }}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: RECH_BG, border: `1px solid ${RECH_BD}`, borderRadius: 8, color: RECH_C, fontSize: "0.8125rem" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ ...btnOut, flex: 1, justifyContent: "center" }}>Cancelar</button>
            <button
              onClick={() => { void submit(); }}
              disabled={loading}
              style={{
                ...btnInk, flex: 1, justifyContent: "center",
                background: status === "aprobada" ? APRO_C : RECH_C,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Guardando…" : status === "aprobada" ? "Confirmar aprobación" : "Confirmar rechazo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function ApelacionesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Apelacion[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<Apelacion | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = new URLSearchParams({ limit: "50" });
      if (statusFilter) qs.set("status", statusFilter);
      const res = await fetch(`/api/apelaciones?${qs}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar"); return; }
      setItems(data.data.items ?? []);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, statusFilter, router]);

  useEffect(() => { void load(); }, [load]);

  function handleResolved(updated: Apelacion) {
    setItems((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
    setResolving(null);
  }

  const pendientes = items.filter((a) => a.status === "pendiente").length;
  const aprobadas  = items.filter((a) => a.status === "aprobada").length;
  const rechazadas = items.filter((a) => a.status === "rechazada").length;

  if (!user) return null;

  return (
    <div>
      <PageHeader
        kicker="Operación · RF-13"
        title="Apelaciones"
        subtitle="Revisión y resolución de apelaciones presentadas por operadores sobre inspecciones rechazadas u observadas."
      />

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, margin: "24px 0 18px" }}>
        {[
          { ico: <MessageSquareWarning size={18} />, lbl: "Total",      val: items.length, bg: INK1,    ic: INK5   },
          { ico: <Clock size={18} />,                lbl: "Pendientes", val: pendientes,   bg: PEND_BG, ic: PEND_C },
          { ico: <CheckCircle size={18} />,          lbl: "Aprobadas",  val: aprobadas,    bg: APRO_BG, ic: APRO_C },
          { ico: <XCircle size={18} />,              lbl: "Rechazadas", val: rechazadas,   bg: RECH_BG, ic: RECH_C },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: 18 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: m.bg, color: m.ic, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{m.ico}</div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: INK5 }}>{m.lbl}</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 6, color: INK9 }}>{loading ? "—" : m.val}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        {[["", "Todas"], ["pendiente", "Pendientes"], ["aprobada", "Aprobadas"], ["rechazada", "Rechazadas"]].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setStatusFilter(k)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
              fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: statusFilter === k ? INK9 : "#fff",
              color: statusFilter === k ? "#fff" : INK6,
              border: statusFilter === k ? `1.5px solid ${INK9}` : `1.5px solid ${INK2}`,
            }}
          >
            {l}
          </button>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <button style={{ ...btnOut, height: 36 }} onClick={() => void load()}>
            <Filter size={14} />Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: RECH_BG, border: `1px solid ${RECH_BD}`, borderRadius: 10, color: RECH_C, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Tabla */}
      <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: `1px solid ${INK2}` }}>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
            Lista de apelaciones {!loading && <span style={{ fontWeight: 400, color: INK5 }}>({items.length})</span>}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: INK5 }}>Cargando…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: INK5 }}>
            <MessageSquareWarning size={36} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
            <div style={{ fontWeight: 600 }}>Sin apelaciones registradas</div>
            <div style={{ fontSize: "0.875rem", marginTop: 4 }}>
              {statusFilter ? `No hay apelaciones con estado "${statusFilter}"` : "No hay apelaciones en el sistema"}
            </div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr>
                {["Vehículo", "Operador", "Motivo", "Insp. resultado", "Estado", "Fecha", "Acción"].map((h, i) => (
                  <th key={i} style={{
                    textAlign: "left", padding: "12px 16px",
                    fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: INK5, background: "#FAFAFA", borderBottom: `1px solid ${INK2}`,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((ap) => (
                <tr key={ap.id} style={{ borderBottom: `1px solid ${INK1}` }}>
                  {/* Vehículo */}
                  <td style={{ padding: "14px 16px" }}>
                    {ap.vehicle ? (
                      <>
                        <span style={{
                          display: "inline-flex", padding: "3px 9px", borderRadius: 6,
                          background: INK9, color: "#fff", fontFamily: "ui-monospace,monospace",
                          fontWeight: 700, fontSize: "0.8125rem",
                        }}>
                          {ap.vehicle.plate}
                        </span>
                        <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 4 }}>
                          {ap.vehicle.brand} {ap.vehicle.model}
                        </div>
                      </>
                    ) : <span style={{ color: INK5 }}>—</span>}
                  </td>

                  {/* Operador */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{ap.submittedBy?.name ?? "—"}</div>
                    <div style={{ fontSize: "0.75rem", color: INK5 }}>{ap.submittedBy?.email ?? ""}</div>
                  </td>

                  {/* Motivo */}
                  <td style={{ padding: "14px 16px", maxWidth: 220 }}>
                    <div style={{
                      fontSize: "0.8125rem", color: INK6, lineHeight: 1.4,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>
                      {ap.reason}
                    </div>
                    {ap.evidence.length > 0 && (
                      <div style={{ fontSize: "0.6875rem", color: INK5, marginTop: 4 }}>
                        {ap.evidence.length} evidencia{ap.evidence.length > 1 ? "s" : ""}
                      </div>
                    )}
                  </td>

                  {/* Resultado inspección */}
                  <td style={{ padding: "14px 16px" }}>
                    {ap.inspection ? (
                      <>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 9px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase",
                          background: ap.inspection.result === "rechazada" ? RECH_BG : PEND_BG,
                          color: ap.inspection.result === "rechazada" ? RECH_C : PEND_C,
                          border: `1px solid ${ap.inspection.result === "rechazada" ? RECH_BD : PEND_BD}`,
                        }}>
                          {ap.inspection.result}
                        </span>
                        <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 4 }}>Score: {ap.inspection.score}/100</div>
                      </>
                    ) : <span style={{ color: INK5 }}>—</span>}
                  </td>

                  {/* Estado */}
                  <td style={{ padding: "14px 16px" }}>
                    <StatusBadge s={ap.status} />
                    {ap.resolvedBy && (
                      <div style={{ fontSize: "0.6875rem", color: INK5, marginTop: 4 }}>
                        por {ap.resolvedBy.name}
                      </div>
                    )}
                  </td>

                  {/* Fecha */}
                  <td style={{ padding: "14px 16px", fontSize: "0.8125rem", color: INK6, whiteSpace: "nowrap" }}>
                    {fmtDate(ap.createdAt)}
                  </td>

                  {/* Acción */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Link
                        href={`/apelaciones/${ap.id}`}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
                          borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                          border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
                          textDecoration: "none", whiteSpace: "nowrap",
                        }}
                      >
                        Ver detalle
                      </Link>
                      {ap.status === "pendiente" && (
                        <button
                          onClick={() => setResolving(ap)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
                            borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                            border: `1.5px solid ${INK9}`, background: INK9, color: "#fff", fontFamily: "inherit",
                          }}
                        >
                          Resolver
                        </button>
                      )}
                      {ap.status !== "pendiente" && ap.resolvedAt && (
                        <span style={{ fontSize: "0.75rem", color: INK5, whiteSpace: "nowrap" }}>
                          {fmtDate(ap.resolvedAt)}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal resolver */}
      {resolving && (
        <ResolveModal
          apelacion={resolving}
          onClose={() => setResolving(null)}
          onResolved={handleResolved}
        />
      )}
    </div>
  );
}
