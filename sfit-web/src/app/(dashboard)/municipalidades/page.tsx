"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Building2, MapPin, ChevronRight } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";

type Province     = { id: string; name: string };
type Municipality = {
  id: string; name: string;
  provinceId: string; provinceName?: string;
  active: boolean; createdAt: string;
};
type StoredUser = { role: string; provinceId?: string };

const ALLOWED_ROLES = ["super_admin", "admin_provincial"];
const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b";
const RED  = "#b91c1c"; const REDBG = "#FFF5F5"; const REDBD = "#FCA5A5";
const G    = "#B8860B";

export default function MunicipalidadesPage() {
  const router = useRouter();
  const [user,          setUser]          = useState<StoredUser | null>(null);
  const [items,         setItems]         = useState<Municipality[]>([]);
  const [provinces,     setProvinces]     = useState<Province[]>([]);
  const [provinceFilter, setProvinceFilter] = useState("");
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as StoredUser;
    if (!ALLOWED_ROLES.includes(u.role)) { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    void loadProvinces();
    void loadMunicipalities();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, provinceFilter]);

  async function loadProvinces() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/provincias", { headers:{ Authorization:`Bearer ${token??""}`} });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setProvinces(data.data.items ?? []);
    } catch { /* silent */ }
  }

  async function loadMunicipalities() {
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = provinceFilter ? `?provinceId=${encodeURIComponent(provinceFilter)}` : "";
      const res = await fetch(`/api/municipalidades${qs}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 403) { router.replace("/dashboard"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "No se pudieron cargar las municipalidades."); return; }
      setItems(data.data.items ?? []);
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }

  const provinceMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of provinces) m.set(p.id, p.name);
    return m;
  }, [provinces]);

  const columns = useMemo<ColumnDef<Municipality, unknown>[]>(() => [
    {
      id: "nombre",
      header: "Municipalidad",
      accessorFn: m => m.name,
      enableSorting: true,
      sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
      cell: ({ row: r }) => (
        <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#18181b" }}>{r.original.name}</span>
      ),
    },
    {
      id: "provincia",
      header: "Provincia",
      accessorFn: m => m.provinceName ?? provinceMap.get(m.provinceId) ?? "",
      enableSorting: true,
      cell: ({ row: r }) => (
        <span style={{ color: INK6 }}>
          {r.original.provinceName ?? provinceMap.get(r.original.provinceId) ?? "—"}
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
  ], [provinceMap]);

  if (!user) return null;

  const isSA        = user.role === "super_admin";
  const selectStyle: React.CSSProperties = {
    height:34, padding:"0 10px", borderRadius:8, border:`1.5px solid ${INK2}`,
    fontSize:"0.8125rem", fontFamily:"inherit", background:"#fff", color:INK6, cursor:"pointer",
  };

  const toolbarEnd = isSA ? (
    <select style={selectStyle} value={provinceFilter} onChange={e => setProvinceFilter(e.target.value)}>
      <option value="">Todas las provincias</option>
      {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  ) : undefined;

  const headerAction = (
    <Link href="/municipalidades/nueva">
      <button style={{ display:"inline-flex", alignItems:"center", gap:6, height:34, padding:"0 14px", borderRadius:8, border:`1.5px solid ${G}`, background:G, color:"#fff", fontSize:"0.8125rem", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
        <Plus size={13}/>Nueva municipalidad
      </button>
    </Link>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <PageHeader
        kicker={isSA ? "Panel global · RF-03" : "Panel provincial · RF-03"}
        title="Municipalidades"
        action={headerAction}
      />

      <KPIStrip cols={2} items={[
        { label:"MUNICIPIOS", value:items.length,    subtitle:"registrados", icon:Building2 },
        { label:"PROVINCIAS", value:provinces.length, subtitle:"cubiertas",   icon:MapPin    },
      ]} />

      {error && (
        <div style={{ padding:"11px 16px", background:REDBG, border:`1px solid ${REDBD}`, borderRadius:10, color:RED, fontSize:"0.8125rem" }}>
          {error}
        </div>
      )}

      <DataTable<Municipality>
        columns={columns}
        data={items}
        loading={loading}
        searchPlaceholder="Buscar municipalidad o provincia…"
        emptyTitle="Sin municipalidades"
        emptyDescription="Registra la primera municipalidad para comenzar."
        defaultPageSize={20}
        showColumnToggle
        toolbarEnd={toolbarEnd}
        onRowClick={row => router.push(`/municipalidades/${row.id}`)}
      />
    </div>
  );
}
