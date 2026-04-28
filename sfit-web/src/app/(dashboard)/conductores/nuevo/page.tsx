"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, AlertTriangle, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";

const CREATE_ROLES = ["admin_municipal", "operador", "super_admin"];

const LICENSE_CATEGORIES = ["A-I", "A-IIa", "A-IIb", "A-IIIa", "A-IIIb", "A-IIIc"];

type DniLookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; nombreCompleto: string }
  | { state: "not_found" }
  | { state: "error"; message: string };

type LicLookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; numero: string; categoria: string; estado: string; vencimiento: string; restricciones?: string }
  | { state: "not_found" }
  | { state: "error"; message: string };

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

export default function NuevoconductorPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);

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
  const [serverError, setServerError] = useState<string | null>(null);

  // Autocompletado: RENIEC al escribir DNI; consulta de licencia MTC en
  // paralelo (Factiliza /licencia/info/{dni}).
  const [dniLookup, setDniLookup] = useState<DniLookup>({ state: "idle" });
  const [licLookup, setLicLookup] = useState<LicLookup>({ state: "idle" });
  const dniTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function mapMtcCategory(cat: string): string | null {
    const k = cat.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
    if (k === "AI")    return "A-I";
    if (k === "AIIA")  return "A-IIa";
    if (k === "AIIB")  return "A-IIb";
    if (k === "AIIIA") return "A-IIIa";
    if (k === "AIIIB") return "A-IIIb";
    if (k === "AIIIC") return "A-IIIc";
    return null;
  }

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

    if (!user.role || !CREATE_ROLES.includes(user.role)) {
      router.replace("/conductores");
      return;
    }

    setAuthorized(true);
    setToken(tk);
  }, [router]);

  useEffect(() => {
    if (!authorized || !token) return;

    setLoadingEmpresas(true);
    fetch("/api/empresas?limit=100", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((body) => {
        const items: Empresa[] = body?.data?.items ?? [];
        setEmpresas(items);
      })
      .catch(() => setEmpresas([]))
      .finally(() => setLoadingEmpresas(false));
  }, [authorized, token]);

  // Lookup encadenado al cambiar el DNI: RENIEC + Licencia MTC en paralelo.
  useEffect(() => {
    if (dniTimer.current) clearTimeout(dniTimer.current);
    if (!token) return;
    if (!/^\d{8}$/.test(form.dni)) {
      if (dniLookup.state !== "idle") setDniLookup({ state: "idle" });
      if (licLookup.state !== "idle") setLicLookup({ state: "idle" });
      return;
    }
    setDniLookup({ state: "loading" });
    setLicLookup({ state: "loading" });
    dniTimer.current = setTimeout(async () => {
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const dni = form.dni;
      // RENIEC
      void fetch("/api/validar/dni", { method: "POST", headers, body: JSON.stringify({ dni }) })
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok || !j?.success || !j?.data) {
            setDniLookup({ state: r.status === 404 ? "not_found" : "error", message: j?.error ?? "No se encontró" } as DniLookup);
            return;
          }
          const nc = (j.data.nombre_completo ?? "").trim();
          // Solo autocompletamos el nombre si el campo está vacío.
          setForm((prev) => prev.name.trim() ? prev : { ...prev, name: nc });
          setDniLookup({ state: "ok", nombreCompleto: nc });
        })
        .catch(() => setDniLookup({ state: "error", message: "No se pudo verificar el DNI" }));
      // Licencia MTC (Factiliza)
      void fetch("/api/validar/licencia", { method: "POST", headers, body: JSON.stringify({ dni }) })
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok || !j?.success || !j?.data?.licencia) {
            setLicLookup({ state: r.status === 404 ? "not_found" : "error", message: j?.error ?? "Sin licencia" } as LicLookup);
            return;
          }
          const lic = j.data.licencia;
          // Autocompletamos número y categoría sólo si están vacíos.
          setForm((prev) => {
            const next = { ...prev };
            if (!prev.licenseNumber.trim() && lic.numero) next.licenseNumber = lic.numero;
            if (!prev.licenseCategory) {
              const mapped = mapMtcCategory(lic.categoria ?? "");
              if (mapped) next.licenseCategory = mapped;
            }
            return next;
          });
          setLicLookup({
            state: "ok",
            numero: lic.numero, categoria: lic.categoria, estado: lic.estado,
            vencimiento: lic.fecha_vencimiento, restricciones: lic.restricciones,
          });
        })
        .catch(() => setLicLookup({ state: "error", message: "No se pudo verificar la licencia" }));
    }, 350);
    return () => { if (dniTimer.current) clearTimeout(dniTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.dni, token]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      dni: form.dni.trim(),
      licenseNumber: form.licenseNumber.trim(),
      licenseCategory: form.licenseCategory,
    };
    if (form.companyId) payload.companyId = form.companyId;
    if (form.phone.trim()) payload.phone = form.phone.trim();

    try {
      const res = await fetch("/api/conductores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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
      setSubmitting(false);
    }
  }

  function handleChange(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FieldErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  if (!authorized) return null;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <PageHeader
        kicker="Conductores"
        title="Nuevo conductor"
        subtitle="Registra un nuevo conductor en el sistema."
      />

      <form onSubmit={handleSubmit} noValidate>
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
                Nombre completo <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                id="name"
                type="text"
                className={errors.name ? "field field-error" : "field"}
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Ej. Juan Carlos Pérez Quispe"
                maxLength={160}
                disabled={submitting}
              />
              {errors.name && (
                <p
                  style={{
                    marginTop: 6,
                    fontSize: "0.8125rem",
                    color: "#DC2626",
                    fontWeight: 500,
                  }}
                >
                  {errors.name}
                </p>
              )}
            </div>

            {/* DNI con verificación RENIEC + licencia MTC */}
            <div>
              <label htmlFor="dni" style={{ display: "block", marginBottom: 8 }}>
                DNI <span style={{ color: "#DC2626" }}>*</span>
                <span style={{ marginLeft: 8, color: "#71717a", fontWeight: 400, fontSize: "0.75rem" }}>
                  · RENIEC + licencia MTC
                </span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="dni"
                  type="text"
                  className={errors.dni ? "field field-error" : "field"}
                  value={form.dni}
                  onChange={(e) => handleChange("dni", e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="Ej. 12345678"
                  maxLength={8}
                  inputMode="numeric"
                  disabled={submitting}
                  style={{ fontFamily: "ui-monospace,monospace", paddingRight: 40 }}
                />
                <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  {dniLookup.state === "loading" && <Loader2 size={16} color="#71717a" style={{ animation: "spin 0.7s linear infinite" }} />}
                  {dniLookup.state === "ok" && <CheckCircle size={16} color="#15803d" />}
                  {dniLookup.state === "not_found" && <Search size={16} color="#71717a" />}
                  {dniLookup.state === "error" && <AlertTriangle size={16} color="#b91c1c" />}
                </div>
              </div>
              {errors.dni && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>
                  {errors.dni}
                </p>
              )}
              {dniLookup.state === "ok" && (
                <p style={{ marginTop: 6, fontSize: "0.75rem", color: "#15803d", fontWeight: 600 }}>
                  ✓ {dniLookup.nombreCompleto}
                </p>
              )}
              {dniLookup.state === "not_found" && (
                <p style={{ marginTop: 6, fontSize: "0.75rem", color: "#92400E" }}>
                  DNI no encontrado en RENIEC.
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
                disabled={submitting}
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
            {/* Número de licencia con verificación MTC */}
            <div>
              <label htmlFor="licenseNumber" style={{ display: "block", marginBottom: 8 }}>
                Número de licencia <span style={{ color: "#DC2626" }}>*</span>
                <span style={{ marginLeft: 8, color: "#71717a", fontWeight: 400, fontSize: "0.75rem" }}>
                  · se autocompleta con el DNI
                </span>
              </label>
              <input
                id="licenseNumber"
                type="text"
                className={errors.licenseNumber ? "field field-error" : "field"}
                value={form.licenseNumber}
                onChange={(e) => handleChange("licenseNumber", e.target.value.toUpperCase())}
                placeholder="Ej. Q12345678"
                maxLength={30}
                disabled={submitting}
                style={{ fontFamily: "ui-monospace,monospace" }}
              />
              {errors.licenseNumber && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>
                  {errors.licenseNumber}
                </p>
              )}
              {licLookup.state === "ok" && (
                <div style={{
                  marginTop: 8, padding: "10px 14px",
                  background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 9,
                  fontSize: "0.75rem",
                }}>
                  <div style={{ fontWeight: 700, fontSize: "0.6875rem", color: "#15803d", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Verificada en MTC · {licLookup.estado}
                  </div>
                  <div style={{ color: "#18181b", fontWeight: 600, marginTop: 2 }}>
                    {licLookup.numero} · Categoría {licLookup.categoria}
                  </div>
                  <div style={{ color: "#52525b", marginTop: 2 }}>
                    Vence {licLookup.vencimiento}
                    {licLookup.restricciones && licLookup.restricciones !== "SIN RESTRICCIONES"
                      ? ` · ${licLookup.restricciones}`
                      : ""}
                  </div>
                </div>
              )}
              {licLookup.state === "not_found" && (
                <p style={{ marginTop: 6, fontSize: "0.75rem", color: "#92400E" }}>
                  Sin licencia registrada en MTC para ese DNI. Captúrala manualmente.
                </p>
              )}
            </div>

            {/* Categoría de licencia */}
            <div>
              <label
                htmlFor="licenseCategory"
                style={{ display: "block", marginBottom: 8 }}
              >
                Categoría de licencia <span style={{ color: "#DC2626" }}>*</span>
              </label>
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
              {errors.licenseCategory && (
                <p
                  style={{
                    marginTop: 6,
                    fontSize: "0.8125rem",
                    color: "#DC2626",
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
            Empresa (opcional)
          </h3>

          <div style={{ maxWidth: 720 }}>
            <label
              htmlFor="companyId"
              style={{ display: "block", marginBottom: 8 }}
            >
              Empresa de transporte
            </label>
            <select
              id="companyId"
              className="field"
              value={form.companyId}
              onChange={(e) => handleChange("companyId", e.target.value)}
              disabled={submitting || loadingEmpresas}
              style={{ maxWidth: 360 }}
            >
              <option value="">
                {loadingEmpresas ? "Cargando empresas…" : "Sin empresa asignada"}
              </option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.razonSocial}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Error de servidor */}
        {serverError && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 8,
              backgroundColor: "#FFF5F5",
              border: "1px solid #FCA5A5",
              color: "#DC2626",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            {serverError}
          </div>
        )}

        {/* Acciones */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 24,
            alignItems: "center",
          }}
        >
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creando…" : "Crear conductor"}
          </Button>
          <Link href="/conductores">
            <Button type="button" variant="outline" disabled={submitting}>
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
