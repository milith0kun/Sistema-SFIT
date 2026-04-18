"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";

type Province = { id: string; name: string };
type Municipality = {
  id: string;
  name: string;
  provinceId: string;
  logoUrl?: string;
  active: boolean;
};

type StoredUser = { role: string };

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditarMunicipalidadPage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [municipality, setMunicipality] = useState<Municipality | null>(null);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!["super_admin", "admin_provincial"].includes(u.role)) {
      router.replace("/dashboard");
      return;
    }
    void load();
    void loadProvinces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function load() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/municipalidades/${id}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo cargar la municipalidad.");
        return;
      }
      setMunicipality(data.data);
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProvinces() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/provincias", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setProvinces(data.data.items ?? []);
    } catch {
      // silent
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!municipality) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const payload = {
      name: (form.get("name") as string)?.trim(),
      provinceId: (form.get("provinceId") as string) || municipality.provinceId,
      logoUrl: (form.get("logoUrl") as string)?.trim() || undefined,
      active: form.get("active") === "on",
    };

    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/municipalidades/${id}`, {
        method: "PATCH",
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
          setError(data.error ?? "No se pudo guardar.");
        }
        return;
      }
      setMunicipality(data.data);
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!municipality) return;
    if (!window.confirm(`¿Eliminar la municipalidad "${municipality.name}"?`)) return;
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/municipalidades/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      if (!res.ok || !data.success) {
        window.alert(data.error ?? "No se pudo eliminar.");
        return;
      }
      router.push("/municipalidades");
    } catch {
      window.alert("Error de conexión.");
    }
  }

  if (notFound) {
    return (
      <Card>
        <h3 style={{ fontFamily: "var(--font-inter)" }}>Municipalidad no encontrada</h3>
        <p style={{ color: "#52525b", marginTop: 8 }}>La municipalidad solicitada no existe o fue eliminada.</p>
        <div style={{ marginTop: 16 }}>
          <Link href="/municipalidades">
            <Button variant="outline">Volver</Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (loading || !municipality) {
    return (
      <Card>
        <div style={{ color: "#71717a" }}>Cargando…</div>
      </Card>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Municipalidades"
        title={municipality.name}
        subtitle="Edita los datos y configura el estado de la municipalidad."
        action={
          <Link href="/municipalidades">
            <Button variant="outline">
              <ArrowLeft size={16} strokeWidth={1.8} />
              Volver
            </Button>
          </Link>
        }
      />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {municipality.active ? (
          <Badge variant="activo">Activa</Badge>
        ) : (
          <Badge variant="suspendido">Suspendida</Badge>
        )}
      </div>

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
              defaultValue={municipality.name}
              className={`field${fieldErrors.name ? " field-error" : ""}`}
              required
            />
          </div>

          <div>
            <label htmlFor="provinceId" style={{ display: "block", marginBottom: 10 }}>
              Provincia
            </label>
            <select
              id="provinceId"
              name="provinceId"
              className={`field${fieldErrors.provinceId ? " field-error" : ""}`}
              defaultValue={municipality.provinceId}
            >
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="logoUrl" style={{ display: "block", marginBottom: 10 }}>
              URL del logo (opcional)
            </label>
            <input
              id="logoUrl"
              name="logoUrl"
              type="url"
              defaultValue={municipality.logoUrl ?? ""}
              placeholder="https://…"
              className="field"
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" name="active" defaultChecked={municipality.active} />
            <span>Activa</span>
          </label>

          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", paddingTop: 8 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <Button type="submit" variant="primary" size="lg" loading={saving}>
                Guardar cambios
              </Button>
              <Link href="/municipalidades">
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
