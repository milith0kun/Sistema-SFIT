"use client";

import { useEffect, useState, useCallback, cloneElement } from "react";
import { useRouter } from "next/navigation";
import { Users, Clock, CheckCircle, XCircle, Filter, ShieldCheck, ShieldOff, UserCog } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

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
  province: { _id: string; name: string } | null;
  createdAt: string;
  image: string | null;
};

type StoredUser = { id: string; role: string };

// ── Palette ───────────────────────────────────────────────────────────────────
const INK1 = "#f4f4f5";
const INK2 = "#e4e4e7";
const INK5 = "#71717a";
const INK6 = "#52525b";
const INK9 = "#18181b";

const PEND_BG = "#FFFBEB"; const PEND_C = "#b45309"; const PEND_BD = "#FCD34D";
const ACTI_BG = "#F0FDF4"; const ACTI_C = "#15803d"; const ACTI_BD = "#86EFAC";
const SUSP_BG = "#FFF5F5"; const SUSP_C = "#b91c1c"; const SUSP_BD = "#FCA5A5";
const INFO_BG = "#EFF6FF"; const INFO_C = "#1D4ED8"; const INFO_BD = "#BFDBFE";

const ALLOWED = ["admin_municipal", "admin_provincial", "super_admin"];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin_provincial: "Admin Provincial",
  admin_municipal: "Admin Municipal",
  fiscal: "Fiscal / Inspector",
  operador: "Operador",
  conductor: "Conductor",
  ciudadano: "Ciudadano",
};

const ASSIGNABLE_ROLES: UserRole[] = [
  "ciudadano", "conductor", "operador", "fiscal",
  "admin_municipal", "admin_provincial", "super_admin",
];

const btnInk: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
  borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
  border: "none", background: INK9, color: "#fff", fontFamily: "inherit",
};
const btnOut: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
  borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
  border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit",
};

