"use client";

import { useEffect, useRef } from "react";

type LatLng = { lat: number; lng: number };
type MapMarker = { lat: number; lng: number; label?: string; title?: string; color?: "gold" | "red" | "green" | "blue" };

interface Props {
  center?: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  polyline?: LatLng[];
  height?: number | string;
  style?: React.CSSProperties;
  className?: string;
  apiKey?: string;
  onMapClick?: (lat: number, lng: number) => void;
}

const DEFAULT_CENTER: LatLng = { lat: -13.5178, lng: -71.9785 }; // Cusco

let _mapsLoaded = false;
let _mapsLoading: Promise<void> | null = null;

function loadMapsApi(key: string): Promise<void> {
  if (_mapsLoaded) return Promise.resolve();
  if (_mapsLoading) return _mapsLoading;
  _mapsLoading = new Promise((resolve, reject) => {
    if (typeof window === "undefined") { reject(new Error("SSR")); return; }
    if ((window as unknown as Record<string, unknown>).google) { _mapsLoaded = true; resolve(); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => { _mapsLoaded = true; resolve(); };
    script.onerror = () => reject(new Error("Error al cargar Google Maps"));
    document.head.appendChild(script);
  });
  return _mapsLoading;
}

// "gold" se mantiene como nombre de variante por compatibilidad,
// pero ahora apunta al marcador rojo del primary institucional.
const MARKER_COLORS: Record<string, string> = {
  gold: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
  red: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
  green: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
  blue: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
};

export function GoogleMapView({
  center = DEFAULT_CENTER,
  zoom = 13,
  markers = [],
  polyline = [],
  height = 280,
  style,
  className,
  apiKey,
  onMapClick,
}: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const key = apiKey ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
  const noKey = !key;

  useEffect(() => {
    if (!divRef.current || noKey) return;
    let active = true;

    void loadMapsApi(key).then(() => {
      if (!active || !divRef.current) return;
      const g = (window as unknown as { google: typeof google }).google;

      if (!mapRef.current) {
        mapRef.current = new g.maps.Map(divRef.current, {
          center,
          zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          draggableCursor: onMapClickRef.current ? "crosshair" : undefined,
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });

        // Click listener — uses ref so always calls latest handler
        clickListenerRef.current = mapRef.current.addListener(
          "click",
          (e: google.maps.MapMouseEvent) => {
            if (e.latLng && onMapClickRef.current) {
              onMapClickRef.current(e.latLng.lat(), e.latLng.lng());
            }
          },
        );
      } else {
        mapRef.current.setCenter(center);
        mapRef.current.setZoom(zoom);
        mapRef.current.setOptions({ draggableCursor: onMapClickRef.current ? "crosshair" : undefined });
      }

      // Clear existing markers
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];

      markers.forEach(m => {
        const marker = new g.maps.Marker({
          position: { lat: m.lat, lng: m.lng },
          map: mapRef.current!,
          title: m.title,
          icon: MARKER_COLORS[m.color ?? "gold"],
          label: m.label ? { text: m.label, color: "#fff", fontWeight: "bold", fontSize: "11px" } : undefined,
        });
        markersRef.current.push(marker);
      });

      // Clear existing polyline
      polylineRef.current?.setMap(null);
      if (polyline.length > 1) {
        polylineRef.current = new g.maps.Polyline({
          path: polyline,
          geodesic: true,
          strokeColor: "#6C0606",
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map: mapRef.current,
        });
      }
    }).catch(() => { /* API key faltante o sin internet */ });

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, zoom, JSON.stringify(markers), JSON.stringify(polyline), key]);

  if (noKey) {
    return (
      <div style={{ height, borderRadius: 14, background: "#f4f4f5", border: "1px solid #e4e4e7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, ...style }} className={className}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        <span style={{ fontSize: "0.8125rem", color: "#71717a", fontWeight: 500 }}>Configura NEXT_PUBLIC_GOOGLE_MAPS_KEY</span>
      </div>
    );
  }

  return (
    <div
      ref={divRef}
      style={{ height, borderRadius: 14, overflow: "hidden", ...style }}
      className={className}
    />
  );
}
