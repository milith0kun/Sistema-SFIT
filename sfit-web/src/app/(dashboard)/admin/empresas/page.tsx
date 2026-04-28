"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Globe2, MapPin, Plus } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";

type ServiceScope =
  | "urbano_distrital"
  | "urbano_provincial"
  | "interprovincial_regional"
  | "interregional_nacional";

type Department = {
  code: string; name: string;
  totalMunicipalityCount: number;
  activeMunicipalityCount: number;
};

type Company = {
  id: string;
  razonSocial: string;
  ruc: string;
  serviceScope: ServiceScope;
  coverage: {
    departmentCodes: string[];
    provinceCodes: string[];
    districtCodes: string[];
  };
  headquarters: { name?: string; ubigeoCode?: string; departmentName?: string } | null;
  active: boolean;
  reputationScore: number;
  authorizations: Array<{ level: string; scope: string; issuedBy?: string }>;
};

type StoredUser = { role: string };

const ALLOWED_ROLES = ["super_admin", "admin_provincial"];

const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a";
const INK6 = "#52525b"; const INK9 = "#18181b";
const RED  = "#b91c1c"; const REDBG = "#FFF5F5"; const REDBD = "#FCA5A5";
const G    = "#B8860B";

const SCOPE_LABEL: Record<ServiceScope, string> = {
  urbano_distrital:         "Urbano distrital",
  urbano_provincial:        "Urbano provincial",
  interprovincial_regional: "Interprovincial",
  interregional_nacional:   "Nacional",
};

const SCOPE_ACCENT: Record<ServiceScope, { bg: string; bd: string; fg: string }> = {
  urbano_distrital:         { bg: "#F0FDF4", bd: "#86EFAC", fg: "#15803d" },
  urbano_provincial:        { bg: "#EFF6FF", bd: "#BFDBFE", fg: "#1D4ED8" },
  interprovincial_regional: { bg: "#FDF8EC", bd: "#E8D090", fg: "#B8860B" },
  interregional_nacional:   { bg: "#FEF2F2", bd: "#FECACA", fg: "#b91c1c" },
};

