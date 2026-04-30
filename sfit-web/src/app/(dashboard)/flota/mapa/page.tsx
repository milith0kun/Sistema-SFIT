"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, MapPin, Pause, Play, Loader2, Inbox, Truck, Route as RouteIcon,
  RefreshCw,
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { GoogleMapView, type MapPolyline } from "@/components/ui/GoogleMapView";

/* Paleta sobria */
const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK4 = "#a1a1aa"; const INK5 = "#71717a"; const INK6 = "#52525b";
const INK7 = "#3f3f46"; const INK9 = "#18181b";
const APTO = "#15803d";
const RIESGO = "#B45309";
const NO = "#DC2626"; const NO_BG = "#FFF5F5"; const NO_BD = "#FCA5A5";
const GOLD = "#B8860B";

const ALLOWED = ["super_admin", "admin_provincial", "admin_municipal", "operador"];
const REFRESH_INTERVAL_MS = 15_000;

type ActiveLocation = {
  id: string;
  plate: string;
  vehicleLabel: string;
  driverName: string;
  routeCode: string | null;
  routeName: string | null;
  lat: number;
  lng: number;
  locationUpdatedAt: string;
  departureTime: string | null;
};

type TrackPoint = { lat: number; lng: number; ts: string; accuracy?: number; speed?: number };
type LocationDetail = {
  trackPoints: TrackPoint[];
  currentLocation: { lat: number; lng: number; updatedAt: string } | null;
  startLocation: { lat: number; lng: number } | null;
  endLocation: { lat: number; lng: number } | null;
  visitedStops: Array<{ stopIndex: number; label?: string; lat: number; lng: number; visitedAt: string }>;
};

type Waypoint = { order: number; lat: number; lng: number; label?: string };

const CUSCO_CENTER = { lat: -13.5178, lng: -71.9785 };

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "—";
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 5) return "ahora";
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function freshnessDot(iso: string | null | undefined): { color: string; status: "fresh" | "stale" | "old" } {
  if (!iso) return { color: INK4, status: "old" };
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return { color: APTO, status: "fresh" };
  if (diff < 5 * 60_000) return { color: RIESGO, status: "stale" };
  return { color: NO, status: "old" };
}

