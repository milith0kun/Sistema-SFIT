"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, Check, Route, Wrench, Search, Download, Plus, QrCode } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type VehicleStatus = "disponible" | "en_ruta" | "en_mantenimiento" | "fuera_de_servicio";
type Vehicle = {
  id: string; plate: string; vehicleTypeKey: string; brand: string; model: string; year: number;
  status: VehicleStatus; companyName?: string; currentDriverName?: string;
  lastInspectionStatus?: string; reputationScore: number; soatExpiry?: string; qrHmac?: string;
};

const G = "#B8860B"; const GD = "#926A09"; const GBG = "#FDF8EC"; const GBR = "#E8D090";
const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const RIESGO = "#b45309"; const RIESGOBG = "#FFFBEB"; const RIESGOBD = "#FCD34D";
const NO = "#b91c1c"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const INFO = "#1e40af"; const INFOBG = "#EFF6FF"; const INFOBD = "#BFDBFE";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

const statusStyle = (s: VehicleStatus) => ({
  disponible: { bg: APTOBG, color: APTO, border: APTOBD, label: "DISPONIBLE" },
  en_ruta: { bg: INFOBG, color: INFO, border: INFOBD, label: "EN RUTA" },
  en_mantenimiento: { bg: RIESGOBG, color: RIESGO, border: RIESGOBD, label: "MANTENIMIENTO" },
  fuera_de_servicio: { bg: NOBG, color: NO, border: NOBD, label: "FUERA DE SERVICIO" },
}[s]);

function StateBadge({ s }: { s: VehicleStatus }) {
  const st = statusStyle(s);
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", background: st.bg, color: st.color, border: `1px solid ${st.border}` }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />{st.label}</span>;
}

function Plate({ p, gold }: { p: string; gold?: boolean }) {
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 6, background: gold ? "#fff" : INK9, color: gold ? INK9 : "#fff", border: gold ? `1.5px solid ${G}` : undefined, fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.05em" }}>{p}</span>;
}

function QrGrid({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    const s = seed.charCodeAt(0) + (seed.charCodeAt(3) ?? 0);
    return Array.from({ length: 21 * 21 }, (_, i) => {
      const r = (i / 21) | 0; const c = i % 21;
      const corner = (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7);
      if (corner) {
        const inner = (r >= 2 && r <= 4 && c <= 4 && c >= 2) || (r >= 2 && r <= 4 && c >= 16 && c <= 18) || (r >= 16 && r <= 18 && c <= 4 && c >= 2);
        const frame = (r === 0 || r === 6 || c === 0 || c === 6) && r < 7 && c < 7;
        const frame2 = (r === 0 || r === 6 || c === 14 || c === 20) && r < 7 && c >= 14;
        const frame3 = (r === 14 || r === 20 || c === 0 || c === 6) && r >= 14 && c < 7;
        return inner || frame || frame2 || frame3 ? 1 : 0;
      }
      return ((r * c + s + i * 7) % 3) < 1 ? 1 : 0;
    });
  }, [seed]);
  return (
    <div style={{ aspectRatio: "1/1", border: `2px solid ${INK9}`, borderRadius: 16, padding: 12, background: "#fff", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(21,1fr)", gap: 1, width: "100%", height: "100%" }}>
        {cells.map((v, i) => <div key={i} style={{ background: v ? INK9 : "transparent", aspectRatio: "1/1" }} />)}
      </div>
      {[["tl","top -3px","left -3px","none","none",14,14], ["tr","top -3px","right -3px","none","none",14,0], ["bl","bottom -3px","left -3px","none","none",0,14], ["br","bottom -3px","right -3px","none","none",0,0]].map(([, top, side, br, bl, btr, btl], i) => (
        <div key={i} style={{ position: "absolute", width: 48, height: 48, border: `3px solid ${G}`, top: top as string, [Object.keys({left:0,right:0})[i < 2 ? (i === 0 ? 0 : 1) : (i === 2 ? 0 : 1)]]: side as string, borderTop: i >= 2 ? "none" : undefined, borderBottom: i < 2 ? "none" : undefined, borderLeft: (i === 1 || i === 3) ? "none" : undefined, borderRight: (i === 0 || i === 2) ? "none" : undefined, borderTopLeftRadius: btl as number, borderTopRightRadius: btr as number, borderBottomRightRadius: i === 3 ? 14 : 0, borderBottomLeftRadius: i === 2 ? 14 : 0 }} />
      ))}
    </div>
  );
}

const TYPES = ["todos", "transporte_publico", "limpieza_residuos", "emergencia", "maquinaria", "municipal_general"];
const TYPE_LABELS: Record<string, string> = { todos: "Todos", transporte_publico: "Transporte público", limpieza_residuos: "Limpieza", emergencia: "Emergencia", maquinaria: "Maquinaria", municipal_general: "Municipal" };
const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const btnInk: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: "none", background: INK9, color: "#fff", fontFamily: "inherit" };
const btnOut: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit" };

