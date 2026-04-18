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

type Company = {
  id: string;
  razonSocial: string;
  ruc: string;
  representanteLegal: { name: string; dni: string; phone?: string };
  vehicleTypeKeys: string[];
  active: boolean;
  reputationScore: number;
  status?: "activo" | "suspendido" | "pendiente";
};

type VehicleType = { id: string; key: string; name: string; active: boolean };
type StoredUser = { role: string };

const ALLOWED_ROLES = ["admin_municipal", "fiscal", "admin_provincial", "super_admin"];

function repColor(score: number): { bg: string; color: string; border: string; label: string } {
  if (score >= 80) return { bg: "#F0FDF4", color: "#15803d", border: "#86EFAC", label: "Alta" };
  if (score >= 50) return { bg: "#FFFBEB", color: "#b45309", border: "#FCD34D", label: "Media" };
  return { bg: "#FFF5F5", color: "#b91c1c", border: "#FCA5A5", label: "Baja" };
}

export default function EmpresasPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [items, setItems] = useState<Company[]>([]);
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
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
    void loadTypes();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, statusFilter, typeFilter]);

  async function loadTypes() {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/tipos-vehiculo", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setTypes(data.data.items ?? []);
    } catch {
      // silent
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = new URLSearchParams();
      if (statusFilter) qs.set("status", statusFilter);
      if (typeFilter) qs.set("vehicleTypeKey", typeFilter);
      const url = "/api/empresas" + (qs.toString() ? `?${qs.toString()}` : "");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudieron cargar las empresas.");
        return;
      }
      setItems(data.data.items ?? []);
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  const typeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of types) m.set(t.key, t.name);
    return m;
  }, [types]);

  if (forbidden) {
    return (
      <Card>
        <h3 style={{ fontFamily: "var(--font-inter)", marginBottom: 8 }}>Acceso denegado</h3>
        <p style={{ color: "#52525b" }}>No tienes permisos para ver esta sección.</p>
      </Card>
    );
  }

  if (!user) return null;
  const canCreate = user.role === "admin_municipal";

  const columns: TableColumn<Company>[] = [
    {
      key: "name",
      header: "Razón social",
      render: (c) => (
        <Link href={`/empresas/${c.id}`} style={{ fontWeight: 600, color: "#09090b", textDecoration: "none" }}>
          {c.razonSocial}
        </Link>
      ),
    },
    { key: "ruc", header: "RUC", render: (c) => <span style={{ color: "#52525b", fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem" }}>{c.ruc}</span> },
    {
      key: "rep",
      header: "Representante",
      render: (c) => (
        <div>
          <div style={{ color: "#18181b", fontWeight: 500 }}>{c.representanteLegal.name}</div>
          <div style={{ color: "#71717a", fontSize: "0.75rem" }}>DNI {c.representanteLegal.dni}</div>
        </div>
      ),
    },
    {
      key: "fleet",
      header: "Flota",
      render: (c) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {c.vehicleTypeKeys.length === 0 ? (
            <span style={{ color: "#a1a1aa", fontSize: "0.8125rem" }}>—</span>
          ) : (
            c.vehicleTypeKeys.map((k) => (
              <Badge key={k} variant="info">
                {typeMap.get(k) ?? k}
              </Badge>
            ))
          )}
        </div>
      ),
    },
    {
      key: "rep_score",
      header: "Reputación",
      render: (c) => {
        const s = repColor(c.reputationScore);
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px",
              borderRadius: 999,
              background: s.bg,
              color: s.color,
              border: `1px solid ${s.border}`,
              fontSize: "0.8125rem",
              fontWeight: 700,
            }}
          >
            {c.reputationScore}
          </span>
        );
      },
    },
    {
      key: "estado",
      header: "Estado",
      render: (c) => {
        if (c.status === "suspendido" || !c.active) return <Badge variant="suspendido">Suspendida</Badge>;
        if (c.status === "pendiente") return <Badge variant="pendiente">Pendiente</Badge>;
        return <Badge variant="activo">Activa</Badge>;
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <Link href={`/empresas/${c.id}`}>
          <Button variant="outline" size="sm">
            Ver
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        kicker="Panel municipal"
        title="Empresas de transporte"
        subtitle="Administra las empresas y flotas que operan en tu jurisdicción."
        action={
          canCreate ? (
            <Link href="/empresas/nueva">
              <Button variant="primary">+ Nueva empresa</Button>
            </Link>
          ) : undefined
        }
      />

      <Card>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px" }}>
            <label htmlFor="statusFilter" style={{ display: "block", marginBottom: 8 }}>
              Estado
            </label>
            <select
              id="statusFilter"
              className="field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="activo">Activa</option>
              <option value="suspendido">Suspendida</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
          <div style={{ flex: "1 1 220px" }}>
            <label htmlFor="typeFilter" style={{ display: "block", marginBottom: 8 }}>
              Tipo de flota
            </label>
            <select
              id="typeFilter"
              className="field"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Todos</option>
              {types.filter((t) => t.active).map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {error && (
        <div
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
            <div style={{ color: "#71717a" }}>Cargando empresas…</div>
          </Card>
        ) : items.length === 0 ? (
          <EmptyState
            title="Sin empresas"
            subtitle={canCreate ? "Registra la primera empresa para comenzar a gestionar su flota." : "Aún no hay empresas registradas."}
            cta={
              canCreate ? (
                <Link href="/empresas/nueva">
                  <Button variant="primary">Nueva empresa</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Table<Company>
            columns={columns}
            rows={items}
            rowKey={(c) => c.id}
            emptyLabel="Sin empresas."
          />
        )}
      </div>
    </div>
  );
}
