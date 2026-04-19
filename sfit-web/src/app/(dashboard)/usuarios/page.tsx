"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Clock, CheckCircle, XCircle,
  ShieldCheck, ShieldOff, UserCog, RefreshCw,
} from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { KPIStrip, type KPIItem } from "@/components/dashboard/KPIStrip";

// ── Tipos ─────────────────────────────────────────────────────────────────────
type UserStatus = "activo" | "pendiente" | "suspendido" | "rechazado";
type UserRole =
  | "super_admin" | "admin_provincial" | "admin_municipal"
  | "fiscal" | "operador" | "conductor" | "ciudadano";

type UsuarioRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  municipality: { _id: string; name: string } | null;
  province:     { _id: string; name: string } | null;
  createdAt: string;
  image: string | null;
};

type StoredUser = { id: string; role: string };

// ── Constants ─────────────────────────────────────────────────────────────────
const ALLOWED = ["admin_municipal", "admin_provincial", "super_admin"];
const LIMIT   = 200;

const ROLE_LABELS: Record<string, string> = {
  super_admin:      "Super Admin",
  admin_provincial: "Admin Provincial",
  admin_municipal:  "Admin Municipal",
  fiscal:           "Fiscal",
  operador:         "Operador",
  conductor:        "Conductor",
  ciudadano:        "Ciudadano",
};

const ASSIGNABLE_ROLES: UserRole[] = [
  "ciudadano", "conductor", "operador", "fiscal",
  "admin_municipal", "admin_provincial", "super_admin",
];

// ── Palette ───────────────────────────────────────────────────────────────────
const PEND_BG = "#FFFBEB"; const PEND_C = "#b45309"; const PEND_BD = "#FCD34D";
const ACTI_BG = "#F0FDF4"; const ACTI_C = "#15803d"; const ACTI_BD = "#86EFAC";
const SUSP_BG = "#FFF5F5"; const SUSP_C = "#b91c1c"; const SUSP_BD = "#FCA5A5";
const INFO_BG = "#EFF6FF"; const INFO_C = "#1D4ED8"; const INFO_BD = "#BFDBFE";
const INK1    = "#f4f4f5";
const INK2    = "#e4e4e7";
const INK5    = "#71717a";
const INK6    = "#52525b";
const INK9    = "#18181b";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

