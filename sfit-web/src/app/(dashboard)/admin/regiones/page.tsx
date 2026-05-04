"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Plus, Globe2, MapPin, Building2, ChevronRight, X, AlertTriangle, Loader2 } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";

type Region = {
  id: string;
  name: string;
  code?: string;
  active: boolean;
  provinceCount: number;
  createdAt?: string;
  updatedAt?: string;
};

type StoredUser = { role: string };

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
};

type RegionListResponse = { items: Region[]; total: number };

// Tokens — paleta sobria
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const RED  = "#DC2626"; const REDBG = "#FFF5F5"; const REDBD = "#FCA5A5";
const GRN  = "#15803d";
// Granate institucional SFIT
const G    = "#6C0606";

export default function AdminRegionesPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [items, setItems] = useState<Region[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Auth gate — sólo super_admin
  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as StoredUser;
    if (u.role !== "super_admin") { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const loadRegiones = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/regiones?limit=200", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 403) { router.replace("/dashboard"); return; }
      const data = await res.json() as ApiResponse<RegionListResponse>;
      if (!res.ok || !data.success || !data.data) {
        setError(data.error ?? "No se pudieron cargar las regiones.");
        return;
      }
      setItems(data.data.items ?? []);
      setTotal(data.data.total ?? 0);
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  }, [user, router]);

  useEffect(() => { void loadRegiones(); }, [loadRegiones]);

  // Cálculos
  const activeCount = useMemo(() => items.filter((r) => r.active).length, [items]);
  const totalProvincesAggregated = useMemo(
    () => items.reduce((sum, r) => sum + (r.provinceCount ?? 0), 0),
    [items],
  );

  // Columnas DataTable
  const columns = useMemo<ColumnDef<Region, unknown>[]>(() => [
    {
      id: "code",
      header: "Código",
      accessorFn: (r) => r.code ?? "",
      enableSorting: true,
      enableHiding: false,
      cell: ({ row: r }) => r.original.code ? (
        <span style={{
          display: "inline-flex", padding: "2px 8px", borderRadius: 6,
          background: INK9, color: "#fff",
          fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: "0.75rem",
        }}>
          {r.original.code}
        </span>
      ) : <span style={{ color: INK5, fontSize: "0.75rem" }}>—</span>,
    },
    {
      id: "name",
      header: "Región",
      accessorFn: (r) => r.name,
      enableSorting: true,
      enableHiding: false,
      sortingFn: (a, b) => a.original.name.localeCompare(b.original.name, "es-PE"),
      cell: ({ row: r }) => (
        <Link
          href={`/admin/regiones/${r.original.id}`}
          style={{
            fontWeight: 600, fontSize: "0.875rem", color: INK9,
            textDecoration: "none",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {r.original.name}
        </Link>
      ),
    },
    {
      id: "provinceCount",
      header: "Provincias",
      accessorFn: (r) => r.provinceCount,
      enableSorting: true,
      cell: ({ row: r }) => (
        <Badge variant={r.original.provinceCount > 0 ? "info" : "inactivo"}>
          {r.original.provinceCount}
        </Badge>
      ),
    },
    {
      id: "active",
      header: "Estado",
      accessorFn: (r) => r.active ? "activa" : "inactiva",
      enableSorting: true,
      enableHiding: false,
      cell: ({ row: r }) => (
        <Badge variant={r.original.active ? "activo" : "inactivo"}>
          {r.original.active ? "Activa" : "Inactiva"}
        </Badge>
      ),
    },
    {
      id: "_nav",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: () => (
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "flex-end",
          color: INK5,
        }}>
          <ChevronRight size={14} />
        </span>
      ),
    },
  ], []);

  if (!user) return null;

  const headerAction = (
    <button
      onClick={() => setShowCreate(true)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8, height: 40,
        padding: "0 16px", borderRadius: 9, border: "none",
        background: INK9, color: "#fff", fontSize: "0.875rem", fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      <Plus size={16} /> Nueva región
    </button>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <PageHeader
        kicker="Red nacional · Jerarquía geográfica"
        title="Regiones"
        action={headerAction}
      />

      <KPIStrip cols={3} items={[
        {
          label: "REGIONES",
          value: total,
          subtitle: "registradas",
          icon: Globe2,
          accent: G,
        },
        {
          label: "ACTIVAS",
          value: `${activeCount} / ${total}`,
          subtitle: "en operación",
          icon: Building2,
          accent: GRN,
        },
        {
          label: "PROVINCIAS",
          value: totalProvincesAggregated,
          subtitle: "asociadas en total",
          icon: MapPin,
        },
      ]} />

      {error && (
        <div role="alert" style={{
          padding: "11px 16px", background: REDBG, border: `1px solid ${REDBD}`,
          borderRadius: 10, color: RED, fontSize: "0.8125rem",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />{error}
        </div>
      )}

      <DataTable<Region>
        columns={columns}
        data={items}
        loading={loading}
        onRowClick={(row) => router.push(`/admin/regiones/${row.id}`)}
        searchPlaceholder="Buscar por nombre o código…"
        emptyTitle="Sin regiones"
        emptyDescription="No hay regiones registradas. Crea la primera con el botón Nueva región."
        defaultPageSize={50}
        showColumnToggle
      />

      {showCreate && typeof document !== "undefined" && createPortal(
        <CreateRegionModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); void loadRegiones(); }}
        />,
        document.body,
      )}
    </div>
  );
}

