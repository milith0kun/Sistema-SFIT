"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Check, X, UserCheck, Clock, Users, Calendar, Mail, ShieldAlert,
  Search, Inbox, MessageSquare, Loader2, ChevronRight,
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { KPIStrip } from "@/components/dashboard/KPIStrip";

type PendingUser = {
  id: string;
  name: string;
  email: string;
  image?: string;
  requestedRole: string;
  createdAt: string;
};
type ActionMode = "approve" | "reject";

const ROLE_LABELS: Record<string, string> = {
  ciudadano:        "Ciudadano",
  conductor:        "Conductor",
  operador:         "Operador de Empresa",
  fiscal:           "Fiscal / Inspector",
  admin_municipal:  "Admin Municipal",
};
const ROLE_OPTIONS = [
  { value: "ciudadano", label: "Ciudadano" },
  { value: "conductor", label: "Conductor" },
  { value: "operador",  label: "Operador de Empresa" },
  { value: "fiscal",    label: "Fiscal / Inspector" },
];

// Tokens — paleta sobria (gris + verde sólo para confirmación, rojo sólo para errores)
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK3 = "#d4d4d8";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const RED = "#DC2626"; const REDBG = "#FFF5F5"; const REDBD = "#FCA5A5";
const GRN = "#15803d"; const GRNBG = "#F0FDF4"; const GRNBD = "#86EFAC";

