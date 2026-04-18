"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, type TableColumn } from "@/components/ui/Table";

type Province = { id: string; name: string };
type Municipality = {
  id: string;
  name: string;
  provinceId: string;
  provinceName?: string;
  active: boolean;
  createdAt: string;
};

type StoredUser = { role: string; provinceId?: string; municipalityId?: string };

const ALLOWED_ROLES = ["super_admin", "admin_provincial"];
const CAN_CREATE = ["super_admin", "admin_provincial"];

export default function MunicipalidadesPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [items, setItems] = useState<Municipality[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [provinceFilter, setProvinceFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as StoredUser;
    if (!ALLOWED_ROLES.includes(u.role)) {
      router.replace("/dashboard");
      return;
    }
    setUser(u);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    void loadProvinces();
    void loadMunicipalities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, provinceFilter]);

  async function loadProvinces() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/provincias", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setProvinces(data.data.items ?? []);
    } catch {
      // silent — los filtros no son críticos
    }
  }

  async function loadMunicipalities() {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = provinceFilter ? `?provinceId=${encodeURIComponent(provinceFilter)}` : "";
      const res = await fetch(`/api/municipalidades${qs}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudieron cargar las municipalidades.");
        return;
      }
      setItems(data.data.items ?? []);
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  const provinceMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of provinces) map.set(p.id, p.name);
    return map;
  }, [provinces]);

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

  if (!user) return null;
  const canCreate = CAN_CREATE.includes(user.role);
  const canFilterProvince = user.role === "super_admin";

  const columns: TableColumn<Municipality>[] = [
    {
      key: "name",
      header: "Nombre",
      render: (m) => (
        <Link href={`/municipalidades/${m.id}`} style={{ fontWeight: 600, color: "#09090b", textDecoration: "none" }}>
          {m.name}
        </Link>
      ),
    },
    {
      key: "province",
      header: "Provincia",
      render: (m) => (
        <span style={{ color: "#52525b" }}>{m.provinceName ?? provinceMap.get(m.provinceId) ?? "—"}</span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (m) =>
        m.active ? <Badge variant="activo">Activa</Badge> : <Badge variant="inactivo">Inactiva</Badge>,
    },
    {
      key: "createdAt",
      header: "Creada",
      render: (m) => (
        <span style={{ color: "#71717a", fontSize: "0.8125rem" }}>
          {m.createdAt ? new Date(m.createdAt).toLocaleDateString("es-PE") : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (m) => (
        <Link href={`/municipalidades/${m.id}`}>
          <Button variant="outline" size="sm">
            Editar
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker={user.role === "super_admin" ? "Panel global" : "Panel provincial"}
        title="Municipalidades"
        subtitle="Gestiona las municipalidades de la jurisdicción."
        action={
          canCreate ? (
            <Link href="/municipalidades/nueva">
              <Button variant="primary">+ Nueva municipalidad</Button>
            </Link>
          ) : undefined
        }
      />

      {canFilterProvince && (
        <Card padded>
          <label htmlFor="provinceFilter" style={{ display: "block", marginBottom: 8 }}>
            Filtrar por provincia
          </label>
          <select
            id="provinceFilter"
            className="field"
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value)}
            style={{ maxWidth: 360 }}
          >
            <option value="">Todas las provincias</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Card>
      )}

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

      <div className="animate-fade-up delay-100">
        {loading ? (
          <Card>
            <div style={{ color: "#71717a" }}>Cargando municipalidades…</div>
          </Card>
        ) : items.length === 0 ? (
          <EmptyState
            title="Sin municipalidades"
            subtitle={canCreate ? "Registra una municipalidad para empezar." : "No hay municipalidades registradas en tu jurisdicción."}
            cta={
              canCreate ? (
                <Link href="/municipalidades/nueva">
                  <Button variant="primary">Nueva municipalidad</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Table<Municipality>
            columns={columns}
            rows={items}
            rowKey={(m) => m.id}
            emptyLabel="Sin municipalidades."
          />
        )}
      </div>
    </div>
  );
}
