"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MapPin, Building2, ChevronRight } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";

type Province = {
  id: string;
  name: string;
  region: string;
  active: boolean;
  createdAt: string;
  municipalitiesCount?: number;
};

const INK5 = "#71717a"; const INK6 = "#52525b";
const RED  = "#b91c1c"; const REDBG = "#FFF5F5"; const REDBD = "#FCA5A5";
const G    = "#B8860B";

export default function ProvinciasPage() {
  const router = useRouter();
  const [items,   setItems]   = useState<Province[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as { role: string };
    if (u.role !== "super_admin") { router.replace("/dashboard"); return; }
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/provincias", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 403) { router.replace("/dashboard"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "No se pudieron cargar las provincias."); return; }
      setItems(data.data.items ?? []);
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  const totalMunis = useMemo(() =>
    items.reduce((acc, p) => acc + (typeof p.municipalitiesCount === "number" ? p.municipalitiesCount : 0), 0),
  [items]);

  const columns = useMemo<ColumnDef<Province, unknown>[]>(() => [
    {
      id: "nombre",
      header: "Provincia",
      accessorFn: p => `${p.name} ${p.region}`,
      enableSorting: true,
      sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
      cell: ({ row: r }) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#18181b" }}>{r.original.name}</div>
          <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 1 }}>{r.original.region}</div>
        </div>
      ),
    },
    {
      id: "municipalidades",
      header: "Municipalidades",
      accessorFn: p => p.municipalitiesCount ?? 0,
      enableSorting: true,
      cell: ({ row: r }) => (
        <span style={{ color: INK6, fontVariantNumeric: "tabular-nums" }}>
          {typeof r.original.municipalitiesCount === "number" ? r.original.municipalitiesCount : "—"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Registrada",
      enableSorting: true,
      sortingFn: "datetime",
      cell: ({ row: r }) => (
        <span style={{ color: INK5, fontSize: "0.8125rem" }}>
          {r.original.createdAt ? new Date(r.original.createdAt).toLocaleDateString("es-PE", { day:"2-digit", month:"short", year:"numeric" }) : "—"}
        </span>
      ),
    },
    {
      id: "_nav",
      header: "",
      enableSorting: false,
      cell: () => <ChevronRight size={15} color="#a1a1aa"/>,
    },
  ], []);

  const headerAction = (
    <Link href="/provincias/nueva">
      <button style={{ display:"inline-flex", alignItems:"center", gap:6, height:34, padding:"0 14px", borderRadius:8, border:`1.5px solid ${G}`, background:G, color:"#fff", fontSize:"0.8125rem", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
        <Plus size={13}/>Nueva provincia
      </button>
    </Link>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <PageHeader kicker="Panel global · RF-02" title="Provincias" action={headerAction} />

      <KPIStrip cols={2} items={[
        { label: "PROVINCIAS", value: items.length, subtitle: "registradas", icon: MapPin },
        { label: "MUNICIPIOS", value: totalMunis,   subtitle: "asociados",   icon: Building2 },
      ]} />

      {error && (
        <div style={{ padding:"11px 16px", background:REDBG, border:`1px solid ${REDBD}`, borderRadius:10, color:RED, fontSize:"0.8125rem" }}>
          {error}
        </div>
      )}

      <DataTable<Province>
        columns={columns}
        data={items}
        loading={loading}
        searchPlaceholder="Buscar provincia o región…"
        emptyTitle="Sin provincias"
        emptyDescription="Registra la primera provincia para comenzar."
        defaultPageSize={20}
        showColumnToggle
        onRowClick={row => router.push(`/provincias/${row.id}`)}
      />
    </div>
  );
}