export default function AdminEmpresasPage() {
  const router = useRouter();
  const [user,             setUser]             = useState<StoredUser | null>(null);
  const [items,            setItems]            = useState<Company[]>([]);
  const [total,            setTotal]            = useState(0);
  const [departments,      setDepartments]      = useState<Department[]>([]);
  const [scopeFilter,      setScopeFilter]      = useState<"" | ServiceScope>("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [activeFilter,     setActiveFilter]     = useState<"" | "true" | "false">("");
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);

  // ── Cargar usuario y permisos ──
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
      .then((d) => { if (d?.success) setDepartments(d.data.items ?? []); })
      .catch(() => { /* silent */ });
  }, [user, isSA]);

  // ── Cargar empresas ──
  const loadCompanies = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = new URLSearchParams();
      qs.set("limit", "200");
      if (scopeFilter)      qs.set("serviceScope", scopeFilter);
      if (departmentFilter) qs.set("departmentCode", departmentFilter);
      if (activeFilter)     qs.set("active", activeFilter);
      const res = await fetch(`/api/admin/empresas?${qs}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 403) { router.replace("/dashboard"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudieron cargar las empresas.");
        return;
      }
      setItems(data.data.items ?? []);
      setTotal(data.data.total ?? 0);
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }, [user, scopeFilter, departmentFilter, activeFilter, router]);

  useEffect(() => { void loadCompanies(); }, [loadCompanies]);

  // ── Cálculos KPI ──
  const byScope = useMemo(() => {
    const acc: Record<ServiceScope, number> = {
      urbano_distrital: 0,
      urbano_provincial: 0,
      interprovincial_regional: 0,
      interregional_nacional: 0,
    };
    for (const c of items) {
      if (c.serviceScope) acc[c.serviceScope] = (acc[c.serviceScope] ?? 0) + 1;
    }
    return acc;
  }, [items]);

  // ── Columnas ──
  const columns = useMemo<ColumnDef<Company, unknown>[]>(() => [
    {
      id: "razon",
      header: "Empresa",
      accessorFn: (c) => c.razonSocial,
      enableSorting: true,
      enableHiding: false,
      cell: ({ row: r }) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.875rem", color: INK9 }}>
            {r.original.razonSocial}
          </div>
          <div style={{ fontSize: "0.75rem", color: INK5, fontFamily: "ui-monospace,monospace" }}>
            RUC {r.original.ruc}
          </div>
        </div>
      ),
    },
    {
      id: "scope",
      header: "Modalidad",
      accessorFn: (c) => c.serviceScope ?? "",
      enableSorting: true,
      cell: ({ row: r }) => {
        const s = r.original.serviceScope;
        if (!s) return <span style={{ color: INK5 }}>—</span>;
        const t = SCOPE_ACCENT[s];
        return (
          <span style={{
            display: "inline-flex", padding: "3px 9px", borderRadius: 999,
            background: t.bg, border: `1px solid ${t.bd}`, color: t.fg,
            fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.02em",
          }}>
            {SCOPE_LABEL[s]}
          </span>
        );
      },
    },
    {
      id: "cobertura",
      header: "Cobertura",
      accessorFn: (c) => c.coverage?.districtCodes?.length ?? 0,
      enableSorting: true,
      cell: ({ row: r }) => {
        const cov = r.original.coverage;
        if (!cov) return <span style={{ color: INK5 }}>—</span>;
        const dCount = cov.districtCodes?.length ?? 0;
        const pCount = cov.provinceCodes?.length ?? 0;
        const xCount = cov.departmentCodes?.length ?? 0;
        return (
          <div style={{ fontSize: "0.75rem", color: INK6, lineHeight: 1.4 }}>
            <div>{xCount} dpto · {pCount} prov · {dCount} dist</div>
          </div>
        );
      },
    },
    {
      id: "sede",
      header: "Sede",
      accessorFn: (c) => c.headquarters?.name ?? "",
      cell: ({ row: r }) => {
        const h = r.original.headquarters;
        if (!h) return <span style={{ color: INK5 }}>—</span>;
        return (
          <div style={{ fontSize: "0.8125rem", color: INK6 }}>
            <div>{h.name ?? "—"}</div>
            <div style={{ fontSize: "0.6875rem", color: INK5 }}>
              {h.departmentName ?? ""}
              {h.ubigeoCode ? ` · ${h.ubigeoCode}` : ""}
            </div>
          </div>
        );
      },
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (c) => c.active ? "activa" : "suspendida",
      cell: ({ row: r }) => (
        <Badge variant={r.original.active ? "activo" : "suspendido"}>
          {r.original.active ? "Activa" : "Suspendida"}
        </Badge>
      ),
    },
    {
      id: "rep",
      header: "Reputación",
      accessorFn: (c) => c.reputationScore,
      enableSorting: true,
      cell: ({ row: r }) => (
        <span style={{
          fontFamily: "ui-monospace,monospace", fontWeight: 700,
          fontSize: "0.8125rem", color: r.original.reputationScore >= 80 ? "#15803d" : INK6,
        }}>
          {r.original.reputationScore}
        </span>
      ),
    },
  ], []);

  if (!user) return null;

  const selectStyle: React.CSSProperties = {
    height: 34, padding: "0 10px", borderRadius: 8, border: `1.5px solid ${INK2}`,
    fontSize: "0.8125rem", fontFamily: "inherit", background: "#fff", color: INK6,
    cursor: "pointer", minWidth: 160,
  };

  const toolbarEnd = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value as "" | ServiceScope)} style={selectStyle}>
        <option value="">Todas las modalidades</option>
        <option value="urbano_distrital">Urbano distrital</option>
        <option value="urbano_provincial">Urbano provincial</option>
        <option value="interprovincial_regional">Interprovincial</option>
        <option value="interregional_nacional">Nacional</option>
      </select>
      {isSA && (
        <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} style={selectStyle}>
          <option value="">Todos los departamentos</option>
          {departments.map((d) => (
            <option key={d.code} value={d.code}>{d.code} — {d.name}</option>
          ))}
        </select>
      )}
      <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as "" | "true" | "false")} style={{ ...selectStyle, minWidth: 130 }}>
        <option value="">Todas</option>
        <option value="true">Activas</option>
        <option value="false">Suspendidas</option>
      </select>
    </div>
  );

  const headerAction = isSA ? (
    <Link href="/admin/empresas/nueva">
      <button style={{
        display: "inline-flex", alignItems: "center", gap: 6, height: 34,
        padding: "0 14px", borderRadius: 8, border: `1.5px solid ${G}`,
        background: G, color: "#fff", fontSize: "0.8125rem", fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
      }}>
        <Plus size={13}/> Nueva interprovincial
      </button>
    </Link>
  ) : undefined;

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <PageHeader
        kicker={isSA ? "Vista nacional · super_admin" : "Vista provincial · admin_provincial"}
        title="Empresas de transporte"
        subtitle="Las empresas urbano_distritales se gestionan desde su municipalidad. Las interprovinciales y nacionales se autorizan a nivel super_admin (proxy MTC)."
        action={headerAction}
      />

      <KPIStrip cols={4} items={[
        { label: "TOTAL EN VISTA", value: items.length, subtitle: `${total} en total`, icon: Building2 },
        { label: "URBANAS",        value: byScope.urbano_distrital + byScope.urbano_provincial, subtitle: "distrital + provincial", icon: MapPin },
        { label: "INTERPROVINCIALES", value: byScope.interprovincial_regional, subtitle: "regionales", icon: Globe2, accent: G },
        { label: "NACIONALES",     value: byScope.interregional_nacional, subtitle: "interregionales", icon: Globe2, accent: "#b91c1c" },
      ]} />

      {error && (
        <div style={{
          padding: "11px 16px", background: REDBG, border: `1px solid ${REDBD}`,
          borderRadius: 10, color: RED, fontSize: "0.8125rem",
        }}>
          {error}
        </div>
      )}

      <DataTable<Company>
        columns={columns}
        data={items}
        loading={loading}
        searchPlaceholder="Buscar por razón social o RUC…"
        emptyTitle="Sin empresas"
        emptyDescription="No hay empresas que cumplan los filtros."
        defaultPageSize={50}
        showColumnToggle
        toolbarEnd={toolbarEnd}
        onRowClick={(row) => router.push(`/empresas/${row.id}`)}
      />
    </div>
  );
}
