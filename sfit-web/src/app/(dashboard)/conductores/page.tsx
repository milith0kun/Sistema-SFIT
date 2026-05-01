"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users, Check, Gauge, AlertTriangle, Download, Plus, Phone, Car, Pencil, Eye,
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";

type DriverStatus = "apto" | "riesgo" | "no_apto";
type Driver = {
  id: string; name: string; dni: string; licenseNumber: string; licenseCategory: string;
  companyName?: string; phone?: string; status: DriverStatus;
  continuousHours: number; restHours: number; reputationScore: number; active: boolean;
};

/* Paleta sobria — gris + verde/ámbar/rojo sólo como semántica de fatiga */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK3 = "#d4d4d8";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d"; const APTO_BD = "#86EFAC";
const RIESGO = "#B45309"; const RIESGO_BD = "#FDE68A";
const NO = "#DC2626"; const NO_BG = "#FFF5F5"; const NO_BD = "#FCA5A5";

const STATUS_META = (s: DriverStatus) =>
  s === "apto"   ? { color: APTO, bd: APTO_BD, label: "APTO" }
  : s === "riesgo" ? { color: RIESGO, bd: RIESGO_BD, label: "RIESGO" }
  : { color: NO, bd: NO_BD, label: "NO APTO" };

function StatusBadge({ s }: { s: DriverStatus }) {
  const m = STATUS_META(s);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 6,
      background: "#fff", color: INK9, border: `1px solid ${INK2}`,
      fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em",
      textTransform: "uppercase",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const parts = name.split(" ");
  const ini = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: INK1, color: INK6,
      border: `1px solid ${INK2}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size > 40 ? "1rem" : "0.8125rem", flexShrink: 0,
    }}>{ini || "?"}</div>
  );
}

const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const CAN_EDIT = ["admin_municipal", "super_admin"];
const CAN_CREATE = ["super_admin", "admin_municipal", "operador"];

const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  height: 32, padding: "0 12px", borderRadius: 7,
  border: "none", background: INK9, color: "#fff",
  fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
const btnOutline: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  height: 32, padding: "0 12px", borderRadius: 7,
  border: `1px solid ${INK2}`, background: "#fff", color: INK6,
  fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};

export default function ConductoresPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Driver[]>([]);
  const [filter, setFilter] = useState<"todos" | DriverStatus>("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sel, setSel] = useState<Driver | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) return router.replace("/login");
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const qs = new URLSearchParams({ limit: "100" });
      if (filter !== "todos") qs.set("status", filter);
      const res = await fetch(`/api/conductores?${qs}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al cargar conductores"); return; }
      setItems(data.data.items ?? []);
      setCounts(data.data.statusCounts ?? {});
      // Auto-seleccionar el primero
      if (data.data.items?.length && !sel) setSel(data.data.items[0]);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filter, router]);

  useEffect(() => { void load(); }, [load]);

  const total = (counts.apto ?? 0) + (counts.riesgo ?? 0) + (counts.no_apto ?? 0) || items.length;
  const canEdit = user ? CAN_EDIT.includes(user.role) : false;
  const canCreate = user ? CAN_CREATE.includes(user.role) : false;

  const columns = useMemo<ColumnDef<Driver, unknown>[]>(() => [
    {
      id: "conductor",
      header: "Conductor",
      accessorFn: (d) => `${d.name ?? ""} ${d.dni ?? ""} ${d.licenseCategory ?? ""}`,
      cell: ({ row: r }) => {
        const d = r.original;
        const isSel = sel?.id === d.id;
        const dni = d.dni?.trim() || "—";
        const cat = d.licenseCategory?.trim() || "—";
        return (
          <div
            style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
            onClick={() => setSel(d)}
          >
            <Avatar name={d.name ?? "?"} />
            <div>
              <div style={{ fontWeight: 600, color: isSel ? INK9 : INK9, fontSize: "0.875rem" }}>
                {d.name?.trim() || "Sin nombre"}
              </div>
              <div style={{ fontSize: "0.75rem", color: INK5, fontFamily: "ui-monospace,monospace" }}>
                DNI {dni} · {cat}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "empresa",
      header: "Empresa",
      accessorFn: (d) => `${d.companyName ?? ""} ${d.licenseNumber ?? ""}`,
      cell: ({ row: r }) => (
        <div style={{ cursor: "pointer" }} onClick={() => setSel(r.original)}>
          <div style={{ fontWeight: 600, fontSize: "0.875rem", color: INK9 }}>
            {r.original.companyName?.trim() || <span style={{ color: INK5, fontWeight: 500 }}>Sin empresa</span>}
          </div>
          <div style={{ fontSize: "0.75rem", color: INK5 }}>
            Lic. {r.original.licenseNumber?.trim() || "—"}
          </div>
        </div>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (d) => STATUS_META(d.status ?? "apto").label,
      cell: ({ row: r }) => (
        <div style={{ cursor: "pointer" }} onClick={() => setSel(r.original)}>
          <StatusBadge s={r.original.status ?? "apto"} />
        </div>
      ),
    },
    {
      id: "fatiga",
      header: "Fatiga",
      accessorFn: (d) => d.continuousHours ?? 0,
      cell: ({ row: r }) => {
        const d = r.original;
        const hours = d.continuousHours ?? 0;
        const pct = Math.min(100, (hours / 10) * 100);
        const m = STATUS_META(d.status ?? "apto");
        return (
          <div style={{ width: 140, cursor: "pointer" }} onClick={() => setSel(d)}>
            <div style={{ height: 4, background: INK2, borderRadius: 999, overflow: "hidden" }}>
              <span style={{
                display: "block", height: "100%", borderRadius: 999,
                background: m.color, width: `${pct}%`,
              }} />
            </div>
            <div style={{ fontSize: "0.6875rem", color: INK5, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
              {hours} h conducción
            </div>
          </div>
        );
      },
    },
    {
      id: "reputacion",
      header: "Rep.",
      accessorFn: (d) => d.reputationScore ?? 0,
      cell: ({ row: r }) => {
        const score = r.original.reputationScore ?? 0;
        const color = score >= 80 ? "#15803d" : score >= 50 ? "#b45309" : "#DC2626";
        return (
          <div style={{ minWidth: 90, cursor: "pointer" }} onClick={() => setSel(r.original)}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
              <span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 800, fontSize: "0.875rem", color: INK9, fontVariantNumeric: "tabular-nums" }}>
                {score}
              </span>
              <span style={{ fontSize: "0.625rem", color: INK5, fontWeight: 500 }}>/ 100</span>
            </div>
            <div style={{ height: 4, background: INK1, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, score))}%`, background: color, borderRadius: 999 }} />
            </div>
          </div>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [sel]);

  const toolbarEnd = (
    <select
      value={filter}
      onChange={(e) => setFilter(e.target.value as "todos" | DriverStatus)}
      style={{
        height: 32, padding: "0 10px", borderRadius: 7,
        border: `1px solid ${INK2}`, fontSize: "0.8125rem",
        fontFamily: "inherit", background: "#fff", color: INK6, cursor: "pointer",
      }}
    >
      <option value="todos">Todos ({total})</option>
      <option value="apto">Apto ({counts.apto ?? 0})</option>
      <option value="riesgo">Riesgo ({counts.riesgo ?? 0})</option>
      <option value="no_apto">No apto ({counts.no_apto ?? 0})</option>
    </select>
  );

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      <DashboardHero
        kicker="Operación · RF-05"
        title="Conductores"
        pills={[
          { label: "Total", value: total },
          { label: "Aptos", value: counts.apto ?? 0 },
          { label: "Riesgo", value: counts.riesgo ?? 0, warn: (counts.riesgo ?? 0) > 0 },
          { label: "No aptos", value: counts.no_apto ?? 0, warn: (counts.no_apto ?? 0) > 0 },
        ]}
        action={
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
              borderRadius: 7, border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)",
              fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              <Download size={13} />Exportar CSV
            </button>
            {canCreate && (
              <Link href="/conductores/nuevo">
                <button style={{
                  display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
                  borderRadius: 7, border: "none",
                  background: "#fff", color: INK9,
                  fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}>
                  <Plus size={13} />Nuevo conductor
                </button>
              </Link>
            )}
          </div>
        }
      />

      <KPIStrip cols={4} items={[
        { label: "TOTAL REGISTRADOS", value: loading ? "—" : total, subtitle: "conductores", icon: Users },
        { label: "APTOS AHORA", value: loading ? "—" : (counts.apto ?? 0), subtitle: "operativos", icon: Check },
        { label: "EN RIESGO", value: loading ? "—" : (counts.riesgo ?? 0), subtitle: "fatiga acumulada", icon: Gauge },
        { label: "NO APTOS", value: loading ? "—" : (counts.no_apto ?? 0), subtitle: "sin acceso", icon: AlertTriangle },
      ]} />

      {error && (
        <div role="alert" style={{
          padding: "10px 14px", background: NO_BG, border: `1px solid ${NO_BD}`,
          borderRadius: 8, color: NO, fontSize: "0.8125rem",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />{error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 16, alignItems: "start" }}>
        <DataTable<Driver>
          columns={columns}
          data={items}
          loading={loading}
          searchPlaceholder="Buscar por nombre, DNI o licencia…"
          emptyTitle="Sin conductores"
          emptyDescription="No hay conductores registrados con los filtros actuales."
          defaultPageSize={20}
          toolbarEnd={toolbarEnd}
        />

        {sel ? (
          <DriverPreview driver={sel} canEdit={canEdit} />
        ) : (
          <div style={{
            background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
            padding: "60px 24px", textAlign: "center", color: INK5,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: INK1,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Users size={20} color={INK5} strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9 }}>
              Selecciona un conductor
            </div>
            <div style={{ fontSize: "0.8125rem", color: INK5, maxWidth: 260, lineHeight: 1.5 }}>
              Haz clic en cualquier conductor de la lista para ver su perfil resumido.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DriverPreview({ driver, canEdit }: { driver: Driver; canEdit: boolean }) {
  const score = driver.reputationScore ?? 0;
  const cont = driver.continuousHours ?? 0;
  const rest = driver.restHours ?? 0;
  const repColor = score >= 80 ? APTO : score >= 60 ? RIESGO : NO;
  const status = driver.status ?? "apto";
  return (
    <div style={{
      background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
      position: "sticky", top: 16, overflow: "hidden",
    }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${INK2}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={driver.name ?? "?"} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: INK9, lineHeight: 1.25, wordBreak: "break-word" }}>
              {driver.name?.trim() || "Sin nombre"}
            </div>
            <div style={{ fontSize: "0.75rem", color: INK5, fontFamily: "ui-monospace,monospace", marginTop: 2 }}>
              DNI {driver.dni?.trim() || "—"} · Lic. {driver.licenseNumber?.trim() || "—"}
            </div>
          </div>
          <StatusBadge s={status} />
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {driver.phone && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 9px", borderRadius: 6,
              background: INK1, fontSize: "0.75rem", fontWeight: 600, color: INK6,
            }}>
              <Phone size={11} />{driver.phone}
            </span>
          )}
          {driver.licenseCategory && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 9px", borderRadius: 6,
              background: INK1, fontSize: "0.75rem", fontWeight: 600, color: INK6,
            }}>
              <Car size={11} />{driver.licenseCategory}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{
          fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: INK5, marginBottom: 8,
        }}>FatigueEngine</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { lbl: "Conducción continua", val: cont },
            { lbl: "Descanso restante", val: rest },
          ].map(x => (
            <div key={x.lbl} style={{
              padding: "10px 12px", background: INK1,
              border: `1px solid ${INK2}`, borderRadius: 8,
            }}>
              <div style={{
                fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.06em",
                color: INK5, textTransform: "uppercase",
              }}>{x.lbl}</div>
              <div style={{
                fontSize: "1.125rem", fontWeight: 800, color: INK9,
                fontVariantNumeric: "tabular-nums", marginTop: 2,
              }}>
                {x.val}<span style={{ fontSize: "0.75rem", color: INK5, fontWeight: 500 }}> h</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: INK5, marginBottom: 8,
        }}>Reputación</div>

        <div style={{
          padding: "10px 12px", background: INK1,
          border: `1px solid ${INK2}`, borderRadius: 8, marginBottom: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: "0.8125rem", color: INK6, fontWeight: 600 }}>Score</span>
            <span style={{ fontWeight: 800, fontSize: "1rem", color: repColor, fontVariantNumeric: "tabular-nums" }}>
              {score}/100
            </span>
          </div>
          <div style={{ height: 4, background: INK2, borderRadius: 999, overflow: "hidden" }}>
            <span style={{
              display: "block", height: "100%", borderRadius: 999,
              background: repColor, width: `${score}%`,
            }} />
          </div>
        </div>

        <Link href={`/conductores/${driver.id}`} style={{ display: "block" }}>
          <button style={{ ...btnPrimary, width: "100%", height: 34 }}>
            {canEdit ? <Pencil size={13} /> : <Eye size={13} />}
            {canEdit ? "Editar conductor" : "Ver perfil completo"}
          </button>
        </Link>
      </div>
    </div>
  );
}
