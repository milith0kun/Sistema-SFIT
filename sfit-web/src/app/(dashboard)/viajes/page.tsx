"use client";

import { useEffect, useState, useCallback, cloneElement, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Route, Check, Clock, Download, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";

type TripStatus = "en_curso" | "completado" | "auto_cierre";
type Trip = {
  id: string;
  vehicle: { plate: string };
  driver: { name: string };
  route?: { code: string; name: string } | null;
  startTime: string; endTime?: string | null;
  km: number; passengers: number; status: TripStatus;
};

const APTO = "#15803d"; const APTOBG = "#F0FDF4";
const RIESGO = "#b45309"; const RIESGOBG = "#FFFBEB";
const INFO = "#1e40af"; const INFOBG = "#EFF6FF";
const NO = "#b91c1c"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const btnInk: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: "none", background: INK9, color: "#fff", fontFamily: "inherit" };
const btnOut: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit" };

export default function ViajesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Trip[]>([]);
  const [period, setPeriod] = useState("hoy");
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

  const columns = useMemo<ColumnDef<Trip, unknown>[]>(() => [
    {
      id: "id_viaje",
      header: "ID",
      accessorFn: (row) => row.id.slice(-8).toUpperCase(),
      cell: ({ getValue }) => (
        <span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.75rem" }}>
          {getValue() as string}
        </span>
      ),
    },
    {
      id: "vehiculo",
      header: "Vehículo",
      accessorFn: (row) => row.vehicle?.plate ?? "",
      cell: ({ getValue }) => (
        <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 6, background: INK9, color: "#fff", fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.8125rem" }}>
          {(getValue() as string) || "—"}
        </span>
      ),
    },
    {
      id: "conductor",
      header: "Conductor",
      accessorFn: (row) => row.driver?.name ?? "",
      cell: ({ getValue }) => <span>{(getValue() as string) || "—"}</span>,
    },
    {
      id: "ruta",
      header: "Ruta/Zona",
      accessorFn: (row) => row.route ? `${row.route.code} ${row.route.name}` : "",
      cell: ({ row }) => (
        <span style={{ fontWeight: 600 }}>
          {row.original.route ? `${row.original.route.code} ${row.original.route.name}` : "—"}
        </span>
      ),
    },
    {
      id: "inicio",
      header: "Inicio",
      accessorFn: (row) => row.startTime,
      sortingFn: "datetime",
      cell: ({ row }) => (
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {row.original.startTime
            ? new Date(row.original.startTime).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
            : "—"}
        </span>
      ),
    },
    {
      id: "fin",
      header: "Fin",
      accessorFn: (row) => row.endTime ?? "",
      sortingFn: "datetime",
      cell: ({ row }) => (
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: row.original.endTime ? INK9 : INK5 }}>
          {row.original.endTime
            ? new Date(row.original.endTime).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
            : "—"}
        </span>
      ),
    },
    {
      id: "km",
      header: "Km",
      accessorFn: (row) => row.km,
      cell: ({ getValue }) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{getValue() as number}</span>,
    },
    {
      id: "pasajeros",
      header: "Pasaj.",
      accessorFn: (row) => row.passengers,
      cell: ({ getValue }) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{(getValue() as number) || "—"}</span>,
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (row) => row.status,
      cell: ({ row }) => {
        const s = row.original.status;
        const variantMap: Record<TripStatus, React.ComponentProps<typeof Badge>["variant"]> = {
          completado: "activo",
          en_curso: "info",
          auto_cierre: "pendiente",
        };
        const labelMap: Record<TripStatus, string> = {
          completado: "COMPLETADO",
          en_curso: "EN CURSO",
          auto_cierre: "AUTO-CIERRE",
        };
        return <Badge variant={variantMap[s]}>{labelMap[s]}</Badge>;
      },
    },
    {
      id: "acciones",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <Link href={`/viajes/${row.original.id}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 7, border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontSize: "1rem", textDecoration: "none", fontWeight: 700 }}>⋯</Link>
      ),
    },
  ], []);

  if (!user) return null;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader kicker="Operación · RF-10" title="Viajes"
        action={<div style={{ display: "flex", gap: 8 }}><button style={btnOut}><Download size={16} />Exportar CSV</button>{user.role === "operador" && (<button style={btnInk}><Plus size={16} />Iniciar viaje</button>)}</div>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[
          { ico: <Calendar size={18} />, lbl: "Total", val: items.length, bg: INK1, ic: INK5 },
          { ico: <Route size={18} />, lbl: "En curso", val: enCurso, bg: INFOBG, ic: INFO },
          { ico: <Check size={18} />, lbl: "Km acumulados", val: totalKm.toLocaleString(), bg: APTOBG, ic: APTO },
          { ico: <Clock size={18} />, lbl: "Auto-cierres", val: autoCierre, bg: RIESGOBG, ic: RIESGO },
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

      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        searchPlaceholder="Buscar por placa, conductor, ruta…"
        emptyTitle="Sin viajes en este período"
        emptyDescription="No se encontraron registros de viajes."
        toolbarEnd={
          <div style={{ display: "flex", gap: 6 }}>
            {[["hoy","Hoy"],["semana","Esta semana"],["mes","Este mes"],["todos","Histórico"]].map(([k,l]) => (
              <button key={k} onClick={() => setPeriod(k)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: period === k ? INK9 : "#fff", color: period === k ? "#fff" : INK6, border: period === k ? `1.5px solid ${INK9}` : `1.5px solid ${INK2}` }}>{l}</button>
            ))}
          </div>
        }
      />
    </div>
  );
}
