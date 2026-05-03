"use client";

import { useEffect, useRef } from "react";

type LatLng = { lat: number; lng: number };
type MapMarker = {
  lat: number; lng: number;
  label?: string; title?: string;
  color?: "gold" | "red" | "green" | "blue";
  /** Permite arrastrar el marcador. Cuando termina el drag se llama onMarkerDragEnd con su índice. */
  draggable?: boolean;
};

/**
 * Una polilínea adicional con su propio estilo. Permite renderizar varias líneas
 * (ej. trazado planeado vs. trazado real) sobre el mismo mapa.
 */
export type MapPolyline = {
  path: LatLng[];
  color?: string;
  weight?: number;
  opacity?: number;
};

interface Props {
  center?: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  polyline?: LatLng[];
  /** Color del trazo de la polilínea principal. Default: negro institucional INK9. */
  polylineColor?: string;
  /**
   * Polilíneas adicionales independientes de `polyline`. Cada una con su color,
   * peso y opacidad propios. Útil para superponer trazado real vs. ruta planeada.
   */
  polylines?: MapPolyline[];
  height?: number | string;
  style?: React.CSSProperties;
  className?: string;
  apiKey?: string;
  onMapClick?: (lat: number, lng: number) => void;
  /** Callback cuando el usuario suelta un marcador draggable. */
  onMarkerDragEnd?: (index: number, lat: number, lng: number) => void;
  /**
   * Modo de visualización. `"2d"` (default) usa roadmap plano. `"3d"` activa
   * mapType `hybrid` con tilt 67.5° (aerial 45°+) y muestra edificios 3D
   * en zonas con cobertura. Toggle nativo de Google Maps, sin libs extra.
   */
  view?: "2d" | "3d";
}

const DEFAULT_CENTER: LatLng = { lat: -13.5178, lng: -71.9785 }; // Cusco

let _mapsLoaded = false;
let _mapsLoading: Promise<void> | null = null;

/**
 * Carga el script de Google Maps y espera a que la clase `Map` esté lista.
 *
 * Con `loading=async`, el `script.onload` puede dispararse antes de que las
 * librerías internas estén disponibles. Por eso después del onload usamos
 * `importLibrary("maps")` cuando existe, o un poll de respaldo, para resolver
 * sólo cuando `google.maps.Map` ya se puede instanciar. Esto elimina el bug
 * intermitente de "a veces carga el mapa, a veces no".
 */
