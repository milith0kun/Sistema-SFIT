"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Shield, Users, TriangleAlert } from "lucide-react";
import { type ColumnDef, DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { KPIStrip } from "@/components/dashboard/KPIStrip";

type ApiResponse<T> = { success: boolean; data?: T; error?: string };

type AuditEntry = {
  id: string;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  municipalityId?: string;
  municipalityName?: string;
  provinceId?: string;
  provinceName?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

type Municipality = { id: string; name: string };
type StoredUser = { role: string; provinceId?: string; municipalityId?: string };

const ALLOWED_ROLES = ["super_admin", "admin_provincial", "admin_municipal"];
const PAGE_SIZE = 200;

const ACTION_OPTIONS = [
  "",
  "user.registered",
  "user.approved",
  "user.rejected",
  "user.role_changed",
  "user.suspended",
  "user.reactivated",
  "municipality.created",
  "municipality.updated",
  "municipality.deleted",
  "province.created",
  "province.updated",
  "company.created",
  "company.suspended",
];

function actionVariant(action: string): "activo" | "pendiente" | "suspendido" | "info" | "gold" {
  if (action.includes("rejected") || action.includes("suspended") || action.includes("deleted"))
    return "suspendido";
  if (action.includes("approved") || action.includes("created") || action.includes("reactivated"))
    return "activo";
  if (action.includes("role_changed") || action.includes("updated")) return "pendiente";
  if (action.startsWith("user.")) return "info";
  return "gold";
}

function getToken(): string {
  return typeof window === "undefined" ? "" : (localStorage.getItem("sfit_access_token") ?? "");
}

function MetadataCell({ row }: { row: AuditEntry }) {
  const [open, setOpen] = useState(false);
  if (!row.metadata || Object.keys(row.metadata).length === 0) return <span style={{ color: "#a1a1aa" }}>—</span>;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "transparent", border: "none", color: "#0A1628",
          cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, padding: 0,
        }}
      >
        {open ? "Ocultar" : "Ver metadata"}
      </button>
      {open && (
        <pre
          style={{
            marginTop: 6, fontSize: "0.72rem", color: "#3F3F46",
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            background: "#fafafa", borderRadius: 6, padding: "8px 10px",
            border: "1px solid #e4e4e7", maxWidth: 340,
          }}
        >
          {JSON.stringify(row.metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AuditoriaPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);

  // Filtros
  const [actorEmail, setActorEmail] = useState("");
  const [action, setAction] = useState("");
  const [municipalityId, setMunicipalityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

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

  const load = useCallback(
    async (opts?: { email?: string; act?: string; muniId?: string; fr?: string; t?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set("page", "1");
        qs.set("limit", String(PAGE_SIZE));
        const em = opts?.email ?? actorEmail;
        const ac = opts?.act ?? action;
        const mi = opts?.muniId ?? municipalityId;
        const fr = opts?.fr ?? from;
        const tt = opts?.t ?? to;
        if (em.trim()) qs.set("actorEmail", em.trim());
        if (ac) qs.set("action", ac);
        if (mi) qs.set("municipalityId", mi);
        if (fr) qs.set("from", new Date(fr).toISOString());
        if (tt) qs.set("to", new Date(tt).toISOString());

        const res = await fetch(`/api/admin/audit-log?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.status === 401) return router.replace("/login");
        if (res.status === 403) { setForbidden(true); return; }
        const data: ApiResponse<{ items: AuditEntry[]; total: number }> = await res.json();
        if (!res.ok || !data.success) { setError(data.error ?? "No se pudo cargar la auditoría."); return; }
        setItems(data.data?.items ?? []);
        setTotal(data.data?.total ?? 0);
      } catch {
        setError("Error de conexión.");
      } finally {
        setLoading(false);
      }
    },
    [actorEmail, action, municipalityId, from, to, router]
  );

  const loadMunis = useCallback(async () => {
    try {
      const res = await fetch("/api/municipalidades", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const data: ApiResponse<{ items: Municipality[] }> = await res.json();
      if (data.success && data.data) setMunicipalities(data.data.items ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadMunis();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const sensitiveCount = useMemo(
    () => items.filter((e) => e.action.includes("suspended") || e.action.includes("deleted") || e.action.includes("rejected")).length,
    [items]
  );
  const approvalsCount = useMemo(() => items.filter((e) => e.action.includes("approved")).length, [items]);
  const userActionsCount = useMemo(() => items.filter((e) => e.action.startsWith("user.")).length, [items]);

  const columns = useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Fecha",
        cell: ({ row }) => (
          <span style={{ color: "#52525b", whiteSpace: "nowrap", fontSize: "0.8125rem" }}>
            {new Date(row.original.createdAt).toLocaleString("es-PE")}
          </span>
        ),
      },
      {
        id: "actor",
        header: "Actor",
        accessorFn: (r) => `${r.actorName ?? ""} ${r.actorEmail ?? ""}`,
        cell: ({ row }) => (
          <div>
            <div style={{ color: "#09090b", fontWeight: 600, fontSize: "0.875rem" }}>
              {row.original.actorName ?? "—"}
            </div>
            {row.original.actorEmail && (
              <div style={{ color: "#71717a", fontSize: "0.75rem" }}>{row.original.actorEmail}</div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "actorRole",
        header: "Rol",
        cell: ({ getValue }) => (
          <span style={{ color: "#52525b", fontSize: "0.8125rem" }}>{(getValue() as string) ?? "—"}</span>
        ),
      },
      {
        accessorKey: "action",
        header: "Acción",
        cell: ({ getValue }) => (
          <Badge variant={actionVariant(getValue() as string)}>{getValue() as string}</Badge>
        ),
      },
      {
        id: "recurso",
        header: "Recurso",
        accessorFn: (r) => `${r.resourceType ?? ""} ${r.resourceId ?? ""}`,
        cell: ({ row }) => (
          <div>
            <div style={{ color: "#27272a", fontSize: "0.875rem" }}>{row.original.resourceType ?? "—"}</div>
            {row.original.resourceId && (
              <div style={{ color: "#a1a1aa", fontSize: "0.6875rem" }}>{row.original.resourceId}</div>
            )}
          </div>
        ),
      },
      {
        id: "ambito",
        header: "Ámbito",
        accessorFn: (r) => r.municipalityName ?? r.provinceName ?? "",
        cell: ({ getValue }) => (
          <span style={{ color: "#52525b", fontSize: "0.8125rem" }}>{(getValue() as string) || "—"}</span>
        ),
      },
      {
        id: "metadata",
        header: "Metadata",
        enableSorting: false,
        cell: ({ row }) => <MetadataCell row={row.original} />,
      },
    ],
    []
  );

  const toolbarFilters = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input
        className="field"
        type="email"
        placeholder="Email del actor"
        value={actorEmail}
        onChange={(e) => setActorEmail(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void load(); }}
        style={{ height: 34, fontSize: "0.8125rem", borderRadius: 8 }}
      />
      <select
        className="field"
        value={action}
        onChange={(e) => { setAction(e.target.value); }}
        style={{ height: 34, fontSize: "0.8125rem", borderRadius: 8 }}
      >
        {ACTION_OPTIONS.map((a) => (
          <option key={a || "all"} value={a}>{a || "Todas las acciones"}</option>
        ))}
      </select>
      {user?.role !== "admin_municipal" && (
        <select
          className="field"
          value={municipalityId}
          onChange={(e) => setMunicipalityId(e.target.value)}
          style={{ height: 34, fontSize: "0.8125rem", borderRadius: 8 }}
        >
          <option value="">Todos los municipios</option>
          {municipalities.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      )}
      <input
        className="field"
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        style={{ height: 34, fontSize: "0.8125rem", borderRadius: 8 }}
      />
      <input
        className="field"
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        style={{ height: 34, fontSize: "0.8125rem", borderRadius: 8 }}
      />
      <Button variant="outline" size="sm" onClick={() => void load()}>Aplicar</Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setActorEmail(""); setAction(""); setMunicipalityId(""); setFrom(""); setTo("");
          void load({ email: "", act: "", muniId: "", fr: "", t: "" });
        }}
      >
        Limpiar
      </Button>
    </div>
  );

  if (forbidden) {
    return (
      <div className="animate-fade-in">
        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", marginBottom: 8 }}>Acceso denegado</h3>
          <p style={{ color: "#52525b" }}>No tienes permisos para ver esta sección.</p>
        </Card>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <DashboardHero
        kicker="Trazabilidad"
        rfCode="RNF-16"
        title="Auditoría"
        pills={[
          { label: "Eventos", value: total },
          { label: "Sensibles", value: sensitiveCount, warn: sensitiveCount > 0 },
        ]}
      />

      <KPIStrip
        cols={4}
        items={[
          { label: "EVENTOS", value: total, subtitle: "en período", accent: "#0A1628", icon: FileText },
          { label: "APROBACIONES", value: approvalsCount, subtitle: "confirmadas", accent: "#15803d", icon: Shield },
          { label: "USUARIOS", value: userActionsCount, subtitle: "acciones", accent: "#B8860B", icon: Users },
          { label: "SENSIBLES", value: sensitiveCount, subtitle: "rechazos / supresiones", accent: "#b91c1c", icon: TriangleAlert },
        ]}
      />

      {error && (
        <div
          role="alert"
          style={{
            background: "#FFF5F5", border: "1.5px solid #FCA5A5",
            borderRadius: 12, padding: 16, color: "#b91c1c",
            fontSize: "0.9375rem", fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        searchPlaceholder="Buscar actor, acción, recurso…"
        emptyTitle="Sin registros"
        emptyDescription="Aún no hay entradas en el audit-log con los filtros seleccionados."
        defaultPageSize={25}
        showColumnToggle
        toolbarEnd={toolbarFilters}
      />
    </div>
  );
}
