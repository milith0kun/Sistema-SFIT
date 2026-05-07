"use client";

/**
 * Rutas candidatas — listado.
 *
 * Las "candidatas" son capturas GPS que generaron los conductores al cerrar
 * un turno SIN ruta asociada. El operador / admin las revisa para:
 *   1) validarlas creando una Route nueva,
 *   2) asignarlas a una Route existente, o
 *   3) descartarlas.
 *
 * Esta vista es la bandeja de entrada — sin la candidata seleccionada en detalle.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, RefreshCw, Search, Eye, Trash2, Loader2,
  Activity, MapPin, Filter, Sparkles, CheckCircle2, XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { GoogleMapView } from "@/components/ui/GoogleMapView";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/hooks/useToast";

type CandidateStatus = "candidate" | "validated" | "rejected" | "all";

type Candidate = {
  id: string;
  fleetEntryId: string;
  driverId: string;
  driverName: string;
  vehiclePlate: string;
  distanceMeters: number;
  durationSeconds: number;
  pointCount: number;
  qualityScore: number;
  samplePolyline: Array<[number, number]>;
  createdAt: string;
  status: "candidate" | "validated" | "rejected";
};

type StoredUser = { role: string; municipalityId?: string };

const ALLOWED = ["super_admin", "admin_provincial", "admin_municipal", "operador"];

/* Tokens — coherentes con el resto del dashboard */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d"; const APTO_BG = "#F0FDF4"; const APTO_BD = "#86EFAC";
const AMB  = "#b45309"; const AMB_BG  = "#FFFBEB"; const AMB_BD  = "#FCD34D";
const RED  = "#DC2626"; const RED_BG  = "#FFF5F5"; const RED_BD  = "#FCA5A5";

function fmtKm(m: number): string {
  if (!Number.isFinite(m)) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}
function fmtDuration(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  if (m < 60) return `${m}:${String(sec).padStart(2, "0")}`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}
function fmtAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Hace instantes";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  return `Hace ${d} d`;
}

function QualityBadge({ score }: { score: number }) {
  const color = score >= 80 ? APTO : score >= 60 ? AMB : RED;
  const bg    = score >= 80 ? APTO_BG : score >= 60 ? AMB_BG : RED_BG;
  const bd    = score >= 80 ? APTO_BD : score >= 60 ? AMB_BD : RED_BD;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999,
      fontSize: "0.6875rem", fontWeight: 700,
      background: bg, color, border: `1px solid ${bd}`,
      fontFamily: "ui-monospace, monospace",
    }}>
      <Sparkles size={9} />{score}/100
    </span>
  );
}

function StatusChip({ status }: { status: Candidate["status"] }) {
  const m: Record<Candidate["status"], { label: string; color: string; bg: string; bd: string }> = {
    candidate: { label: "Candidata", color: INK6,  bg: INK1,    bd: INK2 },
    validated: { label: "Validada",  color: APTO,  bg: APTO_BG, bd: APTO_BD },
    rejected:  { label: "Descartada",color: RED,   bg: RED_BG,  bd: RED_BD },
  };
  const meta = m[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 4,
      fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
      background: meta.bg, color: meta.color, border: `1px solid ${meta.bd}`,
    }}>{meta.label}</span>
  );
}

