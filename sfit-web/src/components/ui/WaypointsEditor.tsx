"use client";

import { useMemo } from "react";
import { Trash2, MapPin, RotateCcw, Undo2, ArrowUp, ArrowDown, Move } from "lucide-react";
import { GoogleMapView } from "./GoogleMapView";

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

const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const APTO = "#15803d"; const NO = "#DC2626";

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

export function WaypointsEditor({
  waypoints,
  onChange,
  height = 360,
  readOnly = false,
  draggable = true,
}: WaypointsEditorProps) {
  const canDrag = !readOnly && draggable && !!onChange;

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

  const markers = waypoints.map((w, i) => ({
    lat: w.lat,
    lng: w.lng,
    title: w.label ?? `Parada ${i + 1}`,
    color: (i === 0 ? "green" : i === waypoints.length - 1 && waypoints.length > 1 ? "red" : "gold") as "green" | "red" | "gold",
    label: String(i + 1),
    draggable: canDrag,
  }));

  const polyline = waypoints.map((w) => ({ lat: w.lat, lng: w.lng }));

  const center =
    waypoints.length > 0
      ? {
          lat: waypoints.reduce((s, w) => s + w.lat, 0) / waypoints.length,
          lng: waypoints.reduce((s, w) => s + w.lng, 0) / waypoints.length,
        }
      : DEFAULT_CENTER;

  const zoom = waypoints.length > 1 ? 14 : waypoints.length === 1 ? 15 : 13;

  // Distancia total del trazado
  const totalMeters = useMemo(() => {
    let sum = 0;
    for (let i = 1; i < waypoints.length; i++) {
      sum += haversine(waypoints[i - 1], waypoints[i]);
    }
    return sum;
  }, [waypoints]);

  return (
    <div>
      <GoogleMapView
        center={center}
        zoom={zoom}
        markers={markers}
        polyline={polyline}
        polylineColor={INK9}
        height={height}
        onMapClick={handleMapClick}
        onMarkerDragEnd={handleMarkerDragEnd}
        style={{ borderRadius: 10 }}
      />

      {!readOnly && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 8, gap: 8, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.75rem", color: INK6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <MapPin size={11} />
              Click para agregar
            </span>
            {canDrag && waypoints.length > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Move size={11} />
                Arrastra los puntos para ajustar
              </span>
            )}
            {waypoints.length > 1 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600, color: INK9 }}>
                · Trazado: {formatKm(totalMeters)}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
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
                <Undo2 size={11} />
                Deshacer
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
                <RotateCcw size={11} />
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {waypoints.length > 0 && (
        <div style={{
          marginTop: 10, maxHeight: 240, overflowY: "auto",
          border: `1px solid ${INK2}`, borderRadius: 8,
        }}>
          {waypoints.map((w, i) => {
            const isFirst = i === 0;
            const isLast = i === waypoints.length - 1 && waypoints.length > 1;
            const dotColor = isFirst ? APTO : isLast ? NO : INK9;
            const dotLabel = isFirst ? "A" : isLast ? "B" : String(i + 1);
            return (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                  borderBottom: i < waypoints.length - 1 ? `1px solid ${INK1}` : "none",
                  background: i % 2 === 0 ? "#fafafa" : "#fff",
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: dotColor, color: "#fff",
                  fontSize: "0.625rem", fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {dotLabel}
                </span>
                <span style={{
                  fontSize: "0.6875rem", color: INK5,
                  fontFamily: "ui-monospace,monospace", flexShrink: 0, minWidth: 130,
                }}>
                  {w.lat.toFixed(5)}, {w.lng.toFixed(5)}
                </span>
                {!readOnly ? (
                  <>
                    <input
                      type="text"
                      placeholder="Nombre de parada (opcional)"
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
                      title="Mover arriba"
                      aria-label="Mover arriba"
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
                      title="Mover abajo"
                      aria-label="Mover abajo"
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
                      title="Eliminar parada"
                      aria-label="Eliminar parada"
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
