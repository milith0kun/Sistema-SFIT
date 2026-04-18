"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Route, Check, Clock, Search, Filter, Download, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type TripStatus = "en_curso" | "completado" | "auto_cierre";
type Trip = {
  id: string;
  vehicle: { plate: string };
  driver: { name: string };
  route?: { code: string; name: string } | null;
  startTime: string; endTime?: string | null;
  km: number; passengers: number; status: TripStatus;
};

const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const RIESGO = "#b45309"; const RIESGOBG = "#FFFBEB"; const RIESGOBD = "#FCD34D";
const NO = "#b91c1c"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const INFO = "#1e40af"; const INFOBG = "#EFF6FF"; const INFOBD = "#BFDBFE";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

function StatusBadge({ s }: { s: TripStatus }) {
  const map = {
    completado: { bg: APTOBG, color: APTO, border: APTOBD, label: "COMPLETADO" },
    en_curso: { bg: INFOBG, color: INFO, border: INFOBD, label: "EN CURSO" },
    auto_cierre: { bg: RIESGOBG, color: RIESGO, border: RIESGOBD, label: "AUTO-CIERRE" },
  };
  const st = map[s];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", background: st.bg, color: st.color, border: `1px solid ${st.border}` }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />{st.label}</span>;
}

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const btnInk: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: "none", background: INK9, color: "#fff", fontFamily: "inherit" };
const btnOut: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit" };

export default function ViajesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Trip[]>([]);
  const [period, setPeriod] = useState("hoy");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const qs = new URLSearchParams({ period, limit: "100" });
      const res = await fetch(`/api/viajes?${qs}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error"); return; }
      setItems(data.data.items ?? []);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, period, router]);

  useEffect(() => { void load(); }, [load]);

  const enCurso = items.filter(t => t.status === "en_curso").length;
  const totalKm = items.reduce((s, t) => s + t.km, 0);
  const autoCierre = items.filter(t => t.status === "auto_cierre").length;

  if (!user) return null;

  return (
    <div>
      <PageHeader kicker="Operación · RF-10" title="Viajes" subtitle="Historial y operaciones en tiempo real. Cierre automático si un viaje excede el tiempo estimado."
        action={<div style={{ display: "flex", gap: 8 }}><button style={btnOut}><Download size={16} />Exportar CSV</button><button style={btnInk}><Plus size={16} />Iniciar viaje</button></div>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, margin: "24px 0 18px" }}>
        {[
          { ico: <Calendar size={18} />, lbl: "Total", val: items.length, bg: INK1, ic: INK5 },
          { ico: <Route size={18} />, lbl: "En curso", val: enCurso, bg: INFOBG, ic: INFO },
          { ico: <Check size={18} />, lbl: "Km acumulados", val: totalKm.toLocaleString(), bg: APTOBG, ic: APTO },
          { ico: <Clock size={18} />, lbl: "Auto-cierres", val: autoCierre, bg: RIESGOBG, ic: RIESGO },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: 18 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: m.bg, color: m.ic, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{m.ico}</div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: INK5 }}>{m.lbl}</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 6, color: INK9 }}>{loading ? "—" : m.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 340 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: INK5, pointerEvents: "none" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por placa o conductor…"
            style={{ width: "100%", height: 38, padding: "0 12px 0 36px", borderRadius: 8, border: `1.5px solid ${INK2}`, fontSize: "0.875rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
        {[["hoy","Hoy"],["semana","Esta semana"],["mes","Este mes"],["todos","Histórico"]].map(([k,l]) => (
          <button key={k} onClick={() => setPeriod(k)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: period === k ? INK9 : "#fff", color: period === k ? "#fff" : INK6, border: period === k ? `1.5px solid ${INK9}` : `1.5px solid ${INK2}` }}>{l}</button>
        ))}
        <div style={{ marginLeft: "auto" }}><button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "#fff", color: INK6, border: `1.5px solid ${INK2}` }}><Filter size={14} />Estado</button></div>
      </div>

      {error && <div style={{ padding: "12px 16px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, color: NO, marginBottom: 16 }}>{error}</div>}

      <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
        {loading ? <div style={{ padding: 40, textAlign: "center", color: INK5 }}>Cargando viajes…</div>
        : items.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: INK5 }}>Sin viajes en este período</div>
        : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead><tr>{["ID","Vehículo","Conductor","Ruta/Zona","Inicio","Fin","Km","Pasaj.","Estado"].map((h,i) => (
              <th key={i} style={{ textAlign: "left", padding: "12px 16px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, background: "#FAFAFA", borderBottom: `1px solid ${INK2}` }}>{h}</th>
            ))}</tr></thead>
            <tbody>{items.map(t => (
              <tr key={t.id}>
                <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.75rem" }}>{t.id.slice(-8).toUpperCase()}</span></td>
                <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 6, background: INK9, color: "#fff", fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.8125rem" }}>{t.vehicle.plate}</span></td>
                <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}>{t.driver.name}</td>
                <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}`, fontWeight: 600 }}>{t.route ? `${t.route.code} ${t.route.name}` : "—"}</td>
                <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}`, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{t.startTime ? new Date(t.startTime).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}`, fontWeight: 600, color: t.endTime ? INK9 : INK5, fontVariantNumeric: "tabular-nums" }}>{t.endTime ? new Date(t.endTime).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}`, fontVariantNumeric: "tabular-nums" }}>{t.km}</td>
                <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}`, fontVariantNumeric: "tabular-nums" }}>{t.passengers || "—"}</td>
                <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><StatusBadge s={t.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
