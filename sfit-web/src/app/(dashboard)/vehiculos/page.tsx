"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Car, Check, Route, Wrench, Plus, QrCode, Pencil, Eye, AlertTriangle, Loader2, Printer, Download, RefreshCw,
} from "lucide-react";
import { KPIStrip } from "@/components/dashboard/KPIStrip";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";

type VehicleStatus = "disponible" | "en_ruta" | "en_mantenimiento" | "fuera_de_servicio";
type Vehicle = {
  id: string; plate: string; vehicleTypeKey: string;
  brand: string; model: string; year: number;
  status: VehicleStatus; companyName?: string; currentDriverName?: string;
  lastInspectionStatus?: string; reputationScore: number;
  soatExpiry?: string; qrHmac?: string;
};

/* Paleta sobria — gris + verde/ámbar/rojo sólo como semántica de estado */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d"; const APTO_BD = "#86EFAC";
const INFO = "#1E40AF"; const INFO_BD = "#BFDBFE";
const RIESGO = "#B45309"; const RIESGO_BD = "#FDE68A";
const NO = "#DC2626"; const NO_BG = "#FFF5F5"; const NO_BD = "#FCA5A5";

const STATUS_META = (s: VehicleStatus) => ({
  disponible:        { color: APTO,   bd: APTO_BD,   label: "DISPONIBLE" },
  en_ruta:           { color: INFO,   bd: INFO_BD,   label: "EN RUTA" },
  en_mantenimiento:  { color: RIESGO, bd: RIESGO_BD, label: "MANTENIMIENTO" },
  fuera_de_servicio: { color: NO,     bd: NO_BD,     label: "FUERA DE SERVICIO" },
}[s] ?? { color: INK6, bd: INK2, label: s });

function StateBadge({ s }: { s: VehicleStatus }) {
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

function Plate({ p }: { p: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "4px 10px", borderRadius: 5,
      background: INK9, color: "#fff",
      fontFamily: "ui-monospace, monospace", fontWeight: 700,
      fontSize: "0.8125rem", letterSpacing: "0.05em",
    }}>{p}</span>
  );
}

const TYPES = ["todos", "transporte_publico", "limpieza_residuos", "emergencia", "maquinaria", "municipal_general"];
const TYPE_LABELS: Record<string, string> = {
  todos: "Todos", transporte_publico: "Transporte público",
  limpieza_residuos: "Limpieza", emergencia: "Emergencia",
  maquinaria: "Maquinaria", municipal_general: "Municipal",
};
const ALLOWED = ["admin_municipal", "fiscal", "admin_provincial", "super_admin", "operador"];
const CAN_EDIT = ["admin_municipal", "super_admin", "operador"];
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