// ── UserAvatar ─────────────────────────────────────────────────────────────────
function UserAvatar({ name, role }: { name: string; role: string }) {
  const isAdmin = role.startsWith("admin") || role === "super_admin";
  const initials = name.split(" ").map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
      background: isAdmin ? INFO_BG : INK1,
      color: isAdmin ? INFO_C : INK6,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "0.75rem", fontWeight: 800, letterSpacing: "-0.01em",
      border: `1.5px solid ${isAdmin ? INFO_BD : INK2}`,
    }}>
      {initials || "?"}
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
function StatusBadge({ s }: { s: UserStatus }) {
  const map = {
    activo:     { bg: ACTI_BG, c: ACTI_C, bd: ACTI_BD, label: "Activo"     },
    pendiente:  { bg: PEND_BG, c: PEND_C, bd: PEND_BD, label: "Pendiente"  },
    suspendido: { bg: SUSP_BG, c: SUSP_C, bd: SUSP_BD, label: "Suspendido" },
    rechazado:  { bg: SUSP_BG, c: SUSP_C, bd: SUSP_BD, label: "Rechazado"  },
  };
  const st = map[s] ?? map.pendiente;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 999,
      fontSize: "0.6875rem", fontWeight: 700,
      background: st.bg, color: st.c, border: `1px solid ${st.bd}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
      {st.label}
    </span>
  );
}

// ── RoleBadge ─────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const isAdmin = role.startsWith("admin") || role === "super_admin";
  const isGold  = role === "super_admin";
  return (
    <span style={{
      display: "inline-flex", padding: "3px 9px", borderRadius: 6,
      fontSize: "0.6875rem", fontWeight: 700, whiteSpace: "nowrap",
      background: isGold ? "#FDF8EC" : isAdmin ? INFO_BG : INK1,
      color: isGold ? "#926A09" : isAdmin ? INFO_C : INK6,
      border: `1px solid ${isGold ? "#E8D090" : isAdmin ? INFO_BD : INK2}`,
    }}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ── AccionesCell ──────────────────────────────────────────────────────────────
function AccionesCell({
  u, isLoading, onPatch, onRoleModal,
}: {
  u: UsuarioRow;
  isLoading: boolean;
  onPatch: (id: string, patch: { status?: string }) => void;
  onRoleModal: (u: UsuarioRow) => void;
}) {
  const btnStyle = (bg: string, c: string, bd: string): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    height: 28, padding: "0 9px", borderRadius: 7,
    fontSize: "0.75rem", fontWeight: 600, cursor: isLoading ? "not-allowed" : "pointer",
    fontFamily: "inherit", transition: "all 0.15s",
    border: `1.5px solid ${bd}`, background: bg, color: c,
    opacity: isLoading ? 0.55 : 1,
  });

  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "nowrap" }}>
      {u.status === "pendiente" && (
        <button
          disabled={isLoading}
          onClick={() => onPatch(u.id, { status: "activo" })}
          style={btnStyle(ACTI_BG, ACTI_C, ACTI_BD)}
          title="Aprobar"
        >
          <ShieldCheck size={12} /> Aprobar
        </button>
      )}
      {(u.status === "suspendido" || u.status === "rechazado") && (
        <button
          disabled={isLoading}
          onClick={() => onPatch(u.id, { status: "activo" })}
          style={btnStyle(ACTI_BG, ACTI_C, ACTI_BD)}
          title="Reactivar"
        >
          <ShieldCheck size={12} /> Reactivar
        </button>
      )}
      {u.status === "activo" && (
        <button
          disabled={isLoading}
          onClick={() => onPatch(u.id, { status: "suspendido" })}
          style={btnStyle(SUSP_BG, SUSP_C, SUSP_BD)}
          title="Suspender"
        >
          <ShieldOff size={12} /> Suspender
        </button>
      )}
      <button
        disabled={isLoading}
        onClick={() => onRoleModal(u)}
        style={btnStyle("#fff", INK6, INK2)}
        title="Cambiar rol"
      >
        <UserCog size={12} /> Rol
      </button>
    </div>
  );
}

// ── RoleModal ─────────────────────────────────────────────────────────────────
function RoleModal({
  usuario, adminRole, onClose, onUpdated,
}: {
  usuario: UsuarioRow; adminRole: string;
  onClose: () => void; onUpdated: (u: UsuarioRow) => void;
}) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(usuario.role);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const assignable = ASSIGNABLE_ROLES.filter((r) => {
    if (adminRole === "admin_municipal")  return !["super_admin", "admin_provincial"].includes(r);
    if (adminRole === "admin_provincial") return r !== "super_admin";
    return true;
  });

  async function submit() {
    if (selectedRole === usuario.role) { onClose(); return; }
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/admin/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ role: selectedRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al actualizar"); return; }
      onUpdated(data.data as UsuarioRow);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(9,9,11,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 18, width: "100%", maxWidth: 420,
        overflow: "hidden", boxShadow: "0 32px 64px rgba(0,0,0,0.18)",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 18px",
          borderBottom: `1px solid ${INK2}`,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: INK9 }}>Cambiar rol</div>
            <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 3 }}>
              {usuario.name} · <span style={{ color: INK6 }}>{usuario.email}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8, border: `1px solid ${INK2}`,
              background: INK1, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: INK5, fontSize: 18, lineHeight: 1, flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 24px" }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9, marginBottom: 10 }}>
            Seleccionar rol
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {assignable.map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRole(r)}
                style={{
                  padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                  fontFamily: "inherit", fontWeight: 600, fontSize: "0.875rem", textAlign: "left",
                  border: selectedRole === r ? `2px solid ${INFO_C}` : `1.5px solid ${INK2}`,
                  background: selectedRole === r ? INFO_BG : "#fff",
                  color: selectedRole === r ? INFO_C : INK6,
                  transition: "all 0.15s",
                }}
              >
                {ROLE_LABELS[r] ?? r}
              </button>
            ))}
          </div>

          {error && (
            <div style={{
              margin: "16px 0 0", padding: "10px 14px",
              background: SUSP_BG, border: `1px solid ${SUSP_BD}`,
              borderRadius: 8, color: SUSP_C, fontSize: "0.8125rem",
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, height: 40, borderRadius: 10, border: `1.5px solid ${INK2}`,
                background: "#fff", color: INK6, fontFamily: "inherit",
                fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => { void submit(); }}
              disabled={loading}
              style={{
                flex: 1, height: 40, borderRadius: 10, border: "none",
                background: INK9, color: "#fff", fontFamily: "inherit",
                fontWeight: 600, fontSize: "0.875rem",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function UsuariosAdminPage() {
  const router = useRouter();
  const [user,         setUser]         = useState<StoredUser | null>(null);
  const [items,        setItems]        = useState<UsuarioRow[]>([]);
  const [total,        setTotal]        = useState(0);
  const [roleFilter,   setRoleFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [roleModal,    setRoleModal]    = useState<UsuarioRow | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
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

  async function patchUser(id: string, patch: { status?: string; role?: string }) {
    setActionLoading(id);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/admin/usuarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error"); return; }
      setItems((prev) => prev.map((u) => u.id === id ? { ...u, ...data.data } : u));
    } catch { setError("Error de conexión"); }
    finally { setActionLoading(null); }
  }

  function handleRoleUpdated(updated: UsuarioRow) {
    setItems((prev) => prev.map((u) => u.id === updated.id ? { ...u, ...updated } : u));
    setRoleModal(null);
  }

  // ── Pre-filter client-side ────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    return items
      .filter((u) => !roleFilter   || u.role   === roleFilter)
      .filter((u) => !statusFilter || u.status === statusFilter);
  }, [items, roleFilter, statusFilter]);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis: KPIItem[] = useMemo(() => {
    const activos    = items.filter((u) => u.status === "activo").length;
    const pendientes = items.filter((u) => u.status === "pendiente").length;
    const suspendidos = items.filter((u) => u.status === "suspendido" || u.status === "rechazado").length;
    return [
      { label: "Total",       value: total || items.length, accent: "#71717a", icon: Users,        subtitle: "usuarios registrados" },
      { label: "Pendientes",  value: pendientes,  accent: "#b45309", icon: Clock,        subtitle: "por aprobar" },
      { label: "Activos",     value: activos,     accent: "#15803d", icon: CheckCircle,  subtitle: "con acceso activo" },
      { label: "Suspendidos", value: suspendidos, accent: "#b91c1c", icon: XCircle,      subtitle: "sin acceso" },
    ];
  }, [items, total]);

  // ── Column definitions ────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<UsuarioRow, unknown>[]>(() => [
    {
      id: "usuario",
      header: "Usuario",
      accessorFn: (row) => `${row.name} ${row.email}`,
      enableSorting: true,
      sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
      cell: ({ row: r }) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <UserAvatar name={r.original.name} role={r.original.role} />
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.875rem", color: INK9, lineHeight: 1.3 }}>
              {r.original.name}
            </div>
            <div style={{ fontSize: "0.75rem", color: INK5, lineHeight: 1.3 }}>
              {r.original.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: "Rol",
      enableSorting: true,
      sortingFn: (a, b) => (ROLE_LABELS[a.original.role] ?? "").localeCompare(ROLE_LABELS[b.original.role] ?? ""),
      cell: ({ row: r }) => <RoleBadge role={r.original.role} />,
    },
    {
      accessorKey: "status",
      header: "Estado",
      enableSorting: true,
      cell: ({ row: r }) => <StatusBadge s={r.original.status} />,
    },
    {
      id: "ubicacion",
      header: "Municipio / Provincia",
      accessorFn: (row) => row.municipality?.name ?? row.province?.name ?? "",
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v
          ? <span style={{ fontSize: "0.8125rem", color: INK6 }}>{v}</span>
          : <span style={{ color: "#a1a1aa" }}>—</span>;
      },
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
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      cell: ({ row: r }) => (
        <AccionesCell
          u={r.original}
          isLoading={actionLoading === r.original.id}
          onPatch={patchUser}
          onRoleModal={setRoleModal}
        />
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [actionLoading]);

  if (!user) return null;

  // ── Filter controls (inject into DataTable toolbar) ────────────────────
  const selectStyle: React.CSSProperties = {
    height: 34, padding: "0 10px",
    borderRadius: 8, border: `1.5px solid ${INK2}`,
    fontSize: "0.8125rem", fontFamily: "inherit",
    background: "#fff", color: INK6, cursor: "pointer",
  };

  const toolbarEnd = (
    <>
      <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={selectStyle}>
        <option value="">Todos los roles</option>
        {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>

      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
        <option value="">Todos los estados</option>
        <option value="pendiente">Pendiente</option>
        <option value="activo">Activo</option>
        <option value="suspendido">Suspendido</option>
        <option value="rechazado">Rechazado</option>
      </select>

      <button
        onClick={() => { void load(); }}
        disabled={loading}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          height: 34, padding: "0 12px",
          borderRadius: 8, border: `1.5px solid ${INK2}`,
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

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <PageHeader
        kicker="Administración · RF-01"
        title="Gestión de usuarios"
      />

      {/* KPI Strip */}
      <KPIStrip items={kpis} cols={4} />

      {/* Error */}
      {error && (
        <div style={{
          padding: "11px 16px", background: "#FFF5F5",
          border: "1px solid #FCA5A5", borderRadius: 10,
          color: "#b91c1c", fontSize: "0.8125rem",
        }}>
          {error}
        </div>
      )}

      {/* Data Table */}
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
      />

      {/* Role modal */}
      {roleModal && (
        <RoleModal
          usuario={roleModal}
          adminRole={user.role}
          onClose={() => setRoleModal(null)}
          onUpdated={handleRoleUpdated}
        />
      )}
    </div>
  );
}
