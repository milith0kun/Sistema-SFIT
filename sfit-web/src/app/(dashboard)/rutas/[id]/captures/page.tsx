"use client";

import { useCallback, useEffect, useMemo, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, RefreshCw, AlertTriangle, CheckCircle, Loader2,
  Eye, Sparkles, Activity, Trash2, History,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { WaypointsEditor, type Waypoint } from "@/components/ui/WaypointsEditor";

type CaptureStatus = "raw" | "validated" | "rejected" | "merged";

type Capture = {
  id: string;
  routeId: string;
  tripId: string | null;
  driver: { name?: string } | null;
  vehicle: { plate?: string } | null;
  pointCount: number;
  avgAccuracy?: number;
  distanceMeters?: number;
  durationSeconds?: number;
  qualityScore: number;
  status: CaptureStatus;
  mergedAt?: string | null;
  createdAt: string;
};

type RouteSummary = {
  id: string; code: string; name: string;
  waypoints: Waypoint[];
};

type StoredUser = { role: string };

const ALLOWED = ["admin_municipal", "super_admin", "admin_provincial", "operador", "fiscal"];
const CAN_RECALC = ["admin_municipal", "super_admin", "operador"];

const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d"; const APTOBG = "#F0FDF4"; const APTOBD = "#86EFAC";
const AMB = "#b45309"; const AMBBG = "#FFFBEB"; const AMBBD = "#FCD34D";
const RED = "#DC2626"; const REDBG = "#FFF5F5"; const REDBD = "#FCA5A5";

interface Props { params: Promise<{ id: string }> }

function fmtKm(m?: number) {
  if (m == null) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}
function fmtDuration(s?: number) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m}:${String(sec).padStart(2, "0")}`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}
function fmtAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  return `Hace ${Math.floor(h / 24)} d`;
}

const STATUS_META: Record<CaptureStatus, { label: string; color: string; bg: string; bd: string }> = {
  raw:       { label: "Sin procesar", color: INK6, bg: INK1,   bd: INK2 },
  validated: { label: "Validada",     color: APTO, bg: APTOBG, bd: APTOBD },
  merged:    { label: "Fusionada",    color: APTO, bg: APTOBG, bd: APTOBD },
  rejected:  { label: "Rechazada",    color: RED,  bg: REDBG,  bd: REDBD },
};

function QualityPill({ score }: { score: number }) {
  const color = score >= 80 ? APTO : score >= 60 ? AMB : RED;
  const bg    = score >= 80 ? APTOBG : score >= 60 ? AMBBG : REDBG;
  const bd    = score >= 80 ? APTOBD : score >= 60 ? AMBBD : REDBD;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999,
      fontSize: "0.6875rem", fontWeight: 700,
      background: bg, color, border: `1px solid ${bd}`,
      fontFamily: "ui-monospace, monospace",
    }}>
      {score}/100
    </span>
  );
}

export default function RutaCapturesPage({ params }: Props) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewPoints, setPreviewPoints] = useState<{ lat: number; lng: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [convergedWaypoints, setConvergedWaypoints] = useState<Waypoint[] | null>(null);
  const [convergedStats, setConvergedStats] = useState<{ used: number; discarded: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auth gate
  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("sfit_user") : null;
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as StoredUser;
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const canRecalc = !!user && CAN_RECALC.includes(user.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const headers = { Authorization: `Bearer ${token ?? ""}` };
      const [routeRes, capturesRes] = await Promise.all([
        fetch(`/api/rutas/${id}`, { headers }),
        fetch(`/api/rutas/${id}/captures?limit=50`, { headers }),
      ]);
      if (routeRes.status === 401) { router.replace("/login"); return; }
      if (routeRes.status === 404) { setError("Ruta no encontrada"); return; }
      const routeData = await routeRes.json();
      const capturesData = await capturesRes.json();
      if (!routeRes.ok || !routeData.success) {
        setError(routeData.error ?? "No se pudo cargar la ruta"); return;
      }
      setRoute({
        id: routeData.data.id ?? routeData.data._id ?? id,
        code: routeData.data.code,
        name: routeData.data.name,
        waypoints: (routeData.data.waypoints ?? []) as Waypoint[],
      });
      if (capturesRes.ok && capturesData.success) {
        setCaptures(capturesData.data.items ?? []);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { if (user) void load(); }, [user, load]);

  // Cargar preview de la captura seleccionada (puntos GPS).
  useEffect(() => {
    if (!selectedId) { setPreviewPoints([]); return; }
    let cancelled = false;
    void (async () => {
      try {
        const token = localStorage.getItem("sfit_access_token");
        const res = await fetch(`/api/rutas/${id}/captures/${selectedId}/preview`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        const data = await res.json();
        if (!cancelled && res.ok && data.success) {
          setPreviewPoints(data.data.capture?.points ?? []);
        }
      } catch { /* silencioso */ }
    })();
    return () => { cancelled = true; };
  }, [id, selectedId]);

  const recalcular = async (preview: boolean) => {
    if (!route) return;
    setRecalculating(true); setError(null); setSuccess(null);
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/rutas/${id}/recalcular`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ preview }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo recalcular"); return;
      }
      const after = (data.data.after ?? []) as Array<{ lat: number; lng: number }>;
      const wp: Waypoint[] = after.map((p, i) => ({ order: i, lat: p.lat, lng: p.lng }));
      if (preview) {
        setConvergedWaypoints(wp);
        setConvergedStats({ used: data.data.usedCaptures, discarded: data.data.discardedCaptures });
        setSuccess(`Vista previa lista — usaría ${data.data.usedCaptures} captura${data.data.usedCaptures === 1 ? "" : "s"}.`);
      } else {
        setConvergedWaypoints(null);
        setConvergedStats(null);
        setSuccess(`Ruta actualizada con ${data.data.usedCaptures} captura${data.data.usedCaptures === 1 ? "" : "s"} fusionadas.`);
        // Recargar captures (algunas pasaron a "merged") y los waypoints oficiales.
        void load();
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setRecalculating(false);
    }
  };

  // Polilíneas a superponer al editor: la captura seleccionada en azul y, si
  // hay vista previa de convergencia, la nueva ruta propuesta en verde.
  const historicalCaptures = useMemo(() => {
    const out: Array<{ id?: string; points: { lat: number; lng: number }[]; color?: string; opacity?: number }> = [];
    if (previewPoints.length > 0) {
      out.push({ id: selectedId ?? undefined, points: previewPoints, color: "#1e40af", opacity: 0.65 });
    }
    if (convergedWaypoints) {
      out.push({
        id: "converged",
        points: convergedWaypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
        color: APTO,
        opacity: 0.85,
      });
    }
    return out;
  }, [previewPoints, selectedId, convergedWaypoints]);

  if (!user) return null;

  const stats = {
    total: captures.length,
    raw: captures.filter(c => c.status === "raw").length,
    merged: captures.filter(c => c.status === "merged").length,
    avgQuality: captures.length > 0
      ? Math.round(captures.reduce((s, c) => s + c.qualityScore, 0) / captures.length)
      : 0,
  };

  return (
    <div className="sfit-page">
      <PageHeader
        kicker={route ? `RUTA · ${route.code}` : "RUTA"}
        title="Capturas GPS"
        subtitle={route ? `${route.name} — ${stats.total} captura${stats.total === 1 ? "" : "s"} en historial` : "Cargando…"}
        action={
          <Link
            href={`/rutas/${id}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 36, padding: "0 14px", borderRadius: 8,
              border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
              fontSize: "0.875rem", fontWeight: 600, fontFamily: "inherit",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={14} />Volver a la ruta
          </Link>
        }
      />

      {error && (
        <div role="alert" style={{
          margin: "12px 0", padding: "10px 14px",
          background: REDBG, border: `1px solid ${REDBD}`,
          borderRadius: 8, color: RED, fontSize: "0.875rem",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />{error}
        </div>
      )}
      {success && (
        <div role="status" style={{
          margin: "12px 0", padding: "10px 14px",
          background: APTOBG, border: `1px solid ${APTOBD}`,
          borderRadius: 8, color: APTO, fontSize: "0.875rem",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <CheckCircle size={14} />{success}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 14, marginTop: 14 }} className="sfit-aside-grid">
        {/* Mapa principal */}
        <div style={{ background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10, padding: 12 }}>
          {loading ? (
            <div style={{ height: 480, display: "flex", alignItems: "center", justifyContent: "center", color: INK5 }}>
              <Loader2 size={20} style={{ animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : (
            <WaypointsEditor
              waypoints={(convergedWaypoints ?? route?.waypoints ?? []) as Waypoint[]}
              readOnly
              height={480}
              historicalCaptures={historicalCaptures}
            />
          )}

          {/* Acciones de convergencia */}
          {canRecalc && (
            <div style={{
              marginTop: 12, padding: 12,
              background: INK1, border: `1px solid ${INK2}`, borderRadius: 8,
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            }}>
              <Sparkles size={16} color={INK6} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: INK9 }}>
                  Convergencia automática
                </div>
                <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 2 }}>
                  {convergedWaypoints
                    ? `Vista previa: ${convergedStats?.used ?? 0} capturas usadas, ${convergedStats?.discarded ?? 0} descartadas. Confirma para reemplazar la ruta oficial.`
                    : "Promedia las capturas GPS y propone una nueva polilínea oficial."}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {convergedWaypoints ? (
                  <>
                    <button
                      type="button"
                      onClick={() => { setConvergedWaypoints(null); setConvergedStats(null); setSuccess(null); }}
                      disabled={recalculating}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        height: 32, padding: "0 12px", borderRadius: 7,
                        border: `1.5px solid ${INK2}`, background: "#fff", color: INK6,
                        fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      <Trash2 size={12} />Descartar
                    </button>
                    <button
                      type="button"
                      onClick={() => recalcular(false)}
                      disabled={recalculating}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        height: 32, padding: "0 14px", borderRadius: 7,
                        border: "none", background: APTO, color: "#fff",
                        fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {recalculating ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} /> : <CheckCircle size={12} />}
                      Aplicar a la ruta
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => recalcular(true)}
                    disabled={recalculating || captures.filter(c => c.status === "raw").length === 0}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      height: 32, padding: "0 14px", borderRadius: 7,
                      border: "none", background: INK9, color: "#fff",
                      fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                      opacity: captures.filter(c => c.status === "raw").length === 0 ? 0.5 : 1,
                    }}
                    title={captures.filter(c => c.status === "raw").length === 0
                      ? "No hay capturas sin procesar"
                      : "Calcular nueva polilínea propuesta"}
                  >
                    {recalculating ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} /> : <RefreshCw size={12} />}
                    Vista previa
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar lista de capturas */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Stats compactas */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6,
            padding: 10, background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10,
          }}>
            {[
              { lbl: "Total", val: stats.total, color: INK9 },
              { lbl: "Raw",   val: stats.raw,   color: INK6 },
              { lbl: "Merged", val: stats.merged, color: APTO },
              { lbl: "Calidad ⌀", val: `${stats.avgQuality}`, color: INK9 },
            ].map((s) => (
              <div key={s.lbl} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.125rem", fontWeight: 800, color: s.color, fontFamily: "ui-monospace, monospace" }}>{s.val}</div>
                <div style={{ fontSize: "0.625rem", color: INK5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{s.lbl}</div>
              </div>
            ))}
          </div>

          {/* Lista */}
          <div style={{
            background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10, overflow: "hidden",
            display: "flex", flexDirection: "column", maxHeight: 540,
          }}>
            <div style={{ padding: "10px 12px", borderBottom: `1px solid ${INK1}`, display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", fontWeight: 700, color: INK9 }}>
              <History size={13} />Historial de capturas
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {captures.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: INK5, fontSize: "0.8125rem" }}>
                  Sin capturas todavía. Cuando un conductor cierre un viaje en esta ruta, aparecerá aquí automáticamente.
                </div>
              ) : (
                captures.map((c) => {
                  const meta = STATUS_META[c.status];
                  const selected = selectedId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(selected ? null : c.id)}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "10px 12px",
                        background: selected ? INK1 : "#fff",
                        border: "none", borderBottom: `1px solid ${INK1}`,
                        cursor: "pointer", fontFamily: "inherit",
                        transition: "background 120ms",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{
                          padding: "2px 7px", borderRadius: 4,
                          background: meta.bg, color: meta.color, border: `1px solid ${meta.bd}`,
                          fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                        }}>{meta.label}</span>
                        <QualityPill score={c.qualityScore} />
                        {selected && <Eye size={11} color={INK6} style={{ marginLeft: "auto" }} />}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: INK6, fontWeight: 600 }}>
                        {c.driver?.name ?? "Conductor desconocido"}
                        {c.vehicle?.plate ? ` · ${c.vehicle.plate}` : ""}
                      </div>
                      <div style={{ fontSize: "0.6875rem", color: INK5, marginTop: 2, display: "flex", gap: 8, fontFamily: "ui-monospace, monospace" }}>
                        <span><Activity size={9} style={{ verticalAlign: "middle" }} /> {c.pointCount} pts</span>
                        <span>{fmtKm(c.distanceMeters)}</span>
                        <span>{fmtDuration(c.durationSeconds)}</span>
                      </div>
                      <div style={{ fontSize: "0.625rem", color: INK5, marginTop: 2 }}>
                        {fmtAgo(c.createdAt)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