const MONTH_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = Math.floor(hr / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  const dt = new Date(iso);
  return `${dt.getDate()} ${MONTH_ABBR[dt.getMonth()]}`;
}
function formatDateAbs(iso: string): string {
  const dt = new Date(iso);
  return `${dt.getDate()} ${MONTH_ABBR[dt.getMonth()]} ${dt.getFullYear()}, ${dt.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selección + acción
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<ActionMode>("approve");
  const [assignedRole, setAssignedRole] = useState("ciudadano");
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/users/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al cargar solicitudes"); return; }
      setUsers(data.data.users);
      setError(null);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  // Auto-seleccionar el primero al cargar (si no hay nada seleccionado)
  useEffect(() => {
    if (!selectedId && users.length > 0) {
      setSelectedId(users[0].id);
      setAssignedRole(users[0].requestedRole);
    }
  }, [users, selectedId]);

  // Reset del formulario al cambiar selección
  useEffect(() => {
    setActionError(null);
    setActionSuccess(null);
    setApproveNotes("");
    setRejectReason("");
    setAction("approve");
    const u = users.find(x => x.id === selectedId);
    if (u) setAssignedRole(u.requestedRole);
  }, [selectedId, users]);

  const target = useMemo(() => users.find(u => u.id === selectedId) ?? null, [users, selectedId]);

  const rolesCount = useMemo(() =>
    users.reduce<Record<string, number>>((acc, u) => {
      acc[u.requestedRole] = (acc[u.requestedRole] ?? 0) + 1;
      return acc;
    }, {}),
  [users]);
  const maxRole = useMemo(() =>
    Object.entries(rolesCount).sort((a, b) => b[1] - a[1])[0],
  [rolesCount]);

  // Lista filtrada
  const visible = useMemo(() => {
    let list = users;
    if (roleFilter !== "all") list = list.filter(u => u.requestedRole === roleFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return list;
  }, [users, roleFilter, search]);

  async function handleAction() {
    if (!selectedId) return;
    if (action === "reject" && !rejectReason.trim()) {
      setActionError("Indica el motivo del rechazo.");
      return;
    }
    setProcessing(true); setActionError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/users/${selectedId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(
          action === "approve"
            ? { role: assignedRole, notes: approveNotes.trim() || undefined }
            : { reason: rejectReason.trim() }
        ),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error ?? "Error al procesar la solicitud"); return; }

      const removedName = target?.name ?? "Usuario";
      setActionSuccess(action === "approve"
        ? `${removedName} fue aprobado con rol ${ROLE_LABELS[assignedRole] ?? assignedRole}.`
        : `Se rechazó la solicitud de ${removedName}.`);

      // Quita el usuario procesado y selecciona el siguiente
      setUsers(prev => {
        const idx = prev.findIndex(u => u.id === selectedId);
        const next = prev.filter(u => u.id !== selectedId);
        const newSelected = next[idx] ?? next[idx - 1] ?? next[0] ?? null;
        setSelectedId(newSelected?.id ?? null);
        return next;
      });
    } catch { setActionError("Error de conexión"); }
    finally { setProcessing(false); }
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      <DashboardHero
        kicker="Control de Acceso"
        rfCode="RF-01-04"
        title="Aprobaciones de Usuarios"
        pills={[{ label: "Pendientes", value: users.length, warn: users.length > 0 }]}
      />

      <KPIStrip
        cols={3}
        items={[
          { label: "PENDIENTES", value: users.length, subtitle: "por revisar", accent: "#92400E", icon: Clock },
          { label: "TIPOS DE ROL", value: Object.keys(rolesCount).length, subtitle: "solicitados", accent: "#0A1628", icon: Users },
          { label: "MÁS SOLICITADO", value: maxRole ? (ROLE_LABELS[maxRole[0]] ?? maxRole[0]) : "—", subtitle: maxRole ? `${maxRole[1]} solicitud${maxRole[1] === 1 ? "" : "es"}` : "sin datos", accent: "#0A1628", icon: UserCheck },
        ]}
      />

      {error && (
        <div role="alert" style={{ padding: "11px 16px", background: REDBG, border: `1.5px solid ${REDBD}`, borderRadius: 10, color: RED, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldAlert size={15} />{error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Columna izquierda: toolbar + lista ── */}
        <div style={{ minWidth: 0 }}>

          <ListToolbar
            users={users}
            visible={visible}
            search={search}
            setSearch={setSearch}
            roleFilter={roleFilter}
            setRoleFilter={setRoleFilter}
            rolesCount={rolesCount}
          />

          {loading ? (
            <ListSkeleton />
          ) : visible.length === 0 ? (
            <ListEmpty hasUsers={users.length > 0} hasSearch={search.length > 0} onClear={() => { setSearch(""); setRoleFilter("all"); }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {visible.map(u => (
                <RequestCard
                  key={u.id}
                  user={u}
                  selected={u.id === selectedId}
                  onSelect={() => setSelectedId(u.id)}
                />
              ))}
              <div style={{ textAlign: "center", padding: "8px 0 4px", fontSize: "0.8125rem", color: INK5 }}>
                {visible.length} solicitud{visible.length !== 1 ? "es" : ""}
              </div>
            </div>
          )}
        </div>

        {/* ── Columna derecha: detalle + acciones ── */}
        <div style={{ position: "sticky", top: 16 }}>
          {target ? (
            <DetailPanel
              user={target}
              action={action}
              setAction={setAction}
              assignedRole={assignedRole}
              setAssignedRole={setAssignedRole}
              approveNotes={approveNotes}
              setApproveNotes={setApproveNotes}
              rejectReason={rejectReason}
              setRejectReason={setRejectReason}
              processing={processing}
              error={actionError}
              success={actionSuccess}
              onSubmit={handleAction}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <DetailEmpty />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Subcomponentes ─────────── */

function ListToolbar({
  users, visible, search, setSearch, roleFilter, setRoleFilter, rolesCount,
}: {
  users: PendingUser[]; visible: PendingUser[];
  search: string; setSearch: (v: string) => void;
  roleFilter: string; setRoleFilter: (v: string) => void;
  rolesCount: Record<string, number>;
}) {
  const roleTabs = useMemo(() => [
    { id: "all", label: "Todos", count: users.length },
    ...Object.entries(rolesCount).map(([role, count]) => ({
      id: role, label: ROLE_LABELS[role] ?? role, count,
    })),
  ], [users.length, rolesCount]);

  return (
    <div style={{
      background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
      padding: "12px 14px", marginBottom: 12,
      display: "flex", flexDirection: "column", gap: 10,
      position: "sticky", top: 8, zIndex: 10,
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search size={14} color={INK5} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            style={{
              width: "100%", height: 34, paddingLeft: 32, paddingRight: 12,
              border: `1px solid ${INK2}`, borderRadius: 8, fontSize: "0.8125rem",
              fontFamily: "inherit", color: INK9, outline: "none", background: "#fff",
            }}
            onFocus={e => { e.target.style.borderColor = INK9; }}
            onBlur={e => { e.target.style.borderColor = INK2; }}
          />
        </div>
        <span style={{ fontSize: "0.75rem", color: INK5, fontWeight: 600 }}>
          {visible.length} {visible.length === 1 ? "resultado" : "resultados"}
        </span>
      </div>

      {/* Filtros por rol */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {roleTabs.map(t => {
          const active = roleFilter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setRoleFilter(t.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 7,
                border: active ? `1px solid ${INK9}` : `1px solid ${INK2}`,
                background: active ? INK9 : "#fff",
                color: active ? "#fff" : INK6,
                fontSize: "0.75rem", fontWeight: active ? 700 : 500,
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 120ms",
              }}
            >
              {t.label}
              {t.count > 0 && (
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  minWidth: 16, height: 16, padding: "0 5px", borderRadius: 999,
                  background: active ? "rgba(255,255,255,0.2)" : INK1,
                  color: active ? "#fff" : INK6,
                  fontSize: "0.6875rem", fontWeight: 700,
                }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RequestCard({
  user, selected, onSelect,
}: {
  user: PendingUser; selected: boolean; onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px",
        background: selected ? INK1 : "#fff",
        border: `1px solid ${selected ? INK9 : INK2}`,
        borderLeft: `3px solid ${selected ? INK9 : INK2}`,
        borderRadius: 8,
        cursor: "pointer",
        transition: "border-color 120ms, background 120ms",
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = INK5; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = INK2; }}
    >
      {/* Avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: INK1,
        border: `1px solid ${INK2}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.875rem", fontWeight: 700,
        color: INK6,
        flexShrink: 0,
      }}>
        {user.name.charAt(0).toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{
            fontSize: "0.875rem", fontWeight: 700, color: INK9,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {user.name}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem", color: INK5 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "1px 7px", borderRadius: 4,
            background: "#fff", border: `1px solid ${INK2}`, color: INK6,
            fontSize: "0.6875rem", fontWeight: 600,
            whiteSpace: "nowrap",
          }}>
            {ROLE_LABELS[user.requestedRole] ?? user.requestedRole}
          </span>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
            {user.email}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: "0.6875rem", color: INK5, whiteSpace: "nowrap" }}>
          {timeAgo(user.createdAt)}
        </span>
        <ChevronRight size={14} color={INK5} />
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10,
          padding: "12px 14px", display: "flex", gap: 12, alignItems: "center",
        }}>
          <div className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton-shimmer" style={{ height: 12, width: "55%", borderRadius: 5, marginBottom: 7 }} />
            <div className="skeleton-shimmer" style={{ height: 10, width: "75%", borderRadius: 5 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListEmpty({ hasUsers, hasSearch, onClear }: { hasUsers: boolean; hasSearch: boolean; onClear: () => void }) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
      padding: "48px 24px", textAlign: "center",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
    }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: INK1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {hasUsers ? <Search size={24} color={INK5} strokeWidth={1.5} /> : <Inbox size={24} color={INK5} strokeWidth={1.5} />}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9, marginBottom: 3 }}>
          {hasUsers ? "Sin resultados" : "Bandeja vacía"}
        </div>
        <div style={{ fontSize: "0.8125rem", color: INK5 }}>
          {hasUsers
            ? "Ningún usuario coincide con los filtros aplicados."
            : "No hay nuevas solicitudes de acceso por el momento."}
        </div>
      </div>
      {hasSearch && (
        <button onClick={onClear} style={{
          height: 32, padding: "0 14px", borderRadius: 8,
          border: `1px solid ${INK2}`, background: "#fff", color: INK6,
          fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}>
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

function DetailEmpty() {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${INK2}`, borderRadius: 14,
      padding: "60px 24px", textAlign: "center",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
    }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: INK1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <UserCheck size={22} color={INK5} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9 }}>Selecciona una solicitud</div>
      <div style={{ fontSize: "0.8125rem", color: INK5, maxWidth: 280, lineHeight: 1.5 }}>
        Haz clic en un usuario de la lista para revisar sus datos, asignar el rol definitivo y dejar un comentario.
      </div>
    </div>
  );
}

function DetailPanel({
  user, action, setAction,
  assignedRole, setAssignedRole,
  approveNotes, setApproveNotes,
  rejectReason, setRejectReason,
  processing, error, success,
  onSubmit, onClose,
}: {
  user: PendingUser;
  action: ActionMode; setAction: (a: ActionMode) => void;
  assignedRole: string; setAssignedRole: (v: string) => void;
  approveNotes: string; setApproveNotes: (v: string) => void;
  rejectReason: string; setRejectReason: (v: string) => void;
  processing: boolean; error: string | null; success: string | null;
  onSubmit: () => void; onClose: () => void;
}) {
  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${INK2}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      {/* Header neutro */}
      <div style={{
        borderBottom: `1px solid ${INK2}`,
        padding: "14px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 9px", borderRadius: 5,
            background: INK1, color: INK6,
            border: `1px solid ${INK2}`,
            fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            <Clock size={11} /> Solicitud pendiente
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar detalle"
            style={{
              width: 26, height: 26, borderRadius: 6,
              border: `1px solid ${INK2}`, background: "#fff",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: INK5, fontSize: 15, fontFamily: "inherit",
            }}
          >×</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: INK1, border: `1px solid ${INK2}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: INK9, fontWeight: 700, fontSize: "1.375rem", flexShrink: 0,
          }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: INK9, lineHeight: 1.25, wordBreak: "break-word" }}>
              {user.name}
            </div>
            <div style={{ fontSize: "0.8125rem", color: INK6, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
              <Mail size={12} />{user.email}
            </div>
          </div>
        </div>

        {/* Mini-info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 14 }}>
          <InfoChip label="Rol solicitado" value={ROLE_LABELS[user.requestedRole] ?? user.requestedRole} />
          <InfoChip label="Recibida" value={formatDateAbs(user.createdAt)} icon={<Calendar size={11} />} />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "16px 18px 18px" }}>
        {/* Switcher de acción */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 3, background: INK1, borderRadius: 8, marginBottom: 14, border: `1px solid ${INK2}` }}>
          <button
            onClick={() => setAction("approve")}
            style={{
              padding: "6px 10px", borderRadius: 6, border: "none",
              background: action === "approve" ? "#fff" : "transparent",
              color: action === "approve" ? INK9 : INK6,
              fontWeight: action === "approve" ? 700 : 500,
              fontSize: "0.8125rem", cursor: "pointer", fontFamily: "inherit",
              border: action === "approve" ? `1px solid ${INK2}` : "1px solid transparent",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "background 120ms, color 120ms",
            }}
          >
            <Check size={13} /> Aprobar
          </button>
          <button
            onClick={() => setAction("reject")}
            style={{
              padding: "6px 10px", borderRadius: 6, border: "none",
              background: action === "reject" ? "#fff" : "transparent",
              color: action === "reject" ? INK9 : INK6,
              fontWeight: action === "reject" ? 700 : 500,
              fontSize: "0.8125rem", cursor: "pointer", fontFamily: "inherit",
              border: action === "reject" ? `1px solid ${INK2}` : "1px solid transparent",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "background 120ms, color 120ms",
            }}
          >
            <X size={13} /> Rechazar
          </button>
        </div>

        {action === "approve" ? (
          <>
            <FormLabel>Rol definitivo</FormLabel>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <select
                value={assignedRole}
                onChange={e => setAssignedRole(e.target.value)}
                style={{
                  width: "100%", height: 38, padding: "0 36px 0 12px", borderRadius: 8,
                  border: `1px solid ${INK2}`, background: "#fff",
                  fontSize: "0.875rem", color: INK9, fontFamily: "inherit",
                  appearance: "none", cursor: "pointer", outline: "none",
                }}
              >
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <svg viewBox="0 0 10 6" width="10" height="10" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} fill="none">
                <path d="M1 1l4 4 4-4" stroke={INK5} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <FormLabel optional icon={<MessageSquare size={11} />}>Comentario (opcional)</FormLabel>
            <textarea
              value={approveNotes}
              onChange={e => setApproveNotes(e.target.value)}
              placeholder="Notas internas, ej. 'Verificado con la municipalidad de Cusco'…"
              rows={3}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: `1px solid ${INK2}`, background: "#fff",
                fontSize: "0.8125rem", color: INK9, fontFamily: "inherit",
                outline: "none", resize: "vertical", minHeight: 64, lineHeight: 1.5,
              }}
              onFocus={e => { e.target.style.borderColor = INK9; }}
              onBlur={e => { e.target.style.borderColor = INK2; }}
            />
          </>
        ) : (
          <>
            <FormLabel required>Motivo del rechazo</FormLabel>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Ej. Datos institucionales no verificables…"
              rows={4}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: `1px solid ${rejectReason.trim() ? INK2 : INK2}`, background: "#fff",
                fontSize: "0.8125rem", color: INK9, fontFamily: "inherit",
                outline: "none", resize: "vertical", minHeight: 96, lineHeight: 1.5,
              }}
              onFocus={e => { e.target.style.borderColor = INK9; }}
              onBlur={e => { e.target.style.borderColor = INK2; }}
            />
            <p style={{ fontSize: "0.75rem", color: INK5, marginTop: 6, lineHeight: 1.5 }}>
              El usuario recibirá una notificación con este motivo y no podrá acceder a la plataforma.
            </p>
          </>
        )}

        {error && (
          <div role="alert" style={{
            marginTop: 12, padding: "9px 12px",
            background: REDBG, border: `1px solid ${REDBD}`, borderRadius: 8,
            color: RED, fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: 7,
          }}>
            <ShieldAlert size={13} />{error}
          </div>
        )}
        {success && (
          <div role="status" style={{
            marginTop: 12, padding: "9px 12px",
            background: GRNBG, border: `1px solid ${GRNBD}`, borderRadius: 8,
            color: GRN, fontSize: "0.8125rem", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <Check size={13} />{success}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            onClick={onSubmit}
            disabled={processing || (action === "reject" && !rejectReason.trim())}
            style={{
              flex: 1, height: 36, borderRadius: 8, border: "none",
              background: action === "approve" ? GRN : RED, color: "#fff",
              fontFamily: "inherit", fontWeight: 700, fontSize: "0.875rem",
              cursor: processing ? "not-allowed" : "pointer",
              opacity: processing || (action === "reject" && !rejectReason.trim()) ? 0.5 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              transition: "opacity 120ms",
            }}
          >
            {processing
              ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Procesando…</>
              : action === "approve"
                ? <><Check size={14} strokeWidth={2.5} /> Aprobar usuario</>
                : <><X size={14} strokeWidth={2.5} /> Rechazar solicitud</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoChip({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      padding: "8px 10px", borderRadius: 8,
      background: "#fff", border: `1px solid ${INK2}`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.06em",
        color: INK5, textTransform: "uppercase", marginBottom: 3,
      }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9, lineHeight: 1.3, wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}

function FormLabel({ children, required, optional, icon }: {
  children: React.ReactNode; required?: boolean; optional?: boolean; icon?: React.ReactNode;
}) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 5,
      fontSize: "0.6875rem", fontWeight: 700,
      letterSpacing: "0.06em", textTransform: "uppercase",
      color: INK5, marginBottom: 6,
    }}>
      {icon}
      {children}
      {required && <span style={{ color: RED, marginLeft: 2 }}>*</span>}
      {optional && <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>(opcional)</span>}
    </label>
  );
}
