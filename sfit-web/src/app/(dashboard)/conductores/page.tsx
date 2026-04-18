"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, Check, Gauge, AlertTriangle, Search, Filter, Download, Plus, Phone, Car, Eye, Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type DriverStatus = "apto" | "riesgo" | "no_apto";
type Driver = {
  id: string; name: string; dni: string; licenseNumber: string; licenseCategory: string;
  companyName?: string; phone?: string; status: DriverStatus;
  continuousHours: number; restHours: number; reputationScore: number; active: boolean;
};

const G = "#B8860B"; const GD = "#926A09"; const GBG = "#FDF8EC";
const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const RIESGO = "#b45309"; const RIESGOBG = "#FFFBEB"; const RIESGOBD = "#FCD34D";
const NO = "#b91c1c"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

const statusStyle = (s: DriverStatus) =>
  s === "apto" ? { bg: APTOBG, color: APTO, border: APTOBD, label: "APTO" }
  : s === "riesgo" ? { bg: RIESGOBG, color: RIESGO, border: RIESGOBD, label: "RIESGO" }
  : { bg: NOBG, color: NO, border: NOBD, label: "NO APTO" };

function StatusBadge({ s }: { s: DriverStatus }) {
  const st = statusStyle(s);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />{st.label}
    </span>
  );
}

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const parts = name.split(" ");
  const ini = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  return <div style={{ width: size, height: size, borderRadius: size > 40 ? 12 : 8, background: GBG, color: GD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size > 40 ? "1rem" : "0.8125rem", flexShrink: 0 }}>{ini}</div>;
}

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const btnInk: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: "none", background: INK9, color: "#fff", fontFamily: "inherit" };
const btnOut: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit" };

