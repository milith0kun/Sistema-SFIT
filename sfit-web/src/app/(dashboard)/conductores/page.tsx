"use client";

import { useEffect, useState, useCallback, useMemo, cloneElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Check, Gauge, AlertTriangle, Download, Plus, Phone, Car, Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";

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

const selectStyle: React.CSSProperties = {
  height: 34,
  padding: "0 10px",
  borderRadius: 8,
  border: `1.5px solid ${INK2}`,
  fontSize: "0.8125rem",
  fontFamily: "inherit",
  background: "#fff",
  color: INK6,
  cursor: "pointer",
};

export default function ConductoresPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Driver[]>([]);
  const [filter, setFilter] = useState("todos");
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
      const res = await fetch(`/api/conductores?${qs}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar conductores"); return; }
      setItems(data.data.items ?? []);
      setCounts(data.data.statusCounts ?? {});
      if (data.data.items?.length && !sel) setSel(data.data.items[0]);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, filter, router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const total = (counts.apto ?? 0) + (counts.riesgo ?? 0) + (counts.no_apto ?? 0) || items.length;

  const columns = useMemo<ColumnDef<Driver, unknown>[]>(
    () => [
      {
        id: "conductor",
        header: "Conductor",
        accessorFn: (d) => `${d.name} ${d.dni} ${d.licenseCategory}`,
        cell: ({ row: r }) => {
          const d = r.original;
          const isSel = sel?.id === d.id;
          return (
            <div
              style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
              onClick={() => setSel(d)}
            >
              <Avatar name={d.name} />
              <div>
                <div style={{ fontWeight: 600, color: isSel ? GD : INK9 }}>{d.name}</div>
                <div style={{ fontSize: "0.75rem", color: INK5, fontFamily: "ui-monospace,monospace" }}>
                  DNI {d.dni} · {d.licenseCategory}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: "empresa",
        header: "Empresa",
        accessorFn: (d) => `${d.companyName ?? ""} ${d.licenseNumber}`,
        cell: ({ row: r }) => (
          <div style={{ cursor: "pointer" }} onClick={() => setSel(r.original)}>
            <div style={{ fontWeight: 600 }}>{r.original.companyName ?? "—"}</div>
            <div style={{ fontSize: "0.75rem", color: INK5 }}>Lic. {r.original.licenseNumber}</div>
          </div>
        ),
      },
      {
        id: "estado",
        header: "Estado",
        accessorFn: (d) => statusStyle(d.status).label,
        cell: ({ row: r }) => (
          <div style={{ cursor: "pointer" }} onClick={() => setSel(r.original)}>
            <StatusBadge s={r.original.status} />
          </div>
        ),
      },
      {
        id: "fatiga",
        header: "Fatiga",
        accessorFn: (d) => d.continuousHours,
        cell: ({ row: r }) => {
          const d = r.original;
          const pct = Math.min(100, (d.continuousHours / 10) * 100);
          const barC = d.status === "riesgo" ? RIESGO : d.status === "no_apto" ? NO : APTO;
          return (
            <div style={{ width: 140, cursor: "pointer" }} onClick={() => setSel(d)}>
              <div style={{ height: 6, background: INK1, borderRadius: 999, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", borderRadius: 999, background: barC, width: `${pct}%` }} />
              </div>
              <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 4 }}>{d.continuousHours} h conducción</div>
            </div>
          );
        },
      },
      {
        id: "reputacion",
        header: "Rep.",
        accessorFn: (d) => d.reputationScore,
        cell: ({ row: r }) => (
          <div style={{ cursor: "pointer" }} onClick={() => setSel(r.original)}>
            <span style={{ fontWeight: 700 }}>{r.original.reputationScore}</span>
            <span style={{ color: INK5, fontSize: "0.75rem" }}>/100</span>
          </div>
        ),
      },
    ],
    [sel] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const toolbarEnd = (
    <select style={selectStyle} value={filter} onChange={(e) => setFilter(e.target.value)}>
      <option value="todos">Todos ({total})</option>
      <option value="apto">Apto ({counts.apto ?? 0})</option>
      <option value="riesgo">Riesgo ({counts.riesgo ?? 0})</option>
      <option value="no_apto">No apto ({counts.no_apto ?? 0})</option>
    </select>
  );

  if (!user) return null;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader kicker="Operación · RF-05" title="Conductores"
        action={<div style={{ display: "flex", gap: 8 }}><button style={btnOut}><Download size={16} />Exportar CSV</button><Link href="/conductores/nuevo"><button style={btnInk}><Plus size={16} />Nuevo conductor</button></Link></div>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[
          { ico: <Users size={18} />, lbl: "Total registrados", val: total, ico_bg: INK1, ico_c: INK5 },
          { ico: <Check size={18} />, lbl: "APTOS ahora", val: counts.apto ?? 0, ico_bg: APTOBG, ico_c: APTO },
          { ico: <Gauge size={18} />, lbl: "En riesgo", val: counts.riesgo ?? 0, ico_bg: RIESGOBG, ico_c: RIESGO },
          { ico: <AlertTriangle size={18} />, lbl: "NO APTOS", val: counts.no_apto ?? 0, ico_bg: NOBG, ico_c: NO },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: 18, position: "relative", overflow: "hidden" }}>
            <div aria-hidden style={{ position: "absolute", right: -8, bottom: -8, color: m.ico_c, opacity: 0.16, pointerEvents: "none", lineHeight: 0 }}>
              {cloneElement(m.ico as React.ReactElement<{ size?: number; strokeWidth?: number }>, { size: 80, strokeWidth: 1.4 })}
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: m.ico_bg, color: m.ico_c, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{m.ico}</div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: INK5 }}>{m.lbl}</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 6, color: INK9 }}>{loading ? "—" : m.val}</div>
          </div>
        ))}
      </div>

      {error && <div style={{ padding: "12px 16px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, color: NO, fontSize: "0.875rem" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20 }}>
        <DataTable<Driver>
          columns={columns}
          data={items}
          loading={loading}
          searchPlaceholder="Buscar por nombre, DNI o licencia…"
          emptyTitle="Sin conductores"
          emptyDescription="No hay conductores registrados con los filtros actuales."
          defaultPageSize={20}
          toolbarEnd={toolbarEnd}
        />

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
              <Link href={`/conductores/${sel.id}`}>
                <button style={{ ...btnOut, width: "100%", height: 32, fontSize: "0.8125rem" }}><Eye size={14}/>Ver perfil completo</button>
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: INK5, padding: 40 }}>Selecciona un conductor</div>
        )}
      </div>
    </div>
  );
}
