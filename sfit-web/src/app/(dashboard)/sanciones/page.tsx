"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Check, X, Download, Plus, Filter, Mail, Phone, Bell } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type SanctionStatus = "emitida" | "notificada" | "apelada" | "confirmada" | "anulada";
type Notification = { channel: string; target: string; status: string; sentAt?: string };
type Sanction = {
  id: string;
  vehicle: { plate: string };
  driver?: { name: string } | null;
  company?: { razonSocial: string } | null;
  faultType: string;
  amountSoles: number;
  amountUIT: string;
  status: SanctionStatus;
  notifications: Notification[];
  appealNotes?: string;
  createdAt: string;
};

const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const RIESGO = "#b45309"; const RIESGOBG = "#FFFBEB"; const RIESGOBD = "#FCD34D";
const NO = "#b91c1c"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const G = "#B8860B"; const GD = "#926A09"; const GBG = "#FDF8EC"; const GBR = "#E8D090";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

function StatusBadge({ s }: { s: SanctionStatus }) {
  const map: Record<SanctionStatus, { bg: string; color: string; border: string; label: string }> = {
    emitida: { bg: GBG, color: GD, border: GBR, label: "EMITIDA" },
    notificada: { bg: APTOBG, color: APTO, border: APTOBD, label: "NOTIFICADA" },
    apelada: { bg: RIESGOBG, color: RIESGO, border: RIESGOBD, label: "APELADA" },
    confirmada: { bg: NOBG, color: NO, border: NOBD, label: "CONFIRMADA" },
    anulada: { bg: INK1, color: INK5, border: INK2, label: "ANULADA" },
  };
  const st = map[s];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", background: st.bg, color: st.color, border: `1px solid ${st.border}` }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />{st.label}</span>;
}

function StepFlow({ status }: { status: SanctionStatus }) {
  const steps = [
    { k: "emitida", l: "Emitida" }, { k: "notificada", l: "Notificada" },
    { k: "apelacion", l: "Apelación" }, { k: "resuelta", l: "Resuelta" },
  ];
  const stepIdx = { emitida: 1, notificada: 2, apelada: 3, confirmada: 4, anulada: 4 }[status] ?? 1;
  return (
    <div style={{ display: "flex", alignItems: "center", margin: "8px 0 18px" }}>
      {steps.map((s, i) => {
        const isDone = stepIdx > i + 1 || (stepIdx === i + 1 && status !== "emitida" && i === 0);
        const isCur = stepIdx === i + 1;
        const isApelada = status === "apelada" && i === 2;
        return (
          <div key={s.k} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8125rem", flexShrink: 0, background: isDone || (stepIdx > i + 1) ? APTO : isApelada ? "#fff" : isCur ? "#fff" : INK1, color: isDone || (stepIdx > i + 1) ? "#fff" : isApelada ? GD : isCur ? GD : INK5, border: isApelada || (isCur && i >= 1) ? `2px solid ${G}` : "2px solid transparent" }}>
                {(isDone || stepIdx > i + 1) ? <Check size={14} /> : i + 1}
              </div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: (isDone || stepIdx > i + 1) || isCur ? INK9 : INK5 }}>{s.l}</div>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: (stepIdx > i + 2) ? APTO : INK2, margin: "0 4px", marginBottom: 20 }} />}
          </div>
        );
      })}
    </div>
  );
}

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin"];
const btnInk: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: "none", background: INK9, color: "#fff", fontFamily: "inherit" };
const btnOut: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit" };
const btnSm: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 7, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6 };

