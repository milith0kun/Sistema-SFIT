"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { MapPin } from "lucide-react";

/**
 * Autocomplete de direcciones con Google Places (New).
 *
 * Reusa la API key client-side ya configurada (`NEXT_PUBLIC_GOOGLE_MAPS_KEY`).
 * Restringido a Perú. Cuando el usuario selecciona una sugerencia, llama a
 * `onSelect` con la dirección formateada y las coordenadas lat/lng.
 *
 * @example
 * <AddressAutocomplete
 *   value={form.address}
 *   onChange={v => setForm({...form, address: v})}
 *   onSelect={({ formatted, lat, lng }) => {
 *     setForm({ ...form, address: formatted, lat, lng });
 *   }}
 * />
 */

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

export interface PlaceResult {
  formatted: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}

// Tipos mínimos de la lib de Google Maps Places clásica.
// Usamos la API legacy `google.maps.places.Autocomplete` (estable, gratis con key).
interface GooglePlace {
  formatted_address?: string;
  name?: string;
  geometry?: {
    location?: { lat: () => number; lng: () => number };
  };
  place_id?: string;
}
interface GoogleAutocomplete {
  addListener: (event: string, cb: () => void) => void;
  getPlace: () => GooglePlace;
  setComponentRestrictions: (r: { country: string[] }) => void;
}
// Tipos duck-typed para no colisionar con la declaración global de Window.google
// que el login usa con otra forma (Sign-In). Accedemos a `google.maps.places`
// con un cast acotado en runtime.
interface GoogleMapsPlacesLib {
  Autocomplete: new (
    input: HTMLInputElement,
    options: { fields: string[]; componentRestrictions?: { country: string[] } },
  ) => GoogleAutocomplete;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (place: PlaceResult) => void;
  placeholder?: string;
  disabled?: boolean;
  /** className aplicada al input — usar para alinear estilos con el resto del form */
  className?: string;
  style?: React.CSSProperties;
  /** Países permitidos en formato ISO. Default: Perú */
  countries?: string[];
  /**
   * Cuando es true, no inyecta su propio <Script> de Google Maps y en su lugar
   * espera (polling) a que la librería `places` ya esté cargada por otro
   * componente (ej. GoogleMapView). Útil cuando ambos conviven en la misma
   * página para evitar doble carga del script.
   */
  skipScript?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Empieza a tipear una dirección…",
  disabled,
  className,
  style,
  countries = ["pe"],
  skipScript = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<GoogleAutocomplete | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  // Modo skipScript: espera a que google.maps.places esté disponible vía otro
  // componente (GoogleMapView). Polling cada 200ms, máximo 50 intentos (~10s).
  useEffect(() => {
    if (!skipScript || scriptReady) return;
    let attempts = 0;
    const id = setInterval(() => {
      attempts++;
      const win = window as unknown as { google?: { maps?: { places?: unknown } } };
      if (win.google?.maps?.places) {
        setScriptReady(true);
        clearInterval(id);
      } else if (attempts >= 50) {
        clearInterval(id);
      }
    }, 200);
    return () => clearInterval(id);
  }, [skipScript, scriptReady]);

  // Inicializar Autocomplete cuando el script esté ready y el input montado
  useEffect(() => {
    if (!scriptReady) return;
    if (!inputRef.current) return;
    if (acRef.current) return;  // ya inicializado

    // Acceso duck-typed a google.maps.places — la declaración global de
    // Window.google la usa el login para Sign-In con otra forma.
    const win = window as unknown as { google?: { maps?: { places?: GoogleMapsPlacesLib } } };
    const places = win.google?.maps?.places;
    if (!places) return;

    const ac = new places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry", "name", "place_id"],
      componentRestrictions: { country: countries },
    });

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const formatted = place.formatted_address ?? place.name ?? inputRef.current?.value ?? "";
      const lat = place.geometry?.location?.lat();
      const lng = place.geometry?.location?.lng();
      onChange(formatted);
      onSelect?.({
        formatted,
        lat,
        lng,
        placeId: place.place_id,
      });
    });

    acRef.current = ac;
  }, [scriptReady, countries, onChange, onSelect]);

  // Si la key no está configurada, fallback a un input normal
  if (!KEY) {
    return (
      <div style={{ position: "relative", ...style }}>
        <MapPin
          size={15}
          style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          color="#71717A"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          style={{
            paddingLeft: 38, width: "100%", height: 36,
            border: "1px solid #d4d4d8", borderRadius: 6,
            background: "#fff", fontSize: "0.8125rem",
            outline: "none", color: "#18181b", fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
      </div>
    );
  }

  return (
    <>
      {!skipScript && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places&loading=async`}
          strategy="afterInteractive"
          onLoad={() => setScriptReady(true)}
          onReady={() => setScriptReady(true)}
        />
      )}
      <div style={{ position: "relative", ...style }}>
        <MapPin
          size={15}
          style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", zIndex: 1 }}
          color="#71717A"
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          autoComplete="off"
          style={{
            paddingLeft: 38, width: "100%", height: 36,
            border: "1px solid #d4d4d8", borderRadius: 6,
            background: "#fff", fontSize: "0.8125rem",
            outline: "none", color: "#18181b", fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
      </div>
    </>
  );
}
