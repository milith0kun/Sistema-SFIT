"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, X, UserCheck, Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
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

/** RF-01-04: Admin Municipal aprueba o rechaza solicitudes pendientes */
export default function AdminUsersPage() {
  const [users, setUsers]         = useState<PendingUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selected, setSelected]   = useState<string | null>(null);
  const [action, setAction]       = useState<"approve" | "reject" | null>(null);
  const [assignedRole, setAssignedRole] = useState("ciudadano");
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/users/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al cargar solicitudes");
        return;
      }
      setUsers(data.data.users);
      setError(null);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleAction() {
    if (!selected || !action) return;
    setProcessing(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/users/${selected}/${action}`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          Authorization:   `Bearer ${token}`,
        },
        body: JSON.stringify(
          action === "approve"
            ? { role: assignedRole }
            : { reason: rejectReason },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Error");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== selected));
      setSelected(null);
      setAction(null);
      setRejectReason("");
    } catch {
      alert("Error de conexión");
    } finally {
      setProcessing(false);
    }
  }

  const target = users.find((u) => u.id === selected);

  const rolesCount = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.requestedRole] = (acc[u.requestedRole] ?? 0) + 1;
    return acc;
  }, {});
  const maxRole = Object.entries(rolesCount).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <DashboardHero
        kicker="Aprobaciones pendientes"
        rfCode="RF-01-04"
        title="Solicitudes pendientes"
        pills={[
          { label: "Por revisar", value: users.length, warn: users.length > 0 },
        ]}
      />

      <KPIStrip
        cols={3}
        items={[
          { label: "PENDIENTES", value: users.length, subtitle: "por revisar", accent: "#B45309", icon: Clock },
          { label: "TIPOS DE ROL", value: Object.keys(rolesCount).length, subtitle: "solicitados", accent: "#B8860B", icon: Users },
          { label: "MÁS SOLICITADO", value: maxRole ? (ROLE_LABELS[maxRole[0]] ?? maxRole[0]) : "—", subtitle: maxRole ? `${maxRole[1]} solicitud${maxRole[1] === 1 ? "" : "es"}` : "sin datos", accent: "#0A1628", icon: UserCheck },
        ]}
      />

      {error && (
        <div
          role="alert"
          className="animate-fade-up"
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

      <div className="animate-fade-up delay-100">
        {loading ? (
          <Card>
            <div style={{ color: "#71717a", fontSize: "0.9375rem" }}>Cargando solicitudes…</div>
          </Card>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<UserCheck size={22} strokeWidth={1.8} />}
            title="Sin solicitudes pendientes"
            subtitle="Todas las solicitudes han sido procesadas."
          />
        ) : (
          <div
            style={{
              background: "#ffffff",
              border: "1.5px solid #e4e4e7",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {users.map((u, i) => (
                <li
                  key={u.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "16px 22px",
                    borderTop: i > 0 ? "1px solid #f4f4f5" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                    <div
                      aria-hidden
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "#FDF8EC",
                        border: "1.5px solid #E8D090",
                        color: "#926A09",
                        fontWeight: 700,
                        fontSize: "0.9375rem",
                        fontFamily: "var(--font-inter)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.9375rem",
                          fontWeight: 600,
                          color: "#09090b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {u.name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.8125rem",
                          color: "#71717a",
                          marginTop: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>{u.email}</span>
                        <span style={{ color: "#d4d4d8" }}>·</span>
                        <span>Solicita:</span>
                        <Badge variant="gold">
                          {ROLE_LABELS[u.requestedRole] ?? u.requestedRole}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "inline-flex", gap: 8, flexShrink: 0 }}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelected(u.id);
                        setAction("approve");
                        setAssignedRole(u.requestedRole);
                      }}
                    >
                      <Check size={14} strokeWidth={2} />
                      Aprobar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelected(u.id);
                        setAction("reject");
                      }}
                    >
                      <X size={14} strokeWidth={2} />
                      Rechazar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Modal de confirmación */}
      {selected && target && action && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(9,9,11,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => {
            if (!processing) {
              setSelected(null);
              setAction(null);
            }
          }}
        >
          <div
            className="animate-fade-up"
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#ffffff",
              border: "1.5px solid #e4e4e7",
              borderRadius: 16,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontFamily: "var(--font-inter)",
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#09090b",
                letterSpacing: "-0.015em",
                margin: 0,
              }}
            >
              {action === "approve" ? "Aprobar solicitud" : "Rechazar solicitud"}
            </h3>
            <p style={{ margin: "8px 0 20px", color: "#52525b", fontSize: "0.9375rem", lineHeight: 1.55 }}>
              <strong>{target.name}</strong> — {target.email}
            </p>

            {action === "approve" ? (
              <div>
                <label
                  htmlFor="assignedRole"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "#09090b",
                  }}
                >
                  Asignar rol
                </label>
                <select
                  id="assignedRole"
                  value={assignedRole}
                  onChange={(e) => setAssignedRole(e.target.value)}
                  className="field"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="rejectReason"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "#09090b",
                  }}
                >
                  Motivo (opcional)
                </label>
                <textarea
                  id="rejectReason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ej. Datos institucionales no verificados"
                  rows={3}
                  className="field"
                  style={{ height: "auto", padding: "12px 16px", resize: "vertical" }}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <Button
                variant="outline"
                size="md"
                style={{ flex: 1 }}
                disabled={processing}
                onClick={() => {
                  setSelected(null);
                  setAction(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant={action === "approve" ? "primary" : "danger"}
                size="md"
                style={{ flex: 1 }}
                loading={processing}
                onClick={handleAction}
              >
                {action === "approve" ? "Confirmar aprobación" : "Confirmar rechazo"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
