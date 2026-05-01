"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareWarning, Clock, CheckCircle, XCircle, ChevronRight } from "lucide-react";
import { type ColumnDef, DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/button";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";

// Tokens consistentes con el resto del dashboard
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK5 = "#71717a";
const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d"; const RIESGO = "#b45309"; const NO = "#DC2626";

// ── Tipos ────────────────────────────────────────────────────────────────────
type ApelacionStatus = "pendiente" | "aprobada" | "rechazada";

type Apelacion = {
  id: string;
  inspection: { result: string; date: string; score: number } | null;
  vehicle: { plate: string; vehicleTypeKey: string; brand: string; model: string } | null;
  submittedBy: { name: string; email: string } | null;
  reason: string;
  evidence: string[];
  status: ApelacionStatus;
  resolvedBy?: { name: string } | null;
  resolvedAt?: string;
  resolution?: string;
  createdAt: string;
};

const ALLOWED = ["fiscal", "admin_municipal", "admin_provincial", "super_admin"];

const STATUS_LABEL: Record<ApelacionStatus, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

const STATUS_DOT: Record<ApelacionStatus, string> = {
  pendiente: RIESGO,
  aprobada:  APTO,
  rechazada: NO,
};

const INSPECTION_DOT: Record<string, string> = {
  aprobada:  APTO,
  observada: RIESGO,
  rechazada: NO,
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Modal de resolución ──────────────────────────────────────────────────────
function ResolveModal({
  apelacion,
  onClose,
  onResolved,
}: {
  apelacion: Apelacion;
  onClose: () => void;
  onResolved: (updated: Apelacion) => void;
}) {
  const [status, setStatus] = useState<"aprobada" | "rechazada">("aprobada");
  const [resolution, setResolution] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (resolution.trim().length < 5) { setError("La resolución debe tener al menos 5 caracteres."); return; }
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/apelaciones/${apelacion.id}/resolver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ status, resolution: resolution.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al resolver"); return; }
      onResolved(data.data as Apelacion);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }

  const APRO_C = "#15803d"; const APRO_BG = "#F0FDF4"; const APRO_BD = "#86EFAC";
  const RECH_C = "#DC2626"; const RECH_BG = "#FFF5F5"; const RECH_BD = "#FCA5A5";
  const INK2 = "#e4e4e7"; const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(9,9,11,0.55)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, overflow: "hidden", boxShadow: "0 24px 48px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${INK2}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: INK9 }}>Resolver apelación</div>
            <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 2 }}>
              Vehículo: {apelacion.vehicle?.plate ?? "—"} · {apelacion.submittedBy?.name ?? "—"}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${INK2}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: INK5, fontSize: 18 }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 20, padding: 14, background: "#f4f4f5", borderRadius: 10, borderLeft: `3px solid ${INK2}` }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: INK5, marginBottom: 6 }}>Motivo del operador</div>
            <div style={{ fontSize: "0.875rem", color: INK6, lineHeight: 1.6 }}>{apelacion.reason}</div>
            {apelacion.inspection && (
              <div style={{ marginTop: 8, fontSize: "0.75rem", color: INK5 }}>
                Inspección con resultado: <strong>{apelacion.inspection.result}</strong> · Score: {apelacion.inspection.score}/100
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: INK9, marginBottom: 8 }}>Decisión</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setStatus("aprobada")}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                  fontWeight: 600, fontSize: "0.875rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  border: status === "aprobada" ? `2px solid ${APRO_C}` : `1.5px solid ${INK2}`,
                  background: status === "aprobada" ? APRO_BG : "#fff",
                  color: status === "aprobada" ? APRO_C : INK6,
                }}
              >
                <CheckCircle size={16} />Aprobar
              </button>
              <button
                onClick={() => setStatus("rechazada")}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                  fontWeight: 600, fontSize: "0.875rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  border: status === "rechazada" ? `2px solid ${RECH_C}` : `1.5px solid ${INK2}`,
                  background: status === "rechazada" ? RECH_BG : "#fff",
                  color: status === "rechazada" ? RECH_C : INK6,
                }}
              >
                <XCircle size={16} />Rechazar
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: INK9, marginBottom: 6 }}>
              Resolución <span style={{ color: RECH_C }}>*</span>
            </label>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Describa el motivo de su decisión…"
              rows={4}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                border: `1.5px solid ${INK2}`, fontSize: "0.875rem", color: INK9,
                fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = INK6; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = INK2; }}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: RECH_BG, border: `1px solid ${RECH_BD}`, borderRadius: 8, color: RECH_C, fontSize: "0.8125rem" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{ flex: 1, justifyContent: "center", display: "inline-flex", alignItems: "center", height: 38, padding: "0 16px", borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${INK2}`, background: "#fff", color: INK6, fontFamily: "inherit" }}
            >
              Cancelar
            </button>
            <button
              onClick={() => { void submit(); }}
              disabled={loading}
              style={{
                flex: 1, justifyContent: "center", display: "inline-flex", alignItems: "center", height: 38, padding: "0 16px",
                borderRadius: 9, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
                border: "none", fontFamily: "inherit", color: "#fff",
                background: status === "aprobada" ? APRO_C : RECH_C,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Guardando…" : status === "aprobada" ? "Confirmar aprobación" : "Confirmar rechazo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function ApelacionesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Apelacion[]>([]);
  const [stats, setStats] = useState({ pendiente: 0, aprobada: 0, rechazada: 0, total: 0 });
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<Apelacion | null>(null);
  const canResolve = user?.role === "admin_municipal" || user?.role === "super_admin";

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = new URLSearchParams({ limit: "100" });
      if (statusFilter) qs.set("status", statusFilter);
      const res = await fetch(`/api/apelaciones?${qs}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar"); return; }
      setItems(data.data.items ?? []);
      if (data.data.stats) setStats(data.data.stats);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }, [user, statusFilter, router]);

  useEffect(() => { void load(); }, [load]);

  function handleResolved(updated: Apelacion) {
    // Hacer merge preservando referencias del row original (vehicle/submittedBy/inspection
    // pueden venir reducidas desde el resolver) y luego recargar para datos completos.
    setItems((prev) => prev.map((a) => {
      if (a.id !== updated.id) return a;
      return {
        ...a,
        ...updated,
        vehicle:     updated.vehicle     ?? a.vehicle,
        inspection:  updated.inspection  ?? a.inspection,
        submittedBy: updated.submittedBy ?? a.submittedBy,
      };
    }));
    setResolving(null);
    void load();
  }

  const pendientes = stats.pendiente;
  const aprobadas  = stats.aprobada;
  const rechazadas = stats.rechazada;
  const totalGlobal = stats.total;

  const columns = useMemo<ColumnDef<Apelacion, unknown>[]>(
    () => [
      {
        id: "vehiculo",
        header: "Vehículo",
        accessorFn: (r) => r.vehicle?.plate ?? "",
        cell: ({ row }) =>
          row.original.vehicle ? (
            <div>
              <span style={{
                display: "inline-flex", padding: "2px 8px", borderRadius: 6,
                background: INK9, color: "#fff",
                fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.8125rem",
              }}>
                {row.original.vehicle.plate}
              </span>
              <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 3 }}>
                {row.original.vehicle.brand} {row.original.vehicle.model}
              </div>
            </div>
          ) : <span style={{ color: INK5 }}>—</span>,
      },
      {
        id: "operador",
        header: "Operador",
        accessorFn: (r) => `${r.submittedBy?.name ?? ""} ${r.submittedBy?.email ?? ""}`,
        cell: ({ row }) => (
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.875rem", color: INK9 }}>{row.original.submittedBy?.name ?? "—"}</div>
            <div style={{ fontSize: "0.75rem", color: INK5 }}>{row.original.submittedBy?.email ?? ""}</div>
          </div>
        ),
      },
      {
        accessorKey: "reason",
        header: "Motivo",
        cell: ({ row }) => (
          <div style={{ maxWidth: 240 }}>
            <div style={{
              fontSize: "0.8125rem", color: INK6, lineHeight: 1.4,
              overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            }}>
              {row.original.reason}
            </div>
            {(row.original.evidence?.length ?? 0) > 0 && (
              <div style={{ fontSize: "0.6875rem", color: INK5, marginTop: 3 }}>
                {row.original.evidence.length} evidencia{row.original.evidence.length > 1 ? "s" : ""}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "inspeccion",
        header: "Insp. resultado",
        accessorFn: (r) => r.inspection?.result ?? "",
        cell: ({ row }) => {
          const insp = row.original.inspection;
          if (!insp) return <span style={{ color: INK5 }}>—</span>;
          const dot = INSPECTION_DOT[insp.result] ?? INK5;
          return (
            <div>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "2px 9px", borderRadius: 6,
                background: "#fff", color: INK9, border: `1px solid ${INK2}`,
                fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                {insp.result}
              </span>
              <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
                Score: {insp.score}/100
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => {
          const s = row.original.status;
          return (
            <div>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "2px 9px", borderRadius: 6,
                background: "#fff", color: INK9, border: `1px solid ${INK2}`,
                fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: STATUS_DOT[s], flexShrink: 0 }} />
                {STATUS_LABEL[s]}
              </span>
              {row.original.resolvedBy && (
                <div style={{ fontSize: "0.6875rem", color: INK5, marginTop: 3 }}>
                  por {row.original.resolvedBy.name}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Fecha",
        cell: ({ getValue }) => (
          <span style={{ fontSize: "0.8125rem", color: INK6, whiteSpace: "nowrap" }}>
            {fmtDate(getValue() as string)}
          </span>
        ),
      },
      {
        id: "acciones",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          // Si está pendiente y se puede resolver, ofrecer acción rápida.
          // De lo contrario, solo el chevron de afordancia hacia el detalle.
          const isPending = row.original.status === "pendiente";
          if (canResolve && isPending) {
            return (
              <div onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setResolving(row.original)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, height: 28,
                    padding: "0 11px", borderRadius: 6,
                    border: "none", background: INK9, color: "#fff",
                    fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Resolver
                </button>
              </div>
            );
          }
          return (
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", color: INK5 }}>
              <ChevronRight size={14} />
            </span>
          );
        },
      },
    ],
    [canResolve]
  );

  const statusFilterButtons = (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {(["", "pendiente", "aprobada", "rechazada"] as const).map((k) => {
        const labels: Record<string, string> = { "": "Todas", pendiente: "Pendientes", aprobada: "Aprobadas", rechazada: "Rechazadas" };
        const active = statusFilter === k;
        return (
          <button
            key={k}
            onClick={() => setStatusFilter(k)}
            style={{
              display: "inline-flex", alignItems: "center", height: 34, padding: "0 12px", borderRadius: 8,
              fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: active ? "#18181b" : "#fff",
              color: active ? "#fff" : "#52525b",
              border: active ? "1.5px solid #18181b" : "1.5px solid #e4e4e7",
            }}
          >
            {labels[k]}
          </button>
        );
      })}
      <Button variant="outline" size="sm" onClick={() => void load()}>Actualizar</Button>
    </div>
  );

  if (!user) return null;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <PageHeader
        kicker="Operación · RF-13"
        title="Apelaciones"
      />

      <KPIStrip
        cols={4}
        items={[
          { label: "TOTAL", value: loading ? "—" : totalGlobal, subtitle: "registradas", icon: MessageSquareWarning },
          { label: "PENDIENTES", value: loading ? "—" : pendientes, subtitle: "por resolver", icon: Clock },
          { label: "APROBADAS", value: loading ? "—" : aprobadas, subtitle: "confirmadas", icon: CheckCircle },
          { label: "RECHAZADAS", value: loading ? "—" : rechazadas, subtitle: "denegadas", icon: XCircle },
        ]}
      />

      {error && (
        <div style={{
          padding: "12px 16px", background: "#FFF5F5",
          border: "1px solid #FCA5A5", borderRadius: 10, color: "#DC2626",
        }}>
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        onRowClick={(row) => router.push(`/apelaciones/${row.id}`)}
        searchPlaceholder="Buscar placa, operador, motivo…"
        emptyTitle="Sin apelaciones"
        emptyDescription={statusFilter ? `No hay apelaciones con estado "${statusFilter}".` : "No hay apelaciones en el sistema."}
        defaultPageSize={20}
        showColumnToggle
        toolbarEnd={statusFilterButtons}
      />

      {resolving && (
        <ResolveModal
          apelacion={resolving}
          onClose={() => setResolving(null)}
          onResolved={handleResolved}
        />
      )}
    </div>
  );
}
