"use client";

import { useEffect, useState, useCallback } from "react";

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

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="animate-fade-up">
        <p className="kicker mb-3">RF-01-04 · Aprobación de usuarios</p>
        <h1
          className="font-black text-[#09090b]"
          style={{ fontFamily: "var(--font-syne)", fontSize: "2.25rem", lineHeight: 0.98, letterSpacing: "-0.035em" }}
        >
          Solicitudes pendientes
        </h1>
        <p className="mt-3" style={{ color: "#52525b", fontSize: "1rem", lineHeight: 1.55 }}>
          Revisa y aprueba o rechaza las solicitudes de acceso.
        </p>
      </div>

      {error && (
        <div className="rounded-xl p-4 animate-fade-up" style={{ background: "#FFF5F5", border: "1.5px solid #FCA5A5" }}>
          <p style={{ color: "#DC2626", fontSize: "0.9375rem", fontWeight: 500 }}>{error}</p>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden animate-fade-up" style={{ background: "#ffffff", border: "1.5px solid #e4e4e7" }}>
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-6 h-6 rounded-full border-[3px] border-[#e4e4e7] border-t-[#09090b] animate-spin" />
            <p className="mt-3" style={{ color: "#71717A", fontSize: "0.875rem" }}>Cargando solicitudes…</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 style={{ fontFamily: "var(--font-syne)", fontSize: "1.125rem", fontWeight: 700, color: "#09090b" }}>
              Sin solicitudes pendientes
            </h3>
            <p className="mt-2" style={{ color: "#71717A", fontSize: "0.9375rem" }}>
              Todas las solicitudes han sido procesadas.
            </p>
          </div>
        ) : (
          <ul>
            {users.map((u, i) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-4 px-6 py-4"
                style={{ borderTop: i > 0 ? "1px solid #f4f4f5" : "none" }}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "#FDF8EC", border: "1.5px solid #E8D090", color: "#926A09", fontWeight: 700, fontSize: "0.9375rem", fontFamily: "var(--font-syne)" }}
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate" style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#09090b" }}>{u.name}</div>
                    <div className="truncate" style={{ fontSize: "0.8125rem", color: "#71717A", marginTop: 2 }}>
                      {u.email} · Solicita: <span style={{ color: "#926A09", fontWeight: 500 }}>{ROLE_LABELS[u.requestedRole] ?? u.requestedRole}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setSelected(u.id); setAction("approve"); setAssignedRole(u.requestedRole); }}
                    className="px-4 h-9 rounded-lg transition-colors"
                    style={{ background: "#09090b", color: "#ffffff", fontSize: "0.8125rem", fontWeight: 600 }}
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => { setSelected(u.id); setAction("reject"); }}
                    className="px-4 h-9 rounded-lg transition-colors"
                    style={{ background: "#ffffff", border: "1.5px solid #e4e4e7", color: "#3F3F46", fontSize: "0.8125rem", fontWeight: 500 }}
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal de confirmación */}
      {selected && target && action && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(9,9,11,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => { if (!processing) { setSelected(null); setAction(null); } }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 animate-fade-up"
            style={{ background: "#ffffff", border: "1.5px solid #e4e4e7" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: "var(--font-syne)", fontSize: "1.25rem", fontWeight: 700, color: "#09090b", letterSpacing: "-0.02em" }}>
              {action === "approve" ? "Aprobar solicitud" : "Rechazar solicitud"}
            </h3>
            <p className="mt-2 mb-5" style={{ color: "#52525b", fontSize: "0.9375rem", lineHeight: 1.5 }}>
              <strong>{target.name}</strong> — {target.email}
            </p>

            {action === "approve" ? (
              <div>
                <label className="block mb-2" style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#09090b" }}>
                  Asignar rol
                </label>
                <select
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
                <label className="block mb-2" style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#09090b" }}>
                  Motivo (opcional)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ej. Datos institucionales no verificados"
                  rows={3}
                  className="field"
                  style={{ height: "auto", padding: "12px 16px", resize: "vertical" }}
                />
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setSelected(null); setAction(null); }}
                disabled={processing}
                className="btn-outline flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleAction}
                disabled={processing}
                className="btn-primary flex-1"
              >
                {processing ? (
                  <><span className="spinner" /><span>Procesando…</span></>
                ) : (
                  action === "approve" ? "Confirmar aprobación" : "Confirmar rechazo"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
