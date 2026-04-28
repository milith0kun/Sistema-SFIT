"use client";

import { useCallback, useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, Clock, FileText, Scale } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type ApelacionStatus = "pendiente" | "aprobada" | "rechazada";
type Apelacion = {
  id: string;
  inspection: { id: string; date: string; result: string; score: number; vehicle?: { id: string; plate: string; brand?: string; model?: string } | null } | null;
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

const G = "#B8860B"; const GD = "#926A09"; const GBG = "#FDF8EC";
const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const NO = "#b91c1c"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const AMB = "#b45309"; const AMBBG = "#FFFBEB"; const AMBBD = "#FCD34D";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

// Suppress unused-variable warnings for palette tokens used only in JSX string literals
void GD; void GBG;

const ALLOWED_VIEW = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const CAN_RESOLVE = ["admin_municipal", "super_admin"];

function StatusBadge({ s }: { s: ApelacionStatus }) {
  const map = {
    pendiente: { bg: AMBBG, color: AMB, border: AMBBD, label: "PENDIENTE" },
    aprobada:  { bg: APTOBG, color: APTO, border: APTOBD, label: "APROBADA" },
    rechazada: { bg: NOBG, color: NO, border: NOBD, label: "RECHAZADA" },
  };
  const st = map[s] ?? { bg: INK1, color: INK5, border: INK2, label: String(s ?? "—").toUpperCase() };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
      {st.label}
    </span>
  );
}

