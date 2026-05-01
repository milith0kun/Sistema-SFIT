"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Globe2, MapPin, Plus, ChevronRight } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";

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
const RED = "#DC2626"; const REDBG = "#FFF5F5"; const REDBD = "#FCA5A5";

const SCOPE_LABEL: Record<ServiceScope, string> = {
  urbano_distrital:         "Urbano distrital",
  urbano_provincial:        "Urbano provincial",
  interprovincial_regional: "Interprovincial",
  interregional_nacional:   "Nacional",
};

// Paleta sobria — todos los chips comparten estilo neutro, sólo varía el texto.
const SCOPE_CHIP: React.CSSProperties = {
  display: "inline-flex", padding: "2px 9px", borderRadius: 5,
  background: "#fff", border: `1px solid ${INK2}`, color: INK6,
  fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.02em",
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
      cell: ({ row: r }) => {
        const ok = r.original.active;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              title={ok ? "Activa" : "Suspendida"}
              aria-label={ok ? "Activa" : "Suspendida"}
              style={{
                width: 7, height: 7, borderRadius: "50%",
                background: ok ? "#15803d" : RED,
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "0.875rem", color: INK9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.original.razonSocial}
              </div>
              <div style={{ fontSize: "0.75rem", color: INK5, fontFamily: "ui-monospace,monospace" }}>
                RUC {r.original.ruc}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "scope",
      header: "Modalidad",
      accessorFn: (c) => c.serviceScope ?? "",
      enableSorting: true,
      cell: ({ row: r }) => {
        const s = r.original.serviceScope;
        if (!s) return <span style={{ color: INK5 }}>—</span>;
        return <span style={SCOPE_CHIP}>{SCOPE_LABEL[s]}</span>;
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
      id: "rep",
      header: "Reputación",
      accessorFn: (c) => c.reputationScore,
      enableSorting: true,
      cell: ({ row: r }) => {
        const score = r.original.reputationScore;
        const color = score >= 80 ? "#15803d" : score >= 50 ? "#b45309" : RED;
        return (
          <div style={{ minWidth: 90 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
              <span style={{
                fontFamily: "ui-monospace,monospace", fontWeight: 800,
                fontSize: "0.875rem", color: INK9,
                fontVariantNumeric: "tabular-nums",
              }}>
                {score}
              </span>
              <span style={{ fontSize: "0.625rem", color: INK5, fontWeight: 500 }}>/ 100</span>
            </div>
            <div style={{ height: 4, background: INK1, borderRadius: 999, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${Math.max(0, Math.min(100, score))}%`,
                background: color, borderRadius: 999,
              }} />
            </div>
          </div>
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

  const selectStyle: React.CSSProperties = {
    height: 34, padding: "0 10px", borderRadius: 8, border: `1.5px solid ${INK2}`,
    fontSize: "0.8125rem", fontFamily: "inherit", background: "#fff", color: INK6,
    cursor: "pointer", minWidth: 160,
  };

  const pillBtn = (active: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px",
    borderRadius: 7, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit",
    background: active ? INK9 : "#fff",
    color: active ? "#fff" : INK6,
    border: active ? `1.5px solid ${INK9}` : `1.5px solid ${INK2}`,
  });

  const toolbarEnd = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {/* Estado: pills binarios */}
      <div style={{ display: "flex", gap: 4 }}>
        {([["", "Todas"], ["true", "Activas"], ["false", "Suspendidas"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setActiveFilter(k as "" | "true" | "false")} style={pillBtn(activeFilter === k)}>
            {l}
          </button>
        ))}
      </div>
      <div style={{ width: 1, height: 22, background: INK2 }} />
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
    </div>
  );

  const headerAction = isSA ? (
    <Link href="/admin/empresas/nueva">
      <button style={{
        display: "inline-flex", alignItems: "center", gap: 6, height: 32,
        padding: "0 14px", borderRadius: 7, border: "none",
        background: INK9, color: "#fff", fontSize: "0.8125rem", fontWeight: 600,
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
        { label: "INTERPROVINCIALES", value: byScope.interprovincial_regional, subtitle: "regionales", icon: Globe2 },
        { label: "NACIONALES",     value: byScope.interregional_nacional, subtitle: "interregionales", icon: Globe2 },
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
