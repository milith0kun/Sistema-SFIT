"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

type ApiResponse<T> = { success: boolean; data?: T; error?: string };

type UserDetail = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  image?: string;
  provinceId?: string;
  provinceName?: string;
  municipalityId?: string;
  municipalityName?: string;
  createdAt: string;
  updatedAt?: string;
  requestedRole?: string;
  rejectionReason?: string;
};

type Province = { id: string; name: string };
type Municipality = { id: string; name: string; provinceId: string };
type AuditEntry = {
  id: string;
  action: string;
  resourceType?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

type StoredUser = { id: string; role: string };

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin_provincial: "Admin Provincial",
  admin_municipal: "Admin Municipal",
  fiscal: "Fiscal / Inspector",
  operador: "Operador",
  conductor: "Conductor",
  ciudadano: "Ciudadano",
};

const STATUS_VARIANTS: Record<string, "activo" | "pendiente" | "suspendido" | "inactivo"> = {
  activo: "activo",
  pendiente: "pendiente",
  rechazado: "suspendido",
  suspendido: "suspendido",
};

const SCOPED_ROLES = ["admin_municipal", "fiscal", "operador", "conductor"];

function getToken(): string {
  return typeof window === "undefined" ? "" : localStorage.getItem("sfit_access_token") ?? "";
}

function assignableRoles(actorRole: string): string[] {
  if (actorRole === "super_admin") {
    return ["admin_provincial", "admin_municipal", "fiscal", "operador", "conductor", "ciudadano"];
  }
  if (actorRole === "admin_provincial") {
    return ["admin_municipal", "fiscal", "operador", "conductor", "ciudadano"];
  }
  if (actorRole === "admin_municipal") {
    return ["fiscal", "operador", "conductor", "ciudadano"];
  }
  return [];
}