export default function VehiculosPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [items, setItems] = useState<Vehicle[]>([]);
  const [typeFilter, setTypeFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Vehicle | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrPng, setQrPng] = useState<string | null>(null);

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
      if (typeFilter !== "todos") qs.set("type", typeFilter);
      const res = await fetch(`/api/vehiculos?${qs}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Error al cargar vehículos"); return;
      }
      setItems(data.data.items ?? []);
      if (data.data.items?.length && !sel) setSel(data.data.items[0]);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, typeFilter, router]);

  useEffect(() => { void load(); }, [load]);

  const fetchQr = useCallback(async (vehicleId: string) => {
    setQrLoading(true); setQrError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/vehiculos/${vehicleId}/qr`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status === 401) { router.replace("/login"); return null; }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setQrError(data.error ?? "Error al generar QR"); return null;
      }
      return data.data as { pngDataUrl: string; payload: { sig: string } };
    } catch { setQrError("Error de conexión"); return null; }
    finally { setQrLoading(false); }
  }, [router]);

  useEffect(() => {
    if (!sel) { setQrPng(null); return; }
    let cancelled = false;
    void (async () => {
      const result = await fetchQr(sel.id);
      if (!cancelled && result) setQrPng(result.pngDataUrl);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id]);

  const handleReemitirQr = useCallback(async () => {
    if (!sel) return;
    const result = await fetchQr(sel.id);
    if (!result) return;
    setQrPng(result.pngDataUrl);
    const newHmac = result.payload.sig;
    setSel(prev => prev ? { ...prev, qrHmac: newHmac } : prev);
    setItems(prev => prev.map(v => v.id === sel.id ? { ...v, qrHmac: newHmac } : v));
  }, [sel, fetchQr]);

  const handleDescargarQr = useCallback(async () => {
    if (!sel) return;
    const result = await fetchQr(sel.id);
    if (!result) return;
    setQrPng(result.pngDataUrl);
    const link = document.createElement("a");
    link.href = result.pngDataUrl;
    link.download = `QR_SFIT_${sel.plate.replace(/-/g, "")}.png`;
    link.click();
    const newHmac = result.payload.sig;
    setSel(prev => prev ? { ...prev, qrHmac: newHmac } : prev);
    setItems(prev => prev.map(v => v.id === sel.id ? { ...v, qrHmac: newHmac } : v));
  }, [sel, fetchQr]);

  const statusCounts = useMemo(() => ({
    total: items.length,
    disponible: items.filter(v => v.status === "disponible").length,
    en_ruta: items.filter(v => v.status === "en_ruta").length,
    en_mantenimiento: items.filter(v => v.status === "en_mantenimiento").length,
    fuera_de_servicio: items.filter(v => v.status === "fuera_de_servicio").length,
  }), [items]);

  const canEdit = user ? CAN_EDIT.includes(user.role) : false;
  const canCreate = user ? CAN_CREATE.includes(user.role) : false;

  const columns = useMemo<ColumnDef<Vehicle, unknown>[]>(() => [
    {
      id: "placa",
      header: "Placa",
      accessorFn: (v) => v.plate,
      cell: ({ row: r }) => (
        <div style={{ cursor: "pointer" }} onClick={() => setSel(r.original)}>
          <Plate p={r.original.plate ?? "—"} />
        </div>
      ),
    },
    {
      id: "vehiculo",
      header: "Vehículo",
      accessorFn: (v) => `${v.brand ?? ""} ${v.model ?? ""} ${v.year ?? ""} ${TYPE_LABELS[v.vehicleTypeKey] ?? v.vehicleTypeKey ?? ""}`,
      cell: ({ row: r }) => {
        const d = r.original;
        const brand = d.brand?.trim() || "Sin marca";
        const model = d.model?.trim() || "—";
        const type = TYPE_LABELS[d.vehicleTypeKey] ?? (d.vehicleTypeKey?.trim() || "—");
        const year = d.year ?? "—";
        return (
          <div style={{ cursor: "pointer" }} onClick={() => setSel(d)}>
            <div style={{ fontWeight: 600, color: INK9, fontSize: "0.875rem" }}>{brand} {model}</div>
            <div style={{ fontSize: "0.75rem", color: INK5 }}>{type} · {year}</div>
          </div>
        );
      },
    },
    {
      id: "empresa",
      header: "Empresa",
      accessorFn: (v) => `${v.companyName ?? ""} ${v.currentDriverName ?? ""}`,
      cell: ({ row: r }) => (
        <div style={{ cursor: "pointer" }} onClick={() => setSel(r.original)}>
          <div style={{ fontWeight: 600, fontSize: "0.875rem", color: INK9 }}>
            {r.original.companyName?.trim() || <span style={{ color: INK5, fontWeight: 500 }}>Sin empresa</span>}
          </div>
          <div style={{ fontSize: "0.75rem", color: INK5 }}>
            {r.original.currentDriverName?.trim() || "Sin conductor"}
          </div>
        </div>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (v) => STATUS_META(v.status).label,
      cell: ({ row: r }) => (
        <div style={{ cursor: "pointer" }} onClick={() => setSel(r.original)}>
          <StateBadge s={r.original.status} />
        </div>
      ),
    },
    {
      id: "reputacion",
      header: "Reputación",
      accessorFn: (v) => v.reputationScore ?? 0,
      cell: ({ row: r }) => {
        const score = r.original.reputationScore ?? 0;
        const color = score >= 80 ? APTO : score >= 50 ? RIESGO : NO;
        return (
          <div style={{ minWidth: 90, cursor: "pointer" }} onClick={() => setSel(r.original)}>
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [sel]);

  const toolbarEnd = (
    <select
      value={typeFilter}
      onChange={(e) => setTypeFilter(e.target.value)}
      style={{
        height: 32, padding: "0 10px", borderRadius: 7,
        border: `1px solid ${INK2}`, fontSize: "0.8125rem",
        fontFamily: "inherit", background: "#fff", color: INK6, cursor: "pointer",
      }}
    >
      {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
    </select>
  );

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      <PageHeader
        kicker="Operación · RF-06"
        title="Vehículos y QR"
        subtitle={`${statusCounts.total} registrados · ${statusCounts.disponible} disponibles · ${statusCounts.en_ruta} en ruta`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 36, padding: "0 14px", borderRadius: 9,
              border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
              fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              <QrCode size={14} />Escanear QR
            </button>
            {canCreate && (
              <Link href="/vehiculos/nuevo">
                <button style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  height: 36, padding: "0 14px", borderRadius: 9,
                  border: "none",
                  background: INK9, color: "#fff",
                  fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>
                  <Plus size={14} />Nuevo vehículo
                </button>
              </Link>
            )}
          </div>
        }
      />

      <KPIStrip cols={4} items={[
        { label: "REGISTRADOS", value: loading ? "—" : statusCounts.total, subtitle: "vehículos", icon: Car },
        { label: "DISPONIBLES", value: loading ? "—" : statusCounts.disponible, subtitle: "operativos", icon: Check },
        { label: "EN RUTA", value: loading ? "—" : statusCounts.en_ruta, subtitle: "en circulación", icon: Route },
        { label: "MANTENIMIENTO", value: loading ? "—" : statusCounts.en_mantenimiento, subtitle: "fuera de servicio", icon: Wrench },
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
        <DataTable<Vehicle>
          columns={columns}
          data={items}
          loading={loading}
          searchPlaceholder="Buscar placa, marca, modelo o empresa…"
          emptyTitle="Sin vehículos"
          emptyDescription="No hay vehículos registrados con los filtros actuales."
          defaultPageSize={20}
          toolbarEnd={toolbarEnd}
        />

        {sel ? (
          <VehiclePreview
            vehicle={sel}
            qrPng={qrPng}
            qrLoading={qrLoading}
            qrError={qrError}
            canEdit={canEdit}
            onDescargar={() => void handleDescargarQr()}
            onReemitir={() => void handleReemitirQr()}
          />
        ) : (
          <div style={{
            background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
            padding: "60px 24px", textAlign: "center", color: INK5,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            position: "sticky", top: 16,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: INK1,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Car size={20} color={INK5} strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: INK9 }}>
              Selecciona un vehículo
            </div>
            <div style={{ fontSize: "0.8125rem", color: INK5, maxWidth: 240, lineHeight: 1.5 }}>
              Haz clic en cualquier vehículo de la lista para ver sus datos y QR firmado.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VehiclePreview({
  vehicle, qrPng, qrLoading, qrError, canEdit,
  onDescargar, onReemitir,
}: {
  vehicle: Vehicle;
  qrPng: string | null;
  qrLoading: boolean;
  qrError: string | null;
  canEdit: boolean;
  onDescargar: () => void;
  onReemitir: () => void;
}) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
      position: "sticky", top: 16, overflow: "hidden",
    }}>
      {/* Header del vehículo */}
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${INK2}` }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10,
        }}>
          <Plate p={vehicle.plate ?? "—"} />
          <StateBadge s={vehicle.status} />
        </div>
        <div style={{
          fontWeight: 700, fontSize: "1rem", color: INK9, lineHeight: 1.25,
          marginTop: 10, wordBreak: "break-word",
        }}>
          {vehicle.brand?.trim() || "Sin marca"} {vehicle.model?.trim() || ""}
        </div>
        <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2 }}>
          {TYPE_LABELS[vehicle.vehicleTypeKey] ?? vehicle.vehicleTypeKey ?? "—"} · {vehicle.year ?? "—"}
          {vehicle.companyName && ` · ${vehicle.companyName}`}
        </div>
      </div>

      {/* QR — protagonista del panel */}
      <div style={{ padding: "18px 16px 16px" }}>
        {/* QR grande, ocupa todo el ancho del panel */}
        <div style={{
          background: "#fff", borderRadius: 10,
          padding: 12, border: `1px solid ${INK2}`,
        }}>
          {qrPng ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrPng}
              alt={`QR ${vehicle.plate}`}
              style={{ width: "100%", display: "block", borderRadius: 6 }}
            />
          ) : (
            <div style={{
              aspectRatio: "1/1", borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: INK1, color: INK5, fontSize: "0.8125rem", gap: 8,
              flexDirection: "column",
            }}>
              {qrLoading ? (
                <>
                  <Loader2 size={20} style={{ animation: "spin 0.7s linear infinite" }} />
                  <span>Generando…</span>
                </>
              ) : (
                <>
                  <QrCode size={28} color={INK5} />
                  <span>Sin QR</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Instrucción para el ciudadano + firma */}
        <div style={{
          textAlign: "center", marginTop: 10,
          fontSize: "0.8125rem", color: INK6, lineHeight: 1.4,
        }}>
          Apunta tu cámara para reportar este vehículo
        </div>
        <div style={{
          textAlign: "center", marginTop: 4, fontSize: "0.6875rem",
          color: INK5, fontFamily: "ui-monospace,monospace",
        }}>
          sha256:{vehicle.qrHmac ? vehicle.qrHmac.slice(0, 12) + "…" : "pendiente"}
        </div>

        {/* Acciones — imprimir es la principal (a tamaño real) */}
        <Link
          href={`/vehiculos/${vehicle.id}/qr/imprimir`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", marginTop: 14 }}
        >
          <button style={{ ...btnPrimary, width: "100%", height: 36 }}>
            <Printer size={14} />Imprimir etiqueta
          </button>
        </Link>

        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button
            style={{
              ...btnOutline, flex: 1, height: 32,
              opacity: qrLoading ? 0.5 : 1, cursor: qrLoading ? "not-allowed" : "pointer",
            }}
            disabled={qrLoading}
            onClick={onDescargar}
          >
            <Download size={12} />PNG
          </button>
          <button
            style={{
              ...btnOutline, flex: 1, height: 32,
              opacity: qrLoading ? 0.5 : 1, cursor: qrLoading ? "not-allowed" : "pointer",
            }}
            disabled={qrLoading}
            onClick={onReemitir}
          >
            <RefreshCw size={12} />{qrLoading ? "…" : "Re-emitir"}
          </button>
        </div>

        {qrError && (
          <div role="alert" style={{
            marginTop: 8, padding: "7px 10px",
            background: NO_BG, border: `1px solid ${NO_BD}`,
            borderRadius: 7, fontSize: "0.75rem", color: NO,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <AlertTriangle size={12} />{qrError}
          </div>
        )}
      </div>

      {/* Historial mínimo */}
      <div style={{ padding: "0 16px 14px" }}>
        <div style={{
          fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: INK5, marginBottom: 8,
          paddingTop: 14, borderTop: `1px solid ${INK1}`,
        }}>Historial</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            { lbl: "Última inspección", val: vehicle.lastInspectionStatus ?? "Pendiente" },
            { lbl: "Reputación", val: `${vehicle.reputationScore ?? 0}/100` },
            { lbl: "SOAT vigente", val: vehicle.soatExpiry
                ? new Date(vehicle.soatExpiry).toLocaleDateString("es-PE", { month: "short", year: "numeric" })
                : "—" },
          ].map(x => (
            <div key={x.lbl} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: "0.75rem", padding: "7px 0",
              borderBottom: `1px solid ${INK1}`,
            }}>
              <span style={{ color: INK5 }}>{x.lbl}</span>
              <strong style={{ color: INK9, fontWeight: 600 }}>{x.val}</strong>
            </div>
          ))}
        </div>

        {/* Acción única — ver/editar */}
        <Link href={`/vehiculos/${vehicle.id}`} style={{ display: "block", marginTop: 12 }}>
          <button style={{ ...btnPrimary, width: "100%", height: 34 }}>
            {canEdit ? <Pencil size={13} /> : <Eye size={13} />}
            {canEdit ? "Editar vehículo" : "Ver detalle"}
          </button>
        </Link>
      </div>
    </div>
  );
}