export default function RutasCandidatasPage() {
  const router = useRouter();
  const toast = useToast();

  const [user, setUser]       = useState<StoredUser | null>(null);
  const [items, setItems]     = useState<Candidate[]>([]);
  const [statusFilter, setStatusFilter] = useState<CandidateStatus>("candidate");
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const [confirmingDiscardId, setConfirmingDiscardId] = useState<string | null>(null);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("sfit_user") : null;
    if (!raw) { router.replace("/login"); return; }
    try {
      const u = JSON.parse(raw) as StoredUser;
      if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
      setUser(u);
    } catch { router.replace("/login"); }
  }, [router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token") ?? "";
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "60");
      if (user.municipalityId) params.set("municipalityId", user.municipalityId);
      const res = await fetch(`/api/rutas/candidatas?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json() as {
        success: boolean;
        data?: { items: Candidate[]; total: number };
        error?: string;
      };
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudieron cargar las candidatas.");
        return;
      }
      setItems(data.data?.items ?? []);
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter, router]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(c =>
      c.driverName.toLowerCase().includes(q) ||
      c.vehiclePlate.toLowerCase().includes(q),
    );
  }, [items, search]);

  // KPIs sobre la lista cargada actualmente.
  const kpis = useMemo(() => {
    const total = items.length;
    const high  = items.filter(c => c.qualityScore >= 80 && c.status === "candidate").length;
    const rejected = items.filter(c => c.status === "rejected").length;
    const validated = items.filter(c => c.status === "validated").length;
    return { total, high, rejected, validated };
  }, [items]);

  async function quickDiscard(id: string) {
    setDiscarding(id);
    try {
      const token = localStorage.getItem("sfit_access_token") ?? "";
      const res = await fetch(`/api/rutas/candidatas/${id}/descartar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (!res.ok || !data.success) {
        toast.error(data.error ?? "No se pudo descartar la captura.");
        return;
      }
      toast.success("Candidata descartada.");
      setConfirmingDiscardId(null);
      void load();
    } catch {
      toast.error("Error de conexión.");
    } finally {
      setDiscarding(null);
    }
  }

  if (!user) return null;

  const headerAction = (
    <button
      type="button"
      onClick={() => void load()}
      disabled={loading}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 36, padding: "0 14px", borderRadius: 9,
        border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
        fontSize: "0.875rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
        fontFamily: "inherit", opacity: loading ? 0.6 : 1,
      }}
    >
      {loading
        ? <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />
        : <RefreshCw size={14} />}
      Refrescar
    </button>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      <PageHeader
        kicker="Operación · Rutas no autorizadas"
        title="Rutas candidatas"
        subtitle="Capturas GPS de turnos cerrados sin ruta asociada — revisá y validá para crear o asignar la ruta."
        action={headerAction}
      />

      {/* KPI strip simple */}
      <div className="sfit-kpi-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10,
      }}>
        <KPICard label="En la vista" value={kpis.total} icon={<Activity size={16} />} accent={INK9} />
        <KPICard label="Calidad ≥ 80" value={kpis.high} icon={<Sparkles size={16} />} accent={APTO} />
        <KPICard label="Validadas" value={kpis.validated} icon={<CheckCircle2 size={16} />} accent={APTO} />
        <KPICard label="Descartadas" value={kpis.rejected} icon={<XCircle size={16} />} accent={RED} />
      </div>

      {/* Filtros */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
        padding: 10, background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10,
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Filter size={14} color={INK5} />
          <span style={{
            fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: INK5,
          }}>Estado</span>
        </div>
        <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
          {([
            { k: "candidate" as CandidateStatus, l: "Candidatas" },
            { k: "validated" as CandidateStatus, l: "Validadas"  },
            { k: "rejected"  as CandidateStatus, l: "Descartadas" },
            { k: "all"       as CandidateStatus, l: "Todas"       },
          ]).map(t => {
            const active = statusFilter === t.k;
            return (
              <button
                key={t.k}
                type="button"
                onClick={() => setStatusFilter(t.k)}
                style={{
                  height: 30, padding: "0 12px", borderRadius: 7,
                  border: active ? `1.5px solid ${INK9}` : `1.5px solid ${INK2}`,
                  background: active ? INK9 : "#fff",
                  color: active ? "#fff" : INK6,
                  fontSize: "0.75rem", fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >{t.l}</button>
            );
          })}
        </div>

        <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
          <Search size={14} color={INK5} style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            pointerEvents: "none",
          }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por placa o conductor…"
            style={{
              width: "100%", height: 34, padding: "0 12px 0 32px", borderRadius: 8,
              border: `1.5px solid ${INK2}`, fontSize: "0.875rem",
              fontFamily: "inherit", color: INK9, background: "#fff", outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {error && (
        <div role="alert" style={{
          padding: "10px 14px", background: RED_BG, border: `1px solid ${RED_BD}`,
          borderRadius: 8, color: RED, fontSize: "0.875rem",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />{error}
        </div>
      )}

      {/* Grid de cards o estados vacíos */}
      {loading ? (
        <div style={{
          padding: 60, textAlign: "center", color: INK5,
          background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
        }}>
          <Loader2 size={20} style={{ animation: "spin 0.7s linear infinite" }} />
          <div style={{ marginTop: 8, fontSize: "0.875rem" }}>Cargando candidatas…</div>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<MapPin size={20} />}
          title={
            search
              ? "Sin resultados para tu búsqueda"
              : statusFilter === "candidate"
                ? "Sin candidatas pendientes"
                : "Sin candidatas en este estado"
          }
          subtitle={
            search
              ? "Probá con otra placa o nombre de conductor."
              : statusFilter === "candidate"
                ? "Cuando un conductor cierre un turno sin ruta asociada, la captura aparecerá acá para que la revises."
                : "Cambiá el filtro de estado para ver otras capturas."
          }
        />
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 12,
        }}>
          {filtered.map(c => (
            <CandidateCard
              key={c.id}
              c={c}
              isDiscarding={discarding === c.id}
              isConfirming={confirmingDiscardId === c.id}
              onAskDiscard={() => setConfirmingDiscardId(c.id)}
              onCancelDiscard={() => setConfirmingDiscardId(null)}
              onConfirmDiscard={() => void quickDiscard(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, icon, accent }: {
  label: string; value: number | string;
  icon: React.ReactNode; accent: string;
}) {
  return (
    <div style={{
      background: "#fff",
      borderTop: `1.5px solid ${INK2}`,
      borderRight: `1.5px solid ${INK2}`,
      borderBottom: `1.5px solid ${INK2}`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 12, padding: "14px 16px",
      minHeight: 96, position: "relative", overflow: "hidden",
    }}>
      <div style={{
        fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em",
        color: INK5, textTransform: "uppercase", marginBottom: 8,
      }}>{label}</div>
      <div style={{
        fontSize: "1.75rem", fontWeight: 800, color: accent,
        lineHeight: 1, fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.03em",
      }}>{value}</div>
      <div aria-hidden style={{
        position: "absolute", right: 12, top: 12, color: accent, opacity: 0.18,
      }}>{icon}</div>
    </div>
  );
}

function CandidateCard({
  c, isDiscarding, isConfirming, onAskDiscard, onCancelDiscard, onConfirmDiscard,
}: {
  c: Candidate;
  isDiscarding: boolean;
  isConfirming: boolean;
  onAskDiscard: () => void;
  onCancelDiscard: () => void;
  onConfirmDiscard: () => void;
}) {
  // Centro del mini-mapa: media aritmética de la muestra.
  const center = useMemo(() => {
    if (!c.samplePolyline || c.samplePolyline.length === 0) {
      return { lat: -13.5178, lng: -71.9785 };
    }
    let lat = 0, lng = 0;
    for (const [la, ln] of c.samplePolyline) { lat += la; lng += ln; }
    return { lat: lat / c.samplePolyline.length, lng: lng / c.samplePolyline.length };
  }, [c.samplePolyline]);

  const polyline = useMemo(
    () => (c.samplePolyline ?? []).map(([lat, lng]) => ({ lat, lng })),
    [c.samplePolyline],
  );

  return (
    <div style={{
      background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
      overflow: "hidden", display: "flex", flexDirection: "column",
    }}>
      {/* Mini-mapa */}
      <div style={{ position: "relative" }}>
        <GoogleMapView
          center={center}
          zoom={polyline.length > 1 ? 13 : 12}
          height={150}
          markers={polyline.length > 0 ? [
            { lat: polyline[0].lat, lng: polyline[0].lng, color: "green", title: "Inicio" },
            { lat: polyline[polyline.length - 1].lat, lng: polyline[polyline.length - 1].lng, color: "red", title: "Fin" },
          ] : []}
          polyline={polyline}
          polylineColor="#6C0606"
          style={{ borderRadius: 0, borderBottom: `1px solid ${INK2}` }}
        />
        <div style={{
          position: "absolute", top: 8, left: 8, display: "flex", gap: 6,
        }}>
          <StatusChip status={c.status} />
          <QualityBadge score={c.qualityScore} />
        </div>
      </div>

      {/* Cuerpo */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div>
          <div style={{ fontSize: "0.875rem", fontWeight: 700, color: INK9, lineHeight: 1.3 }}>
            {c.driverName || "Conductor desconocido"}
          </div>
          <div style={{
            fontSize: "0.75rem", color: INK6, marginTop: 2, fontFamily: "ui-monospace, monospace",
          }}>
            {c.vehiclePlate || "—"} · {fmtAgo(c.createdAt)}
          </div>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6,
        }}>
          <Mini label="Distancia" value={fmtKm(c.distanceMeters)} />
          <Mini label="Duración"  value={fmtDuration(c.durationSeconds)} />
          <Mini label="Puntos"    value={String(c.pointCount ?? 0)} />
        </div>

        {/* Acciones */}
        <div style={{ marginTop: "auto", display: "flex", gap: 6, paddingTop: 4 }}>
          <Link
            href={`/rutas/candidatas/${c.id}`}
            style={{
              flex: 1,
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              height: 34, padding: "0 12px", borderRadius: 8,
              border: "none", background: INK9, color: "#fff",
              fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", textDecoration: "none",
            }}
          ><Eye size={13} />Revisar</Link>

          {c.status === "candidate" && (
            isConfirming ? (
              <div style={{
                display: "inline-flex", gap: 4,
                border: `1.5px solid ${RED_BD}`, borderRadius: 8, padding: 2,
              }}>
                <button
                  type="button" onClick={onCancelDiscard}
                  disabled={isDiscarding}
                  style={{
                    height: 28, padding: "0 8px", borderRadius: 6, border: "none",
                    background: "#fff", color: INK6,
                    fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  }}
                >Cancelar</button>
                <button
                  type="button" onClick={onConfirmDiscard}
                  disabled={isDiscarding}
                  style={{
                    height: 28, padding: "0 10px", borderRadius: 6, border: "none",
                    background: RED, color: "#fff",
                    fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}
                >
                  {isDiscarding
                    ? <Loader2 size={11} style={{ animation: "spin 0.7s linear infinite" }} />
                    : <Trash2 size={11} />}
                  Confirmar
                </button>
              </div>
            ) : (
              <button
                type="button" onClick={onAskDiscard}
                title="Descartar esta candidata"
                style={{
                  height: 34, width: 34, borderRadius: 8,
                  border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontFamily: "inherit",
                }}
                aria-label="Descartar"
              ><Trash2 size={14} /></button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: "6px 8px", borderRadius: 7,
      background: INK1, border: `1px solid ${INK2}`,
    }}>
      <div style={{
        fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.06em",
        textTransform: "uppercase", color: INK5, marginBottom: 2,
      }}>{label}</div>
      <div style={{
        fontSize: "0.8125rem", fontWeight: 700, color: INK9,
        fontVariantNumeric: "tabular-nums", fontFamily: "ui-monospace, monospace",
      }}>{value}</div>
    </div>
  );
}
