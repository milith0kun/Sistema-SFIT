"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar, Route, Check, Clock, Download, Plus, AlertTriangle, Inbox, ChevronRight,
} from "lucide-react";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";

type TripStatus = "en_curso" | "completado" | "auto_cierre" | "cerrado_automatico";
type Trip = {
  id: string;
  vehicle: { plate: string };
  driver: { name: string };
  route?: { code: string; name: string } | null;
  startTime: string;
  endTime?: string | null;
  km: number;
  passengers: number;
  status: TripStatus;
};

/* Paleta sobria */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d"; const APTO_BD = "#86EFAC";
const INFO = "#1E40AF"; const INFO_BD = "#BFDBFE";
const RIESGO = "#B45309"; const RIESGO_BD = "#FDE68A";
const NO = "#DC2626"; const NO_BG = "#FFF5F5"; const NO_BD = "#FCA5A5";

const STATUS_META: Record<TripStatus, { color: string; bd: string; label: string }> = {
  en_curso:           { color: INFO,   bd: INFO_BD,   label: "EN CURSO" },
  completado:         { color: APTO,   bd: APTO_BD,   label: "COMPLETADO" },
  auto_cierre:        { color: RIESGO, bd: RIESGO_BD, label: "AUTO-CIERRE" },
  cerrado_automatico: { color: RIESGO, bd: RIESGO_BD, label: "AUTO-CIERRE" },
};

function StatusBadge({ s }: { s: TripStatus | undefined }) {
  const m = STATUS_META[s ?? "en_curso"] ?? { color: INK6, bd: INK2, label: "—" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 9px", borderRadius: 999,
      background: "#fff", color: m.color, border: `1px solid ${m.bd}`,
      fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
      {m.label}
    </span>
  );
}

