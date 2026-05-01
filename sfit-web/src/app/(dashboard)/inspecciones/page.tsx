"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, Check, AlertTriangle, X, Plus, Sparkles, Download, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";

type InspectionResult = "aprobada" | "observada" | "rechazada";
type Inspection = {
  id: string;
  vehicle: { plate: string; vehicleTypeKey: string; brand: string; model: string };
  fiscal: { name: string };
  driver?: { name: string } | null;
  vehicleTypeKey: string;
  date: string;
  score: number;
  result: InspectionResult;
  observations?: string;
  createdAt: string;
};
type Stats = { aprobada: number; observada: number; rechazada: number; avgScore: number; mes: number };
type Sugerencia = { item: string; fallos: number; total: number; tasaFallo: number };

const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const RIESGO = "#b45309"; const RIESGOBG = "#FFFBEB"; const RIESGOBD = "#FCD34D";
const NO = "#DC2626"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const G = "#6C0606"; const GD = "#4A0303"; const GBG = "#FBEAEA"; const GBR = "#D9B0B0";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin"];
const btnInk: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: "none", background: INK9, color: "#fff", fontFamily: "inherit" };
const btnOut: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit" };

export default function InspeccionesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Inspection[]>([]);
  const [stats, setStats] = useState<Stats>({ aprobada: 0, observada: 0, rechazada: 0, avgScore: 0, mes: 0 });
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [loadingSug, setLoadingSug] = useState(true);
  const [resultFilter, setResultFilter] = useState<string>("");
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
      const qs = new URLSearchParams({ limit: "50" });
      if (resultFilter) qs.set("result", resultFilter);
      const res = await fetch(`/api/inspecciones?${qs}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error"); return; }
      setItems(data.data.items ?? []);
      if (data.data.stats) setStats(data.data.stats as Stats);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, resultFilter, router]);

  useEffect(() => { void load(); }, [load]);

  // Carga sugerencias agregadas por municipalidad (solo una vez al montar)
  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoadingSug(true);
      try {
        const token = localStorage.getItem("sfit_access_token");
        const res = await fetch("/api/inspecciones/sugerencias", { headers: { Authorization: `Bearer ${token ?? ""}` } });
        const data = await res.json();
        if (res.ok && data.success) setSugerencias(data.data.sugerencias ?? []);
      } catch { /* silencioso */ }
      finally { setLoadingSug(false); }
    })();
  }, [user]);

  const aprobadas = stats.aprobada;
  const observadas = stats.observada;
  const rechazadas = stats.rechazada;
  const totalGlobal = stats.aprobada + stats.observada + stats.rechazada;

  const exportCSV = async () => {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = new URLSearchParams();
      if (resultFilter) qs.set("result", resultFilter);
      const res = await fetch(`/api/admin/exportar/inspecciones?${qs}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) { setError("No se pudo exportar el CSV"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inspecciones_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setError("Error de conexión al exportar"); }
  };

  const columns = useMemo<ColumnDef<Inspection, unknown>[]>(() => [
    {
      id: "acta",
      header: "Acta",
      accessorFn: (row) => `A-${(row.id ?? "").slice(-10).toUpperCase()} ${row.score}`,
      cell: ({ row }) => (
        <div>
          <div style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.75rem" }}>
            A-{(row.original.id ?? "").slice(-10).toUpperCase()}
          </div>
          <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2 }}>{row.original.score}/100</div>
        </div>
      ),
    },
    {
      id: "vehiculo",
      header: "Vehículo",
      accessorFn: (row) => `${row.vehicle?.plate ?? ""} ${row.vehicle?.brand ?? ""} ${row.vehicle?.model ?? ""} ${row.vehicleTypeKey}`,
      cell: ({ row }) => (
        <div>
          <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 6, background: INK9, color: "#fff", fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.8125rem" }}>
            {row.original.vehicle?.plate ?? "—"}
          </span>
          <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 4 }}>{row.original.vehicleTypeKey}</div>
        </div>
      ),
    },
    {
      id: "fiscal",
      header: "Fiscal",
      accessorFn: (row) => row.fiscal?.name ?? "",
      cell: ({ getValue }) => <span style={{ fontSize: "0.875rem" }}>{getValue() as string || "—"}</span>,
    },
    {
      id: "fecha",
      header: "Fecha",
      accessorFn: (row) => row.date,
      sortingFn: "datetime",
      cell: ({ row }) => (
        <span style={{ fontSize: "0.8125rem", color: INK6 }}>{fmtDate(row.original.date)}</span>
      ),
    },
    {
      id: "resultado",
      header: "Resultado",
      accessorFn: (row) => row.result,
      cell: ({ row }) => {
        const r = row.original.result;
        const labelMap: Record<InspectionResult, string> = {
          aprobada: "Aprobada",
          observada: "Observada",
          rechazada: "Rechazada",
        };
        // Estilo sobrio: sin fondos saturados; solo un punto + texto y borde gris.
        // El indicador visual es el punto coloreado pequeño.
        const dotColor: Record<InspectionResult, string> = {
          aprobada: APTO,
          observada: RIESGO,
          rechazada: NO,
        };
        return (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 10px", borderRadius: 6,
            background: "#fff", border: `1px solid ${INK2}`,
            fontSize: "0.75rem", fontWeight: 600, color: INK9,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor[r], flexShrink: 0 }} />
            {labelMap[r]}
          </span>
        );
      },
    },
    {
      id: "_nav",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: () => (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", color: INK5 }}>
          <ChevronRight size={14} />
        </span>
      ),
    },
  ], []);

  if (!user) return null;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader kicker="Operación · RF-11" title="Inspecciones"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnOut} onClick={exportCSV} disabled={items.length === 0}>
              <Download size={16} />Exportar CSV
            </button>
            {user?.role === "fiscal" && (<Link href="/inspecciones/nueva"><button style={btnInk}><Plus size={16} />Nueva inspección</button></Link>)}
          </div>
        } />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { ico: <Shield size={16} />, lbl: "Este mes",   val: stats.mes },
          { ico: <Check size={16} />,  lbl: "Aprobadas",  val: aprobadas },
          { ico: <AlertTriangle size={16} />, lbl: "Observadas", val: observadas },
          { ico: <X size={16} />,      lbl: "Rechazadas", val: rechazadas },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: INK1, border: `1px solid ${INK2}`, color: INK6, display: "flex", alignItems: "center", justifyContent: "center" }}>{m.ico}</div>
              <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: INK5 }}>{m.lbl}</div>
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05, color: INK9, fontVariantNumeric: "tabular-nums" }}>
              {loading ? "—" : m.val}
            </div>
          </div>
        ))}
      </div>

      {error && <div style={{ padding: "12px 16px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, color: NO, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
        <div>
          <DataTable
            columns={columns}
            data={items}
            loading={loading}
            onRowClick={(row) => router.push(`/inspecciones/${row.id}`)}
            searchPlaceholder="Buscar por placa, fiscal…"
            emptyTitle="Sin inspecciones registradas"
            emptyDescription="No se encontraron actas en este período."
            toolbarEnd={
              <div style={{ display: "flex", gap: 6 }}>
                {[["", "Todas"], ["aprobada", "Aprobadas"], ["observada", "Observadas"], ["rechazada", "Rechazadas"]].map(([k, l]) => (
                  <button key={k} onClick={() => setResultFilter(k)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: resultFilter === k ? INK9 : "#fff", color: resultFilter === k ? "#fff" : INK6, border: resultFilter === k ? `1.5px solid ${INK9}` : `1.5px solid ${INK2}` }}>{l}</button>
                ))}
              </div>
            }
          />
        </div>

        {/* Panel de análisis: puntos críticos + tasa aprobación (sobrio) */}
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${INK1}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: INK1, border: `1px solid ${INK2}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Sparkles size={13} color={INK6} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9, lineHeight: 1.25 }}>Puntos críticos</div>
              <div style={{ fontSize: "0.75rem", color: INK5, lineHeight: 1.3, marginTop: 1 }}>Ítems con mayor tasa de fallo</div>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            {loadingSug ? (
              <div style={{ fontSize: "0.8125rem", color: INK5, textAlign: "center", padding: 20 }}>Calculando…</div>
            ) : sugerencias.length === 0 ? (
              <div style={{ padding: 12, background: INK1, borderRadius: 8, fontSize: "0.8125rem", color: INK6 }}>
                Sin patrones de fallo detectados.
              </div>
            ) : (
              <>
                <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: INK5, marginBottom: 8 }}>
                  Top {sugerencias.length} fallas frecuentes
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {sugerencias.map((s, i) => {
                    const pct = Math.round(s.tasaFallo * 100);
                    return (
                      <div key={i} style={{ padding: "10px 12px", border: `1px solid ${INK2}`, borderRadius: 8, display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 7,
                          background: INK1, border: `1px solid ${INK2}`,
                          color: INK9,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, fontSize: "0.75rem", flexShrink: 0,
                          fontVariantNumeric: "tabular-nums",
                        }}>{pct}%</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9, overflow: "hidden", textOverflow: "ellipsis" }}>{s.item}</div>
                          <div style={{ fontSize: "0.6875rem", color: INK5, marginTop: 1 }}>{s.fallos} de {s.total} fallaron</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ marginTop: 14, padding: "12px 14px", background: INK1, borderRadius: 8, border: `1px solid ${INK2}` }}>
              <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: INK5 }}>Tasa de aprobación global</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: "1.5rem", fontWeight: 800, color: INK9, fontVariantNumeric: "tabular-nums" }}>
                  {totalGlobal ? `${Math.round((aprobadas / totalGlobal) * 100)}%` : "—"}
                </span>
                {stats.avgScore > 0 && (
                  <span style={{ fontSize: "0.75rem", color: INK5 }}>· Score {stats.avgScore}/100</span>
                )}
              </div>
              <div style={{ height: 5, background: "#fff", border: `1px solid ${INK2}`, borderRadius: 999, marginTop: 8, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", borderRadius: 999, background: INK9, width: totalGlobal ? `${(aprobadas / totalGlobal) * 100}%` : "0%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
