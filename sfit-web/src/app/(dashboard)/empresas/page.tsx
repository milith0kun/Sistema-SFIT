"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Truck, Star, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";

type Company = {
  id: string;
  razonSocial: string;
  ruc: string;
  representanteLegal: { name: string; dni: string; phone?: string };
  vehicleTypeKeys: string[];
  active: boolean;
  reputationScore: number;
  status?: "activo" | "suspendido" | "pendiente";
};

type VehicleType = { id: string; key: string; name: string; active: boolean };
type StoredUser = { role: string };

const ALLOWED_ROLES = ["admin_municipal", "fiscal", "admin_provincial", "super_admin"];

function repColor(score: number): { bg: string; color: string; border: string; label: string } {
  if (score >= 80) return { bg: "#F0FDF4", color: "#15803d", border: "#86EFAC", label: "Alta" };
  if (score >= 50) return { bg: "#FFFBEB", color: "#b45309", border: "#FCD34D", label: "Media" };
  return { bg: "#FFF5F5", color: "#b91c1c", border: "#FCA5A5", label: "Baja" };
}

const selectStyle: React.CSSProperties = {
  height: 34,
  padding: "0 10px",
  borderRadius: 8,
  border: "1.5px solid #e4e4e7",
  fontSize: "0.8125rem",
  fontFamily: "inherit",
  background: "#fff",
  color: "#52525b",
  cursor: "pointer",
};

export default function EmpresasPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [items, setItems] = useState<Company[]>([]);
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!ALLOWED_ROLES.includes(u.role)) {
      router.replace("/dashboard");
      return;
    }
    setUser(u);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    void loadTypes();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, typeFilter]);

  async function loadTypes() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/tipos-vehiculo", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setTypes(data.data.items ?? []);
    } catch {
      // silent
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = new URLSearchParams();
      if (typeFilter) qs.set("vehicleTypeKey", typeFilter);
      const url = "/api/empresas" + (qs.toString() ? `?${qs.toString()}` : "");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudieron cargar las empresas.");
        return;
      }
      setItems(data.data.items ?? []);
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  const typeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of types) m.set(t.key, t.name);
    return m;
  }, [types]);

  const columns = useMemo<ColumnDef<Company, unknown>[]>(
    () => [
      {
        id: "razonSocial",
        header: "Razón social",
        accessorFn: (c) => `${c.razonSocial} ${c.ruc} ${c.representanteLegal.name}`,
        cell: ({ row: r }) => (
          <Link href={`/empresas/${r.original.id}`} style={{ fontWeight: 600, color: "#09090b", textDecoration: "none" }}>
            {r.original.razonSocial}
          </Link>
        ),
      },
      {
        accessorKey: "ruc",
        header: "RUC",
        cell: ({ row: r }) => (
          <span style={{ color: "#52525b", fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem" }}>
            {r.original.ruc}
          </span>
        ),
      },
      {
        id: "representante",
        header: "Representante",
        accessorFn: (c) => `${c.representanteLegal.name} ${c.representanteLegal.dni}`,
        cell: ({ row: r }) => (
          <div>
            <div style={{ color: "#18181b", fontWeight: 500 }}>{r.original.representanteLegal.name}</div>
            <div style={{ color: "#71717a", fontSize: "0.75rem" }}>DNI {r.original.representanteLegal.dni}</div>
          </div>
        ),
      },
      {
        id: "flota",
        header: "Flota",
        enableSorting: false,
        accessorFn: (c) => c.vehicleTypeKeys.map((k) => typeMap.get(k) ?? k).join(" "),
        cell: ({ row: r }) => (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {r.original.vehicleTypeKeys.length === 0 ? (
              <span style={{ color: "#a1a1aa", fontSize: "0.8125rem" }}>—</span>
            ) : (
              r.original.vehicleTypeKeys.map((k) => (
                <Badge key={k} variant="info">
                  {typeMap.get(k) ?? k}
                </Badge>
              ))
            )}
          </div>
        ),
      },
      {
        id: "reputacion",
        header: "Reputación",
        accessorFn: (c) => c.reputationScore,
        cell: ({ row: r }) => {
          const s = repColor(r.original.reputationScore);
          return (
            <span
              className="num"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 999,
                background: s.bg,
                color: s.color,
                border: `1px solid ${s.border}`,
                fontSize: "0.8125rem",
                fontWeight: 700,
              }}
            >
              {r.original.reputationScore}
            </span>
          );
        },
      },
      {
        id: "_nav",
        header: "",
        enableSorting: false,
        cell: () => <ChevronRight size={15} color="#a1a1aa"/>,
      },
    ],
    [typeMap]
  );

  if (forbidden) {
    return (
      <div style={{ padding: 24, background: "#fff", borderRadius: 14, border: "1px solid #e4e4e7" }}>
        <p style={{ color: "#52525b" }}>No tienes permisos para ver esta sección.</p>
      </div>
    );
  }

  if (!user) return null;
  const canCreate = user.role === "admin_municipal";

  const repAvg =
    items.length > 0
      ? Math.round(items.reduce((a, c) => a + c.reputationScore, 0) / items.length)
      : 0;

  const toolbarEnd = (
    <>
      <select style={selectStyle} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
        <option value="">Todas las flotas</option>
        {types.filter((t) => t.active).map((t) => (
          <option key={t.id} value={t.key}>{t.name}</option>
        ))}
      </select>
      {canCreate && (
        <Link href="/empresas/nueva">
          <button style={{ display:"inline-flex", alignItems:"center", gap:6, height:34, padding:"0 14px", borderRadius:8, border:"1.5px solid #B8860B", background:"#B8860B", color:"#fff", fontSize:"0.8125rem", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            <Plus size={13}/>Nueva empresa
          </button>
        </Link>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <PageHeader kicker="Panel municipal · RF-04" title="Empresas de transporte" />

      <KPIStrip
        cols={2}
        items={[
          { label: "EMPRESAS", value: items.length, subtitle: "registradas", icon: Truck },
          { label: "REPUTACIÓN", value: repAvg, subtitle: "promedio flota", icon: Star },
        ]}
      />

      {error && (
        <div
          role="alert"
          style={{
            background: "#FFF5F5",
            border: "1.5px solid #FCA5A5",
            borderRadius: 12,
            padding: 16,
            color: "#b91c1c",
            fontSize: "0.9375rem",
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      <DataTable<Company>
        columns={columns}
        data={items}
        loading={loading}
        searchPlaceholder="Buscar empresa, RUC o representante…"
        emptyTitle="Sin empresas"
        emptyDescription={
          canCreate
            ? "Registra la primera empresa para comenzar a gestionar su flota."
            : "Aún no hay empresas registradas o ninguna coincide con los filtros."
        }
        defaultPageSize={20}
        showColumnToggle
        toolbarEnd={toolbarEnd}
        onRowClick={row => router.push(`/empresas/${row.id}`)}
      />
    </div>
  );
}
