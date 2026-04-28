"use client";

import { Trash2, MapPin, RotateCcw } from "lucide-react";
import { GoogleMapView } from "./GoogleMapView";

export type Waypoint = { order: number; lat: number; lng: number; label?: string };

interface WaypointsEditorProps {
  waypoints: Waypoint[];
  onChange?: (waypoints: Waypoint[]) => void;
  height?: number;
  readOnly?: boolean;
}

const DEFAULT_CENTER = { lat: -13.5178, lng: -71.9785 }; // Cusco

export function WaypointsEditor({
  waypoints,
  onChange,
  height = 320,
  readOnly = false,
}: WaypointsEditorProps) {
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

  const deleteWaypoint = (idx: number) => {
    if (!onChange) return;
    onChange(waypoints.filter((_, i) => i !== idx).map((w, i) => ({ ...w, order: i })));
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

  return (
    <div>
      <GoogleMapView
        center={center}
        zoom={zoom}
        markers={markers}
        polyline={polyline}
        height={height}
        onMapClick={handleMapClick}
        style={{ borderRadius: 10 }}
      />

      {!readOnly && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <p style={{ fontSize: "0.75rem", color: "#71717a", margin: 0 }}>
            <MapPin size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
            Haz clic en el mapa para agregar paradas
            {waypoints.length > 0 && ` · ${waypoints.length} agregada${waypoints.length !== 1 ? "s" : ""}`}
          </p>
          {waypoints.length > 0 && (
            <button
              type="button"
              onClick={() => onChange?.([]) }
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}
            >
              <RotateCcw size={11} />
              Limpiar todo
            </button>
          )}
        </div>
      )}

      {waypoints.length > 0 && (
        <div style={{ marginTop: 10, maxHeight: 220, overflowY: "auto", border: "1px solid #e4e4e7", borderRadius: 8 }}>
          {waypoints.map((w, i) => {
            const dotColor = i === 0 ? "#15803d" : i === waypoints.length - 1 && waypoints.length > 1 ? "#DC2626" : "#6C0606";
            const dotLabel = i === 0 ? "A" : i === waypoints.length - 1 && waypoints.length > 1 ? "B" : String(i + 1);
            return (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                  borderBottom: i < waypoints.length - 1 ? "1px solid #f4f4f5" : "none",
                  background: i % 2 === 0 ? "#fafafa" : "#fff",
                }}
              >
                <span
                  style={{
                    width: 22, height: 22, borderRadius: "50%", background: dotColor, color: "#fff",
                    fontSize: "0.6875rem", fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                >
                  {dotLabel}
                </span>
                <span style={{ fontSize: "0.6875rem", color: "#71717a", fontFamily: "ui-monospace,monospace", flexShrink: 0 }}>
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
                        flex: 1, fontSize: "0.75rem", padding: "2px 8px",
                        border: "1px solid #e4e4e7", borderRadius: 4, minWidth: 0, fontFamily: "inherit",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => deleteWaypoint(i)}
                      title="Eliminar parada"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#a1a1aa", flexShrink: 0 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                ) : (
                  w.label && (
                    <span style={{ fontSize: "0.75rem", color: "#52525b", fontStyle: "italic", flex: 1 }}>
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
        <div style={{ marginTop: 8, textAlign: "center", fontSize: "0.8125rem", color: "#a1a1aa" }}>
          Sin trazado de ruta registrado
        </div>
      )}
    </div>
  );
}