function loadMapsApi(key: string): Promise<void> {
  if (_mapsLoaded) return Promise.resolve();
  if (_mapsLoading) return _mapsLoading;

  _mapsLoading = (async () => {
    if (typeof window === "undefined") throw new Error("SSR");
    const w = window as unknown as { google?: typeof google };

    // Si ya está cargado por otra ruta o HMR, no volver a inyectar el script.
    if (!w.google?.maps) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry&loading=async&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Error al cargar Google Maps"));
        document.head.appendChild(script);
      });
    }

    // Esperar a que las librerías internas estén listas.
    // 1) Si la API expone `importLibrary` (loading=async), úsala.
    const importLibrary = (w.google?.maps as { importLibrary?: (n: string) => Promise<unknown> } | undefined)?.importLibrary;
    if (importLibrary) {
      await importLibrary("maps");
      // `geometry` ya viene en el query string, pero forzamos su carga por si llega tarde.
      try { await importLibrary("geometry"); } catch { /* opcional */ }
      // `routes` habilita DirectionsService (snap a calles en el editor de rutas).
      try { await importLibrary("routes"); } catch { /* opcional, fallback usa core */ }
    }

    // 2) Poll de respaldo (50 intentos × 50ms = 2.5s máx) por si la api antigua
    //    aún no ha expuesto `Map` justo después del onload.
    for (let i = 0; i < 50 && !w.google?.maps?.Map; i++) {
      await new Promise(r => setTimeout(r, 50));
    }
    if (!w.google?.maps?.Map) {
      // Si después de 2.5s aún no hay Map, marcamos el loader como fallido para
      // que un nuevo intento pueda reintentarlo en lugar de devolver una promesa vieja.
      _mapsLoading = null;
      throw new Error("Google Maps no terminó de cargar a tiempo.");
    }

    _mapsLoaded = true;
  })();

  // Si la promesa se rechaza, limpiamos el cache para permitir reintentos.
  _mapsLoading.catch(() => { _mapsLoading = null; });

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
  polylineColor = "#18181b",
  polylines = [],
  height = 280,
  style,
  className,
  apiKey,
  onMapClick,
  onMarkerDragEnd,
  view = "2d",
}: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onMarkerDragEndRef = useRef(onMarkerDragEnd);
  onMarkerDragEndRef.current = onMarkerDragEnd;
  const key = apiKey ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
  const noKey = !key;

  useEffect(() => {
    if (!divRef.current || noKey) return;
    let active = true;

    void loadMapsApi(key).then(() => {
      if (!active || !divRef.current) return;
      const g = (window as unknown as { google: typeof google }).google;

      // Estilos solo aplican a mapTypeId roadmap; en hybrid los POIs van con el satélite.
      const baseOptions: google.maps.MapOptions = view === "3d"
        ? {
            center,
            zoom,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: true,
            mapTypeId: g.maps.MapTypeId.HYBRID,
            tilt: 67.5,
            heading: 0,
            draggableCursor: onMapClickRef.current ? "crosshair" : undefined,
          }
        : {
            center,
            zoom,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: true,
            mapTypeId: g.maps.MapTypeId.ROADMAP,
            tilt: 0,
            draggableCursor: onMapClickRef.current ? "crosshair" : undefined,
            styles: [
              { featureType: "poi", stylers: [{ visibility: "off" }] },
              { featureType: "transit", stylers: [{ visibility: "off" }] },
            ],
          };

      if (!mapRef.current) {
        mapRef.current = new g.maps.Map(divRef.current, baseOptions);

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
        mapRef.current.setOptions(baseOptions);
        // setMapTypeId / setTilt explícitos para forzar el cambio en re-render.
        mapRef.current.setMapTypeId(view === "3d" ? g.maps.MapTypeId.HYBRID : g.maps.MapTypeId.ROADMAP);
        mapRef.current.setTilt(view === "3d" ? 67.5 : 0);
      }

      // Clear existing markers
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];

      markers.forEach((m, idx) => {
        const marker = new g.maps.Marker({
          position: { lat: m.lat, lng: m.lng },
          map: mapRef.current!,
          title: m.title,
          icon: MARKER_COLORS[m.color ?? "gold"],
          label: m.label ? { text: m.label, color: "#fff", fontWeight: "bold", fontSize: "11px" } : undefined,
          draggable: !!m.draggable,
          cursor: m.draggable ? "grab" : undefined,
        });
        if (m.draggable) {
          marker.addListener("dragend", (e: google.maps.MapMouseEvent) => {
            if (e.latLng && onMarkerDragEndRef.current) {
              onMarkerDragEndRef.current(idx, e.latLng.lat(), e.latLng.lng());
            }
          });
        }
        markersRef.current.push(marker);
      });

      // Clear existing polyline
      polylineRef.current?.setMap(null);
      if (polyline.length > 1) {
        polylineRef.current = new g.maps.Polyline({
          path: polyline,
          geodesic: true,
          strokeColor: polylineColor,
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map: mapRef.current,
        });
      }

      // Clear existing extra polylines
      polylinesRef.current.forEach(p => p.setMap(null));
      polylinesRef.current = [];

      polylines.forEach(p => {
        if (p.path.length > 1) {
          const pl = new g.maps.Polyline({
            path: p.path,
            geodesic: true,
            strokeColor: p.color ?? "#18181b",
            strokeOpacity: p.opacity ?? 0.9,
            strokeWeight: p.weight ?? 4,
            map: mapRef.current,
          });
          polylinesRef.current.push(pl);
        }
      });
    }).catch(() => { /* API key faltante o sin internet */ });

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, zoom, JSON.stringify(markers), JSON.stringify(polyline), JSON.stringify(polylines), key, view]);

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
