"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Building2, MapPin, Map as MapIcon, Power } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";

type Department  = {
  code: string; name: string;
  provinceCount: number;
  totalMunicipalityCount: number;
  activeMunicipalityCount: number;
};
type Province     = {
  id: string; name: string;
  departmentCode?: string;
};
type Municipality = {
  id: string; name: string;
  provinceId: string; provinceName?: string;
  departmentName?: string;
  ubigeoCode?: string;
  departmentCode?: string;
  provinceCode?: string;
  active: boolean;
  createdAt: string;
};
type StoredUser = { role: string; provinceId?: string };

const ALLOWED_ROLES = ["super_admin", "admin_provincial"];
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a";
const INK6 = "#52525b"; const INK9 = "#18181b";
const RED  = "#b91c1c"; const REDBG = "#FFF5F5"; const REDBD = "#FCA5A5";
const G    = "#B8860B";
const GREEN = "#15803d"; const GREENBG = "#F0FDF4"; const GREENBD = "#86EFAC";

export default function MunicipalidadesPage() {
  const router = useRouter();
  const [user,             setUser]             = useState<StoredUser | null>(null);
  const [items,            setItems]            = useState<Municipality[]>([]);
  const [total,            setTotal]            = useState(0);
  const [departments,      setDepartments]      = useState<Department[]>([]);
  const [provinces,        setProvinces]        = useState<Province[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [provinceFilter,   setProvinceFilter]   = useState("");
  const [activeFilter,     setActiveFilter]     = useState<"" | "true" | "false">("");
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [togglingId,       setTogglingId]       = useState<string | null>(null);

  // ── Cargar usuario y verificar permisos ──
  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as StoredUser;
    if (!ALLOWED_ROLES.includes(u.role)) { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const isSA = user?.role === "super_admin";

  // ── Cargar departamentos (solo super_admin) ──
  useEffect(() => {
    if (!user || !isSA) return;
    const token = localStorage.getItem("sfit_access_token");
    fetch("/api/admin/departamentos", { headers: { Authorization: `Bearer ${token ?? ""}` } })
      .then((r) => r.json())
      .then((data) => { if (data?.success) setDepartments(data.data.items ?? []); })
      .catch(() => { /* silent */ });
  }, [user, isSA]);

  // ── Cargar provincias (filtradas por depto si aplica) ──
  const loadProvinces = useCallback(async () => {
    if (!user) return;
    const token = localStorage.getItem("sfit_access_token");
    const qs = new URLSearchParams();
    if (departmentFilter) qs.set("departmentCode", departmentFilter);
    qs.set("limit", "200");
    try {
      const res = await fetch(`/api/provincias?${qs}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) setProvinces(data.data.items ?? []);
    } catch { /* silent */ }
  }, [user, departmentFilter]);

  useEffect(() => { void loadProvinces(); }, [loadProvinces]);

  // Cuando cambia el depto, resetear el filtro de provincia
  useEffect(() => { setProvinceFilter(""); }, [departmentFilter]);

  // ── Cargar municipalidades ──
  const loadMunicipalities = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = new URLSearchParams();
      qs.set("limit", "200");
      if (departmentFilter) qs.set("departmentCode", departmentFilter);
      if (provinceFilter)   qs.set("provinceId", provinceFilter);
      if (activeFilter)     qs.set("active", activeFilter);
      const res = await fetch(`/api/municipalidades?${qs}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 403) { router.replace("/dashboard"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudieron cargar las municipalidades.");
        return;
      }
      setItems(data.data.items ?? []);
      setTotal(data.data.total ?? 0);
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }, [user, departmentFilter, provinceFilter, activeFilter, router]);

  useEffect(() => { void loadMunicipalities(); }, [loadMunicipalities]);

  // ── Toggle activar/desactivar ──
  async function toggleActive(m: Municipality) {
    if (!m.ubigeoCode) {
      setError(`La municipalidad "${m.name}" no pertenece al catálogo UBIGEO.`);
      return;
    }
    setTogglingId(m.id); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/admin/municipalidades/${m.id}/activar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ active: !m.active }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo actualizar el estado.");
        return;
      }
      // Update local
      setItems((prev) => prev.map((x) => x.id === m.id ? { ...x, active: data.data.active } : x));
      // Actualiza el conteo en el departamento (mejor: re-fetch departamentos)
      if (isSA) {
        const tok = localStorage.getItem("sfit_access_token");
        fetch("/api/admin/departamentos", { headers: { Authorization: `Bearer ${tok ?? ""}` } })
          .then((r) => r.json())
          .then((d) => { if (d?.success) setDepartments(d.data.items ?? []); })
          .catch(() => { /* silent */ });
      }
    } catch { setError("Error de conexión."); }
    finally { setTogglingId(null); }
  }

  // ── Cálculos para KPI ──
  const totalDepartments = departments.length;
  const totalNationalMunicipalities = useMemo(
    () => departments.reduce((sum, d) => sum + d.totalMunicipalityCount, 0),
    [departments],
  );
  const totalActiveMunicipalities = useMemo(
    () => departments.reduce((sum, d) => sum + d.activeMunicipalityCount, 0),
    [departments],
  );
  const departmentsCovered = useMemo(
    () => departments.filter((d) => d.activeMunicipalityCount > 0).length,
    [departments],
  );

  // ── Columnas tabla ──
  const columns = useMemo<ColumnDef<Municipality, unknown>[]>(() => [
    {
      id: "ubigeo",
      header: "UBIGEO",
      accessorFn: (m) => m.ubigeoCode ?? "",
      enableSorting: true,
      enableHiding: false,
      cell: ({ row: r }) => r.original.ubigeoCode ? (
        <span style={{
          display: "inline-flex", padding: "2px 8px", borderRadius: 6,
          background: INK9, color: "#fff",
          fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.75rem",
        }}>
          {r.original.ubigeoCode}
        </span>
      ) : <span style={{ color: INK5, fontSize: "0.75rem" }}>—</span>,
    },
    {
      id: "nombre",
      header: "Distrito",
      accessorFn: (m) => m.name,
      enableSorting: true,
      enableHiding: false,
      sortingFn: (a, b) => a.original.name.localeCompare(b.original.name, "es-PE"),
      cell: ({ row: r }) => (
        <span style={{ fontWeight: 600, fontSize: "0.875rem", color: INK9 }}>{r.original.name}</span>
      ),
    },
    {
      id: "provincia",
      header: "Provincia",
      accessorFn: (m) => m.provinceName ?? "",
      enableSorting: true,
      cell: ({ row: r }) => (
        <span style={{ color: INK6, fontSize: "0.8125rem" }}>{r.original.provinceName ?? "—"}</span>
      ),
    },
    {
      id: "departamento",
      header: "Departamento",
      accessorFn: (m) => m.departmentName ?? "",
      enableSorting: true,
      cell: ({ row: r }) => (
        <span style={{ color: INK6, fontSize: "0.8125rem" }}>{r.original.departmentName ?? "—"}</span>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (m) => m.active ? "activa" : "inactiva",
      enableSorting: true,
      enableHiding: false,
      cell: ({ row: r }) => {
        const m = r.original;
        const active = m.active;
        return (
          <button
            disabled={togglingId === m.id || !m.ubigeoCode}
            onClick={(e) => { e.stopPropagation(); void toggleActive(m); }}
            title={m.ubigeoCode
              ? (active ? "Desactivar" : "Activar")
              : "Sin UBIGEO — no gestionable"}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 28, padding: "0 10px", borderRadius: 999,
              border: `1.5px solid ${active ? GREENBD : INK2}`,
              background: active ? GREENBG : "#fff",
              color: active ? GREEN : INK5,
              fontSize: "0.75rem", fontWeight: 700, cursor: m.ubigeoCode ? "pointer" : "not-allowed",
              opacity: togglingId === m.id ? 0.5 : 1,
              fontFamily: "inherit",
            }}
          >
            <Power size={11} strokeWidth={2.5} />
            {togglingId === m.id ? "…" : (active ? "Activa" : "Inactiva")}
          </button>
        );
      },
    },
    {
      id: "_nav",
      header: "",
      enableSorting: false,
      cell: ({ row: r }) => (
        <Link
          href={`/municipalidades/${r.original.id}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: "0.75rem", color: INK6, textDecoration: "none",
            padding: "4px 8px", borderRadius: 6, border: `1px solid ${INK2}`,
          }}
        >
          Ver
        </Link>
      ),
    },
  ], [togglingId]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  // ── Estilos compartidos ──
  const selectStyle: React.CSSProperties = {
    height: 34, padding: "0 10px", borderRadius: 8, border: `1.5px solid ${INK2}`,
    fontSize: "0.8125rem", fontFamily: "inherit", background: "#fff", color: INK6, cursor: "pointer",
    minWidth: 160,
  };

  // ── Toolbar de filtros ──
  const toolbarEnd = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {isSA && (
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="">Todos los departamentos</option>
          {departments.map((d) => (
            <option key={d.code} value={d.code}>
              {d.code} — {d.name} ({d.activeMunicipalityCount}/{d.totalMunicipalityCount})
            </option>
          ))}
        </select>
      )}
      <select
        value={provinceFilter}
        onChange={(e) => setProvinceFilter(e.target.value)}
        style={selectStyle}
      >
        <option value="">Todas las provincias</option>
        {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select
        value={activeFilter}
        onChange={(e) => setActiveFilter(e.target.value as "" | "true" | "false")}
        style={{ ...selectStyle, minWidth: 130 }}
      >
        <option value="">Todas</option>
        <option value="true">Activas</option>
        <option value="false">Inactivas</option>
      </select>
    </div>
  );

  const headerAction = (
    <Link href="/municipalidades/nueva">
      <button style={{
        display: "inline-flex", alignItems: "center", gap: 6, height: 34,
        padding: "0 14px", borderRadius: 8, border: `1.5px solid ${G}`,
        background: G, color: "#fff", fontSize: "0.8125rem", fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
      }}>
        <Plus size={13}/> Activar del catálogo
      </button>
    </Link>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <PageHeader
        kicker={isSA ? "Catálogo nacional · UBIGEO INEI" : "Catálogo provincial · UBIGEO"}
        title="Municipalidades"
        action={headerAction}
      />

      {isSA ? (
        <KPIStrip cols={4} items={[
          { label: "ACTIVAS",       value: `${totalActiveMunicipalities} / ${totalNationalMunicipalities}`,
            subtitle: "incorporadas al sistema", icon: Building2, accent: GREEN },
          { label: "EN VISTA",      value: `${items.length} / ${total}`,
            subtitle: "según filtros aplicados", icon: MapPin },
          { label: "PROVINCIAS",    value: provinces.length,
            subtitle: departmentFilter ? `del departamento ${departmentFilter}` : "del país", icon: MapIcon },
          { label: "DEPARTAMENTOS", value: `${departmentsCovered} / ${totalDepartments}`,
            subtitle: "con al menos una activa", icon: MapIcon, accent: G },
        ]} />
      ) : (
        <KPIStrip cols={3} items={[
          { label: "EN VISTA",   value: items.length,    subtitle: "según filtros", icon: Building2 },
          { label: "TOTAL",      value: total,           subtitle: "de su provincia", icon: MapPin },
          { label: "PROVINCIAS", value: provinces.length, subtitle: "asignadas", icon: MapIcon },
        ]} />
      )}

      {error && (
        <div style={{
          padding: "11px 16px", background: REDBG, border: `1px solid ${REDBD}`,
          borderRadius: 10, color: RED, fontSize: "0.8125rem",
        }}>
          {error}
        </div>
      )}

      <DataTable<Municipality>
        columns={columns}
        data={items}
        loading={loading}
        searchPlaceholder="Buscar por nombre, UBIGEO, provincia…"
        emptyTitle="Sin resultados"
        emptyDescription={
          activeFilter === "true"
            ? "No hay municipalidades activas con esos filtros."
            : activeFilter === "false"
              ? "No quedan municipalidades inactivas en este alcance."
              : "Ajusta los filtros o activa una del catálogo."
        }
        defaultPageSize={50}
        showColumnToggle
        toolbarEnd={toolbarEnd}
      />
    </div>
  );
}
