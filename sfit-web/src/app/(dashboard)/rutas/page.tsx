"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Plus, Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { GoogleMapView } from "@/components/ui/GoogleMapView";

type RouteType = "ruta" | "zona";
type Waypoint = { order: number; lat: number; lng: number; label?: string };
type RouteItem = {
  id: string; code: string; name: string; type: RouteType; stops?: number; length?: string;
  area?: string; vehicleTypeKey?: string; companyName?: string; vehicleCount: number;
  status: "activa" | "suspendida"; frequencies?: string[];
  waypoints?: Waypoint[];
};

const G = "#B8860B"; const GD = "#926A09"; const GBG = "#FDF8EC";
const NO = "#b91c1c"; const NOBG = "#FFF5F5"; const NOBD = "#FCA5A5";
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";


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

  const columns = useMemo<ColumnDef<RouteItem, unknown>[]>(() => [
    {
      id: "codigo",
      header: "Código",
      accessorFn: (row) => row.code,
      cell: ({ getValue }) => (
        <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 6, background: "#fff", color: INK9, border: `1.5px solid ${G}`, fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.8125rem" }}>
          {getValue() as string}
        </span>
      ),
    },
    {
      id: "nombre",
      header: tab === "ruta" ? "Ruta" : "Zona",
      accessorFn: (row) => `${row.name} ${row.companyName ?? ""} ${row.frequencies?.join(" ") ?? ""}`,
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.original.name}</div>
          <div style={{ fontSize: "0.75rem", color: INK5 }}>
            {row.original.companyName ?? (row.original.frequencies?.[0] ?? "—")}
          </div>
        </div>
      ),
    },
    {
      id: "paradas",
      header: tab === "ruta" ? "Paradas" : "Área",
      accessorFn: (row) => tab === "ruta" ? (row.stops ?? 0) : (row.area ?? ""),
      cell: ({ row }) => (
        <span style={{ fontWeight: 600 }}>
          {tab === "ruta"
            ? (row.original.stops != null ? `${row.original.stops} · ${row.original.length ?? ""}` : "—")
            : (row.original.area ?? "—")}
        </span>
      ),
    },
    {
      id: "vehiculos",
      header: "Vehíc.",
      accessorFn: (row) => row.vehicleCount,
      cell: ({ getValue }) => <span>{getValue() as number}</span>,
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (row) => row.status,
      cell: ({ row }) => (
        <Badge variant={row.original.status === "activa" ? "activo" : "suspendido"}>
          {row.original.status === "activa" ? "ACTIVA" : "SUSPENDIDA"}
        </Badge>
      ),
    },
  ], [tab]);

  if (!user) return null;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader kicker="Operación · RF-09" title="Rutas y zonas"
        action={<div style={{ display: "flex", gap: 8 }}><button style={btnOut}><Download size={16} />Exportar</button>{["super_admin","admin_municipal"].includes(user.role) && (<Link href="/rutas/nueva"><button style={btnInk}><Plus size={16} />Nueva ruta</button></Link>)}</div>} />

      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${INK2}`, marginBottom: 18 }}>
        {[["ruta", "Rutas fijas", rutas.length], ["zona", "Zonas de operación", zonas.length]].map(([k, l, c]) => (
          <div key={k as string} onClick={() => { setTab(k as RouteType); const f = items.find(i => i.type === k); if (f) setSel(f); }}
            style={{ padding: "10px 14px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", borderBottom: tab === k ? `2px solid ${G}` : "2px solid transparent", marginBottom: -1, color: tab === k ? INK9 : INK5 }}>
            {l} <span style={{ marginLeft: 6, fontSize: "0.6875rem", padding: "1px 6px", borderRadius: 999, background: tab === k ? GBG : INK1, color: tab === k ? GD : INK5, fontWeight: 700 }}>{c}</span>
          </div>
        ))}
      </div>

      {error && <div style={{ padding: "12px 16px", background: NOBG, border: `1px solid ${NOBD}`, borderRadius: 10, color: NO, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <DataTable
          columns={columns}
          data={visible}
          loading={loading}
          searchPlaceholder="Buscar por código, nombre, empresa…"
          emptyTitle={`Sin ${tab === "ruta" ? "rutas" : "zonas"} registradas`}
          emptyDescription="No se encontraron registros."
          onRowClick={(row) => setSel(row)}
        />

        {sel ? (
          <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: `1px solid ${INK2}` }}>
              <div><div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{sel.code} · {sel.name}</div><div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>{tab === "ruta" ? `${sel.stops ?? 0} paradas · ${sel.length ?? "—"}` : sel.area ?? "—"}</div></div>
              <Link href={`/rutas/${sel.id}`}><button style={{ ...btnOut, height: 32, fontSize: "0.8125rem" }}><Eye size={13}/>Ver detalle</button></Link>
            </div>
            <div style={{ padding: 18 }}>
              <GoogleMapView
                center={
                  sel.waypoints && sel.waypoints.length > 0
                    ? {
                        lat: sel.waypoints.reduce((s, w) => s + w.lat, 0) / sel.waypoints.length,
                        lng: sel.waypoints.reduce((s, w) => s + w.lng, 0) / sel.waypoints.length,
                      }
                    : { lat: -13.5178, lng: -71.9785 }
                }
                zoom={sel.waypoints && sel.waypoints.length > 0 ? 13 : 12}
                height={260}
                markers={
                  sel.waypoints && sel.waypoints.length > 0
                    ? sel.waypoints.map((w, i) => ({
                        lat: w.lat, lng: w.lng,
                        title: w.label ?? `Parada ${i + 1}`,
                        label: String(i + 1),
                        color: (i === 0 ? "green" : i === sel.waypoints!.length - 1 ? "red" : "gold") as "green" | "red" | "gold",
                      }))
                    : [{ lat: -13.5178, lng: -71.9785, title: sel.name, color: "gold" as const }]
                }
                polyline={sel.waypoints && sel.waypoints.length > 0 ? sel.waypoints.map(w => ({ lat: w.lat, lng: w.lng })) : []}
                style={{ borderRadius: 10 }}
              />
              {(!sel.waypoints || sel.waypoints.length === 0) && (
                <div style={{ marginTop: 8, textAlign: "center", fontSize: "0.75rem", color: "#a1a1aa" }}>
                  Sin trazado definido — edita la ruta para agregar paradas en el mapa
                </div>
              )}
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
