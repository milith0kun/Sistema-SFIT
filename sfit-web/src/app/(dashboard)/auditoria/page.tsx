"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText, Shield, Users, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
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
const PAGE_SIZE = 25;

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
  if (action.includes("rejected") || action.includes("suspended") || action.includes("deleted")) {
    return "suspendido";
  }
  if (action.includes("approved") || action.includes("created") || action.includes("reactivated")) {
    return "activo";
  }
  if (action.includes("role_changed") || action.includes("updated")) return "pendiente";
  if (action.startsWith("user.")) return "info";
  return "gold";
}

function getToken(): string {
  return typeof window === "undefined" ? "" : localStorage.getItem("sfit_access_token") ?? "";
}

export default function AuditoriaPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
    async (opts?: { page?: number }) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set("page", String(opts?.page ?? page));
        qs.set("limit", String(PAGE_SIZE));
        if (actorEmail.trim()) qs.set("actorEmail", actorEmail.trim());
        if (action) qs.set("action", action);
        if (municipalityId) qs.set("municipalityId", municipalityId);
        if (from) qs.set("from", new Date(from).toISOString());
        if (to) qs.set("to", new Date(to).toISOString());

        const res = await fetch(`/api/admin/audit-log?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.status === 401) return router.replace("/login");
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        const data: ApiResponse<{ items: AuditEntry[]; total: number }> = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error ?? "No se pudo cargar la auditoría.");
          return;
        }
        setItems(data.data?.items ?? []);
        setTotal(data.data?.total ?? 0);
      } catch {
        setError("Error de conexión.");
      } finally {
        setLoading(false);
      }
    },
    [page, actorEmail, action, municipalityId, from, to, router]
  );

  const loadMunis = useCallback(async () => {
    try {
      const res = await fetch("/api/municipalidades", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const data: ApiResponse<{ items: Municipality[] }> = await res.json();
      if (data.success && data.data) setMunicipalities(data.data.items ?? []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadMunis();
  }, [user, loadMunis]);

  useEffect(() => {
    if (!user) return;
    setPage(1);
    void load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, action, municipalityId, from, to]);

  useEffect(() => {
    if (!user) return;
    void load({ page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  const sensitiveCount = items.filter(
    (e) =>
      e.action.includes("suspended") ||
      e.action.includes("deleted") ||
      e.action.includes("rejected")
  ).length;
  const approvalsCount = items.filter((e) => e.action.includes("approved")).length;
  const userActionsCount = items.filter((e) => e.action.startsWith("user.")).length;

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
          { label: "SENSIBLES", value: sensitiveCount, subtitle: "rechazos/supresiones", accent: "#b91c1c", icon: TriangleAlert },
        ]}
      />

      <Card>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <input
            className="field"
            type="email"
            placeholder="Email del actor"
            value={actorEmail}
            onChange={(e) => setActorEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                void load({ page: 1 });
              }
            }}
          />
          <select className="field" value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTION_OPTIONS.map((a) => (
              <option key={a || "all"} value={a}>
                {a || "Todas las acciones"}
              </option>
            ))}
          </select>
          {user.role !== "admin_municipal" && (
            <select
              className="field"
              value={municipalityId}
              onChange={(e) => setMunicipalityId(e.target.value)}
            >
              <option value="">Todas las municipalidades</option>
              {municipalities.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <input
            className="field"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            className="field"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, gap: 8 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActorEmail("");
              setAction("");
              setMunicipalityId("");
              setFrom("");
              setTo("");
            }}
          >
            Limpiar filtros
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load({ page: 1 })}>
            Aplicar
          </Button>
        </div>
      </Card>

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

      {loading ? (
        <Card>
          <div style={{ color: "#71717a" }}>Cargando…</div>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin registros"
          subtitle="Aún no hay entradas en el audit-log con los filtros seleccionados."
        />
      ) : (
        <>
          <div
            style={{
              background: "#ffffff",
              border: "1.5px solid #e4e4e7",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  {["Fecha", "Actor", "Rol", "Acción", "Recurso", "Ámbito", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        fontWeight: 700,
                        color: "#18181b",
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        padding: "12px 18px",
                        background: "#f4f4f5",
                        borderBottom: "1.5px solid #e4e4e7",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((e) => {
                  const isOpen = expanded.has(e.id);
                  return (
                    <Fragment key={e.id}>
                      <tr style={{ borderBottom: "1px solid #f4f4f5" }}>
                        <td style={{ padding: "12px 18px", color: "#52525b", whiteSpace: "nowrap" }}>
                          {new Date(e.createdAt).toLocaleString("es-PE")}
                        </td>
                        <td style={{ padding: "12px 18px" }}>
                          <div style={{ color: "#09090b", fontWeight: 600 }}>
                            {e.actorName ?? "—"}
                          </div>
                          <div style={{ color: "#71717a", fontSize: "0.75rem" }}>
                            {e.actorEmail ?? ""}
                          </div>
                        </td>
                        <td style={{ padding: "12px 18px", color: "#52525b" }}>
                          {e.actorRole ?? "—"}
                        </td>
                        <td style={{ padding: "12px 18px" }}>
                          <Badge variant={actionVariant(e.action)}>{e.action}</Badge>
                        </td>
                        <td style={{ padding: "12px 18px", color: "#27272a" }}>
                          {e.resourceType ?? "—"}
                          {e.resourceId && (
                            <div style={{ color: "#a1a1aa", fontSize: "0.6875rem" }}>
                              {e.resourceId}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 18px", color: "#52525b" }}>
                          {e.municipalityName ?? e.provinceName ?? "—"}
                        </td>
                        <td style={{ padding: "12px 18px", textAlign: "right" }}>
                          {e.metadata && Object.keys(e.metadata).length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(e.id)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#0A1628",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                              }}
                            >
                              {isOpen ? "Ocultar" : "Ver metadata"}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isOpen && e.metadata && (
                        <tr style={{ background: "#fafafa" }}>
                          <td colSpan={7} style={{ padding: "12px 18px" }}>
                            <pre
                              style={{
                                margin: 0,
                                fontSize: "0.75rem",
                                color: "#3F3F46",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                fontFamily:
                                  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                              }}
                            >
                              {JSON.stringify(e.metadata, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ color: "#71717a", fontSize: "0.8125rem" }}>
              <span className="num">{total}</span> eventos · Página <span className="num">{page}</span> de <span className="num">{totalPages}</span>
            </div>
            <div style={{ display: "inline-flex", gap: 8 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft size={14} strokeWidth={2} />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Siguiente
                <ChevronRight size={14} strokeWidth={2} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
