"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Plus, Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type RouteType = "ruta" | "zona";
type RouteItem = {
  id: string; code: string; name: string; type: RouteType; stops?: number; length?: string;
  area?: string; vehicleTypeKey?: string; companyName?: string; vehicleCount: number;
  status: "activa" | "suspendida"; frequencies?: string[];
};

const G = "#B8860B"; const GD = "#926A09"; const GBG = "#FDF8EC";
const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const NO = "#b91c1c"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

function MapStub({ name }: { name: string }) {
  const pins = [{ x: 12, y: 70, n: "A" }, { x: 28, y: 58 }, { x: 56, y: 40 }, { x: 72, y: 34 }, { x: 86, y: 26, n: "B", ink: true }];
  return (
    <div style={{ position: "relative", height: 260, borderRadius: 14, overflow: "hidden", background: "linear-gradient(135deg,#E8EEF5 0%,#DCE5EF 100%)", border: `1px solid ${INK2}` }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)", backgroundSize: "40px 40px", opacity: .7 }} />
      <div style={{ position: "absolute", height: 6, background: "#fff", width: "80%", top: "60%", left: "8%", transform: "rotate(-12deg)", transformOrigin: "left center" }} />
      {pins.map((p, i) => <div key={i} style={{ position: "absolute", width: 26, height: 26, borderRadius: "50%", background: p.ink ? INK9 : G, border: "3px solid #fff", boxShadow: "0 4px 10px rgba(0,0,0,.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "0.7rem", transform: "translate(-50%,-50%)", left: `${p.x}%`, top: `${p.y}%` }}>{p.n ?? ""}</div>)}
      <div style={{ position: "absolute", bottom: 12, left: 12, padding: "7px 10px", background: "rgba(255,255,255,.9)", borderRadius: 8, border: `1px solid ${INK2}`, display: "flex", gap: 12, fontSize: "0.7rem", fontWeight: 600, color: INK6 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: G, display: "inline-block" }} />Origen</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: INK9, display: "inline-block" }} />Destino</span>
      </div>
    </div>
  );
}

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const btnInk: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: "none", background: INK9, color: "#fff", fontFamily: "inherit" };
const btnOut: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit" };

export default function RutasPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<RouteItem[]>([]);
  const [tab, setTab] = useState<RouteType>("ruta");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<RouteItem | null>(null);

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
      const res = await fetch("/api/rutas", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error"); return; }
      setItems(data.data.items ?? []);
      const first = (data.data.items ?? []).find((i: RouteItem) => i.type === tab);
      if (first) setSel(first);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const rutas = items.filter(i => i.type === "ruta");
  const zonas = items.filter(i => i.type === "zona");
  const visible = tab === "ruta" ? rutas : zonas;

  if (!user) return null;

  return (
    <div>
      <PageHeader kicker="Operación · RF-09" title="Rutas y zonas" subtitle="Rutas fijas para transporte público y polígonos de operación para vehículos municipales."
        action={<div style={{ display: "flex", gap: 8 }}><button style={btnOut}><Download size={16} />Exportar</button><Link href="/rutas/nueva"><button style={btnInk}><Plus size={16} />Nueva ruta</button></Link></div>} />

      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${INK2}`, marginBottom: 18, marginTop: 24 }}>
        {[["ruta", "Rutas fijas", rutas.length], ["zona", "Zonas de operación", zonas.length]].map(([k, l, c]) => (
          <div key={k as string} onClick={() => { setTab(k as RouteType); const f = items.find(i => i.type === k); if (f) setSel(f); }}
            style={{ padding: "10px 14px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", borderBottom: tab === k ? `2px solid ${G}` : "2px solid transparent", marginBottom: -1, color: tab === k ? INK9 : INK5 }}>
            {l} <span style={{ marginLeft: 6, fontSize: "0.6875rem", padding: "1px 6px", borderRadius: 999, background: tab === k ? GBG : INK1, color: tab === k ? GD : INK5, fontWeight: 700 }}>{c}</span>
          </div>
        ))}
      </div>

      {error && <div style={{ padding: "12px 16px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, color: NO, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
          {loading ? <div style={{ padding: 40, textAlign: "center", color: INK5 }}>Cargando…</div>
          : visible.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: INK5 }}>Sin {tab === "ruta" ? "rutas" : "zonas"} registradas</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead><tr>{["Código", tab === "ruta" ? "Ruta" : "Zona", tab === "ruta" ? "Paradas" : "Área", "Vehíc.", "Estado"].map((h,i) => (
                <th key={i} style={{ textAlign: "left", padding: "12px 16px", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, background: "#FAFAFA", borderBottom: `1px solid ${INK2}` }}>{h}</th>
              ))}</tr></thead>
              <tbody>{visible.map(r => (
                <tr key={r.id} onClick={() => setSel(r)} style={{ cursor: "pointer", background: sel?.id === r.id ? GBG : undefined, boxShadow: sel?.id === r.id ? `inset 3px 0 0 ${G}` : undefined }}>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 6, background: "#fff", color: INK9, border: `1.5px solid ${G}`, fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.8125rem" }}>{r.code}</span></td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: "0.75rem", color: INK5 }}>{r.companyName ?? (r.frequencies?.[0] ?? "—")}</div></td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}`, fontWeight: 600 }}>{tab === "ruta" ? (r.stops != null ? `${r.stops} · ${r.length ?? ""}` : "—") : (r.area ?? "—")}</td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}>{r.vehicleCount}</td>
                  <td style={{ padding: "14px 16px", borderBottom: `1px solid ${INK1}` }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", background: r.status === "activa" ? APTOBG : NOBG, color: r.status === "activa" ? APTO : NO, border: `1px solid ${r.status === "activa" ? APTOBD : NOBD}` }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />{r.status === "activa" ? "ACTIVA" : "SUSPENDIDA"}
                    </span>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        {sel ? (
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: `1px solid ${INK2}` }}>
              <div><div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{sel.code} · {sel.name}</div><div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>{tab === "ruta" ? `${sel.stops ?? 0} paradas · ${sel.length ?? "—"}` : sel.area ?? "—"}</div></div>
              <button style={{ ...btnOut, height: 32, fontSize: "0.8125rem" }}><Pencil size={13} />Editar</button>
            </div>
            <div style={{ padding: 18 }}>
              <MapStub name={sel.name} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
                {[["Vehículos", sel.vehicleCount], ["Tipo", tab === "ruta" ? "Ruta fija" : "Zona"], ["Estado", sel.status === "activa" ? "Activa" : "Suspendida"]].map(([lbl, val]) => (
                  <div key={lbl as string} style={{ padding: 12, background: INK1, borderRadius: 10 }}>
                    <div style={{ fontSize: "0.75rem", color: INK5 }}>{lbl}</div>
                    <div style={{ fontSize: "1.125rem", fontWeight: 800, marginTop: 4 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: INK5, padding: 40 }}>Selecciona una {tab === "ruta" ? "ruta" : "zona"}</div>}
      </div>
    </div>
  );
}
