"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

type Province = { id: string; name: string };
type StoredUser = { role: string; provinceId?: string };

export default function NuevaMunicipalidadPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!["super_admin", "admin_provincial"].includes(u.role)) {
      router.replace("/dashboard");
      return;
    }
    setUser(u);
    void loadProvinces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadProvinces() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/provincias", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (res.ok && data.success) setProvinces(data.data.items ?? []);
    } catch {
      // silent
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const name = (form.get("name") as string)?.trim();
    const provinceId =
      user?.role === "admin_provincial" ? user.provinceId : (form.get("provinceId") as string);

    const localErrors: Record<string, string> = {};
    if (!name) localErrors.name = "El nombre es obligatorio.";
    if (!provinceId) localErrors.provinceId = "La provincia es obligatoria.";
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/municipalidades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ name, provinceId }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) mapped[k] = (v as string[])[0];
          setFieldErrors(mapped);
        } else {
          setError(data.error ?? "No se pudo crear la municipalidad.");
        }
        return;
      }
      router.push("/municipalidades");
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Municipalidades"
        title="Nueva municipalidad"
        subtitle="Registra una nueva municipalidad dentro de la provincia correspondiente."
      />

      {error && (
        <div
          className="animate-fade-up"
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

      <Card>
        <form onSubmit={handleSubmit} noValidate className="space-y-5" style={{ maxWidth: 560 }}>
          <div>
            <label htmlFor="name" style={{ display: "block", marginBottom: 10 }}>
              Nombre de la municipalidad
            </label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Ej. Municipalidad Provincial del Cusco"
              className={`field${fieldErrors.name ? " field-error" : ""}`}
              required
            />
            {fieldErrors.name && (
              <p style={{ color: "#DC2626", fontSize: "0.8125rem", marginTop: 6 }}>{fieldErrors.name}</p>
            )}
          </div>

          {user.role === "super_admin" ? (
            <div>
              <label htmlFor="provinceId" style={{ display: "block", marginBottom: 10 }}>
                Provincia
              </label>
              <select
                id="provinceId"
                name="provinceId"
                className={`field${fieldErrors.provinceId ? " field-error" : ""}`}
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecciona una provincia…
                </option>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {fieldErrors.provinceId && (
                <p style={{ color: "#DC2626", fontSize: "0.8125rem", marginTop: 6 }}>{fieldErrors.provinceId}</p>
              )}
            </div>
          ) : (
            <div>
              <label style={{ display: "block", marginBottom: 10 }}>Provincia</label>
              <p style={{ color: "#52525b" }}>
                La municipalidad se creará bajo tu provincia asignada.
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, paddingTop: 8 }}>
            <Button type="submit" variant="primary" size="lg" loading={loading}>
              Crear municipalidad
            </Button>
            <Link href="/municipalidades">
              <Button type="button" variant="outline" size="lg">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