export default function SancionesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Sanction[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Sanction | null>(null);

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
      const res = await fetch(`/api/sanciones?${qs}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error"); return; }
      setItems(data.data.items ?? []);
      if (data.data.items?.length && !sel) setSel(data.data.items[0]);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, statusFilter, router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (id: string, status: SanctionStatus) => {
    const token = localStorage.getItem("sfit_access_token");
    await fetch(`/api/sanciones/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` }, body: JSON.stringify({ status }) });
    void load();
  };

  const emitidas = items.filter(s => s.status === "emitida").length;
  const apeladas = items.filter(s => s.status === "apelada").length;
  const confirmadas = items.filter(s => s.status === "confirmada").length;
  const anuladas = items.filter(s => s.status === "anulada").length;
  const totalMonto = items.filter(s => s.status === "confirmada").reduce((acc, s) => acc + s.amountSoles, 0);

  if (!user) return null;

  const notifIcon = (ch: string) => ch === "email" ? <Mail size={14} /> : ch === "whatsapp" ? <Phone size={14} /> : <Bell size={14} />;
  const notifLabel = (ch: string) => ch === "email" ? "Correo a empresa" : ch === "whatsapp" ? "WhatsApp al operador" : "Push al conductor";

  return (
    <div>
      <PageHeader kicker="Ciudadanía · RF-13" title="Sanciones" subtitle="Emisión, notificación y flujo de apelación. El cobro es externo al sistema."
        action={<div style={{ display: "flex", gap: 8 }}><button style={btnOut}><Download size={16} />Exportar CSV</button><button style={btnInk}><Plus size={16} />Emitir sanción</button></div>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, margin: "24px 0 18px" }}>
        {[
          { ico: <AlertTriangle size={18} />, lbl: "Emitidas", val: emitidas, bg: GBG, ic: GD },
          { ico: <FileText size={18} />, lbl: "En apelación", val: apeladas, bg: RIESGOBG, ic: RIESGO },
          { ico: <Check size={18} />, lbl: "Confirmadas", val: confirmadas, bg: NOBG, ic: NO },
          { ico: <X size={18} />, lbl: "Anuladas", val: anuladas, bg: INK1, ic: INK5 },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: 18 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: m.bg, color: m.ic, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{m.ico}</div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: INK5 }}>{m.lbl}</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 6, color: INK9 }}>{loading ? "—" : m.val}</div>
            {i === 2 && !loading && totalMonto > 0 && <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 4 }}>S/ {totalMonto.toLocaleString("es-PE")}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        {[["", "Todas"], ["emitida", "Emitidas"], ["apelada", "Apeladas"], ["confirmada", "Confirmadas"], ["anulada", "Anuladas"]].map(([k, l]) => (
          <button key={k} onClick={() => setStatusFilter(k)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: statusFilter === k ? INK9 : "#fff", color: statusFilter === k ? "#fff" : INK6, border: statusFilter === k ? `1.5px solid ${INK9}` : `1.5px solid ${INK2}` }}>{l}</button>
        ))}
        <div style={{ marginLeft: "auto" }}><button style={{ ...btnSm }}><Filter size={14} />Más filtros</button></div>
      </div>

      {error && <div style={{ padding: "12px 16px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, color: NO, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: `1px solid ${INK2}` }}>
            <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Últimas sanciones</div>
            <button style={{ ...btnOut, height: 32, fontSize: "0.8125rem" }}><Filter size={13} />Filtrar</button>
          </div>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: INK5 }}>Cargando…</div>
          : items.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: INK5 }}>Sin sanciones registradas</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead><tr>{["Sanción","Infracción","Monto","Estado"].map((h,i) => (
                <th key={i} style={{ textAlign: "left", padding: "12px 16px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, background: "#FAFAFA", borderBottom: `1px solid ${INK2}` }}>{h}</th>
              ))}</tr></thead>
              <tbody>{items.map(s => (
                <tr key={s.id} onClick={() => setSel(s)} style={{ cursor: "pointer", background: sel?.id === s.id ? GBG : undefined, boxShadow: sel?.id === s.id ? `inset 3px 0 0 ${G}` : undefined }}>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}>
                    <div style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.75rem" }}>S-{s.id.slice(-10).toUpperCase()}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                      <span style={{ display: "inline-flex", padding: "2px 7px", borderRadius: 5, background: INK9, color: "#fff", fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.6875rem" }}>{s.vehicle.plate}</span>
                      <span style={{ fontSize: "0.75rem", color: INK5 }}>{new Date(s.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}>
                    <div style={{ fontWeight: 600 }}>{s.faultType}</div>
                    <div style={{ fontSize: "0.75rem", color: INK5 }}>{s.company?.razonSocial ?? "—"}</div>
                  </td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}>
                    <div style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>S/ {s.amountSoles.toLocaleString("es-PE")}</div>
                    <div style={{ fontSize: "0.75rem", color: INK5 }}>{s.amountUIT}</div>
                  </td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><StatusBadge s={s.status} /></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        {sel ? (
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px 22px", borderBottom: `1px solid ${INK2}`, gap: 12 }}>
              <div><div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>S-{sel.id.slice(-10).toUpperCase()}</div><div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>{sel.faultType}</div></div>
              <StatusBadge s={sel.status} />
            </div>
            <div style={{ padding: 22 }}>
              <StepFlow status={sel.status} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
                <div style={{ padding: 12, background: INK1, borderRadius: 10 }}>
                  <div style={{ fontSize: "0.75rem", color: INK5 }}>Vehículo</div>
                  <div style={{ fontWeight: 700, marginTop: 2 }}><span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 5, background: INK9, color: "#fff", fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.75rem" }}>{sel.vehicle.plate}</span></div>
                </div>
                <div style={{ padding: 12, background: INK1, borderRadius: 10 }}>
                  <div style={{ fontSize: "0.75rem", color: INK5 }}>Conductor</div>
                  <div style={{ fontWeight: 700, marginTop: 2, fontSize: "0.875rem" }}>{sel.driver?.name ?? "—"}</div>
                </div>
                <div style={{ padding: 12, background: INK1, borderRadius: 10 }}>
                  <div style={{ fontSize: "0.75rem", color: INK5 }}>Empresa</div>
                  <div style={{ fontWeight: 700, marginTop: 2, fontSize: "0.8125rem" }}>{sel.company?.razonSocial ?? "—"}</div>
                </div>
                <div style={{ padding: 12, background: GBG, borderRadius: 10, border: `1px solid ${GBR}` }}>
                  <div style={{ fontSize: "0.75rem", color: GD }}>Monto sanción</div>
                  <div style={{ fontWeight: 800, marginTop: 2, fontSize: "1.125rem", color: GD, fontVariantNumeric: "tabular-nums" }}>S/ {sel.amountSoles.toLocaleString("es-PE")}</div>
                </div>
              </div>

              {sel.notifications.length > 0 && (
                <>
                  <p className="kicker" style={{ margin: "18px 0 8px" }}>Notificaciones</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sel.notifications.map((n, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 8, background: INK1 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: INK6 }}>{notifIcon(n.channel)}</div>
                        <div style={{ flex: 1, fontSize: "0.8125rem", fontWeight: 600 }}>{notifLabel(n.channel)}</div>
                        <div style={{ fontSize: "0.75rem", color: INK5 }}>{n.status === "pendiente" ? "Pendiente" : n.status === "leido" ? "Leído" : "Entregado"}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {sel.status === "apelada" && (
                <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                  <button style={{ ...btnSm, flex: 1 }} onClick={() => updateStatus(sel.id, "confirmada")}><Check size={14} />Confirmar</button>
                  <button style={{ ...btnInk, flex: 1, height: 32, fontSize: "0.8125rem" }} onClick={() => updateStatus(sel.id, "anulada")}><X size={14} />Anular</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: INK5, padding: 40 }}>Selecciona una sanción</div>
        )}
      </div>
    </div>
  );
}