const PERIODS: { key: string; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
  { key: "todos", label: "Histórico" },
];

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const CAN_CREATE = ["operador", "admin_municipal", "super_admin"];

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
      const res = await fetch(`/api/viajes?${qs}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar"); return; }
      setItems(data.data.items ?? []);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, period, router]);

  useEffect(() => { void load(); }, [load]);

  const enCurso = items.filter(t => t.status === "en_curso").length;
  const completados = items.filter(t => t.status === "completado").length;
  const totalKm = items.reduce((s, t) => s + (t.km ?? 0), 0);
  const autoCierre = items.filter(
    t => t.status === "auto_cierre" || t.status === "cerrado_automatico"
  ).length;
  const totalPasajeros = items.reduce((s, t) => s + (t.passengers ?? 0), 0);

  const canCreate = user ? CAN_CREATE.includes(user.role) : false;

  const columns = useMemo<ColumnDef<Trip, unknown>[]>(() => [
    {
      id: "id_viaje",
      header: "ID",
      accessorFn: (row) => row.id?.slice(-8).toUpperCase() ?? "",
      cell: ({ getValue }) => (
        <span style={{
          fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: "0.75rem",
          color: INK9, letterSpacing: "0.04em",
        }}>
          {(getValue() as string) || "—"}
        </span>
      ),
    },
    {
      id: "vehiculo",
      header: "Vehículo",
      accessorFn: (row) => row.vehicle?.plate ?? "",
      cell: ({ getValue }) => (
        <span style={{
          display: "inline-flex", alignItems: "center",
          padding: "3px 9px", borderRadius: 5,
          background: INK9, color: "#fff",
          fontFamily: "ui-monospace, monospace", fontWeight: 700,
          fontSize: "0.75rem", letterSpacing: "0.04em",
        }}>
          {(getValue() as string)?.trim() || "—"}
        </span>
      ),
    },
    {
      id: "conductor",
      header: "Conductor",
      accessorFn: (row) => row.driver?.name ?? "",
      cell: ({ getValue }) => (
        <span style={{ fontSize: "0.8125rem", color: INK9 }}>
          {(getValue() as string)?.trim() || <span style={{ color: INK5 }}>Sin conductor</span>}
        </span>
      ),
    },
    {
      id: "ruta",
      header: "Ruta / Zona",
      accessorFn: (row) => row.route ? `${row.route.code} ${row.route.name}` : "",
      cell: ({ row: r }) => (
        <span style={{ fontSize: "0.8125rem", color: INK9, fontWeight: 600 }}>
          {r.original.route
            ? `${r.original.route.code} · ${r.original.route.name}`
            : <span style={{ color: INK5, fontWeight: 500 }}>Sin asignar</span>}
        </span>
      ),
    },
    {
      id: "inicio",
      header: "Inicio",
      accessorFn: (row) => row.startTime ?? "",
      sortingFn: "datetime",
      cell: ({ row: r }) => (
        <span style={{ fontSize: "0.8125rem", color: INK9, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {r.original.startTime
            ? new Date(r.original.startTime).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
            : "—"}
        </span>
      ),
    },
    {
      id: "fin",
      header: "Fin",
      accessorFn: (row) => row.endTime ?? "",
      sortingFn: "datetime",
      cell: ({ row: r }) => (
        <span style={{
          fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums", fontWeight: 600,
          color: r.original.endTime ? INK9 : INK5,
        }}>
          {r.original.endTime
            ? new Date(r.original.endTime).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
            : "—"}
        </span>
      ),
    },
    {
      id: "km",
      header: "Km",
      accessorFn: (row) => row.km ?? 0,
      cell: ({ getValue }) => (
        <span style={{ fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums", color: INK9 }}>
          {((getValue() as number) ?? 0).toLocaleString("es-PE")}
        </span>
      ),
    },
    {
      id: "pasajeros",
      header: "Pasaj.",
      accessorFn: (row) => row.passengers ?? 0,
      cell: ({ getValue }) => {
        const n = (getValue() as number) ?? 0;
        return (
          <span style={{ fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums", color: n > 0 ? INK9 : INK5 }}>
            {n > 0 ? n.toLocaleString("es-PE") : "—"}
          </span>
        );
      },
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (row) => row.status,
      cell: ({ row: r }) => <StatusBadge s={r.original.status} />,
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
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      <PageHeader
        kicker="Operación · RF-10"
        title="Viajes"
        subtitle={`${items.length} en período · ${enCurso} en curso${autoCierre > 0 ? ` · ${autoCierre} auto-cierres` : ""}`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 36, padding: "0 14px", borderRadius: 9,
              border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
              fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              <Download size={14} />Exportar CSV
            </button>
            {canCreate && (
              <Link href="/viajes/nueva">
                <button style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  height: 36, padding: "0 14px", borderRadius: 9,
                  border: "none",
                  background: INK9, color: "#fff",
                  fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>
                  <Plus size={14} />Iniciar viaje
                </button>
              </Link>
            )}
          </div>
        }
      />

      <KPIStrip cols={4} items={[
        { label: "TOTAL VIAJES", value: loading ? "—" : items.length, subtitle: PERIODS.find(p => p.key === period)?.label.toLowerCase() ?? "del período", icon: Calendar },
        { label: "EN CURSO", value: loading ? "—" : enCurso, subtitle: "operando ahora", icon: Route, accent: INFO },
        { label: "KM ACUMULADOS", value: loading ? "—" : totalKm.toLocaleString("es-PE"), subtitle: "del período", icon: Check, accent: APTO },
        { label: "AUTO-CIERRES", value: loading ? "—" : autoCierre, subtitle: "cerrados por sistema", icon: Clock, accent: autoCierre > 0 ? RIESGO : undefined },
      ]} />

      {error && (
        <div role="alert" style={{
          padding: "10px 14px", background: NO_BG, border: `1px solid ${NO_BD}`,
          borderRadius: 8, color: NO, fontSize: "0.8125rem",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />{error}
        </div>
      )}

      {/* Toolbar de período */}
      <div style={{
        background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10,
        padding: "8px 10px",
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
      }}>
        <div style={{
          fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: INK5, marginRight: 4,
        }}>
          Período
        </div>
        {PERIODS.map(p => {
          const active = period === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding: "5px 11px", borderRadius: 6,
                fontSize: "0.75rem", fontWeight: active ? 700 : 600,
                cursor: "pointer", fontFamily: "inherit",
                background: active ? INK9 : "#fff",
                color: active ? "#fff" : INK6,
                border: `1px solid ${active ? INK9 : INK2}`,
                transition: "all 120ms",
              }}
            >
              {p.label}
            </button>
          );
        })}
        <span style={{
          marginLeft: "auto", fontSize: "0.75rem", color: INK5,
          fontVariantNumeric: "tabular-nums",
        }}>
          {items.length} viajes · {totalPasajeros.toLocaleString("es-PE")} pasajeros · {completados} completados
        </span>
      </div>

      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        searchPlaceholder="Buscar por placa, conductor, ruta…"
        emptyTitle="Sin viajes en este período"
        emptyDescription={
          period === "hoy"
            ? "No se encontraron viajes registrados hoy. Cambia de período o inicia un viaje."
            : "No se encontraron registros para el período seleccionado."
        }
        onRowClick={(row) => router.push(`/viajes/${row.id}`)}
      />

      {/* Empty hint cuando hay datos pero filtro restringe — opcional */}
      {!loading && items.length === 0 && (
        <div style={{
          background: "#fff", border: `1px dashed ${INK2}`, borderRadius: 10,
          padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 12,
          fontSize: "0.8125rem", color: INK5,
        }}>
          <Inbox size={16} color={INK5} />
          <span>
            Si esperabas ver viajes aquí, ejecuta <code style={{
              fontFamily: "ui-monospace, monospace", padding: "1px 6px", borderRadius: 4,
              background: INK1, border: `1px solid ${INK2}`, color: INK9,
            }}>npx tsx scripts/seed-viajes-hoy.ts</code> en la terminal.
          </span>
        </div>
      )}
    </div>
  );
}
