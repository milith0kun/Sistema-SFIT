"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { UserCheck, ChevronLeft, ChevronRight, Users, Clock, CircleCheck, Pause } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, type TableColumn } from "@/components/ui/Table";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { FilterBar, type FilterSelectConfig } from "@/components/dashboard/FilterBar";

type ApiResponse<T> = { success: boolean; data?: T; error?: string };

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  provinceId?: string;
  provinceName?: string;
  municipalityId?: string;
  municipalityName?: string;
  createdAt: string;
  requestedRole?: string;
};

type Province = { id: string; name: string };
type Municipality = { id: string; name: string; provinceId: string };

type StoredUser = { id: string; role: string; provinceId?: string; municipalityId?: string };

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin_provincial: "Admin Provincial",
  admin_municipal: "Admin Municipal",
  fiscal: "Fiscal / Inspector",
  operador: "Operador",
  conductor: "Conductor",
  ciudadano: "Ciudadano",
};

const STATUS_VARIANTS: Record<string, "activo" | "pendiente" | "suspendido" | "inactivo"> = {
  activo: "activo",
  pendiente: "pendiente",
  rechazado: "suspendido",
  suspendido: "suspendido",
};

const ALLOWED_ROLES = ["super_admin", "admin_provincial", "admin_municipal"];
const PAGE_SIZE = 20;

function getToken(): string {
  return typeof window === "undefined" ? "" : localStorage.getItem("sfit_access_token") ?? "";
}

function UsuariosPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(params.get("page") ?? "1") || 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);

  const [roleFilter, setRoleFilter] = useState<string>(params.get("role") ?? "");
  const [statusFilter, setStatusFilter] = useState<string>(params.get("status") ?? "");
  const [provinceFilter, setProvinceFilter] = useState<string>(params.get("provinceId") ?? "");
  const [municipalityFilter, setMunicipalityFilter] = useState<string>(
    params.get("municipalityId") ?? ""
  );
  const [query, setQuery] = useState<string>(params.get("q") ?? "");

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) {
      router.replace("/login");
      return;
    }
    const u = JSON.parse(raw) as StoredUser;
    if (!ALLOWED_ROLES.includes(u.role)) {
      router.replace("/dashboard");
      return;
    }
    setUser(u);
  }, [router]);

  const load = useCallback(
    async (opts?: { page?: number }) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set("page", String(opts?.page ?? page));
        qs.set("limit", String(PAGE_SIZE));
        if (roleFilter) qs.set("role", roleFilter);
        if (statusFilter) qs.set("status", statusFilter);
        if (provinceFilter) qs.set("provinceId", provinceFilter);
        if (municipalityFilter) qs.set("municipalityId", municipalityFilter);
        if (query.trim()) qs.set("q", query.trim());

        const res = await fetch(`/api/admin/users?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.status === 401) return router.replace("/login");
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        const data: ApiResponse<{ items: UserRow[]; total: number; page: number; limit: number }> =
          await res.json();
        if (!res.ok || !data.success) {
          setError(data.error ?? "No se pudieron cargar los usuarios.");
          return;
        }
        setRows(data.data?.items ?? []);
        setTotal(data.data?.total ?? 0);
      } catch {
        setError("Error de conexión.");
      } finally {
        setLoading(false);
      }
    },
    [page, roleFilter, statusFilter, provinceFilter, municipalityFilter, query, router]
  );

  const loadProvinces = useCallback(async () => {
    try {
      const res = await fetch("/api/provincias", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const data: ApiResponse<{ items: Province[] }> = await res.json();
      if (data.success && data.data) setProvinces(data.data.items ?? []);
    } catch {
      // silent
    }
  }, []);

  const loadMunicipalities = useCallback(async (provinceId: string) => {
    if (!provinceId) {
      setMunicipalities([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/municipalidades?provinceId=${encodeURIComponent(provinceId)}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      if (!res.ok) return;
      const data: ApiResponse<{ items: Municipality[] }> = await res.json();
      if (data.success && data.data) setMunicipalities(data.data.items ?? []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadProvinces();
  }, [user, loadProvinces]);

  useEffect(() => {
    if (provinceFilter) void loadMunicipalities(provinceFilter);
    else setMunicipalities([]);
  }, [provinceFilter, loadMunicipalities]);

  useEffect(() => {
    if (!user) return;
    setPage(1);
    void load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, roleFilter, statusFilter, provinceFilter, municipalityFilter]);

  useEffect(() => {
    if (!user) return;
    void load({ page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const columns: TableColumn<UserRow>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Nombre",
        render: (r) => (
          <Link
            href={`/usuarios/${r.id}`}
            style={{ fontWeight: 600, color: "#09090b", textDecoration: "none" }}
          >
            {r.name}
          </Link>
        ),
      },
      {
        key: "email",
        header: "Email",
        render: (r) => <span style={{ color: "#52525b" }}>{r.email}</span>,
      },
      {
        key: "role",
        header: "Rol",
        render: (r) => (
          <Badge variant={r.role === "super_admin" ? "gold" : "info"}>
            {ROLE_LABELS[r.role] ?? r.role}
          </Badge>
        ),
      },
      {
        key: "status",
        header: "Estado",
        render: (r) => (
          <Badge variant={STATUS_VARIANTS[r.status] ?? "inactivo"}>
            {r.status}
          </Badge>
        ),
      },
      {
        key: "provincia",
        header: "Provincia",
        render: (r) => (
          <span style={{ color: "#52525b" }}>{r.provinceName ?? "—"}</span>
        ),
      },
      {
        key: "municipalidad",
        header: "Municipalidad",
        render: (r) => (
          <span style={{ color: "#52525b" }}>{r.municipalityName ?? "—"}</span>
        ),
      },
      {
        key: "createdAt",
        header: "Creado",
        render: (r) => (
          <span style={{ color: "#71717a", fontSize: "0.8125rem" }}>
            {new Date(r.createdAt).toLocaleDateString("es-PE")}
          </span>
        ),
      },
    ],
    []
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

  if (!user) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const activos = rows.filter((r) => r.status === "activo").length;
  const pendientes = rows.filter((r) => r.status === "pendiente").length;
  const suspendidos = rows.filter(
    (r) => r.status === "suspendido" || r.status === "rechazado"
  ).length;

  const kickerLabel =
    user.role === "super_admin"
      ? "Panel global"
      : user.role === "admin_provincial"
        ? "Panel provincial"
        : "Panel municipal";

  const filterSelects: FilterSelectConfig[] = [
    {
      key: "role",
      value: roleFilter,
      onChange: setRoleFilter,
      options: [
        { v: "", l: "Todos los roles" },
        ...Object.entries(ROLE_LABELS).map(([v, l]) => ({ v, l })),
      ],
    },
    {
      key: "status",
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { v: "", l: "Todos los estados" },
        { v: "pendiente", l: "Pendiente" },
        { v: "activo", l: "Activo" },
        { v: "suspendido", l: "Suspendido" },
        { v: "rechazado", l: "Rechazado" },
      ],
    },
  ];
  if (user.role !== "admin_municipal") {
    filterSelects.push({
      key: "province",
      value: provinceFilter,
      onChange: (v: string) => {
        setProvinceFilter(v);
        setMunicipalityFilter("");
      },
      options: [
        { v: "", l: "Todas las provincias" },
        ...provinces.map((p) => ({ v: p.id, l: p.name })),
      ],
    });
    if (provinceFilter) {
      filterSelects.push({
        key: "municipality",
        value: municipalityFilter,
        onChange: setMunicipalityFilter,
        options: [
          { v: "", l: "Todas las municipalidades" },
          ...municipalities.map((m) => ({ v: m.id, l: m.name })),
        ],
      });
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardHero
        kicker={kickerLabel}
        rfCode="RF-01"
        title="Usuarios"
        subtitle="Gestiona cuentas, roles y estados. Aprueba, suspende o reactiva usuarios."
        pills={[
          { label: "Página actual", value: rows.length },
          { label: "Pendientes", value: pendientes, warn: pendientes > 0 },
        ]}
      />

      <KPIStrip
        cols={4}
        items={[
          { label: "TOTAL", value: total, subtitle: "en resultados", accent: "#0A1628", icon: Users },
          { label: "PENDIENTES", value: pendientes, subtitle: "en esta página", accent: "#B45309", icon: Clock },
          { label: "ACTIVOS", value: activos, subtitle: "habilitados", accent: "#15803d", icon: CircleCheck },
          { label: "SUSPENDIDOS", value: suspendidos, subtitle: "bloqueados/rechazados", accent: "#b91c1c", icon: Pause },
        ]}
      />

      <FilterBar
        searchPlaceholder="Buscar por nombre o email…"
        searchValue={query}
        onSearchChange={setQuery}
        selects={filterSelects}
        actions={
          <Link
            href="/usuarios?status=pendiente"
            onClick={() => {
              setStatusFilter("pendiente");
            }}
          >
            <Button variant="primary" size="sm">
              <UserCheck size={14} strokeWidth={1.8} />
              Pendientes
            </Button>
          </Link>
        }
      />

      {error && (
        <div
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
            <div style={{ color: "#71717a" }}>Cargando…</div>
          </Card>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Sin usuarios"
            subtitle="No hay usuarios que coincidan con los filtros actuales."
          />
        ) : (
          <>
            <Table<UserRow>
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              onRowClick={(r) => router.push(`/usuarios/${r.id}`)}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 16,
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ color: "#71717a", fontSize: "0.8125rem" }}>
                <span className="num">{total}</span> usuarios · Página <span className="num">{page}</span> de <span className="num">{totalPages}</span>
              </div>
              <div style={{ display: "inline-flex", gap: 8 }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={14} strokeWidth={2} />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Siguiente
                  <ChevronRight size={14} strokeWidth={2} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  return (
    <Suspense fallback={<Card><div style={{ color: "#71717a" }}>Cargando…</div></Card>}>
      <UsuariosPageInner />
    </Suspense>
  );
}
