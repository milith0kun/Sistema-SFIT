"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

type StoredUser = { role: string };

export default function NuevaProvinciaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (u.role !== "super_admin") router.replace("/dashboard");
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const name = (form.get("name") as string)?.trim();
    const region = (form.get("region") as string)?.trim();

    const localErrors: Record<string, string> = {};
    if (!name) localErrors.name = "El nombre es obligatorio.";
    if (!region) localErrors.region = "La región es obligatoria.";
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/provincias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ name, region }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) {
            mapped[k] = (v as string[])[0];
          }
          setFieldErrors(mapped);
        } else {
          setError(data.error ?? "No se pudo crear la provincia.");
        }
        return;
      }
      router.push("/provincias");
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Provincias"
        title="Nueva provincia"
        subtitle="Registra una nueva provincia y su región correspondiente."
      />

      {error && (
        <div
          className="animate-fade-up"
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

      <Card>
        <form onSubmit={handleSubmit} noValidate className="space-y-5" style={{ maxWidth: 560 }}>
          <div>
            <label htmlFor="name" style={{ display: "block", marginBottom: 10 }}>
              Nombre de la provincia
            </label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Ej. Cusco"
              className={`field${fieldErrors.name ? " field-error" : ""}`}
              required
            />
            {fieldErrors.name && (
              <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#b91c1c", fontWeight: 500 }}>{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="region" style={{ display: "block", marginBottom: 10 }}>
              Región
            </label>
            <input
              id="region"
              name="region"
              type="text"
              placeholder="Ej. Cusco"
              className={`field${fieldErrors.region ? " field-error" : ""}`}
              required
            />
            {fieldErrors.region && (
              <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#b91c1c", fontWeight: 500 }}>{fieldErrors.region}</p>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, paddingTop: 8 }}>
            <Button variant="primary" type="submit" loading={loading} size="lg">
              {loading ? "Creando…" : "Crear provincia"}
            </Button>
            <Link href="/provincias">
              <Button variant="outline" size="lg" type="button">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