const btnInk: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: "none", background: INK9, color: "#fff", fontFamily: "inherit" };
const btnOut: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit" };
const fieldStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 9, border: `1.5px solid ${INK2}`, fontSize: "0.875rem", fontFamily: "inherit", outline: "none", background: "#fff", color: INK9, boxSizing: "border-box" };

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
      const data = await res.json();
      if (data.success) {
        setApel(data.data as Apelacion);
        setError(null);
      } else {
        setError(data.error ?? "Error al cargar");
      }
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [id, user]);

  useEffect(() => { void fetchApel(); }, [fetchApel]);

  async function handleResolve(status: "aprobada" | "rechazada") {
    if (!resolution.trim() || resolution.length < 5) { setResolveError("La resolución debe tener al menos 5 caracteres"); return; }
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
        // Refrescar para obtener resolvedBy.name actualizado desde el servidor
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

  return (
    <div>
      <PageHeader
        kicker="Operación · RF-12"
        title={`Apelación ${id.slice(-8).toUpperCase()}`}
        subtitle="Revisión de impugnación de acta de inspección."
        action={<Link href="/apelaciones"><button style={btnOut}><ArrowLeft size={16} />Volver</button></Link>}
      />
      {loading && <div style={{ padding: 40, textAlign: "center", color: INK5 }}>Cargando…</div>}
      {error && <div style={{ padding: "12px 16px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, color: NO, marginBottom: 16 }}>{error}</div>}
      {apel && (
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginTop: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header card */}
            <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: INK5, marginBottom: 4 }}>Estado de apelación</div>
                  <StatusBadge s={apel.status} />
                </div>
                {apel.inspection?.vehicle && (
                  <span style={{ display: "inline-flex", padding: "4px 12px", borderRadius: 6, background: INK9, color: "#fff", fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.9375rem" }}>{apel.inspection.vehicle.plate}</span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  ["Presentada por", apel.submittedBy?.name ?? "—"],
                  ["Fecha", new Date(apel.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })],
                  ["Acta relacionada", apel.inspection ? `A-${apel.inspection.id.slice(-10).toUpperCase()}` : "—"],
                ].map(([lbl, val]) => (
                  <div key={lbl} style={{ padding: 12, background: INK1, borderRadius: 10 }}>
                    <div style={{ fontSize: "0.75rem", color: INK5 }}>{lbl}</div>
                    <div style={{ fontWeight: 700, marginTop: 4, fontSize: "0.875rem" }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Motivo */}
            <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.9375rem", marginBottom: 14 }}><FileText size={16} color={G} />Motivo de impugnación</div>
              <p style={{ margin: 0, fontSize: "0.9375rem", color: INK6, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{apel.reason}</p>
              {apel.evidence.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: INK5, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Evidencias adjuntas</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {apel.evidence.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.8125rem", color: G, textDecoration: "underline" }}>Evidencia {i + 1}</a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Resolución si ya está resuelta */}
            {apel.status !== "pendiente" && apel.resolution && (
              <div style={{ background: apel.status === "aprobada" ? APTOBG : NOBG, border: `1px solid ${apel.status === "aprobada" ? APTOBD : NOBD}`, borderRadius: 14, padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.9375rem", marginBottom: 10, color: apel.status === "aprobada" ? APTO : NO }}>
                  {apel.status === "aprobada" ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  Resolución: {apel.status === "aprobada" ? "Aprobada" : "Rechazada"}
                </div>
                <p style={{ margin: 0, fontSize: "0.9375rem", color: INK6, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{apel.resolution}</p>
                {apel.resolvedAt && (
                  <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 10 }}>
                    Resuelta el {new Date(apel.resolvedAt).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}
                    {apel.resolvedBy ? ` por ${apel.resolvedBy.name}` : ""}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Inspección relacionada */}
            <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, padding: "20px 24px" }}>
              <div style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: 14 }}>Acta de inspección</div>
              {apel.inspection ? (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ padding: 12, background: INK1, borderRadius: 10 }}>
                      <div style={{ fontSize: "0.75rem", color: INK5 }}>Código</div>
                      <div style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700, marginTop: 4 }}>A-{apel.inspection.id.slice(-10).toUpperCase()}</div>
                    </div>
                    <div style={{ padding: 12, background: INK1, borderRadius: 10 }}>
                      <div style={{ fontSize: "0.75rem", color: INK5 }}>Score</div>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>{apel.inspection.score}/100</div>
                    </div>
                    <div style={{ padding: 12, background: INK1, borderRadius: 10 }}>
                      <div style={{ fontSize: "0.75rem", color: INK5 }}>Resultado</div>
                      <div style={{ fontWeight: 700, marginTop: 4, textTransform: "capitalize" }}>{apel.inspection.result}</div>
                    </div>
                  </div>
                  <Link
                    href={`/inspecciones/${apel.inspection.id}`}
                    style={{ display: "block", marginTop: 14, textAlign: "center", padding: "9px", borderRadius: 9, border: `1.5px solid ${INK2}`, fontSize: "0.8125rem", fontWeight: 600, color: INK6, textDecoration: "none", background: "#fff" }}
                  >
                    Ver acta completa
                  </Link>
                </>
              ) : (
                <div style={{ padding: 14, background: INK1, borderRadius: 10, color: INK5, fontSize: "0.875rem" }}>
                  No se encontró el acta de inspección vinculada.
                </div>
              )}
            </div>

            {/* Panel de resolución */}
            {canResolve && apel.status === "pendiente" && (
              <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.9375rem", marginBottom: 14 }}><Scale size={16} color={G} />Resolver apelación</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK6, display: "block", marginBottom: 6 }}>Resolución *</label>
                  <textarea
                    value={resolution}
                    onChange={e => setResolution(e.target.value)}
                    rows={5}
                    placeholder="Describe el resultado de la revisión y la decisión tomada…"
                    style={{ ...fieldStyle, resize: "vertical" }}
                  />
                </div>
                {resolveError && (
                  <div style={{ padding: "8px 12px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 8, color: NO, fontSize: "0.8125rem", marginBottom: 12 }}>
                    {resolveError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { void handleResolve("aprobada"); }} disabled={resolving} style={{ ...btnInk, flex: 1, justifyContent: "center", background: APTO, opacity: resolving ? 0.6 : 1 }}>
                    <CheckCircle size={16} />Aprobar
                  </button>
                  <button onClick={() => { void handleResolve("rechazada"); }} disabled={resolving} style={{ ...btnOut, flex: 1, justifyContent: "center", color: NO, borderColor: NOBD, opacity: resolving ? 0.6 : 1 }}>
                    <XCircle size={16} />Rechazar
                  </button>
                </div>
              </div>
            )}

            {/* Pendiente sin permisos */}
            {!canResolve && apel.status === "pendiente" && (
              <div style={{ background: AMBBG, border: `1px solid ${AMBBD}`, borderRadius: 14, padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }}>
                <Clock size={20} color={AMB} />
                <div>
                  <div style={{ fontWeight: 700, color: AMB }}>En revisión</div>
                  <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>Esta apelación está siendo revisada por el equipo competente.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
