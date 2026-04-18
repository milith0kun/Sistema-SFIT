"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, MapPin, Building2, CircleCheck, CircleOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, type TableColumn } from "@/components/ui/Table";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { KPIStrip } from "@/components/dashboard/KPIStrip";

type Province = {
  id: string;
  name: string;
  region: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  municipalitiesCount?: number;
};

type StoredUser = { id: string; name: string; role: string };

export default function ProvinciasPage() {
  const router = useRouter();
  const [items, setItems] = useState<Province[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) {
      router.replace("/login");
      return;
    }
    const u = JSON.parse(raw) as StoredUser;
    if (u.role !== "super_admin") {
      router.replace("/dashboard");
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/provincias", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudieron cargar las provincias.");
        return;
      }
      setItems(data.data.items ?? []);
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`¿Eliminar la provincia "${name}"? Esta acción no se puede deshacer.`)) return;
    const token = localStorage.getItem("sfit_access_token");
    try {
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
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch {
      window.alert("Error de conexión al eliminar.");
    }
  }

  if (forbidden) {
    return (
      <div className="animate-fade-in">
        <Card>
          <h3 style={{ fontFamily: "var(--font-inter)", marginBottom: 8 }}>Acceso denegado</h3>
          <p style={{ color: "#52525b" }}>No tienes permisos para ver esta sección.</p>
        </Card>
      </div>
    );
  }

  const columns: TableColumn<Province>[] = [
    {
      key: "name",
      header: "Nombre",
      render: (p) => (
        <Link
          href={`/provincias/${p.id}`}
          style={{ fontWeight: 600, color: "#09090b", textDecoration: "none" }}
        >
          {p.name}
        </Link>
      ),
    },
    { key: "region", header: "Región", render: (p) => <span style={{ color: "#52525b" }}>{p.region}</span> },
    {
      key: "munis",
      header: "Municipalidades",
      render: (p) => (
        <span style={{ color: "#52525b" }}>
          {typeof p.municipalitiesCount === "number" ? p.municipalitiesCount : "—"}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (p) =>
        p.active ? <Badge variant="activo">Activa</Badge> : <Badge variant="inactivo">Inactiva</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <div style={{ display: "inline-flex", gap: 8 }}>
          <Link href={`/provincias/${p.id}`}>
            <Button variant="outline" size="sm">
              <Pencil size={14} strokeWidth={1.8} />
              Editar
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id, p.name)}>
            <Trash2 size={14} strokeWidth={1.8} />
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  const totalMunis = items.reduce(
    (acc, p) => acc + (typeof p.municipalitiesCount === "number" ? p.municipalitiesCount : 0),
    0
  );
  const activas = items.filter((p) => p.active).length;
  const inactivas = items.length - activas;

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardHero
        kicker="Panel global"
        rfCode="RF-02"
        title="Provincias"
        subtitle="Gestiona las provincias del sistema y sus municipalidades asociadas."
        pills={[
          { label: "Total", value: items.length },
          { label: "Activas", value: activas },
          { label: "Inactivas", value: inactivas, warn: inactivas > 0 },
        ]}
      />

      <KPIStrip
        cols={4}
        items={[
          { label: "PROVINCIAS", value: items.length, subtitle: "registradas", accent: "#B8860B", icon: MapPin },
          { label: "MUNICIPIOS", value: totalMunis, subtitle: "asociados", accent: "#0A1628", icon: Building2 },
          { label: "ACTIVAS", value: activas, subtitle: "operando", accent: "#15803d", icon: CircleCheck },
          { label: "INACTIVAS", value: inactivas, subtitle: "sin actividad", accent: "#b91c1c", icon: CircleOff },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Link href="/provincias/nueva">
          <Button variant="primary" size="md">
            <Plus size={16} strokeWidth={2} />
            Nueva provincia
          </Button>
        </Link>
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

      <div className="animate-fade-up delay-100">
        {loading ? (
          <Card>
            <div style={{ color: "#71717a", fontSize: "0.9375rem" }}>Cargando provincias…</div>
          </Card>
        ) : items.length === 0 ? (
          <EmptyState
            title="Aún no hay provincias"
            subtitle="Registra la primera provincia para comenzar a organizar municipalidades."
            cta={
              <Link href="/provincias/nueva">
                <Button variant="primary">Nueva provincia</Button>
              </Link>
            }
          />
        ) : (
          <Table<Province>
            columns={columns}
            rows={items}
            rowKey={(r) => r.id}
            emptyLabel="Sin provincias registradas."
          />
        )}
      </div>
    </div>
  );
}
