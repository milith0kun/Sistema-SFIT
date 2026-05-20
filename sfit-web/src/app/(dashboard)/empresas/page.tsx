"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Truck, Star, ChevronRight, Car } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";
import { INK1, INK2, INK5, INK6, INK9, RED, AMBER_BG, AMBER_BD, AMBER } from "@/lib/design-tokens";
import { BTN_PRIMARY } from "@/lib/form-styles";

/**
 * Convierte un key técnico (snake_case) a un label humano legible.
 * "transporte_urbano"          → "Transporte urbano"
 * "transporte_interprovincial" → "Transporte interprovincial"
 */
function humanizeKey(key: string): string {
  if (!key) return "";
  const cleaned = key.replace(/_/g, " ").trim().toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

type ServiceScope = "urbano" | "interprovincial";

type Authorization = { scope: ServiceScope; [k: string]: unknown };

type Company = {
  id: string;
  razonSocial: string;
  ruc: string;
  representanteLegal: { name: string; dni: string; phone?: string };
  vehicleTypeKeys: string[];
  active: boolean;
  reputationScore: number;
  status?: "activo" | "suspendido" | "pendiente";
  serviceScope?: ServiceScope;
  authorizations?: Authorization[];
  /** Sello de aprobación. `null` = nunca aprobada (queda como pendiente). */
  approvedAt?: string | null;
  suspendedAt?: string | null;
};

/**
 * Modalidad operativa según la conversación con la municipalidad:
 *   - "urbano":         opera rutas cortas intra-provincia con paraderos.
 *   - "interprovincial": opera rutas largas a Cusco/Arequipa/Abancay.
 *   - "mixta":          la empresa tiene authorizations en ambos tipos.
 *
 * Se calcula desde Company.serviceScope (default) y Company.authorizations[]
 * (override si declara varias modalidades).
 */
type Modality = "urbano" | "interprovincial" | "mixta";

function modalityOf(c: Company): Modality {
  const scopes = new Set<ServiceScope>();
  if (c.serviceScope) scopes.add(c.serviceScope);
  for (const a of c.authorizations ?? []) {
    if (a.scope) scopes.add(a.scope);
  }
  const hasUrban = scopes.has("urbano");
  const hasInter = scopes.has("interprovincial");
  if (hasUrban && hasInter) return "mixta";
  if (hasInter) return "interprovincial";
  return "urbano";
}

type VehicleType = { id: string; key: string; name: string; active: boolean };
type StoredUser = { role: string };

const ALLOWED_ROLES = ["super_admin", "admin_municipal"];

function repColor(score: number): string {
  if (score >= 80) return "#15803d";
  if (score >= 50) return "#b45309";
  return "#DC2626";
}

const selectStyle: React.CSSProperties = {
  height: 34,
  padding: "0 10px",
  borderRadius: 8,
  border: "1.5px solid #e4e4e7",
  fontSize: "0.8125rem",
  fontFamily: "inherit",
  background: "#fff",
  color: "#52525b",
  cursor: "pointer",
};

export default function EmpresasPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [items, setItems] = useState<Company[]>([]);
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [tab, setTab] = useState<"todas" | Modality>("todas");
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
  }, [user, typeFilter]);

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

  const columns = useMemo<ColumnDef<Company, unknown>[]>(
    () => [
      {
        id: "razonSocial",
        header: "Razón social",
        accessorFn: (c) => `${c.razonSocial} ${c.ruc} ${c.representanteLegal.name}`,
        cell: ({ row: r }) => {
          const ok = r.original.active;
          // Pendiente: nunca aprobada (sin approvedAt) y no activa.
          // Suspendida: tuvo aprobación previa pero ahora `active=false` (suspendedAt seteado).
          const isPending =
            !ok && !r.original.approvedAt && !r.original.suspendedAt;
          const dotColor = ok
            ? "#15803d"
            : isPending
              ? "#B45309"
              : "#DC2626";
          const dotLabel = ok ? "Activa" : isPending ? "Pendiente" : "Suspendida";
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                title={dotLabel}
                aria-label={dotLabel}
                style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: dotColor,
                  flexShrink: 0,
                }}
              />
              <Link href={`/empresas/${r.original.id}`} style={{ fontWeight: 600, color: INK9, textDecoration: "none" }}>
                {r.original.razonSocial}
              </Link>
              {isPending && (
                <span style={{
                  fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em",
                  textTransform: "uppercase", padding: "2px 7px", borderRadius: 6,
                  background: AMBER_BG, color: AMBER, border: `1px solid ${AMBER_BD}`,
                }}>
                  Pendiente
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "ruc",
        header: "RUC",
        cell: ({ row: r }) => (
          <span style={{ color: "#52525b", fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem" }}>
            {r.original.ruc}
          </span>
        ),
      },
      {
        id: "representante",
        header: "Representante",
        accessorFn: (c) => `${c.representanteLegal.name} ${c.representanteLegal.dni}`,
        cell: ({ row: r }) => (
          <div>
            <div style={{ color: "#18181b", fontWeight: 500 }}>{r.original.representanteLegal.name}</div>
            <div style={{ color: "#71717a", fontSize: "0.75rem" }}>DNI {r.original.representanteLegal.dni}</div>
          </div>
        ),
      },
      {
        id: "modalidad",
        header: "Modalidad",
        enableSorting: false,
        accessorFn: (c) => modalityOf(c),
        cell: ({ row: r }) => {
          const m = modalityOf(r.original);
          const styles: Record<Modality, { bg: string; color: string; border: string; label: string }> = {
            urbano:          { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE", label: "URBANO" },
            interprovincial: { bg: "#FBEAEA", color: "#4A0303", border: "#D9B0B0", label: "INTERPROV" },
            mixta:           { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A", label: "MIXTA" },
          };
          const s = styles[m];
          return (
            <span style={{
              display: "inline-flex", alignItems: "center",
              padding: "2px 9px", borderRadius: 999,
              background: s.bg, color: s.color, border: `1px solid ${s.border}`,
              fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.06em",
            }}>
              {s.label}
            </span>
          );
        },
      },
      {
        id: "flota",
        header: "Tipos de vehículo",
        enableSorting: false,
        accessorFn: (c) => c.vehicleTypeKeys.map((k) => typeMap.get(k) ?? humanizeKey(k)).join(" "),
        cell: ({ row: r }) => (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {r.original.vehicleTypeKeys.length === 0 ? (
              <span style={{ color: INK5, fontSize: "0.8125rem" }}>—</span>
            ) : (
              r.original.vehicleTypeKeys.map((k) => (
                <span key={k} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "2px 8px", borderRadius: 5,
                  background: "#fff", border: `1px solid ${INK2}`, color: INK9,
                  fontSize: "0.6875rem", fontWeight: 600,
                }}>
                  <Car size={10} color={INK6} />
                  {typeMap.get(k) ?? humanizeKey(k)}
                </span>
              ))
            )}
          </div>
        ),
      },
      {
        id: "reputacion",
        header: "Reputación",
        accessorFn: (c) => c.reputationScore,
        cell: ({ row: r }) => {
          const score = r.original.reputationScore;
          const color = repColor(score);
          return (
            <div style={{ minWidth: 90 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span style={{
                  fontFamily: "ui-monospace,monospace", fontWeight: 800,
                  fontSize: "0.875rem", color: INK9,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {score}
                </span>
                <span style={{ fontSize: "0.625rem", color: INK5, fontWeight: 500 }}>/ 100</span>
              </div>
              <div style={{ height: 4, background: INK1, borderRadius: 999, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${Math.max(0, Math.min(100, score))}%`,
                  background: color, borderRadius: 999,
                }} />
              </div>
            </div>
          );
        },
      },
      {
        id: "_nav",
        header: "",
        enableSorting: false,
        cell: () => (
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", color: INK5 }}>
            <ChevronRight size={14} />
          </span>
        ),
      },
    ],
    [typeMap]
  );

  if (forbidden) {
    return (
      <div style={{ padding: 24, background: "#fff", borderRadius: 14, border: "1px solid #e4e4e7" }}>
        <p style={{ color: "#52525b" }}>No tienes permisos para ver esta sección.</p>
      </div>
    );
  }

  if (!user) return null;
  const canCreate = user.role === "admin_municipal";

  // Tally por modalidad para badges en los tabs.
  const counts = { urbano: 0, interprovincial: 0, mixta: 0 };
  for (const c of items) counts[modalityOf(c)] += 1;

  const visibleItems = tab === "todas" ? items : items.filter((c) => modalityOf(c) === tab);

  const repAvg =
    visibleItems.length > 0
      ? Math.round(visibleItems.reduce((a, c) => a + c.reputationScore, 0) / visibleItems.length)
      : 0;

  const toolbarEnd = (
    <>
      <select style={selectStyle} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
        <option value="">Todos los tipos</option>
        {types.filter((t) => t.active).map((t) => (
          <option key={t.id} value={t.key}>{t.name}</option>
        ))}
      </select>
      {canCreate && (
        <Link href="/empresas/nueva">
          <button style={{ ...BTN_PRIMARY, height: 34, padding: "0 14px", background: "#6C0606", border: "1.5px solid #6C0606", fontWeight: 700 }}>
            <Plus size={13}/>Nueva empresa
          </button>
        </Link>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <PageHeader kicker="Panel municipal · RF-04" title="Empresas de transporte" />

      <KPIStrip
        cols={2}
        items={[
          { label: "EMPRESAS", value: visibleItems.length, subtitle: tab === "todas" ? "registradas" : `de ${items.length} totales`, icon: Truck },
          { label: "REPUTACIÓN", value: repAvg, subtitle: "promedio del catálogo", icon: Star },
        ]}
      />

      {/* Tabs por modalidad operativa */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${INK2}` }}>
        {([
          { k: "todas" as const,           l: "Todas",            c: items.length },
          { k: "urbano" as const,          l: "Urbanas",          c: counts.urbano },
          { k: "interprovincial" as const, l: "Interprovinciales", c: counts.interprovincial },
          { k: "mixta" as const,           l: "Mixtas",           c: counts.mixta },
        ]).map((t) => {
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              style={{
                padding: "9px 14px", fontSize: "0.875rem", fontWeight: 600,
                cursor: "pointer", border: "none", background: "none",
                borderBottom: active ? `2px solid ${INK9}` : "2px solid transparent",
                marginBottom: -1, color: active ? INK9 : INK5,
                fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {t.l}
              <span style={{
                fontSize: "0.6875rem", padding: "1px 7px", borderRadius: 999,
                background: active ? INK9 : INK1, color: active ? "#fff" : INK5,
                fontWeight: 700, fontVariantNumeric: "tabular-nums",
              }}>
                {t.c}
              </span>
            </button>
          );
        })}
      </div>

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

      <DataTable<Company>
        columns={columns}
        data={visibleItems}
        loading={loading}
        searchPlaceholder="Buscar empresa, RUC o representante…"
        emptyTitle="Sin empresas"
        emptyDescription={
          tab !== "todas"
            ? `No hay empresas con modalidad ${tab}. Cambia de pestaña o registra una nueva.`
            : canCreate
              ? "Registra la primera empresa para comenzar a gestionar su flota."
              : "Aún no hay empresas registradas o ninguna coincide con los filtros."
        }
        defaultPageSize={20}
        showColumnToggle
        toolbarEnd={toolbarEnd}
        onRowClick={row => router.push(`/empresas/${row.id}`)}
      />
    </div>
  );
}
