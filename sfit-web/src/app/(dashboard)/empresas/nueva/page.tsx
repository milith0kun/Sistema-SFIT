"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

type VehicleType = { id: string; key: string; name: string; active: boolean };
type StoredUser = { role: string };

export default function NuevaEmpresaPage() {
  const router = useRouter();
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (u.role !== "admin_municipal") {
      router.replace("/dashboard");
      return;
    }
    void loadTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadTypes() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/tipos-vehiculo", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (res.ok && data.success) setTypes((data.data.items ?? []).filter((t: VehicleType) => t.active));
    } catch {
      // silent
    }
  }

  function toggleKey(k: string) {
    setSelectedKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const payload = {
      razonSocial: (form.get("razonSocial") as string)?.trim(),
      ruc: (form.get("ruc") as string)?.trim(),
      representanteLegal: {
        name: (form.get("repName") as string)?.trim(),
        dni: (form.get("repDni") as string)?.trim(),
        phone: ((form.get("repPhone") as string) || "").trim() || undefined,
      },
      vehicleTypeKeys: selectedKeys,
    };

    const localErrors: Record<string, string> = {};
    if (!payload.razonSocial) localErrors.razonSocial = "La razón social es obligatoria.";
    if (!payload.ruc) localErrors.ruc = "El RUC es obligatorio.";
    else if (!/^\d{11}$/.test(payload.ruc)) localErrors.ruc = "El RUC debe tener 11 dígitos.";
    if (!payload.representanteLegal.name) localErrors.repName = "El nombre del representante es obligatorio.";
    if (!payload.representanteLegal.dni) localErrors.repDni = "El DNI es obligatorio.";
    else if (!/^\d{8}$/.test(payload.representanteLegal.dni)) localErrors.repDni = "El DNI debe tener 8 dígitos.";
    if (selectedKeys.length === 0) localErrors.vehicleTypeKeys = "Seleccione al menos un tipo de flota.";

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/empresas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) mapped[k] = (v as string[])[0];
          setFieldErrors(mapped);
        } else {
          setError(data.error ?? "No se pudo crear la empresa.");
        }
        return;
      }
      router.push("/empresas");
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Empresas"
        title="Nueva empresa"
        subtitle="Registra una empresa de transporte o flota municipal."
      />

      {error && (
        <div
          role="alert"
          style={{
            background: "#FFF5F5",
            border: "1.5px solid #FCA5A5",
            borderRadius: 12,
            padding: 16,
            color: "#DC2626",
            fontSize: "0.9375rem",
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
            Datos de la empresa
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, maxWidth: 720 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="razonSocial" style={{ display: "block", marginBottom: 8 }}>
                Razón social
              </label>
              <input
                id="razonSocial"
                name="razonSocial"
                className={`field${fieldErrors.razonSocial ? " field-error" : ""}`}
                placeholder="Empresa de Transportes S.A.C."
              />
              {fieldErrors.razonSocial && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>{fieldErrors.razonSocial}</p>
              )}
            </div>
            <div>
              <label htmlFor="ruc" style={{ display: "block", marginBottom: 8 }}>
                RUC
              </label>
              <input
                id="ruc"
                name="ruc"
                className={`field${fieldErrors.ruc ? " field-error" : ""}`}
                placeholder="20123456789"
                maxLength={11}
                inputMode="numeric"
              />
              {fieldErrors.ruc && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>{fieldErrors.ruc}</p>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 16 }}>
            Representante legal
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, maxWidth: 720 }}>
            <div style={{ gridColumn: "1 / 3" }}>
              <label htmlFor="repName" style={{ display: "block", marginBottom: 8 }}>
                Nombre completo
              </label>
              <input
                id="repName"
                name="repName"
                className={`field${fieldErrors.repName ? " field-error" : ""}`}
                placeholder="Juan Pérez Quispe"
              />
              {fieldErrors.repName && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>{fieldErrors.repName}</p>
              )}
            </div>
            <div>
              <label htmlFor="repDni" style={{ display: "block", marginBottom: 8 }}>
                DNI
              </label>
              <input
                id="repDni"
                name="repDni"
                className={`field${fieldErrors.repDni ? " field-error" : ""}`}
                placeholder="12345678"
                maxLength={8}
                inputMode="numeric"
              />
              {fieldErrors.repDni && (
                <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>{fieldErrors.repDni}</p>
              )}
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="repPhone" style={{ display: "block", marginBottom: 8 }}>
                Teléfono (opcional)
              </label>
              <input
                id="repPhone"
                name="repPhone"
                className="field"
                placeholder="+51 984 000 000"
              />
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", fontSize: "1rem", fontWeight: 700, marginBottom: 8 }}>
            Tipos de flota
          </h3>
          <p style={{ color: "#52525b", fontSize: "0.875rem", marginBottom: 16 }}>
            Seleccione los tipos de vehículo que la empresa operará.
          </p>
          {types.length === 0 ? (
            <p style={{ color: "#a1a1aa" }}>
              No hay tipos de vehículo activos. Actívalos primero en{" "}
              <Link href="/tipos-vehiculo" style={{ color: "#6C0606", fontWeight: 600 }}>
                Tipos de vehículo
              </Link>
              .
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {types.map((t) => {
                const checked = selectedKeys.includes(t.key);
                return (
                  <label
                    key={t.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: checked ? "1.5px solid #D9B0B0" : "1.5px solid #e4e4e7",
                      background: checked ? "#FBEAEA" : "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleKey(t.key)} />
                    <span style={{ fontWeight: 500 }}>{t.name}</span>
                  </label>
                );
              })}
            </div>
          )}
          {fieldErrors.vehicleTypeKeys && (
            <p style={{ marginTop: 12, fontSize: "0.8125rem", color: "#DC2626", fontWeight: 500 }}>
              {fieldErrors.vehicleTypeKeys}
            </p>
          )}
        </Card>

        <div style={{ display: "flex", gap: 10 }}>
          <Button type="submit" variant="primary" size="lg" loading={loading}>
            Crear empresa
          </Button>
          <Link href="/empresas">
            <Button type="button" variant="outline" size="lg">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
