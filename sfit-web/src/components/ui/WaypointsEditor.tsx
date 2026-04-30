"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Trash2, MapPin, RotateCcw, Undo2, ArrowUp, ArrowDown, Move, Route as RouteIcon,
  Loader2, AlertTriangle, CheckCircle,
} from "lucide-react";
import { GoogleMapView, type MapPolyline } from "./GoogleMapView";

export type Waypoint = { order: number; lat: number; lng: number; label?: string };

interface WaypointsEditorProps {
  waypoints: Waypoint[];
  onChange?: (waypoints: Waypoint[]) => void;
  height?: number;
  readOnly?: boolean;
  /** Si true, los marcadores se pueden arrastrar para reposicionar (requiere onChange). */
  draggable?: boolean;
}

const DEFAULT_CENTER = { lat: -13.5178, lng: -71.9785 }; // Cusco

const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7"; const INK3 = "#d4d4d8";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d"; const APTO_BG = "#F0FDF4"; const APTO_BD = "#86EFAC";
const RIESGO = "#B45309"; const RIESGO_BG = "#FFFBEB"; const RIESGO_BD = "#FDE68A";
const NO = "#DC2626";

/** Distancia haversine en metros entre dos coords. */
function haversine(a: Waypoint, b: Waypoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function formatKm(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

type SnapState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; path: { lat: number; lng: number }[]; distanceMeters: number }
  | { state: "error"; message: string };

export function WaypointsEditor({
  waypoints,
  onChange,
  height = 360,
  readOnly = false,
  draggable = true,
}: WaypointsEditorProps) {
  const canDrag = !readOnly && draggable && !!onChange;

  // Modo "ajustar a calles" — usa Google DirectionsService para que la línea siga la malla vial real.
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [snap, setSnap] = useState<SnapState>({ state: "idle" });
  const snapAbortRef = useRef<{ cancelled: boolean } | null>(null);

  // Cuando snap está activo y hay >=2 puntos, llama a DirectionsService.
  useEffect(() => {
    // Marca el guard anterior como cancelado para que su .then() no escriba estado obsoleto.
    if (snapAbortRef.current) snapAbortRef.current.cancelled = true;
    const guard = { cancelled: false };
    snapAbortRef.current = guard;

    if (!snapEnabled || waypoints.length < 2) {
      setSnap({ state: "idle" });
      return;
    }
    if (typeof window === "undefined") return;
    const w = window as unknown as { google?: typeof google };
    if (!w.google?.maps?.DirectionsService) {
      // Si Maps aún no está cargado, esperamos a que esté disponible.
      // El editor ya monta GoogleMapView, así que tarde o temprano se carga.
      const id = setInterval(() => {
        if (w.google?.maps?.DirectionsService) {
          clearInterval(id);
          if (!guard.cancelled) runSnap();
        }
      }, 250);
      return () => clearInterval(id);
    }

    runSnap();

    async function runSnap() {
      if (guard.cancelled) return;
      setSnap({ state: "loading" });
      try {
        const ds = new w.google!.maps.DirectionsService();
        // DirectionsService acepta máx 25 waypoints intermedios. Si hay más, dividimos en chunks.
        const CHUNK = 23; // origin + destination + 23 intermedios = 25
        const fullPath: { lat: number; lng: number }[] = [];
        let totalMeters = 0;

        for (let i = 0; i < waypoints.length - 1; i += CHUNK + 1) {
          if (guard.cancelled) return;
          const slice = waypoints.slice(i, Math.min(i + CHUNK + 2, waypoints.length));
          if (slice.length < 2) break;

          const origin = { lat: slice[0].lat, lng: slice[0].lng };
          const destination = { lat: slice[slice.length - 1].lat, lng: slice[slice.length - 1].lng };
          const middle = slice.slice(1, -1).map(w => ({
            location: { lat: w.lat, lng: w.lng },
            stopover: true,
          }));

          const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
            ds.route(
              {
                origin,
                destination,
                waypoints: middle,
                travelMode: w.google!.maps.TravelMode.DRIVING,
                optimizeWaypoints: false,
                provideRouteAlternatives: false,
              },
              (res, status) => {
                if (status === "OK" && res) resolve(res);
                else reject(new Error(`DirectionsService: ${status}`));
              }
            );
          });

          if (guard.cancelled) return;
          for (const leg of result.routes[0]?.legs ?? []) {
            totalMeters += leg.distance?.value ?? 0;
            for (const step of leg.steps ?? []) {
              const path = step.path ?? [];
              for (const p of path) fullPath.push({ lat: p.lat(), lng: p.lng() });
            }
          }
        }

        if (guard.cancelled) return;
        setSnap({ state: "ok", path: fullPath, distanceMeters: totalMeters });
      } catch (err) {
        if (guard.cancelled) return;
        const msg = err instanceof Error ? err.message : "No se pudo ajustar a calles";
        setSnap({ state: "error", message: msg });
      }
    }

    return () => { guard.cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapEnabled, JSON.stringify(waypoints.map(w => ({ lat: w.lat, lng: w.lng })))]);

  const handleMapClick = readOnly
    ? undefined
    : (lat: number, lng: number) => {
        if (!onChange) return;
        const newWp: Waypoint = {
          order: waypoints.length,
          lat: Math.round(lat * 1e6) / 1e6,
          lng: Math.round(lng * 1e6) / 1e6,
        };
        onChange([...waypoints, newWp]);
      };

  const handleMarkerDragEnd = canDrag
    ? (idx: number, lat: number, lng: number) => {
        if (!onChange) return;
        onChange(
          waypoints.map((w, i) =>
            i === idx
              ? { ...w, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
              : w
          )
        );
      }
    : undefined;

  const deleteWaypoint = (idx: number) => {
    if (!onChange) return;
    onChange(waypoints.filter((_, i) => i !== idx).map((w, i) => ({ ...w, order: i })));
  };

  const moveWaypoint = (idx: number, dir: -1 | 1) => {
    if (!onChange) return;
    const next = [...waypoints];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next.map((w, i) => ({ ...w, order: i })));
  };

  const undoLast = () => {
    if (!onChange || waypoints.length === 0) return;
    onChange(waypoints.slice(0, -1).map((w, i) => ({ ...w, order: i })));
  };

  const updateLabel = (idx: number, label: string) => {
    if (!onChange) return;
    onChange(waypoints.map((w, i) => (i === idx ? { ...w, label: label || undefined } : w)));
  };

  const markers = waypoints.map((w, i) => {
    const isFirst = i === 0;
    const isLast = i === waypoints.length - 1 && waypoints.length > 1;
    return {
      lat: w.lat,
      lng: w.lng,
      title: isFirst ? `🅐 INICIO${w.label ? ` · ${w.label}` : ""}`
        : isLast ? `🅑 FIN${w.label ? ` · ${w.label}` : ""}`
        : `Parada ${i + 1}${w.label ? ` · ${w.label}` : ""}`,
      color: (isFirst ? "green" : isLast ? "red" : "gold") as "green" | "red" | "gold",
      label: isFirst ? "A" : isLast ? "B" : String(i + 1),
      draggable: canDrag,
    };
  });

  // Polilínea: si hay snap, usa el path de la malla vial (gruesa, INK9). Si no, recta INK9.
  const polylineDirect = waypoints.map((w) => ({ lat: w.lat, lng: w.lng }));
  const polylines: MapPolyline[] = useMemo(() => {
    if (snap.state === "ok") {
      return [
        // Recta sutil (referencia visual de los puntos)
        { path: polylineDirect, color: INK3, weight: 2, opacity: 0.5 },
        // Trazado real siguiendo calles (principal)
        { path: snap.path, color: INK9, weight: 5, opacity: 0.95 },
      ];
    }
    return [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, JSON.stringify(polylineDirect)]);

  const center =
    waypoints.length > 0
      ? {
          lat: waypoints.reduce((s, w) => s + w.lat, 0) / waypoints.length,
          lng: waypoints.reduce((s, w) => s + w.lng, 0) / waypoints.length,
        }
      : DEFAULT_CENTER;

  const zoom = waypoints.length > 1 ? 14 : waypoints.length === 1 ? 15 : 13;

  // Distancia total — directa siempre, real cuando hay snap OK.
  const directMeters = useMemo(() => {
    let sum = 0;
    for (let i = 1; i < waypoints.length; i++) {
      sum += haversine(waypoints[i - 1], waypoints[i]);
    }
    return sum;
  }, [waypoints]);

  const realMeters = snap.state === "ok" ? snap.distanceMeters : null;

  return (
    <div>
      {/* Toolbar arriba del mapa */}
      {!readOnly && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          padding: "8px 10px", marginBottom: 8,
          background: INK1, border: `1px solid ${INK2}`, borderRadius: 8,
        }}>
          <button
            type="button"
            onClick={() => setSnapEnabled(v => !v)}
            disabled={waypoints.length < 2}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 28, padding: "0 10px", borderRadius: 6,
              border: `1px solid ${snapEnabled ? INK9 : INK2}`,
              background: snapEnabled ? INK9 : "#fff",
              color: snapEnabled ? "#fff" : INK6,
              fontSize: "0.75rem", fontWeight: 700, fontFamily: "inherit",
              cursor: waypoints.length < 2 ? "not-allowed" : "pointer",
              opacity: waypoints.length < 2 ? 0.5 : 1,
              transition: "all 120ms",
            }}
            title={waypoints.length < 2 ? "Agrega al menos 2 puntos" : "Ajustar la línea para que siga las calles"}
          >
            {snap.state === "loading"
              ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} />
              : <RouteIcon size={12} />}
            {snapEnabled ? "Ajustar a calles: ON" : "Ajustar a calles"}
          </button>

          <span style={{ fontSize: "0.75rem", color: INK6, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <MapPin size={11} />Click para agregar punto
          </span>
          {canDrag && waypoints.length > 0 && (
            <span style={{ fontSize: "0.75rem", color: INK6, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Move size={11} />Arrastra los marcadores para reposicionar
            </span>
          )}

          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {waypoints.length > 0 && (
              <button
                type="button"
                onClick={undoLast}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  height: 26, padding: "0 9px", borderRadius: 6,
                  border: `1px solid ${INK2}`, background: "#fff", color: INK6,
                  fontSize: "0.6875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <Undo2 size={11} />Deshacer
              </button>
            )}
            {waypoints.length > 0 && (
              <button
                type="button"
                onClick={() => onChange?.([])}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  height: 26, padding: "0 9px", borderRadius: 6,
                  border: `1px solid ${INK2}`, background: "#fff", color: NO,
                  fontSize: "0.6875rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <RotateCcw size={11} />Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mapa */}
      <GoogleMapView
        center={center}
        zoom={zoom}
        markers={markers}
        polyline={snapEnabled && snap.state === "ok" ? [] : polylineDirect}
        polylineColor={INK9}
        polylines={polylines}
        height={height}
        onMapClick={handleMapClick}
        onMarkerDragEnd={handleMarkerDragEnd}
        style={{ borderRadius: 10 }}
      />

      {/* Stats / status del snap */}
      {!readOnly && waypoints.length > 0 && (
        <div style={{
          marginTop: 8, padding: "8px 10px", borderRadius: 8,
          background: snap.state === "ok" ? APTO_BG
            : snap.state === "error" ? RIESGO_BG
            : "#fff",
          border: `1px solid ${
            snap.state === "ok" ? APTO_BD
            : snap.state === "error" ? RIESGO_BD
            : INK2
          }`,
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          fontSize: "0.75rem",
        }}>
          {snap.state === "loading" && (
            <>
              <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite", color: INK5 }} />
              <span style={{ color: INK6 }}>Calculando recorrido por calles…</span>
            </>
          )}
          {snap.state === "ok" && (
            <>
              <CheckCircle size={12} color={APTO} />
              <span style={{ color: APTO, fontWeight: 700 }}>
                Trazado por calles: {formatKm(realMeters!)}
              </span>
              <span style={{ color: INK5 }}>· línea recta {formatKm(directMeters)}</span>
              <span style={{ marginLeft: "auto", color: INK6, fontWeight: 600 }}>
                {waypoints.length} {waypoints.length === 1 ? "punto" : "puntos"}
              </span>
            </>
          )}
          {snap.state === "error" && (
            <>
              <AlertTriangle size={12} color={RIESGO} />
              <span style={{ color: RIESGO, fontWeight: 600 }}>
                No se pudo ajustar a calles: {snap.message}
              </span>
              <button
                type="button"
                onClick={() => setSnapEnabled(false)}
                style={{
                  marginLeft: "auto", height: 22, padding: "0 8px", borderRadius: 5,
                  border: `1px solid ${INK2}`, background: "#fff", color: INK6,
                  fontSize: "0.6875rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Volver a línea recta
              </button>
            </>
          )}
          {snap.state === "idle" && (
            <>
              <MapPin size={12} color={INK5} />
              <span style={{ color: INK6, fontWeight: 600 }}>
                Línea recta: {formatKm(directMeters)}
              </span>
              <span style={{ marginLeft: "auto", color: INK5 }}>
                {waypoints.length} {waypoints.length === 1 ? "punto" : "puntos"}
                {waypoints.length >= 2 && " · activa “Ajustar a calles” para evitar que la línea cruce casas"}
              </span>
            </>
          )}
        </div>
      )}

      {/* Lista de puntos */}
      {waypoints.length > 0 && (
        <div style={{
          marginTop: 10, maxHeight: 260, overflowY: "auto",
          border: `1px solid ${INK2}`, borderRadius: 8,
        }}>
          {waypoints.map((w, i) => {
            const isFirst = i === 0;
            const isLast = i === waypoints.length - 1 && waypoints.length > 1;
            const dotColor = isFirst ? APTO : isLast ? NO : INK9;
            const tag = isFirst ? "INICIO" : isLast ? "FIN" : `#${i + 1}`;
            return (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                  borderBottom: i < waypoints.length - 1 ? `1px solid ${INK1}` : "none",
                  background: i % 2 === 0 ? "#fafafa" : "#fff",
                }}
              >
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  minWidth: isFirst || isLast ? 56 : 28, height: 22,
                  padding: "0 7px", borderRadius: 4,
                  background: dotColor, color: "#fff",
                  fontSize: "0.625rem", fontWeight: 800, letterSpacing: "0.06em",
                  flexShrink: 0,
                }}>
                  {tag}
                </span>
                <span style={{
                  fontSize: "0.6875rem", color: INK5,
                  fontFamily: "ui-monospace,monospace", flexShrink: 0,
                }}>
                  {w.lat.toFixed(5)}, {w.lng.toFixed(5)}
                </span>
                {!readOnly ? (
                  <>
                    <input
                      type="text"
                      placeholder="Etiqueta (opcional)"
                      value={w.label ?? ""}
                      onChange={(e) => updateLabel(i, e.target.value)}
                      style={{
                        flex: 1, fontSize: "0.75rem", padding: "3px 8px",
                        border: `1px solid ${INK2}`, borderRadius: 4,
                        minWidth: 0, fontFamily: "inherit", color: INK9, outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => moveWaypoint(i, -1)}
                      disabled={i === 0}
                      title="Mover arriba" aria-label="Mover arriba"
                      style={{
                        background: "none", border: "none", cursor: i === 0 ? "not-allowed" : "pointer",
                        padding: 3, color: i === 0 ? INK2 : INK5, flexShrink: 0,
                      }}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveWaypoint(i, 1)}
                      disabled={i === waypoints.length - 1}
                      title="Mover abajo" aria-label="Mover abajo"
                      style={{
                        background: "none", border: "none",
                        cursor: i === waypoints.length - 1 ? "not-allowed" : "pointer",
                        padding: 3, color: i === waypoints.length - 1 ? INK2 : INK5, flexShrink: 0,
                      }}
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteWaypoint(i)}
                      title="Eliminar punto" aria-label="Eliminar punto"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        padding: 3, color: INK5, flexShrink: 0,
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                ) : (
                  w.label && (
                    <span style={{
                      fontSize: "0.75rem", color: INK6, fontStyle: "italic", flex: 1,
                    }}>
                      {w.label}
                    </span>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {waypoints.length === 0 && readOnly && (
        <div style={{
          marginTop: 8, padding: "16px 12px", textAlign: "center",
          fontSize: "0.8125rem", color: INK5,
          background: INK1, border: `1px solid ${INK2}`, borderRadius: 8,
        }}>
          Sin trazado de ruta registrado
        </div>
      )}
    </div>
  );
}