export default function ConductoresPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Driver[]>([]);
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sel, setSel] = useState<Driver | null>(null);

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
      const qs = new URLSearchParams({ limit: "100" });
      if (filter !== "todos") qs.set("status", filter);
      if (search) qs.set("q", search);
      const res = await fetch(`/api/conductores?${qs}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar conductores"); return; }
      setItems(data.data.items ?? []);
      setCounts(data.data.statusCounts ?? {});
      if (data.data.items?.length && !sel) setSel(data.data.items[0]);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, filter, search, router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const total = (counts.apto ?? 0) + (counts.riesgo ?? 0) + (counts.no_apto ?? 0) || items.length;

  if (!user) return null;

  return (
    <div>
      <PageHeader kicker="Operación · RF-05" title="Conductores" subtitle="Estado de fatiga en tiempo real, historial y habilitación calculada por FatigueEngine."
        action={<div style={{ display: "flex", gap: 8 }}><button style={btnOut}><Download size={16} />Exportar CSV</button><button style={btnInk}><Plus size={16} />Nuevo conductor</button></div>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, margin: "24px 0 18px" }}>
        {[
          { ico: <Users size={18} />, lbl: "Total registrados", val: total, ico_bg: INK1, ico_c: INK5 },
          { ico: <Check size={18} />, lbl: "APTOS ahora", val: counts.apto ?? 0, ico_bg: APTOBG, ico_c: APTO },
          { ico: <Gauge size={18} />, lbl: "En riesgo", val: counts.riesgo ?? 0, ico_bg: RIESGOBG, ico_c: RIESGO },
          { ico: <AlertTriangle size={18} />, lbl: "NO APTOS", val: counts.no_apto ?? 0, ico_bg: NOBG, ico_c: NO },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: 18 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: m.ico_bg, color: m.ico_c, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{m.ico}</div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: INK5 }}>{m.lbl}</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 6, color: INK9 }}>{loading ? "—" : m.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 340 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: INK5, pointerEvents: "none" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, DNI o licencia…"
            style={{ width: "100%", height: 38, padding: "0 12px 0 36px", borderRadius: 8, border: `1.5px solid ${INK2}`, fontSize: "0.875rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
        {["todos", "apto", "riesgo", "no_apto"].map(t => {
          const cnt = t === "todos" ? total : t === "no_apto" ? (counts.no_apto ?? 0) : (counts[t] ?? 0);
          const active = filter === t;
          return (
            <button key={t} onClick={() => setFilter(t)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: active ? INK9 : "#fff", color: active ? "#fff" : INK6, border: active ? `1.5px solid ${INK9}` : `1.5px solid ${INK2}` }}>
              {t === "todos" ? "Todos" : t === "no_apto" ? "NO APTO" : t.toUpperCase()}
              <span style={{ fontSize: "0.6875rem", padding: "1px 6px", borderRadius: 999, background: active ? "rgba(255,255,255,0.15)" : INK1, color: active ? "#fff" : INK5, fontWeight: 700 }}>{cnt}</span>
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "#fff", color: INK6, border: `1.5px solid ${INK2}` }}><Filter size={14} />Empresa</button>
        </div>
      </div>

      {error && <div style={{ padding: "12px 16px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, color: NO, marginBottom: 16, fontSize: "0.875rem" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: INK5 }}>Cargando conductores…</div>
          : items.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: INK5 }}>Sin conductores registrados</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead><tr>{["Conductor","Empresa","Estado","Fatiga","Rep.",""].map((h,i) => (
                <th key={i} style={{ textAlign: "left", padding: "12px 16px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, background: "#FAFAFA", borderBottom: `1px solid ${INK2}` }}>{h}</th>
              ))}</tr></thead>
              <tbody>{items.map(d => {
                const pct = Math.min(100, (d.continuousHours / 10) * 100);
                const barC = d.status === "riesgo" ? RIESGO : d.status === "no_apto" ? NO : APTO;
                const isSel = sel?.id === d.id;
                return (
                  <tr key={d.id} onClick={() => setSel(d)} style={{ cursor: "pointer", background: isSel ? GBG : undefined, boxShadow: isSel ? `inset 3px 0 0 ${G}` : undefined }}>
                    <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Avatar name={d.name} />
                        <div><div style={{ fontWeight: 600, color: INK9 }}>{d.name}</div><div style={{ fontSize: "0.75rem", color: INK5, fontFamily: "ui-monospace,monospace" }}>DNI {d.dni} · {d.licenseCategory}</div></div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><div style={{ fontWeight: 600 }}>{d.companyName ?? "—"}</div><div style={{ fontSize: "0.75rem", color: INK5 }}>Lic. {d.licenseNumber}</div></td>
                    <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><StatusBadge s={d.status} /></td>
                    <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}`, width: 160 }}>
                      <div style={{ height: 6, background: INK1, borderRadius: 999, overflow: "hidden" }}><span style={{ display: "block", height: "100%", borderRadius: 999, background: barC, width: `${pct}%` }} /></div>
                      <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 4 }}>{d.continuousHours} h conducción</div>
                    </td>
                    <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><span style={{ fontWeight: 700 }}>{d.reputationScore}</span><span style={{ color: INK5, fontSize: "0.75rem" }}>/100</span></td>
                    <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><button style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid ${INK2}`, background: "#fff", color: INK6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>⋯</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </div>

        {sel ? (
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14 }}>
            <div style={{ padding: 22, borderBottom: `1px solid ${INK2}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Avatar name={sel.name} size={52} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: INK9 }}>{sel.name}</div>
                  <div style={{ fontSize: "0.8125rem", color: INK5, fontFamily: "ui-monospace,monospace" }}>DNI {sel.dni} · Lic. {sel.licenseNumber}</div>
                </div>
                <StatusBadge s={sel.status} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                {sel.phone && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: INK1, fontSize: "0.8125rem", fontWeight: 600, color: INK6 }}><Phone size={12} />{sel.phone}</span>}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: INK1, fontSize: "0.8125rem", fontWeight: 600, color: INK6 }}><Car size={12} />{sel.licenseCategory}</span>
              </div>
            </div>
            <div style={{ padding: 22 }}>
              <p className="kicker" style={{ marginBottom: 10 }}>FatigueEngine</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {[["Conducción continua", sel.continuousHours, "h"], ["Descanso restante", sel.restHours, "h"]].map(([lbl, val, unit]) => (
                  <div key={lbl as string} style={{ padding: 14, background: INK1, borderRadius: 10 }}>
                    <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", color: INK5, textTransform: "uppercase" }}>{lbl}</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: 4 }}>{val} <span style={{ fontSize: "0.8125rem", color: INK5, fontWeight: 500 }}>{unit}</span></div>
                  </div>
                ))}
              </div>
              <p className="kicker" style={{ marginBottom: 10 }}>Reputación</p>
              <div style={{ padding: 14, background: INK1, borderRadius: 10, marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.875rem", color: INK6 }}>Score</span>
                  <span style={{ fontWeight: 800, fontSize: "1.125rem", color: sel.reputationScore >= 80 ? APTO : sel.reputationScore >= 60 ? RIESGO : NO }}>{sel.reputationScore}/100</span>
                </div>
                <div style={{ height: 6, background: INK2, borderRadius: 999, marginTop: 8, overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", borderRadius: 999, background: sel.reputationScore >= 80 ? APTO : sel.reputationScore >= 60 ? RIESGO : NO, width: `${sel.reputationScore}%` }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...btnOut, flex: 1, height: 32, fontSize: "0.8125rem" }}><Eye size={14} />Ver perfil</button>
                <button style={{ ...btnInk, flex: 1, height: 32, fontSize: "0.8125rem" }}><Pencil size={14} />Editar</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: INK5, padding: 40 }}>Selecciona un conductor</div>
        )}
      </div>
    </div>
  );
}
