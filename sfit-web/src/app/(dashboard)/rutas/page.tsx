"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Plus, Pencil, Eye, MapPin, Map, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { GoogleMapView } from "@/components/ui/GoogleMapView";

type RouteType = "ruta" | "zona";
type Waypoint = { order: number; lat: number; lng: number; label?: string };
type RouteItem = {
  id: string; code: string; name: string; type: RouteType;
  stops?: number; length?: string; area?: string;
  vehicleTypeKey?: string; companyName?: string; vehicleCount: number;
  status: "activa" | "suspendida"; frequencies?: string[];
  waypoints?: Waypoint[];
};

/* Paleta sobria */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d"; const APTO_BD = "#86EFAC";
const NO = "#DC2626"; const NO_BG = "#FFF5F5"; const NO_BD = "#FCA5A5";

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
// Operador edita y crea rutas de su empresa además de los admins.
const CAN_CREATE = ["admin_municipal", "super_admin", "operador"];
const CAN_EDIT = ["admin_municipal", "super_admin", "operador"];

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 9px", borderRadius: 999,
      background: "#fff", color: active ? APTO : NO,
      border: `1px solid ${active ? APTO_BD : NO_BD}`,
      fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
      {active ? "ACTIVA" : "SUSPENDIDA"}
    </span>
  );
}

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
      const res = await fetch("/api/rutas", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error"); return; }
      setItems(data.data.items ?? []);
      const first = (data.data.items ?? []).find((i: RouteItem) => i.type === tab);
      if (first) setSel(first);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  useEffect(() => { void load(); }, [load]);

  const rutas = items.filter(i => i.type === "ruta");
  const zonas = items.filter(i => i.type === "zona");
  const visible = tab === "ruta" ? rutas : zonas;
  const canEdit = user ? CAN_EDIT.includes(user.role) : false;
  const canCreate = user ? CAN_CREATE.includes(user.role) : false;

  const columns = useMemo<ColumnDef<RouteItem, unknown>[]>(() => [
    {
      id: "codigo",
      header: "Código",
      accessorFn: (row) => row.code,
      cell: ({ getValue }) => (
        <span style={{
          display: "inline-flex", alignItems: "center",
          padding: "3px 9px", borderRadius: 5,
          background: INK9, color: "#fff",
          fontFamily: "ui-monospace, monospace", fontWeight: 700,
          fontSize: "0.75rem", letterSpacing: "0.04em",
        }}>
          {(getValue() as string) ?? "—"}
        </span>
      ),
    },
    {
      id: "nombre",
      header: tab === "ruta" ? "Ruta" : "Zona",
      accessorFn: (row) => `${row.name} ${row.companyName ?? ""} ${row.frequencies?.join(" ") ?? ""}`,
      cell: ({ row: r }) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.875rem", color: INK9 }}>
            {r.original.name?.trim() || "Sin nombre"}
          </div>
          <div style={{ fontSize: "0.75rem", color: INK5 }}>
            {r.original.companyName?.trim()
              || (r.original.frequencies?.[0]?.trim())
              || <span style={{ color: INK5 }}>—</span>}
          </div>
        </div>
      ),
    },
    {
      id: "paradas",
      header: tab === "ruta" ? "Paradas" : "Área",
      accessorFn: (row) => tab === "ruta" ? (row.stops ?? 0) : (row.area ?? ""),
      cell: ({ row: r }) => (
        <span style={{ fontSize: "0.8125rem", color: INK9, fontVariantNumeric: "tabular-nums" }}>
          {tab === "ruta"
            ? (r.original.stops != null
                ? `${r.original.stops}${r.original.length ? ` · ${r.original.length}` : ""}`
                : "—")
            : (r.original.area?.trim() || "—")
          }
        </span>
      ),
    },
    {
      id: "vehiculos",
      header: "Vehíc.",
      accessorFn: (row) => row.vehicleCount ?? 0,
      cell: ({ getValue }) => (
        <span style={{ fontSize: "0.8125rem", color: INK9, fontVariantNumeric: "tabular-nums" }}>
          {(getValue() as number) ?? 0}
        </span>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (row) => row.status,
      cell: ({ row: r }) => <StatusBadge active={r.original.status === "activa"} />,
    },
  ], [tab]);

  if (!user) return null;

  const headerAction = (
    <div style={{ display: "flex", gap: 8 }}>
      <button style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 36, padding: "0 14px", borderRadius: 9,
        border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
        fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      }}>
        <Download size={14} />Exportar
      </button>
      {canCreate && (
        <Link href="/rutas/nueva">
          <button style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 36, padding: "0 14px", borderRadius: 9,
            border: "none",
            background: INK9, color: "#fff",
            fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
            <Plus size={14} />Nueva ruta
          </button>
        </Link>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      <PageHeader
        kicker="Operación · RF-09"
        title="Rutas y zonas"
        subtitle={`${rutas.length} rutas · ${zonas.length} zonas · ${items.filter(i => i.status === "activa").length} activas`}
        action={headerAction}
      />

      {/* Tabs por tipo */}
      <div style={{
        display: "flex", gap: 0, borderBottom: `1px solid ${INK2}`,
      }}>
        {([
          { k: "ruta" as RouteType, l: "Rutas fijas", c: rutas.length },
          { k: "zona" as RouteType, l: "Zonas de operación", c: zonas.length },
        ]).map(t => {
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => {
                setTab(t.k);
                const f = items.find(i => i.type === t.k);
                setSel(f ?? null);
              }}
              style={{
                padding: "9px 14px", fontSize: "0.875rem", fontWeight: 600,
                cursor: "pointer", border: "none", background: "none",
                borderBottom: active ? `2px solid ${INK9}` : "2px solid transparent",
                marginBottom: -1, color: active ? INK9 : INK5,
                fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {t.l}
              <span style={{
                fontSize: "0.6875rem", padding: "1px 7px", borderRadius: 999,
                background: active ? INK9 : INK1, color: active ? "#fff" : INK5,
                fontWeight: 700, fontVariantNumeric: "tabular-nums",
              }}>
                {t.c}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div role="alert" style={{
          padding: "10px 14px", background: NO_BG, border: `1px solid ${NO_BD}`,
          borderRadius: 8, color: NO, fontSize: "0.8125rem",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />{error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 16, alignItems: "start" }}>
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
          <RoutePreview route={sel} canEdit={canEdit} typeLabel={tab === "ruta" ? "Ruta fija" : "Zona"} />
        ) : (
          <div style={{
            background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
            padding: "60px 24px", textAlign: "center",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            position: "sticky", top: 16,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: INK1,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Map size={20} color={INK5} strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9 }}>
              Selecciona una {tab === "ruta" ? "ruta" : "zona"}
            </div>
            <div style={{ fontSize: "0.8125rem", color: INK5, maxWidth: 260, lineHeight: 1.5 }}>
              Haz clic en cualquier registro de la lista para ver su trazado en el mapa.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RoutePreview({
  route, canEdit, typeLabel,
}: {
  route: RouteItem;
  canEdit: boolean;
  typeLabel: string;
}) {
  const wp = route.waypoints ?? [];
  return (
    <div style={{
      background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
      position: "sticky", top: 16, overflow: "hidden",
    }}>
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${INK2}`,
      }}>
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={{
              display: "inline-flex", alignItems: "center",
              padding: "2px 8px", borderRadius: 5,
              background: INK9, color: "#fff",
              fontFamily: "ui-monospace, monospace", fontWeight: 700,
              fontSize: "0.6875rem", letterSpacing: "0.04em",
            }}>
              {route.code}
            </span>
            <div style={{
              fontSize: "0.9375rem", fontWeight: 700, color: INK9,
              lineHeight: 1.3, marginTop: 6, wordBreak: "break-word",
            }}>
              {route.name}
            </div>
            <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2 }}>
              {route.stops != null
                ? `${route.stops} paradas${route.length ? ` · ${route.length}` : ""}`
                : route.area?.trim() || "—"}
            </div>
          </div>
          <StatusBadge active={route.status === "activa"} />
        </div>
      </div>

      <div style={{ padding: 12 }}>
        <GoogleMapView
          center={
            wp.length > 0
              ? {
                  lat: wp.reduce((s, w) => s + w.lat, 0) / wp.length,
                  lng: wp.reduce((s, w) => s + w.lng, 0) / wp.length,
                }
              : { lat: -13.5178, lng: -71.9785 }
          }
          zoom={wp.length > 1 ? 13 : wp.length === 1 ? 14 : 12}
          height={200}
          markers={
            wp.length > 0
              ? wp.map((w, i) => ({
                  lat: w.lat, lng: w.lng,
                  title: w.label ?? `Parada ${i + 1}`,
                  label: String(i + 1),
                  color: (i === 0 ? "green" : i === wp.length - 1 ? "red" : "gold") as "green" | "red" | "gold",
                }))
              : []
          }
          polyline={wp.map(w => ({ lat: w.lat, lng: w.lng }))}
          polylineColor={INK9}
          style={{ borderRadius: 8 }}
        />

        {wp.length === 0 && (
          <div style={{
            marginTop: 8, padding: "10px 12px",
            background: INK1, border: `1px dashed ${INK2}`, borderRadius: 7,
            display: "flex", alignItems: "center", gap: 8,
            fontSize: "0.75rem", color: INK5,
          }}>
            <MapPin size={12} />
            Sin trazado — edita la ruta para agregar paradas en el mapa.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 12 }}>
          <MiniRow label="Vehículos" value={`${route.vehicleCount}`} />
          <MiniRow label="Tipo" value={typeLabel} />
        </div>

        {route.frequencies && route.frequencies.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{
              fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", color: INK5, marginBottom: 4,
            }}>Frecuencias</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {route.frequencies.map((f, i) => (
                <span key={i} style={{
                  padding: "2px 8px", borderRadius: 5,
                  background: INK1, border: `1px solid ${INK2}`,
                  fontSize: "0.6875rem", fontWeight: 600, color: INK6,
                }}>{f}</span>
              ))}
            </div>
          </div>
        )}

        <Link href={`/rutas/${route.id}`} style={{ display: "block", marginTop: 12 }}>
          <button style={{
            width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            height: 34, padding: "0 12px", borderRadius: 7,
            border: "none", background: INK9, color: "#fff",
            fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
            {canEdit ? <Pencil size={13} /> : <Eye size={13} />}
            {canEdit ? "Editar ruta" : "Ver detalle"}
          </button>
        </Link>
      </div>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: "8px 10px", borderRadius: 7,
      background: INK1, border: `1px solid ${INK2}`,
    }}>
      <div style={{
        fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.06em",
        textTransform: "uppercase", color: INK5, marginBottom: 2,
      }}>{label}</div>
      <div style={{
        fontSize: "0.875rem", fontWeight: 700, color: INK9,
        fontVariantNumeric: "tabular-nums",
      }}>{value}</div>
    </div>
  );
}