export default function FlotaMapaPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);

  const [activeList, setActiveList] = useState<ActiveLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LocationDetail | null>(null);
  const [routeWaypoints, setRouteWaypoints] = useState<Waypoint[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fuerza la actualización del "hace X" cada 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("sfit_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw) as { role: string };
    if (!ALLOWED.includes(u.role)) { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const loadActive = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch("/api/flota/active-locations", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
        signal,
      });
      if (signal?.aborted) return false;
      if (res.status === 401) { router.replace("/login"); return false; }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Error al cargar flota activa");
        return false;
      }
      const items: ActiveLocation[] = (data.data?.items ?? []).filter(
        (i: ActiveLocation) => Number.isFinite(i.lat) && Number.isFinite(i.lng),
      );
      setActiveList(items);
      setError(null);
      return true;
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return false;
      setError("Error de conexión");
      return false;
    }
  }, [router]);

  const loadDetail = useCallback(async (id: string, signal?: AbortSignal): Promise<void> => {
    try {
      const token = localStorage.getItem("sfit_access_token");
      const res = await fetch(`/api/flota/${id}/location`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
        signal,
      });
      if (signal?.aborted) return;
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      if (!res.ok || !data.success) return;
      setDetail(data.data as LocationDetail);
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
    }
  }, [router]);

  // Carga inicial
  useEffect(() => {
    if (!user) return;
    const ctrl = new AbortController();
    setLoading(true);
    void loadActive(ctrl.signal).finally(() => {
      setLoading(false);
    });
    return () => ctrl.abort();
  }, [user, loadActive]);

  // Auto-refresh: re-fetch active-locations + detalle del seleccionado cada 15s
  useEffect(() => {
    if (!user || paused) return;
    const ctrl = new AbortController();
    intervalRef.current = setInterval(async () => {
      setRefreshing(true);
      await loadActive(ctrl.signal);
      if (selectedId) await loadDetail(selectedId, ctrl.signal);
      setRefreshing(false);
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      ctrl.abort();
    };
  }, [user, paused, selectedId, loadActive, loadDetail]);

  // Cuando cambia la selección, fetchear detalle (trackPoints) y waypoints planeados
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setRouteWaypoints(null);
      return;
    }
    const ctrl = new AbortController();
    setDetailLoading(true);
    setDetail(null);
    setRouteWaypoints(null);
    (async () => {
      await loadDetail(selectedId, ctrl.signal);
      // Buscar el routeId del seleccionado y traer sus waypoints planeados
      try {
        const token = localStorage.getItem("sfit_access_token");
        const res = await fetch(`/api/flota/${selectedId}`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
          signal: ctrl.signal,
        });
        if (!ctrl.signal.aborted && res.ok) {
          const data = await res.json();
          const routeIdField = data?.data?.routeId;
          // routeId puede venir como string (sin populate) u objeto populado con _id
          const routeId =
            typeof routeIdField === "string"
              ? routeIdField
              : (routeIdField?._id ?? routeIdField?.id ?? null);
          if (routeId) {
            const r = await fetch(`/api/rutas/${routeId}`, {
              headers: { Authorization: `Bearer ${token ?? ""}` },
              signal: ctrl.signal,
            });
            if (!ctrl.signal.aborted && r.ok) {
              const rd = await r.json();
              const wps = rd?.data?.waypoints as Waypoint[] | undefined;
              if (wps && wps.length > 0) {
                setRouteWaypoints([...wps].sort((a, b) => a.order - b.order));
              }
            }
          }
        }
      } catch { /* silencioso — el viaje puede no tener ruta */ }
      finally {
        if (!ctrl.signal.aborted) setDetailLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [selectedId, loadDetail]);

  const selected = useMemo(
    () => activeList.find(a => a.id === selectedId) ?? null,
    [activeList, selectedId],
  );

  const municipalitiesCount = useMemo(() => {
    // Heurística: contar rutas únicas (no tenemos municipalityId en el listado).
    return new Set(activeList.map(a => a.routeCode ?? "—")).size;
  }, [activeList]);

  // Marcadores: todos los vehículos activos. Seleccionado en gold, resto en azul.
  const markers = useMemo(() => activeList.map(a => ({
    lat: a.lat,
    lng: a.lng,
    title: `${a.plate} · ${a.driverName}`,
    label: a.plate.slice(-3),
    color: (a.id === selectedId ? "gold" : "blue") as "gold" | "blue",
  })), [activeList, selectedId]);

  // Polyline real del seleccionado (verde APTO)
  const polylinesPayload: MapPolyline[] = useMemo(() => {
    const out: MapPolyline[] = [];
    if (selectedId && routeWaypoints && routeWaypoints.length > 1) {
      out.push({
        path: routeWaypoints.map(w => ({ lat: w.lat, lng: w.lng })),
        color: INK9,
        weight: 3,
        opacity: 0.45,
      });
    }
    if (selectedId && detail?.trackPoints && detail.trackPoints.length > 1) {
      out.push({
        path: detail.trackPoints.map(p => ({ lat: p.lat, lng: p.lng })),
        color: APTO,
        weight: 4,
        opacity: 0.95,
      });
    }
    return out;
  }, [selectedId, detail, routeWaypoints]);

  // Centro: si hay seleccionado, centrar en él. Si no, primer activo o Cusco.
  const mapCenter = useMemo(() => {
    if (selected) return { lat: selected.lat, lng: selected.lng };
    if (activeList.length > 0) return { lat: activeList[0].lat, lng: activeList[0].lng };
    return CUSCO_CENTER;
  }, [selected, activeList]);

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadActive();
    if (selectedId) await loadDetail(selectedId);
    setRefreshing(false);
  }, [loadActive, loadDetail, selectedId]);

  if (!user) return null;

  const heroAction = (
    <div style={{ display: "flex", gap: 6 }}>
      <Link href="/flota" style={{
        display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
        borderRadius: 7, border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)",
        fontWeight: 600, fontSize: "0.8125rem", textDecoration: "none",
      }}>
        <ArrowLeft size={12} />Volver
      </Link>
      <button
        onClick={() => void handleManualRefresh()}
        disabled={refreshing}
        title="Refrescar ahora"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
          borderRadius: 7, border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)",
          fontSize: "0.8125rem", fontWeight: 600, cursor: refreshing ? "not-allowed" : "pointer",
          fontFamily: "inherit", opacity: refreshing ? 0.6 : 1,
        }}
      >
        {refreshing
          ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} />
          : <RefreshCw size={12} />}
        Actualizar
      </button>
      <button
        onClick={() => setPaused(p => !p)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
          borderRadius: 7, border: "none",
          background: "#fff", color: INK9,
          fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        {paused ? <Play size={12} /> : <Pause size={12} />}
        {paused ? "Reanudar" : "Pausar"}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-6">
      <DashboardHero
        kicker="Operación · Tiempo real"
        title="Flota en vivo"
        pills={[
          { label: "En ruta", value: activeList.length },
          { label: "Rutas activas", value: municipalitiesCount },
          { label: "Auto-refresh", value: paused ? "Pausa" : "15s", warn: paused },
        ]}
        action={heroAction}
      />

      {error && (
        <div role="alert" style={{
          padding: "10px 14px", background: NO_BG, border: `1px solid ${NO_BD}`,
          borderRadius: 8, color: NO, fontSize: "0.8125rem",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {error}
        </div>
      )}

      {/* Grid principal */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 380px",
        gap: 16,
        alignItems: "stretch",
      }}>
        {/* Mapa */}
        <div style={{
          background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
          overflow: "hidden", position: "relative", minHeight: 500,
        }}>
          {refreshing && (
            <div style={{
              position: "absolute", top: 12, left: 12, zIndex: 5,
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 10px", borderRadius: 999,
              background: "rgba(24,24,27,0.85)", color: "#fff",
              fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.04em",
              backdropFilter: "blur(4px)",
            }}>
              <Loader2 size={11} style={{ animation: "spin 0.7s linear infinite" }} />
              SINCRONIZANDO
            </div>
          )}

          {loading ? (
            <div style={{
              height: "calc(100vh - 240px)", minHeight: 500,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 10, color: INK5,
            }}>
              <Loader2 size={20} style={{ animation: "spin 0.7s linear infinite" }} />
              <span style={{ fontSize: "0.8125rem" }}>Cargando flota…</span>
            </div>
          ) : activeList.length === 0 ? (
            <EmptyMapState />
          ) : (
            <GoogleMapView
              center={mapCenter}
              zoom={selected ? 14 : 12}
              markers={markers}
              polylines={polylinesPayload}
              height="calc(100vh - 240px)"
              style={{ minHeight: 500, borderRadius: 0 }}
            />
          )}
        </div>

        {/* Lista derecha */}
        <div style={{
          background: "#fff", border: `1px solid ${INK2}`, borderRadius: 12,
          overflow: "hidden", display: "flex", flexDirection: "column",
          maxHeight: "calc(100vh - 240px)", minHeight: 500,
          position: "sticky", top: 16,
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: `1px solid ${INK2}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 6,
              background: INK1, border: `1px solid ${INK2}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Truck size={13} color={INK6} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9, lineHeight: 1.25 }}>
                Vehículos activos
              </div>
              <div style={{ fontSize: "0.75rem", color: INK5, marginTop: 1 }}>
                {activeList.length} en circulación
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{
                padding: 20, display: "flex", flexDirection: "column", gap: 8,
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} className="skeleton-shimmer" style={{ height: 60, borderRadius: 8 }} />
                ))}
              </div>
            ) : activeList.length === 0 ? (
              <div style={{
                padding: 24, display: "flex", flexDirection: "column",
                alignItems: "center", gap: 10, color: INK5, textAlign: "center",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, background: INK1,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Inbox size={16} color={INK5} strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: "0.8125rem" }}>Sin vehículos activos</div>
              </div>
            ) : activeList.map((a, i) => {
              const isSel = a.id === selectedId;
              const dot = freshnessDot(a.locationUpdatedAt);
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  style={{
                    width: "100%", textAlign: "left",
                    padding: "10px 14px",
                    border: "none",
                    borderBottom: i < activeList.length - 1 ? `1px solid ${INK1}` : "none",
                    borderLeft: isSel ? `3px solid ${GOLD}` : "3px solid transparent",
                    background: isSel ? INK1 : "#fff",
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "background 120ms",
                    display: "flex", flexDirection: "column", gap: 5,
                  }}
                  onMouseEnter={e => { if (!isSel) (e.currentTarget.style.background = "#fafafa"); }}
                  onMouseLeave={e => { if (!isSel) (e.currentTarget.style.background = "#fff"); }}
                >
                  <div style={{
                    display: "flex", alignItems: "center", gap: 7, justifyContent: "space-between",
                  }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center",
                      padding: "3px 9px", borderRadius: 5,
                      background: INK9, color: "#fff",
                      fontFamily: "ui-monospace, monospace", fontWeight: 700,
                      fontSize: "0.75rem", letterSpacing: "0.04em",
                    }}>
                      {a.plate || "—"}
                    </span>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: "0.6875rem", fontWeight: 600, color: INK6,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: dot.color,
                        boxShadow: dot.status === "fresh" ? `0 0 0 3px ${dot.color}1f` : "none",
                      }} />
                      {relativeTime(a.locationUpdatedAt)}
                    </div>
                  </div>
                  <div style={{
                    fontSize: "0.8125rem", color: INK9, fontWeight: 600,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {(a.driverName ?? "—").split(" ")[0] || "Sin conductor"}
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 5,
                    fontSize: "0.6875rem", color: INK5,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    <RouteIcon size={11} />
                    {a.routeCode
                      ? <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                          {a.routeCode} · {a.routeName ?? ""}
                        </span>
                      : <span>Sin ruta</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer del panel: detalle del seleccionado */}
          {selected && (
            <div style={{
              borderTop: `1px solid ${INK2}`, padding: "10px 14px",
              background: INK1, fontSize: "0.6875rem", color: INK6,
            }}>
              <div style={{
                fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", color: INK5, marginBottom: 4,
              }}>
                Seleccionado
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span>Puntos GPS</span>
                <strong style={{ color: INK9, fontVariantNumeric: "tabular-nums" }}>
                  {detailLoading ? "…" : (detail?.trackPoints?.length ?? 0)}
                </strong>
              </div>
              {routeWaypoints && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 3 }}>
                  <span>Paraderos planeados</span>
                  <strong style={{ color: INK9, fontVariantNumeric: "tabular-nums" }}>
                    {routeWaypoints.length}
                  </strong>
                </div>
              )}
              {detail?.visitedStops && detail.visitedStops.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 3 }}>
                  <span>Paraderos visitados</span>
                  <strong style={{ color: APTO, fontVariantNumeric: "tabular-nums" }}>
                    {detail.visitedStops.length}
                  </strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Leyenda */}
      <div style={{
        background: "#fff", border: `1px solid ${INK2}`, borderRadius: 10,
        padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 16,
        fontSize: "0.75rem", color: INK6,
      }}>
        <LegendDot color={APTO} label="Actualizado < 1 min" />
        <LegendDot color={RIESGO} label="1–5 min (puede estar stale)" />
        <LegendDot color={NO} label=">5 min" />
        <span style={{ width: 1, background: INK2 }} />
        <LegendLine color={APTO} label="Trazado real GPS" />
        <LegendLine color={INK7} label="Ruta planeada" dashed />
        <span style={{ marginLeft: "auto", color: INK5, fontSize: "0.6875rem" }}>
          <MapPin size={10} style={{ display: "inline", marginRight: 4 }} />
          Click en un vehículo para ver su recorrido
        </span>
      </div>
    </div>
  );
}

function EmptyMapState() {
  return (
    <div style={{
      height: "calc(100vh - 240px)", minHeight: 500,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 12, padding: 32, textAlign: "center",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: INK1, border: `1px solid ${INK2}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <MapPin size={24} color={INK5} strokeWidth={1.5} />
      </div>
      <div>
        <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: INK9 }}>
          Sin vehículos en ruta
        </div>
        <div style={{ fontSize: "0.8125rem", color: INK5, marginTop: 4, maxWidth: 360 }}>
          Cuando un conductor inicie su turno desde la app móvil, aparecerá aquí en tiempo real con su posición GPS.
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}

function LegendLine({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{
        width: 22, height: 0,
        borderTop: `${dashed ? "2px dashed" : "3px solid"} ${color}`,
        opacity: dashed ? 0.65 : 1,
      }} />
      {label}
    </span>
  );
}