export default function UsuarioDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [actor, setActor] = useState<StoredUser | null>(null);
  const [target, setTarget] = useState<UserDetail | null>(null);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [history, setHistory] = useState<AuditEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [assignRole, setAssignRole] = useState<string>("");
  const [assignProvince, setAssignProvince] = useState<string>("");
  const [assignMunicipality, setAssignMunicipality] = useState<string>("");
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!["super_admin", "admin_provincial", "admin_municipal"].includes(u.role)) {
      router.replace("/dashboard");
      return;
    }
    setActor(u);
  }, [router]);

  const fetchTarget = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 404) {
        setError("Usuario no encontrado.");
        return;
      }
      const data: ApiResponse<UserDetail> = await res.json();
      if (!res.ok || !data.success || !data.data) {
        setError(data.error ?? "No se pudo cargar el usuario.");
        return;
      }
      setTarget(data.data);
      setAssignRole(data.data.requestedRole ?? data.data.role);
      setAssignProvince(data.data.provinceId ?? "");
      setAssignMunicipality(data.data.municipalityId ?? "");
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const fetchRefs = useCallback(async () => {
    try {
      const [pres, mres] = await Promise.all([
        fetch("/api/provincias", { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch("/api/municipalidades", { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      if (pres.ok) {
        const pdata: ApiResponse<{ items: Province[] }> = await pres.json();
        if (pdata.success && pdata.data) setProvinces(pdata.data.items ?? []);
      }
      if (mres.ok) {
        const mdata: ApiResponse<{ items: Municipality[] }> = await mres.json();
        if (mdata.success && mdata.data) setMunicipalities(mdata.data.items ?? []);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/admin/audit-log?actorId=${encodeURIComponent(id)}&limit=10`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const data: ApiResponse<{ items: AuditEntry[] }> = await res.json();
      if (data.success && data.data) setHistory(data.data.items ?? []);
    } catch {
      // silent
    }
  }, [id]);

  useEffect(() => {
    if (!actor) return;
    void fetchTarget();
    void fetchRefs();
    void fetchHistory();
  }, [actor, fetchTarget, fetchRefs, fetchHistory]);

  const filteredMunicipalities = useMemo(() => {
    if (!assignProvince) return municipalities;
    return municipalities.filter((m) => m.provinceId === assignProvince);
  }, [municipalities, assignProvince]);

  async function patch(body: Record<string, unknown>, successMsg: string) {
    if (!target) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });
      const data: ApiResponse<UserDetail> = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo aplicar el cambio.");
        return;
      }
      setSuccess(successMsg);
      await fetchTarget();
      await fetchHistory();
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    if (!assignRole) return;
    const body: Record<string, unknown> = { status: "activo", role: assignRole };
    if (SCOPED_ROLES.includes(assignRole) && assignMunicipality) {
      body.municipalityId = assignMunicipality;
    }
    if (assignRole === "admin_provincial" && assignProvince) {
      body.provinceId = assignProvince;
    }
    await patch(body, "Usuario aprobado.");
  }

  async function reject() {
    if (!window.confirm("¿Confirmas rechazar esta solicitud?")) return;
    await patch({ status: "rechazado", rejectionReason: rejectReason.trim() || undefined }, "Solicitud rechazada.");
  }

  async function changeRole() {
    const body: Record<string, unknown> = { role: assignRole };
    if (SCOPED_ROLES.includes(assignRole) && assignMunicipality) {
      body.municipalityId = assignMunicipality;
    }
    await patch(body, "Rol actualizado.");
  }

  async function updateMunicipality() {
    await patch({ municipalityId: assignMunicipality }, "Municipalidad actualizada.");
  }

  async function updateProvince() {
    await patch({ provinceId: assignProvince }, "Provincia actualizada.");
  }

  async function suspend() {
    if (!window.confirm("¿Suspender este usuario?")) return;
    await patch({ status: "suspendido" }, "Usuario suspendido.");
  }

  async function reactivate() {
    await patch({ status: "activo" }, "Usuario reactivado.");
  }

  async function promoteProvincial() {
    if (!target || !assignProvince) return;
    if (!window.confirm(`¿Convertir a ${target.name} en Admin Provincial?`)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/users/${target.id}/assign-admin-provincial`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ provinceId: assignProvince }),
      });
      const data: ApiResponse<UserDetail> = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo asignar rol de Admin Provincial.");
        return;
      }
      setSuccess("Usuario asignado como Admin Provincial.");
      await fetchTarget();
      await fetchHistory();
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  if (!actor) return null;
  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader kicker="Usuario" title="Cargando…" />
        <Card>
          <div style={{ color: "#71717a" }}>Cargando…</div>
        </Card>
      </div>
    );
  }
  if (!target) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader kicker="Usuario" title="Usuario no encontrado" />
        <Card>
          <div style={{ color: "#52525b" }}>{error ?? "No se encontró el usuario solicitado."}</div>
          <div style={{ marginTop: 12 }}>
            <Link href="/usuarios">
              <Button variant="outline" size="sm">
                <ArrowLeft size={14} strokeWidth={1.8} />
                Volver a la lista
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const roles = assignableRoles(actor.role);
  const canSuperAdminPromote = actor.role === "super_admin" && target.role !== "admin_provincial";

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Detalle de usuario"
        title={target.name}
        subtitle={target.email}
        action={
          <Link href="/usuarios">
            <Button variant="outline" size="md">
              <ArrowLeft size={16} strokeWidth={1.8} />
              Volver
            </Button>
          </Link>
        }
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
      {success && (
        <div
          style={{
            background: "#F0FDF4",
            border: "1.5px solid #86EFAC",
            borderRadius: 12,
            padding: 16,
            color: "#15803d",
            fontSize: "0.9375rem",
            fontWeight: 500,
          }}
        >
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Identity card */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            {target.image ? (
              <Image
                src={target.image}
                alt={target.name}
                width={56}
                height={56}
                style={{ borderRadius: "50%", objectFit: "cover" }}
                unoptimized
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#FDF8EC",
                  border: "1.5px solid #E8D090",
                  color: "#926A09",
                  fontFamily: "var(--font-inter)",
                  fontWeight: 700,
                  fontSize: "1.25rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {target.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-inter)",
                  fontWeight: 700,
                  fontSize: "1.0625rem",
                  color: "#09090b",
                  letterSpacing: "-0.01em",
                }}
              >
                {target.name}
              </div>
              <div style={{ color: "#52525b", fontSize: "0.875rem" }}>{target.email}</div>
            </div>
          </div>

          <dl style={{ display: "grid", gap: 10, margin: 0 }}>
            <Row label="Rol actual">
              <Badge variant={target.role === "super_admin" ? "gold" : "info"}>
                {ROLE_LABELS[target.role] ?? target.role}
              </Badge>
            </Row>
            <Row label="Estado">
              <Badge variant={STATUS_VARIANTS[target.status] ?? "inactivo"}>{target.status}</Badge>
            </Row>
            {target.requestedRole && target.status === "pendiente" && (
              <Row label="Rol solicitado">
                <span style={{ color: "#926A09", fontWeight: 600 }}>
                  {ROLE_LABELS[target.requestedRole] ?? target.requestedRole}
                </span>
              </Row>
            )}
            <Row label="Provincia">
              <span style={{ color: "#27272a" }}>{target.provinceName ?? "—"}</span>
            </Row>
            <Row label="Municipalidad">
              <span style={{ color: "#27272a" }}>{target.municipalityName ?? "—"}</span>
            </Row>
            <Row label="Creado">
              <span style={{ color: "#52525b" }}>
                {new Date(target.createdAt).toLocaleString("es-PE")}
              </span>
            </Row>
            {target.rejectionReason && (
              <Row label="Motivo rechazo">
                <span style={{ color: "#b91c1c" }}>{target.rejectionReason}</span>
              </Row>
            )}
          </dl>
        </Card>

        {/* Actions card */}
        <div style={{ gridColumn: "span 2 / span 2" }} className="space-y-4">
          {target.status === "pendiente" && (
            <Card>
              <h3
                style={{
                  fontFamily: "var(--font-inter)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#09090b",
                  margin: 0,
                  marginBottom: 12,
                }}
              >
                Aprobar o rechazar
              </h3>
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6 }}>Rol asignado</label>
                  <select
                    className="field"
                    value={assignRole}
                    onChange={(e) => setAssignRole(e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r] ?? r}
                      </option>
                    ))}
                  </select>
                </div>

                {assignRole === "admin_provincial" && (
                  <div>
                    <label style={{ display: "block", marginBottom: 6 }}>Provincia</label>
                    <select
                      className="field"
                      value={assignProvince}
                      onChange={(e) => setAssignProvince(e.target.value)}
                    >
                      <option value="">Selecciona una provincia</option>
                      {provinces.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {SCOPED_ROLES.includes(assignRole) && (
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                    <div>
                      <label style={{ display: "block", marginBottom: 6 }}>Provincia</label>
                      <select
                        className="field"
                        value={assignProvince}
                        onChange={(e) => {
                          setAssignProvince(e.target.value);
                          setAssignMunicipality("");
                        }}
                      >
                        <option value="">—</option>
                        {provinces.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 6 }}>Municipalidad</label>
                      <select
                        className="field"
                        value={assignMunicipality}
                        onChange={(e) => setAssignMunicipality(e.target.value)}
                        disabled={!assignProvince}
                      >
                        <option value="">—</option>
                        {filteredMunicipalities.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ display: "block", marginBottom: 6 }}>Motivo (solo rechazo)</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder="Opcional — motivo del rechazo"
                    className="field"
                    style={{ height: "auto", padding: "12px 16px", resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button variant="primary" onClick={approve} loading={saving}>
                    Aprobar con rol {ROLE_LABELS[assignRole] ?? assignRole}
                  </Button>
                  <Button variant="danger" onClick={reject} loading={saving}>
                    Rechazar
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {target.status === "activo" && (
            <Card>
              <h3
                style={{
                  fontFamily: "var(--font-inter)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#09090b",
                  margin: 0,
                  marginBottom: 12,
                }}
              >
                Gestión del usuario
              </h3>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr auto" }}>
                  <select className="field" value={assignRole} onChange={(e) => setAssignRole(e.target.value)}>
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r] ?? r}
                      </option>
                    ))}
                  </select>
                  <Button variant="outline" onClick={changeRole} loading={saving}>
                    Cambiar rol
                  </Button>
                </div>

                {SCOPED_ROLES.includes(target.role) && (
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr auto" }}>
                    <select
                      className="field"
                      value={assignProvince}
                      onChange={(e) => {
                        setAssignProvince(e.target.value);
                        setAssignMunicipality("");
                      }}
                    >
                      <option value="">Provincia</option>
                      {provinces.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="field"
                      value={assignMunicipality}
                      onChange={(e) => setAssignMunicipality(e.target.value)}
                    >
                      <option value="">Municipalidad</option>
                      {filteredMunicipalities.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <Button variant="outline" onClick={updateMunicipality} loading={saving}>
                      Asignar municipalidad
                    </Button>
                  </div>
                )}

                {target.role === "admin_provincial" && (
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr auto" }}>
                    <select
                      className="field"
                      value={assignProvince}
                      onChange={(e) => setAssignProvince(e.target.value)}
                    >
                      <option value="">Provincia</option>
                      {provinces.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <Button variant="outline" onClick={updateProvince} loading={saving}>
                      Asignar provincia
                    </Button>
                  </div>
                )}

                {canSuperAdminPromote && (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: "#FDF8EC",
                      border: "1.5px solid #E8D090",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#926A09", fontSize: "0.875rem" }}>
                      Solo Super Admin
                    </div>
                    <div style={{ color: "#52525b", fontSize: "0.8125rem" }}>
                      Convierte este usuario en Admin Provincial con responsabilidad sobre una provincia.
                    </div>
                    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr auto" }}>
                      <select
                        className="field"
                        value={assignProvince}
                        onChange={(e) => setAssignProvince(e.target.value)}
                      >
                        <option value="">Selecciona provincia</option>
                        {provinces.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="primary"
                        onClick={promoteProvincial}
                        loading={saving}
                        disabled={!assignProvince}
                      >
                        Convertir en Admin Provincial
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <Button variant="danger" onClick={suspend} loading={saving}>
                    Suspender usuario
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {target.status === "suspendido" && (
            <Card>
              <h3
                style={{
                  fontFamily: "var(--font-inter)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#09090b",
                  margin: 0,
                  marginBottom: 12,
                }}
              >
                Usuario suspendido
              </h3>
              <Button variant="primary" onClick={reactivate} loading={saving}>
                Reactivar usuario
              </Button>
            </Card>
          )}

          {target.status === "rechazado" && (
            <Card>
              <h3
                style={{
                  fontFamily: "var(--font-inter)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#09090b",
                  margin: 0,
                  marginBottom: 12,
                }}
              >
                Usuario rechazado
              </h3>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr auto" }}>
                <select className="field" value={assignRole} onChange={(e) => setAssignRole(e.target.value)}>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r] ?? r}
                    </option>
                  ))}
                </select>
                <Button variant="primary" onClick={() => patch({ status: "activo", role: assignRole }, "Usuario reactivado.")} loading={saving}>
                  Reactivar con este rol
                </Button>
              </div>
            </Card>
          )}

          {/* Historial */}
          <Card>
            <h3
              style={{
                fontFamily: "var(--font-inter)",
                fontSize: "1rem",
                fontWeight: 700,
                color: "#09090b",
                margin: 0,
                marginBottom: 12,
              }}
            >
              Historial
            </h3>
            {history.length === 0 ? (
              <div style={{ color: "#71717a", fontSize: "0.875rem" }}>Sin actividad registrada.</div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {history.map((h) => (
                  <li
                    key={h.id}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid #f4f4f5",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#09090b" }}>{h.action}</div>
                      <div style={{ fontSize: "0.75rem", color: "#71717a", marginTop: 2 }}>
                        {h.resourceType ?? "—"}
                      </div>
                    </div>
                    <div style={{ fontSize: "0.6875rem", color: "#71717a", whiteSpace: "nowrap" }}>
                      {new Date(h.createdAt).toLocaleString("es-PE")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <dt style={{ color: "#71717a", fontSize: "0.8125rem", fontWeight: 500 }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: "0.875rem", textAlign: "right" }}>{children}</dd>
    </div>
  );
}