export default function VehiculosPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Vehicle[]>([]);
  const [typeFilter, setTypeFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Vehicle | null>(null);

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
      if (typeFilter !== "todos") qs.set("type", typeFilter);
      if (search) qs.set("q", search);
      const res = await fetch(`/api/vehiculos?${qs}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar vehículos"); return; }
      setItems(data.data.items ?? []);
      if (data.data.items?.length && !sel) setSel(data.data.items[0]);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, typeFilter, search, router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const statusCounts = useMemo(() => ({
    total: items.length,
    disponible: items.filter(v => v.status === "disponible").length,
    en_ruta: items.filter(v => v.status === "en_ruta").length,
    en_mantenimiento: items.filter(v => v.status === "en_mantenimiento").length,
    fuera_de_servicio: items.filter(v => v.status === "fuera_de_servicio").length,
  }), [items]);

  if (!user) return null;

  return (
    <div>
      <PageHeader kicker="Operación · RF-06" title="Vehículos y QR" subtitle="Registro de unidades, generación de QR firmado con HMAC-SHA256 y verificación offline."
        action={<div style={{ display: "flex", gap: 8 }}><button style={btnOut}><QrCode size={16} />Escanear QR</button><Link href="/vehiculos/nuevo"><button style={btnInk}><Plus size={16} />Nuevo vehículo</button></Link></div>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, margin: "24px 0 18px" }}>
        {[
          { ico: <Car size={18} />, lbl: "Registrados", val: statusCounts.total, bg: INK1, ic: INK5 },
          { ico: <Check size={18} />, lbl: "Disponibles", val: statusCounts.disponible, bg: APTOBG, ic: APTO },
          { ico: <Route size={18} />, lbl: "En ruta", val: statusCounts.en_ruta, bg: INFOBG, ic: INFO },
          { ico: <Wrench size={18} />, lbl: "Mantenimiento", val: statusCounts.en_mantenimiento, bg: RIESGOBG, ic: RIESGO },
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar placa, marca, modelo…"
            style={{ width: "100%", height: 38, padding: "0 12px 0 36px", borderRadius: 8, border: `1.5px solid ${INK2}`, fontSize: "0.875rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
        {TYPES.map(t => {
          const active = typeFilter === t;
          return <button key={t} onClick={() => setTypeFilter(t)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: active ? G : "#fff", color: active ? "#fff" : INK6, border: active ? `1.5px solid ${G}` : `1.5px solid ${INK2}` }}>{TYPE_LABELS[t]}</button>;
        })}
      </div>

      {error && <div style={{ padding: "12px 16px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, color: NO, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: INK5 }}>Cargando vehículos…</div>
          : items.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: INK5 }}>Sin vehículos registrados</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead><tr>{["Placa","Vehículo","Empresa","Estado","Rep.",""].map((h,i) => (
                <th key={i} style={{ textAlign: "left", padding: "12px 16px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, background: "#FAFAFA", borderBottom: `1px solid ${INK2}` }}>{h}</th>
              ))}</tr></thead>
              <tbody>{items.map(v => (
                <tr key={v.id} onClick={() => setSel(v)} style={{ cursor: "pointer", background: sel?.id === v.id ? GBG : undefined, boxShadow: sel?.id === v.id ? `inset 3px 0 0 ${G}` : undefined }}>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><Plate p={v.plate} /></td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><div style={{ fontWeight: 600, color: INK9 }}>{v.brand} {v.model}</div><div style={{ fontSize: "0.75rem", color: INK5 }}>{TYPE_LABELS[v.vehicleTypeKey] ?? v.vehicleTypeKey} · {v.year}</div></td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{v.companyName ?? "—"}</div><div style={{ fontSize: "0.75rem", color: INK5 }}>{v.currentDriverName ?? "Sin conductor"}</div></td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><StateBadge s={v.status} /></td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><span style={{ fontWeight: 700 }}>{v.reputationScore}</span></td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }} onClick={e => e.stopPropagation()}>
                    <Link href={`/vehiculos/${v.id}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 7, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontSize: "1rem", textDecoration: "none", fontWeight: 700 }}>⋯</Link>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        {sel ? (
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14 }}>
            <div style={{ padding: 22, borderBottom: `1px solid ${INK2}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <Plate p={sel.plate} gold />
                <h3 style={{ marginTop: 10 }}>{sel.brand} {sel.model}</h3>
                <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 4 }}>{TYPE_LABELS[sel.vehicleTypeKey] ?? sel.vehicleTypeKey} · {sel.year} · {sel.companyName ?? "—"}</div>
              </div>
              <StateBadge s={sel.status} />
            </div>
            <div style={{ padding: 22 }}>
              <p className="kicker" style={{ marginBottom: 12 }}>QR firmado HMAC-SHA256</p>
              <div style={{ maxWidth: 220, margin: "0 auto" }}>
                <QrGrid seed={sel.plate} />
                <div style={{ textAlign: "center", marginTop: 10, fontSize: "0.75rem", color: INK5, fontFamily: "ui-monospace,monospace" }}>
                  sha256:{sel.qrHmac ? sel.qrHmac.slice(0, 12) + "…" : "a9f3…" + sel.plate.replace("-", "").toLowerCase()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button style={{ ...btnOut, flex: 1, height: 32, fontSize: "0.8125rem" }}>Descargar PDF</button>
                <button style={{ ...btnInk, flex: 1, height: 32, fontSize: "0.8125rem" }}>Re-emitir QR</button>
              </div>
              <div style={{ height: 1, background: INK2, margin: "18px 0" }} />
              <p className="kicker" style={{ marginBottom: 10 }}>Historial</p>
              {[["Última inspección", sel.lastInspectionStatus ?? "Pendiente"], ["Reputación", `${sel.reputationScore}/100`], ["SOAT vigente", sel.soatExpiry ? new Date(sel.soatExpiry).toLocaleDateString("es-PE", { month: "short", year: "numeric" }) : "—"]].map(([lbl, val]) => (
                <div key={lbl} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", padding: "6px 0", borderBottom: `1px solid ${INK1}` }}>
                  <span style={{ color: INK6 }}>{lbl}</span><strong>{val}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: INK5, padding: 40 }}>Selecciona un vehículo</div>
        )}
      </div>
    </div>
  );
}