/* ── Modal de creación ── */

function CreateRegionModal({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // ESC cierra
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const nameTrim = name.trim();
    if (!nameTrim) errs.name = "El nombre es obligatorio.";
    else if (nameTrim.length < 2) errs.name = "Mínimo 2 caracteres.";
    else if (nameTrim.length > 100) errs.name = "Máximo 100 caracteres.";
    const codeTrim = code.trim();
    if (codeTrim && !/^\d{2}$/.test(codeTrim)) errs.code = "Debe ser exactamente 2 dígitos UBIGEO.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true); setServerError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const body: { name: string; code?: string } = { name: name.trim() };
      if (code.trim()) body.code = code.trim();
      const res = await fetch("/api/regiones", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify(body),
      });
      const data = await res.json() as ApiResponse<Region>;
      if (!res.ok || !data.success) {
        if (data.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.errors)) mapped[k] = (v as string[])[0];
          setErrors(mapped);
        } else {
          setServerError(data.error ?? "No se pudo crear la región.");
        }
        return;
      }
      onCreated();
    } catch { setServerError("Error de conexión."); }
    finally { setSubmitting(false); }
  }

  const FIELD: React.CSSProperties = {
    width: "100%", height: 38, padding: "0 12px",
    border: `1px solid ${INK2}`, borderRadius: 8,
    fontSize: "0.875rem", color: INK9, fontFamily: "inherit",
    outline: "none", background: "#fff", transition: "border-color 0.15s",
    boxSizing: "border-box",
  };
  const LABEL: React.CSSProperties = {
    display: "block", fontSize: "0.6875rem", fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase", color: INK5, marginBottom: 6,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nueva región"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(9, 9, 11, 0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, animation: "fadeIn 140ms ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 14,
          width: "100%", maxWidth: 480,
          border: `1px solid ${INK2}`,
          boxShadow: "0 20px 50px rgba(9,9,11,0.25), 0 4px 12px rgba(9,9,11,0.10)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "14px 18px", borderBottom: `1px solid ${INK1}`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: INK1,
            border: `1px solid ${INK2}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Globe2 size={15} color={INK6} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: INK9, lineHeight: 1.25 }}>
              Nueva región
            </div>
            <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 1 }}>
              Define el nombre y, opcionalmente, el código UBIGEO.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 30, height: 30, borderRadius: 8, border: "none",
              background: "transparent", color: INK6, cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          padding: 22, display: "flex", flexDirection: "column", gap: 18,
        }}>
          {serverError && (
            <div style={{
              padding: "10px 14px", background: REDBG, border: `1px solid ${REDBD}`,
              borderRadius: 8, color: RED, fontSize: "0.8125rem", fontWeight: 500,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertTriangle size={14} />{serverError}
            </div>
          )}

          <div>
            <label style={LABEL}>Nombre de la región</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Cusco, Arequipa, Lima Metropolitana"
              maxLength={100}
              style={{ ...FIELD, borderColor: errors.name ? RED : INK2 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = errors.name ? RED : INK9; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = errors.name ? RED : INK2; }}
            />
            {errors.name && (
              <p style={{ marginTop: 6, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label style={LABEL}>
              Código UBIGEO
              <span style={{ color: INK5, fontWeight: 500, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>
                (opcional, 2 dígitos)
              </span>
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="08"
              inputMode="numeric"
              maxLength={2}
              style={{
                ...FIELD,
                fontFamily: "ui-monospace, monospace",
                borderColor: errors.code ? RED : INK2,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = errors.code ? RED : INK9; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = errors.code ? RED : INK2; }}
            />
            {errors.code && (
              <p style={{ marginTop: 6, fontSize: "0.75rem", color: RED, fontWeight: 500 }}>
                {errors.code}
              </p>
            )}
          </div>

          <div style={{
            display: "flex", gap: 10, justifyContent: "flex-end",
            paddingTop: 4, borderTop: `1px solid ${INK1}`, marginTop: 4,
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                height: 36, padding: "0 16px", borderRadius: 8,
                border: `1px solid ${INK2}`, background: "#fff", color: INK6,
                fontSize: "0.875rem", fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                height: 36, padding: "0 16px", borderRadius: 8,
                border: "none", background: INK9, color: "#fff",
                fontSize: "0.875rem", fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting
                ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />Creando…</>
                : <><Plus size={14} />Crear región</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