// ── StatusBadge ───────────────────────────────────────────────────────────────
function StatusBadge({ s }: { s: UserStatus }) {
  const map: Record<UserStatus, { bg: string; color: string; border: string; label: string }> = {
    activo:     { bg: ACTI_BG, color: ACTI_C, border: ACTI_BD, label: "ACTIVO"     },
    pendiente:  { bg: PEND_BG, color: PEND_C, border: PEND_BD, label: "PENDIENTE"  },
    suspendido: { bg: SUSP_BG, color: SUSP_C, border: SUSP_BD, label: "SUSPENDIDO" },
    rechazado:  { bg: SUSP_BG, color: SUSP_C, border: SUSP_BD, label: "RECHAZADO"  },
  };
  const st = map[s] ?? map.pendiente;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px",
      borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase",
      background: st.bg, color: st.color, border: `1px solid ${st.border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
      {st.label}
    </span>
  );
}

// ── RoleBadge ─────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const isAdmin = role.startsWith("admin") || role === "super_admin";
  return (
    <span style={{
      display: "inline-flex", padding: "3px 9px", borderRadius: 6,
      fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase",
      background: isAdmin ? INFO_BG : INK1,
      color: isAdmin ? INFO_C : INK6,
      border: `1px solid ${isAdmin ? INFO_BD : INK2}`,
    }}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Modal cambiar rol ─────────────────────────────────────────────────────────
function RoleModal({
  usuario,
  adminRole,
  onClose,
  onUpdated,
}: {
  usuario: UsuarioRow;
  adminRole: string;
  onClose: () => void;
  onUpdated: (updated: UsuarioRow) => void;
}) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(usuario.role);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtrar roles asignables según el nivel del admin
  const assignable = ASSIGNABLE_ROLES.filter((r) => {
    if (adminRole === "admin_municipal") return !["super_admin", "admin_provincial"].includes(r);
    if (adminRole === "admin_provincial") return r !== "super_admin";
    return true; // super_admin puede asignar cualquier rol
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
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(9,9,11,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, overflow: "hidden", boxShadow: "0 24px 48px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${INK2}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: INK9 }}>Cambiar rol</div>
            <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>{usuario.name} · {usuario.email}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${INK2}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: INK5, fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9, marginBottom: 10 }}>Seleccionar rol</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {assignable.map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRole(r)}
                  style={{
                    padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                    fontWeight: 600, fontSize: "0.875rem", textAlign: "left",
                    border: selectedRole === r ? `2px solid ${INFO_C}` : `1.5px solid ${INK2}`,
                    background: selectedRole === r ? INFO_BG : "#fff",
                    color: selectedRole === r ? INFO_C : INK6,
                  }}
                >
                  {ROLE_LABELS[r] ?? r}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: SUSP_BG, border: `1px solid ${SUSP_BD}`, borderRadius: 8, color: SUSP_C, fontSize: "0.8125rem" }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ ...btnOut, flex: 1, justifyContent: "center" }}>Cancelar</button>
            <button onClick={() => { void submit(); }} disabled={loading} style={{ ...btnInk, flex: 1, justifyContent: "center", opacity: loading ? 0.7 : 1 }}>
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
  const [user, setUser] = useState<StoredUser | null>(null);
  const [items, setItems] = useState<UsuarioRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [roleModal, setRoleModal] = useState<UsuarioRow | null>(null);

  const LIMIT = 20;

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const load = useCallback(async (p = 1) => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = new URLSearchParams({ limit: String(LIMIT), page: String(p) });
      if (roleFilter)   qs.set("role",   roleFilter);
      if (statusFilter) qs.set("status", statusFilter);
      const res = await fetch(`/api/admin/usuarios?${qs}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 403) { router.replace("/dashboard"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar"); return; }
      setItems(data.data.items ?? []);
      setTotal(data.data.total ?? 0);
      setPage(p);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, roleFilter, statusFilter, router]);

  useEffect(() => { void load(1); }, [load]);

  // ── Acciones inline ───────────────────────────────────────────────────────
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
      if (!res.ok || !data.success) {
        setError(data.error ?? "Error al actualizar usuario");
        return;
      }
      setItems((prev) => prev.map((u) => u.id === id ? { ...u, ...data.data } : u));
    } catch { setError("Error de conexión"); }
    finally { setActionLoading(null); }
  }

  function handleRoleUpdated(updated: UsuarioRow) {
    setItems((prev) => prev.map((u) => u.id === updated.id ? { ...u, ...updated } : u));
    setRoleModal(null);
  }

  const activos    = items.filter((u) => u.status === "activo").length;
  const pendientes = items.filter((u) => u.status === "pendiente").length;
  const suspendidos = items.filter((u) => u.status === "suspendido" || u.status === "rechazado").length;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  if (!user) return null;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader
        kicker="Administración · RF-01"
        title="Gestión de usuarios"
      />

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[
          { ico: <Users size={18} />,        lbl: "Total",       val: total,      bg: INK1,    ic: INK5   },
          { ico: <Clock size={18} />,         lbl: "Pendientes",  val: pendientes, bg: PEND_BG, ic: PEND_C },
          { ico: <CheckCircle size={18} />,   lbl: "Activos",     val: activos,    bg: ACTI_BG, ic: ACTI_C },
          { ico: <XCircle size={18} />,       lbl: "Suspendidos", val: suspendidos,bg: SUSP_BG, ic: SUSP_C },
        ].map((m, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12, padding: 18, position: "relative", overflow: "hidden" }}>
            <div aria-hidden style={{ position: "absolute", right: -8, bottom: -8, color: m.ic, opacity: 0.16, pointerEvents: "none", lineHeight: 0 }}>
              {cloneElement(m.ico as React.ReactElement<{ size?: number; strokeWidth?: number }>, { size: 80, strokeWidth: 1.4 })}
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: m.bg, color: m.ic, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{m.ico}</div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: INK5 }}>{m.lbl}</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 6, color: INK9 }}>{loading ? "—" : m.val}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {/* Filtro rol */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{
            height: 36, padding: "0 12px", borderRadius: 8, border: `1.5px solid ${INK2}`,
            fontSize: "0.8125rem", fontWeight: 600, fontFamily: "inherit", background: "#fff", color: INK6, cursor: "pointer",
          }}
        >
          <option value="">Todos los roles</option>
          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        {/* Filtro estado */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            height: 36, padding: "0 12px", borderRadius: 8, border: `1.5px solid ${INK2}`,
            fontSize: "0.8125rem", fontWeight: 600, fontFamily: "inherit", background: "#fff", color: INK6, cursor: "pointer",
          }}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="activo">Activo</option>
          <option value="suspendido">Suspendido</option>
          <option value="rechazado">Rechazado</option>
        </select>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button style={{ ...btnOut, height: 36 }} onClick={() => void load(page)}>
            <Filter size={14} />Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: SUSP_BG, border: `1px solid ${SUSP_BD}`, borderRadius: 10, color: SUSP_C, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Tabla */}
      <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: `1px solid ${INK2}` }}>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
            Lista de usuarios {!loading && <span style={{ fontWeight: 400, color: INK5 }}>({total})</span>}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: INK5 }}>Cargando…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: INK5 }}>
            <Users size={36} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
            <div style={{ fontWeight: 600 }}>Sin usuarios registrados</div>
            <div style={{ fontSize: "0.875rem", marginTop: 4 }}>Ajusta los filtros para ver resultados</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr>
                {["Nombre / Email", "Rol", "Estado", "Municipio", "Fecha registro", "Acciones"].map((h, i) => (
                  <th key={i} style={{
                    textAlign: "left", padding: "12px 16px",
                    fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: INK5, background: "#FAFAFA", borderBottom: `1px solid ${INK2}`,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((u) => {
                const isLoading = actionLoading === u.id;
                return (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${INK1}` }}>
                    {/* Nombre / Email */}
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 600, color: INK9 }}>{u.name}</div>
                      <div style={{ fontSize: "0.75rem", color: INK5 }}>{u.email}</div>
                    </td>

                    {/* Rol */}
                    <td style={{ padding: "14px 16px" }}>
                      <RoleBadge role={u.role} />
                    </td>

                    {/* Estado */}
                    <td style={{ padding: "14px 16px" }}>
                      <StatusBadge s={u.status} />
                    </td>

                    {/* Municipio */}
                    <td style={{ padding: "14px 16px", fontSize: "0.8125rem", color: INK6 }}>
                      {u.municipality?.name ?? u.province?.name ?? <span style={{ color: INK5 }}>—</span>}
                    </td>

                    {/* Fecha */}
                    <td style={{ padding: "14px 16px", fontSize: "0.8125rem", color: INK6, whiteSpace: "nowrap" }}>
                      {fmtDate(u.createdAt)}
                    </td>

                    {/* Acciones inline */}
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {/* Aprobar — solo si pendiente */}
                        {u.status === "pendiente" && (
                          <button
                            disabled={isLoading}
                            onClick={() => { void patchUser(u.id, { status: "activo" }); }}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5, height: 30, padding: "0 10px",
                              borderRadius: 7, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                              border: `1.5px solid ${ACTI_C}`, background: ACTI_BG, color: ACTI_C,
                              opacity: isLoading ? 0.6 : 1,
                            }}
                            title="Aprobar usuario"
                          >
                            <ShieldCheck size={13} />
                            Aprobar
                          </button>
                        )}

                        {/* Reactivar — si suspendido/rechazado */}
                        {(u.status === "suspendido" || u.status === "rechazado") && (
                          <button
                            disabled={isLoading}
                            onClick={() => { void patchUser(u.id, { status: "activo" }); }}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5, height: 30, padding: "0 10px",
                              borderRadius: 7, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                              border: `1.5px solid ${ACTI_C}`, background: ACTI_BG, color: ACTI_C,
                              opacity: isLoading ? 0.6 : 1,
                            }}
                            title="Reactivar usuario"
                          >
                            <ShieldCheck size={13} />
                            Reactivar
                          </button>
                        )}

                        {/* Suspender — solo si activo */}
                        {u.status === "activo" && (
                          <button
                            disabled={isLoading}
                            onClick={() => { void patchUser(u.id, { status: "suspendido" }); }}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5, height: 30, padding: "0 10px",
                              borderRadius: 7, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                              border: `1.5px solid ${SUSP_C}`, background: SUSP_BG, color: SUSP_C,
                              opacity: isLoading ? 0.6 : 1,
                            }}
                            title="Suspender usuario"
                          >
                            <ShieldOff size={13} />
                            Suspender
                          </button>
                        )}

                        {/* Cambiar rol */}
                        <button
                          disabled={isLoading}
                          onClick={() => setRoleModal(u)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5, height: 30, padding: "0 10px",
                            borderRadius: 7, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                            border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
                            opacity: isLoading ? 0.6 : 1,
                          }}
                          title="Cambiar rol"
                        >
                          <UserCog size={13} />
                          Rol
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {!loading && total > LIMIT && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
          <div style={{ fontSize: "0.8125rem", color: INK5 }}>
            Página {page} de {totalPages} · {total} usuarios
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={page <= 1}
              onClick={() => void load(page - 1)}
              style={{ ...btnOut, height: 34, opacity: page <= 1 ? 0.4 : 1 }}
            >
              Anterior
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => void load(page + 1)}
              style={{ ...btnOut, height: 34, opacity: page >= totalPages ? 0.4 : 1 }}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modal cambiar rol */}
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
