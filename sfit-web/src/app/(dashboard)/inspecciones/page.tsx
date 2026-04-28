"use client";

import { useEffect, useState, useCallback, cloneElement, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, Check, AlertTriangle, X, QrCode, Plus, Sparkles, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";

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

const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const RIESGO = "#b45309"; const RIESGOBG = "#FFFBEB"; const RIESGOBD = "#FCD34D";
const NO = "#DC2626"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const G = "#6C0606"; const GD = "#4A0303"; const GBG = "#FBEAEA"; const GBR = "#D9B0B0";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const AI_SUGGESTIONS = [
  { t: "Sistema de frenos", r: "Historial de reportes ciudadanos", p: 92 },
  { t: "Luces traseras", r: "Observación en última inspección", p: 78 },
  { t: "Cinturones de seguridad", r: "Vehículo con alto kilometraje", p: 64 },
];

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin"];
const btnInk: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: "none", background: INK9, color: "#fff", fontFamily: "inherit" };
const btnOut: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit" };

export default function InspeccionesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Inspection[]>([]);
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
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, resultFilter, router]);

  useEffect(() => { void load(); }, [load]);

  const aprobadas = items.filter(i => i.result === "aprobada").length;
  const observadas = items.filter(i => i.result === "observada").length;
  const rechazadas = items.filter(i => i.result === "rechazada").length;

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
        const variantMap: Record<InspectionResult, React.ComponentProps<typeof Badge>["variant"]> = {
          aprobada: "activo",
          observada: "pendiente",
          rechazada: "suspendido",
        };
        const labelMap: Record<InspectionResult, string> = {
          aprobada: "APROBADA",
          observada: "OBSERVADA",
          rechazada: "RECHAZADA",
        };
        return <Badge variant={variantMap[r]}>{labelMap[r]}</Badge>;
      },
    },
  ], []);

  if (!user) return null;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader kicker="Operación · RF-11" title="Inspecciones"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={btnOut}
              onClick={() => {
                const token = localStorage.getItem("sfit_access_token");
                const qs = new URLSearchParams();
                if (resultFilter) qs.set("result", resultFilter);
                window.open(`/api/admin/exportar/inspecciones?${qs.toString()}`, "_blank");
              }}
            >
              <Download size={16} />Exportar CSV
            </button>
            <button style={btnOut}><QrCode size={16} />Escanear QR</button>
            {user?.role === "fiscal" && (<Link href="/inspecciones/nueva"><button style={btnInk}><Plus size={16} />Nueva inspección</button></Link>)}
          </div>
        } />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[
          { ico: <Shield size={18} />, lbl: "Este mes", val: items.length, bg: INK1, ic: INK5 },
          { ico: <Check size={18} />, lbl: "Aprobadas", val: aprobadas, bg: APTOBG, ic: APTO },
          { ico: <AlertTriangle size={18} />, lbl: "Observadas", val: observadas, bg: RIESGOBG, ic: RIESGO },
          { ico: <X size={18} />, lbl: "Rechazadas", val: rechazadas, bg: NOBG, ic: NO },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: 18, position: "relative", overflow: "hidden" }}>
            <div aria-hidden style={{ position: "absolute", right: -8, bottom: -8, color: m.ic, opacity: 0.16, pointerEvents: "none", lineHeight: 0 }}>
              {cloneElement(m.ico as React.ReactElement<{ size?: number; strokeWidth?: number }>, { size: 80, strokeWidth: 1.4 })}
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: m.bg, color: m.ic, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{m.ico}</div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: INK5 }}>{m.lbl}</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 6, color: INK9 }}>{loading ? "—" : m.val}</div>
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

        {/* AI Suggestions Panel */}
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14 }}>
          <div style={{ padding: "16px 22px", borderBottom: `1px solid ${INK2}`, background: `linear-gradient(135deg,${GBG},#fff)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.9375rem" }}><Sparkles size={16} color={G} />Sugerencias de IA</div>
            <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>Análisis del historial de flota</div>
          </div>
          <div style={{ padding: 18 }}>
            <div style={{ padding: 14, background: INK1, borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontSize: "0.75rem", color: INK5 }}>Próximas inspecciones prioritarias</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>Basado en historial y reportes ciudadanos</div>
            </div>
            <p className="kicker" style={{ marginBottom: 10 }}>Puntos prioritarios</p>
            {AI_SUGGESTIONS.map((s, i) => (
              <div key={i} style={{ padding: 12, border: `1px solid ${INK2}`, borderRadius: 10, marginBottom: 8, display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: GBG, color: GD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.75rem", flexShrink: 0 }}>{s.p}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{s.t}</div>
                  <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2 }}>{s.r}</div>
                </div>
                <button style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${INK2}`, background: "#fff", color: INK6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Check size={13} /></button>
              </div>
            ))}
            <div style={{ marginTop: 16, padding: 14, background: GBG, borderRadius: 10, border: `1px solid ${GBR}` }}>
              <div style={{ fontSize: "0.8125rem", color: GD, fontWeight: 600 }}>Tasa de aprobación</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: G, marginTop: 4 }}>
                {items.length ? `${Math.round((aprobadas / items.length) * 100)}%` : "—"}
              </div>
              <div style={{ height: 6, background: "rgba(108,6,6,.15)", borderRadius: 999, marginTop: 8, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", borderRadius: 999, background: G, width: items.length ? `${(aprobadas / items.length) * 100}%` : "0%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
