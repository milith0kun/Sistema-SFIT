"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Users, RefreshCw, ChevronRight, UserPlus } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { KPIStrip, type KPIItem } from "@/components/dashboard/KPIStrip";

import { hasWebPermission } from "@/lib/auth/roleMatrix";
import type { Role } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { INK1, INK2, INK5, INK6, INK9, INFO, INFO_BG, INFO_BD } from "@/lib/design-tokens";
import { ROLE_LABELS } from "@/components/layout/nav";
type UserRole =
  | "super_admin" | "admin_municipal"
  | "fiscal" | "operador" | "conductor" | "ciudadano";

type UsuarioRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
  phone: string | null;
  dni: string | null;
  municipality: { _id: string; name: string } | null;
  province:     { _id: string; name: string } | null;
  createdAt: string;
};

type StoredUser = { id: string; role: string };
const LIMIT   = 200;

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  activo:     { color: "#15803d", label: "Activo" },
  pendiente:  { color: "#b45309", label: "Pendiente" },
  suspendido: { color: "#DC2626", label: "Suspendido" },
  rechazado:  { color: "#71717a", label: "Rechazado" },
};

function UserAvatar({ name, role }: { name: string; role: string }) {
  const isAdmin = role.startsWith("admin") || role === "super_admin";
  const initials = name.split(" ").map(w => w[0] ?? "").slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
      background: isAdmin ? INFO_BG : INK1,
      color: isAdmin ? INFO : INK6,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "0.75rem", fontWeight: 800,
      border: `1.5px solid ${isAdmin ? INFO_BD : INK2}`,
    }}>
      {initials || "?"}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isGold  = role === "super_admin";
  const isAdmin = role.startsWith("admin") || role === "super_admin";
  return (
    <span style={{
      display: "inline-flex", padding: "3px 9px", borderRadius: 6,
      fontSize: "0.6875rem", fontWeight: 700, whiteSpace: "nowrap",
      background: isGold ? "#FBEAEA" : isAdmin ? INFO_BG : INK1,
      color: isGold ? "#4A0303" : isAdmin ? INFO : INK6,
      border: `1px solid ${isGold ? "#D9B0B0" : isAdmin ? INFO_BD : INK2}`,
    }}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

export default function UsuariosAdminPage() {
  const router = useRouter();
  const [user,        setUser]        = useState<StoredUser | null>(null);
  const [items,       setItems]       = useState<UsuarioRow[]>([]);
  const [total,       setTotal]       = useState(0);
  const [roleFilter,  setRoleFilter]  = useState("");
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!hasWebPermission(u.role as Role, "usuarios", "view")) { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = new URLSearchParams({ limit: String(LIMIT), page: "1" });
      const res = await fetch(`/api/admin/usuarios?${qs}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 403) { router.replace("/dashboard"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar"); return; }
      setItems(data.data.items ?? []);
      setTotal(data.data.total ?? 0);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, router]);

  useEffect(() => { void load(); }, [load]);

  const filteredItems = useMemo(() => {
    return items.filter(u => !roleFilter || u.role === roleFilter);
  }, [items, roleFilter]);

  // KPIs fijos por rol: el admin_municipal debe ver siempre el conteo de
  // los 3 roles operativos de cuentas (fiscal, operador, ciudadano) — antes
  // mostraba solo el "top 3 por conteo" y los roles con pocos usuarios
  // quedaban escondidos. Super admin ve adicionalmente Admin Municipal.
  const kpis: KPIItem[] = useMemo(() => {
    const countOf = (r: UserRole) => items.filter(u => u.role === r).length;
    const base: KPIItem[] = [
      { label: "TOTAL",       value: total || items.length, subtitle: "usuarios", icon: Users },
      { label: "FISCALES",    value: countOf("fiscal"),     subtitle: "inspectores en campo", icon: Users },
      { label: "OPERADORES",  value: countOf("operador"),   subtitle: "empresas operando",    icon: Users },
      { label: "CIUDADANOS",  value: countOf("ciudadano"),  subtitle: "reportantes",          icon: Users },
    ];
    if (user?.role === "super_admin") {
      base.push({
        label: "ADMINS MUNICIPALES",
        value: countOf("admin_municipal"),
        subtitle: "panel web",
        icon: Users,
      });
    }
    return base;
  }, [items, total, user]);

  const columns = useMemo<ColumnDef<UsuarioRow, unknown>[]>(() => [
    {
      id: "usuario",
      header: "Usuario",
      accessorFn: row => `${row.name} ${row.email}`,
      enableSorting: true,
      sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
      cell: ({ row: r }) => {
        const meta = STATUS_DOT[r.original.status] ?? { color: INK5, label: r.original.status };
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              title={meta.label}
              aria-label={`Estado: ${meta.label}`}
              style={{
                width: 7, height: 7, borderRadius: "50%",
                background: meta.color, flexShrink: 0,
              }}
            />
            <UserAvatar name={r.original.name} role={r.original.role} />
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.875rem", color: INK9, lineHeight: 1.3 }}>
                {r.original.name}
              </div>
              <div style={{ fontSize: "0.75rem", color: INK5 }}>{r.original.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: "Rol",
      enableSorting: true,
      sortingFn: (a, b) => (ROLE_LABELS[a.original.role] ?? "").localeCompare(ROLE_LABELS[b.original.role] ?? ""),
      cell: ({ row: r }) => <RoleBadge role={r.original.role} />,
    },
    {
      accessorKey: "createdAt",
      header: "Registrado",
      enableSorting: true,
      sortingFn: "datetime",
      cell: ({ getValue }) => (
        <span style={{ fontSize: "0.8125rem", color: INK5, whiteSpace: "nowrap" }}>
          {fmtDate(getValue<string>())}
        </span>
      ),
    },
    {
      id: "_nav",
      header: "",
      enableSorting: false,
      cell: () => <ChevronRight size={15} color="#a1a1aa" />,
    },
  ], []);

  if (!user) return null;

  const selectStyle: React.CSSProperties = {
    height: 34, padding: "0 10px",
    borderRadius: 8, border: `1.5px solid ${INK2}`,
    fontSize: "0.8125rem", fontFamily: "inherit",
    background: "#fff", color: INK6, cursor: "pointer",
  };

  const toolbarEnd = (
    <>
      <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={selectStyle}>
        <option value="">Todos los roles</option>
        {Object.entries(ROLE_LABELS)
          .filter(([v]) => v !== "conductor")
          .filter(([v]) => !(user?.role === "admin_municipal" && v === "super_admin"))
          .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <button
        onClick={() => { void load(); }}
        disabled={loading}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          height: 34, padding: "0 12px", borderRadius: 8, border: `1.5px solid ${INK2}`,
          background: "#fff", color: INK6, fontSize: "0.8125rem",
          fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        Actualizar
      </button>
    </>
  );

  const headerAction = user?.role === "super_admin" ? (
    <button
      onClick={() => router.push("/usuarios/nuevo")}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 34, padding: "0 14px", borderRadius: 8, border: "none",
        background: INK9, color: "#fff", fontSize: "0.8125rem",
        fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
      }}
    >
      <UserPlus size={13} />
      Nuevo usuario
    </button>
  ) : undefined;

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <PageHeader kicker="Administración · RF-01" title="Gestión de usuarios" action={headerAction} />

      <div style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${INFO_BD}`,
        background: INFO_BG,
        color: INFO,
        fontSize: "0.8125rem",
      }}>
        Las cuentas de conductores se administran desde el módulo <strong>Conductores</strong> para evitar duplicidad.
      </div>

      <KPIStrip items={kpis} cols={kpis.length as 2 | 3 | 4 | 5 | 6} />

      {error && (
        <div style={{ padding: "11px 16px", background: "#FFF5F5", border: "1px solid #FCA5A5", borderRadius: 10, color: "#DC2626", fontSize: "0.8125rem" }}>
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={filteredItems}
        loading={loading}
        searchPlaceholder="Buscar por nombre o correo…"
        emptyTitle="Sin usuarios"
        emptyDescription="Ajusta los filtros para ver resultados."
        defaultPageSize={20}
        showColumnToggle
        toolbarEnd={toolbarEnd}
        onRowClick={row => router.push(`/usuarios/${row.id}`)}
      />
    </div>
  );
}
