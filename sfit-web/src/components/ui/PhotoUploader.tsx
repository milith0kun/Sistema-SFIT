"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { ImageUp, Loader2, Trash2, AlertTriangle } from "lucide-react";

/**
 * Uploader de UNA foto referencial (conductor, vehículo, usuario).
 *
 * Consume `POST /api/uploads/photos` con `category` y devuelve una URL
 * absoluta del servidor (ver `src/app/api/uploads/photos/route.ts`).
 *
 * Patrón equivalente a `ManifestUploader` pero single-photo y con
 * preview cuadrada que sirve para avatares (driver/user) y para
 * portadas rectangulares 4:3 (vehículo).
 *
 * Uso típico:
 *   <PhotoUploader
 *     category="driver"
 *     value={driver.photoUrl}
 *     onChange={(url) => setPhotoUrl(url)}
 *     aspect="square"
 *   />
 */
export function PhotoUploader({
  category,
  value,
  onChange,
  aspect = "square",
  label = "Foto referencial",
  disabled = false,
}: {
  category: "driver" | "vehicle" | "user";
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  aspect?: "square" | "wide";
  label?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError("Imagen demasiado grande (máx 10 MB).");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("category", category);
      const token = typeof window !== "undefined" ? localStorage.getItem("sfit_access_token") : null;
      const res = await fetch("/api/uploads/photos", {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? "Error al subir la foto");
      }
      onChange(String(data.data?.url ?? ""));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }, [category, onChange]);

  const onPick = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  function onRemove() {
    if (disabled) return;
    if (!confirm("¿Quitar la foto?")) return;
    onChange(null);
  }

  const isWide = aspect === "wide";
  const previewWidth = isWide ? 240 : 140;
  const previewHeight = isWide ? 180 : 140;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#71717a" }}>
        {label}
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        {value ? (
          <div style={{
            position: "relative",
            width: previewWidth, height: previewHeight,
            borderRadius: 10, overflow: "hidden",
            border: "1.5px solid #e4e4e7", background: "#fafafa",
          }}>
            <Image
              src={value}
              alt={label}
              width={previewWidth}
              height={previewHeight}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              unoptimized
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={onPick}
            disabled={disabled || uploading}
            style={{
              width: previewWidth, height: previewHeight,
              borderRadius: 10,
              border: "1.5px dashed #d4d4d8",
              background: "#fafafa",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 6, cursor: disabled || uploading ? "not-allowed" : "pointer",
              color: "#71717a", fontFamily: "inherit", fontSize: "0.8125rem", fontWeight: 600,
              padding: 8,
            }}
          >
            {uploading ? (
              <>
                <Loader2 size={18} style={{ animation: "spin 0.7s linear infinite" }} />
                <span>Subiendo…</span>
              </>
            ) : (
              <>
                <ImageUp size={22} />
                <span>Subir foto</span>
                <span style={{ fontSize: "0.6875rem", fontWeight: 500, color: "#a1a1aa" }}>
                  JPG / PNG / WEBP · máx 10 MB
                </span>
              </>
            )}
          </button>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {value && (
            <>
              <button
                type="button"
                onClick={onPick}
                disabled={disabled || uploading}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  height: 32, padding: "0 12px", borderRadius: 7,
                  border: "1.5px solid #e4e4e7", background: "#fff", color: "#52525b",
                  fontSize: "0.8125rem", fontWeight: 600,
                  cursor: disabled || uploading ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {uploading ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} /> : <ImageUp size={12} />}
                Reemplazar
              </button>
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled || uploading}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  height: 32, padding: "0 12px", borderRadius: 7,
                  border: "1.5px solid #FCA5A5", background: "#FFF5F5", color: "#DC2626",
                  fontSize: "0.8125rem", fontWeight: 600,
                  cursor: disabled || uploading ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                <Trash2 size={12} /> Quitar
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 6,
          background: "#FFF5F5", color: "#DC2626",
          border: "1px solid #FCA5A5",
          fontSize: "0.75rem", fontWeight: 500,
        }}>
          <AlertTriangle size={11} /> {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          // permitir re-elegir el mismo archivo
          e.target.value = "";
        }}
      />
    </div>
  );
}
