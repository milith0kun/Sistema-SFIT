"use client";

import { use as usePromise, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { Button } from "@/components/ui/button";

const VIEW_ROLES = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const EDIT_ROLES = ["admin_municipal", "super_admin"];

const LICENSE_CATEGORIES = ["A-I", "A-IIa", "A-IIb", "A-IIIa", "A-IIIb", "A-IIIc"];

interface Props {
  params: Promise<{ id: string }>;
}

interface Conductor {
  id: string;
  name: string;
  dni: string;
  licenseNumber: string;
  licenseCategory: string;
  companyId?: string;
  companyName?: string;
  phone?: string;
  status: "apto" | "riesgo" | "no_apto";
  continuousHours: number;
  restHours: number;
  reputationScore: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Empresa {
  id: string;
  razonSocial: string;
}

interface FormData {
  name: string;
  dni: string;
  licenseNumber: string;
  licenseCategory: string;
  companyId: string;
  phone: string;
}

interface FieldErrors {
  name?: string;
  dni?: string;
  licenseNumber?: string;
  licenseCategory?: string;
}

const STATUS_CONFIG = {
  apto: {
    label: "Apto",
    color: "#15803d",
    bg: "#F0FDF4",
    border: "#86EFAC",
  },
  riesgo: {
    label: "Riesgo",
    color: "#b45309",
    bg: "#FFFBEB",
    border: "#FCD34D",
  },
  no_apto: {
    label: "No apto",
    color: "#b91c1c",
    bg: "#FFF5F5",
    border: "#FCA5A5",
  },
};

export default function ConductorDetallePage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadingConductor, setLoadingConductor] = useState(true);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  const [form, setForm] = useState<FormData>({
    name: "",
    dni: "",
    licenseNumber: "",
    licenseCategory: "",
    companyId: "",
    phone: "",
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    const tk = localStorage.getItem("sfit_access_token");

    if (!raw || !tk) {
      router.replace("/login");
      return;
    }

    let user: { role?: string } = {};
    try {
      user = JSON.parse(raw);
    } catch {
      router.replace("/login");
      return;
    }

    if (!user.role || !VIEW_ROLES.includes(user.role)) {
      router.replace("/conductores");
      return;
    }

    setAuthorized(true);
    setCanEdit(EDIT_ROLES.includes(user.role ?? ""));
    setToken(tk);
  }, [router]);

  // Load conductor
  useEffect(() => {
    if (!authorized || !token) return;

    setLoadingConductor(true);
    fetch(`/api/conductores/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const body = await res.json();
        const data: Conductor = body?.data ?? body;
        setConductor(data);
        setForm({
          name: data.name ?? "",
          dni: data.dni ?? "",
          licenseNumber: data.licenseNumber ?? "",
          licenseCategory: data.licenseCategory ?? "",
          companyId: data.companyId ?? "",
          phone: data.phone ?? "",
        });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingConductor(false));
  }, [authorized, token, id]);

  // Load empresas
  useEffect(() => {
    if (!authorized || !token) return;

    fetch("/api/empresas?limit=100", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((body) => {
        const items: Empresa[] = body?.data?.items ?? [];
        setEmpresas(items);
      })
      .catch(() => setEmpresas([]));
  }, [authorized, token]);

  function validate(): boolean {
    const next: FieldErrors = {};

    if (!form.name.trim() || form.name.trim().length < 2) {
      next.name = "El nombre es requerido (mínimo 2 caracteres).";
    } else if (form.name.trim().length > 160) {
      next.name = "El nombre no puede superar 160 caracteres.";
    }

    if (!form.dni.trim() || form.dni.trim().length < 6) {
      next.dni = "El DNI es requerido (mínimo 6 caracteres).";
    } else if (form.dni.trim().length > 20) {
      next.dni = "El DNI no puede superar 20 caracteres.";
    }

    if (!form.licenseNumber.trim() || form.licenseNumber.trim().length < 4) {
      next.licenseNumber = "El número de licencia es requerido (mínimo 4 caracteres).";
    } else if (form.licenseNumber.trim().length > 30) {
      next.licenseNumber = "El número de licencia no puede superar 30 caracteres.";
    }

    if (!form.licenseCategory) {
      next.licenseCategory = "La categoría de licencia es requerida.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSuccessMsg(null);

    if (!validate()) return;

    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      dni: form.dni.trim(),
      licenseNumber: form.licenseNumber.trim(),
      licenseCategory: form.licenseCategory,
    };
    if (form.companyId) payload.companyId = form.companyId;
    payload.phone = form.phone.trim() || undefined;

    try {
      const res = await fetch(`/api/conductores/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const body = await res.json();
        const updated: Conductor = body?.data ?? body;
        setConductor(updated);
        setSuccessMsg("Cambios guardados correctamente.");
        return;
      }

      let msg = `Error ${res.status}`;
      try {
        const body = await res.json();
        msg = body?.message ?? body?.error ?? msg;
      } catch {
        // ignore
      }
      setServerError(msg);
    } catch {
      setServerError("Error de conexión. Intente nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar al conductor "${conductor?.name}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setServerError(null);

    try {
      const res = await fetch(`/api/conductores/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        router.push("/conductores");
        return;
      }

      let msg = `Error ${res.status}`;
      try {
        const body = await res.json();
        msg = body?.message ?? body?.error ?? msg;
      } catch {
        // ignore
      }
      setServerError(msg);
    } catch {
      setServerError("Error de conexión. Intente nuevamente.");
    } finally {
      setDeleting(false);
    }
  }

  function handleChange(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSuccessMsg(null);
    if (errors[field as keyof FieldErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  if (!authorized) return null;

  if (loadingConductor) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <PageHeader title="Cargando…" />
        <p style={{ color: "#71717a", marginTop: 24 }}>Obteniendo datos del conductor…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <PageHeader
          title="Conductor no encontrado"
          breadcrumbs={[{ label: "Conductores", href: "/conductores" }, { label: "Detalle" }]}
        />
        <Card style={{ marginTop: 16 }}>
          <p style={{ color: "#71717a", marginBottom: 16 }}>
            El conductor solicitado no existe o fue eliminado.
          </p>
          <Link href="/conductores">
            <Button variant="outline">Volver a conductores</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const statusCfg = conductor ? STATUS_CONFIG[conductor.status] : null;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <PageHeader
        title={conductor?.name ?? "Conductor"}
        subtitle="Detalle y edición del conductor."
        breadcrumbs={[
          { label: "Conductores", href: "/conductores" },
          { label: conductor?.name ?? "Detalle" },
        ]}
      />

      {/* Estado y métricas (solo lectura) */}
      {conductor && (
        <Card style={{ marginBottom: 16 }}>
          <h3
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Estado y métricas
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 16,
              maxWidth: 720,
            }}
          >
            {/* Status badge */}
            <div>
              <p style={{ fontSize: "0.75rem", color: "#71717a", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Estado
              </p>
              {statusCfg && (
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: statusCfg.color,
                    backgroundColor: statusCfg.bg,
                    border: `1px solid ${statusCfg.border}`,
                  }}
                >
                  {statusCfg.label}
                </span>
              )}
            </div>

            {/* Reputation score */}
            <div>
              <p style={{ fontSize: "0.75rem", color: "#71717a", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Reputación
              </p>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#18181b", fontVariantNumeric: "tabular-nums" }}>
                {conductor.reputationScore ?? 0}
                <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#71717a" }}>/100</span>
              </p>
            </div>

            {/* Continuous hours */}
            <div>
              <p style={{ fontSize: "0.75rem", color: "#71717a", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Horas continuas
              </p>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#18181b", fontVariantNumeric: "tabular-nums" }}>
                {conductor.continuousHours ?? 0}
                <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#71717a" }}> h</span>
              </p>
            </div>

            {/* Rest hours */}
            <div>
              <p style={{ fontSize: "0.75rem", color: "#71717a", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Horas de descanso
              </p>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#18181b", fontVariantNumeric: "tabular-nums" }}>
                {conductor.restHours ?? 0}
                <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#71717a" }}> h</span>
              </p>
            </div>
          </div>
        </Card>
      )}

      <form onSubmit={handleSave} noValidate>
        {/* Información personal */}
        <Card>
          <h3
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Información personal
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              maxWidth: 720,
            }}
          >
            {/* Nombre completo */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label
                htmlFor="name"
                style={{ display: "block", marginBottom: 8 }}
              >
                Nombre completo {canEdit && <span style={{ color: "#b91c1c" }}>*</span>}
              </label>
              <input
                id="name"
                type="text"
                className={errors.name ? "field field-error" : "field"}
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Ej. Juan Carlos Pérez Quispe"
                maxLength={160}
                disabled={submitting || !canEdit}
                readOnly={!canEdit}
              />
              {errors.name && (
                <p
                  style={{
                    marginTop: 6,
                    fontSize: "0.8125rem",
                    color: "#b91c1c",
                    fontWeight: 500,
                  }}
                >
                  {errors.name}
                </p>
              )}
            </div>

            {/* DNI */}
            <div>
              <label
                htmlFor="dni"
                style={{ display: "block", marginBottom: 8 }}
              >
                DNI {canEdit && <span style={{ color: "#b91c1c" }}>*</span>}
              </label>
              <input
                id="dni"
                type="text"
                className={errors.dni ? "field field-error" : "field"}
                value={form.dni}
                onChange={(e) => handleChange("dni", e.target.value)}
                placeholder="Ej. 12345678"
                maxLength={20}
                disabled={submitting || !canEdit}
                readOnly={!canEdit}
              />
              {errors.dni && (
                <p
                  style={{
                    marginTop: 6,
                    fontSize: "0.8125rem",
                    color: "#b91c1c",
                    fontWeight: 500,
                  }}
                >
                  {errors.dni}
                </p>
              )}
            </div>

            {/* Teléfono */}
            <div>
              <label
                htmlFor="phone"
                style={{ display: "block", marginBottom: 8 }}
              >
                Teléfono
              </label>
              <input
                id="phone"
                type="tel"
                className="field"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="Ej. 987654321"
                disabled={submitting || !canEdit}
                readOnly={!canEdit}
              />
            </div>
          </div>
        </Card>

        {/* Datos de licencia */}
        <Card style={{ marginTop: 16 }}>
          <h3
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Datos de licencia
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              maxWidth: 720,
            }}
          >
            {/* Número de licencia */}
            <div>
              <label
                htmlFor="licenseNumber"
                style={{ display: "block", marginBottom: 8 }}
              >
                Número de licencia {canEdit && <span style={{ color: "#b91c1c" }}>*</span>}
              </label>
              <input
                id="licenseNumber"
                type="text"
                className={errors.licenseNumber ? "field field-error" : "field"}
                value={form.licenseNumber}
                onChange={(e) => handleChange("licenseNumber", e.target.value)}
                placeholder="Ej. Q12345678"
                maxLength={30}
                disabled={submitting || !canEdit}
                readOnly={!canEdit}
              />
              {errors.licenseNumber && (
                <p
                  style={{
                    marginTop: 6,
                    fontSize: "0.8125rem",
                    color: "#b91c1c",
                    fontWeight: 500,
                  }}
                >
                  {errors.licenseNumber}
                </p>
              )}
            </div>

            {/* Categoría de licencia */}
            <div>
              <label
                htmlFor="licenseCategory"
                style={{ display: "block", marginBottom: 8 }}
              >
                Categoría de licencia {canEdit && <span style={{ color: "#b91c1c" }}>*</span>}
              </label>
              {canEdit ? (
                <select
                  id="licenseCategory"
                  className={errors.licenseCategory ? "field field-error" : "field"}
                  value={form.licenseCategory}
                  onChange={(e) => handleChange("licenseCategory", e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Seleccionar categoría…</option>
                  {LICENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="licenseCategory"
                  type="text"
                  className="field"
                  value={form.licenseCategory}
                  readOnly
                  disabled
                />
              )}
              {errors.licenseCategory && (
                <p
                  style={{
                    marginTop: 6,
                    fontSize: "0.8125rem",
                    color: "#b91c1c",
                    fontWeight: 500,
                  }}
                >
                  {errors.licenseCategory}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Empresa */}
        <Card style={{ marginTop: 16 }}>
          <h3
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Empresa
          </h3>

          <div style={{ maxWidth: 720 }}>
            <label
              htmlFor="companyId"
              style={{ display: "block", marginBottom: 8 }}
            >
              Empresa de transporte
            </label>
            {canEdit ? (
              <select
                id="companyId"
                className="field"
                value={form.companyId}
                onChange={(e) => handleChange("companyId", e.target.value)}
                disabled={submitting}
                style={{ maxWidth: 360 }}
              >
                <option value="">Sin empresa asignada</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.razonSocial}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="companyId"
                type="text"
                className="field"
                value={
                  conductor?.companyName ??
                  (conductor?.companyId
                    ? empresas.find((e) => e.id === conductor.companyId)?.razonSocial ?? conductor.companyId
                    : "Sin empresa asignada")
                }
                readOnly
                disabled
                style={{ maxWidth: 360 }}
              />
            )}
          </div>
        </Card>

        {/* Server error */}
        {serverError && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 8,
              backgroundColor: "#FFF5F5",
              border: "1px solid #FCA5A5",
              color: "#b91c1c",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            {serverError}
          </div>
        )}

        {/* Success message */}
        {successMsg && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 8,
              backgroundColor: "#F0FDF4",
              border: "1px solid #86EFAC",
              color: "#15803d",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            {successMsg}
          </div>
        )}

        {/* Acciones */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 24,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {canEdit && (
            <>
              <Button type="submit" disabled={submitting || deleting}>
                {submitting ? "Guardando…" : "Guardar cambios"}
              </Button>
              <Link href="/conductores">
                <Button type="button" variant="outline" disabled={submitting || deleting}>
                  Cancelar
                </Button>
              </Link>

              {/* Separator */}
              <div style={{ flex: 1 }} />

              <Button
                type="button"
                variant="outline"
                disabled={submitting || deleting}
                onClick={handleDelete}
                style={{
                  borderColor: "#FCA5A5",
                  color: "#b91c1c",
                  backgroundColor: "transparent",
                }}
              >
                {deleting ? "Eliminando…" : "Eliminar conductor"}
              </Button>
            </>
          )}

          {!canEdit && (
            <Link href="/conductores">
              <Button type="button" variant="outline">
                Volver a conductores
              </Button>
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
