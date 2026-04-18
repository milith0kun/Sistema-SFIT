"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

type Province = {
  id: string;
  name: string;
  region: string;
  active: boolean;
};

type StoredUser = { role: string };

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditarProvinciaPage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [province, setProvince] = useState<Province | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (u.role !== "super_admin") {
      router.replace("/dashboard");
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/provincias/${id}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo cargar la provincia.");
        return;
      }
      setProvince(data.data);
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!province) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const form = new FormData(e.currentTarget);
    const name = (form.get("name") as string)?.trim();
    const region = (form.get("region") as string)?.trim();
    const active = form.get("active") === "on";

    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/provincias/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ name, region, active }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) mapped[k] = (v as string[])[0];
          setFieldErrors(mapped);
        } else {
          setError(data.error ?? "No se pudo guardar.");
        }
        return;
      }
      setProvince(data.data);
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!province) return;
    if (!window.confirm(`¿Eliminar la provincia "${province.name}"?`)) return;
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/provincias/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        window.alert(data.error ?? "No se pudo eliminar.");
        return;
      }
      router.push("/provincias");
    } catch {
      window.alert("Error de conexión al eliminar.");
    }
  }

  if (notFound) {
    return (
      <div className="animate-fade-in">
        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)" }}>Provincia no encontrada</h3>
          <p style={{ color: "#52525b", marginTop: 8 }}>La provincia solicitada no existe o fue eliminada.</p>
          <div style={{ marginTop: 16 }}>
            <Link href="/provincias">
              <Button variant="outline">Volver</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (loading || !province) {
    return (
      <Card>
        <div style={{ color: "#71717a" }}>Cargando…</div>
      </Card>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Provincias"
        title={province.name}
        subtitle="Edita los datos de la provincia."
        action={
          <Link href="/provincias">
            <Button variant="outline" size="md">
              <ArrowLeft size={16} strokeWidth={1.8} />
              Volver
            </Button>
          </Link>
        }
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
        <form onSubmit={handleSubmit} className="space-y-5" style={{ maxWidth: 560 }}>
          <div>
            <label htmlFor="name" style={{ display: "block", marginBottom: 10 }}>
              Nombre
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={province.name}
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
              defaultValue={province.region}
              className={`field${fieldErrors.region ? " field-error" : ""}`}
              required
            />
            {fieldErrors.region && (
              <p style={{ marginTop: 6, fontSize: "0.8125rem", color: "#b91c1c", fontWeight: 500 }}>{fieldErrors.region}</p>
            )}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" name="active" defaultChecked={province.active} />
            <span>Activa</span>
          </label>

          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", paddingTop: 8 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <Button type="submit" variant="primary" size="lg" loading={saving}>
                Guardar cambios
              </Button>
              <Link href="/provincias">
                <Button type="button" variant="outline" size="lg">
                  Cancelar
                </Button>
              </Link>
            </div>
            <Button type="button" variant="danger" size="lg" onClick={handleDelete}>
              Eliminar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
