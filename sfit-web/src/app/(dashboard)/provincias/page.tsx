"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, MapPin, Building2, CircleCheck, CircleOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
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

  const columns = useMemo<ColumnDef<Province, unknown>[]>(
    () => [
      {
        id: "nombre",
        header: "Nombre",
        accessorFn: (p) => `${p.name} ${p.region}`,
        cell: ({ row: r }) => (
          <Link
            href={`/provincias/${r.original.id}`}
            style={{ fontWeight: 600, color: "#09090b", textDecoration: "none" }}
          >
            {r.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "region",
        header: "Región",
        cell: ({ row: r }) => <span style={{ color: "#52525b" }}>{r.original.region}</span>,
      },
      {
        id: "municipalidades",
        header: "Municipalidades",
        accessorFn: (p) => p.municipalitiesCount ?? 0,
        cell: ({ row: r }) => (
          <span style={{ color: "#52525b" }}>
            {typeof r.original.municipalitiesCount === "number" ? r.original.municipalitiesCount : "—"}
          </span>
        ),
      },
      {
        id: "estado",
        header: "Estado",
        accessorFn: (p) => (p.active ? "Activa" : "Inactiva"),
        cell: ({ row: r }) =>
          r.original.active
            ? <Badge variant="activo">Activa</Badge>
            : <Badge variant="inactivo">Inactiva</Badge>,
      },
      {
        accessorKey: "createdAt",
        header: "Creada",
        sortingFn: "datetime",
        cell: ({ row: r }) => (
          <span style={{ color: "#71717a", fontSize: "0.8125rem" }}>
            {r.original.createdAt ? new Date(r.original.createdAt).toLocaleDateString("es-PE") : "—"}
          </span>
        ),
      },
      {
        id: "acciones",
        header: "",
        enableSorting: false,
        cell: ({ row: r }) => (
          <div style={{ display: "inline-flex", gap: 8 }}>
            <Link href={`/provincias/${r.original.id}`}>
              <Button variant="outline" size="sm">
                <Pencil size={14} strokeWidth={1.8} />
                Editar
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(r.original.id, r.original.name)}>
              <Trash2 size={14} strokeWidth={1.8} />
              Eliminar
            </Button>
          </div>
        ),
      },
    ],
    [handleDelete] // eslint-disable-line react-hooks/exhaustive-deps
  );

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

  const totalMunis = items.reduce(
    (acc, p) => acc + (typeof p.municipalitiesCount === "number" ? p.municipalitiesCount : 0),
    0
  );
  const activas = items.filter((p) => p.active).length;
  const inactivas = items.length - activas;

  const toolbarEnd = (
    <Link href="/provincias/nueva">
      <Button variant="primary" size="sm">
        <Plus size={14} strokeWidth={2} />
        Nueva provincia
      </Button>
    </Link>
  );

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <DashboardHero
        kicker="Panel global"
        rfCode="RF-02"
        title="Provincias"
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
        <DataTable<Province>
          columns={columns}
          data={items}
          loading={loading}
          searchPlaceholder="Buscar provincia o región…"
          emptyTitle="Aún no hay provincias"
          emptyDescription="Registra la primera provincia para comenzar a organizar municipalidades."
          defaultPageSize={20}
          showColumnToggle
          toolbarEnd={toolbarEnd}
        />
      </div>
    </div>
  );
}
