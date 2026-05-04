"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, Image as ImageIcon, X, Loader2, ZoomIn, ZoomOut, Trash2,
  AlertCircle, FileImage,
} from "lucide-react";

/**
 * ManifestUploader — sube/visualiza fotos de manifiestos firmados de un viaje.
 *
 * Backend (Track A):
 *  - POST   /api/viajes/[id]/manifest-photo  (multipart, key "file")
 *    -> 201 { success, data: { url, id, manifestPhotoUrls } }
 *  - DELETE /api/viajes/[id]/manifest-photo?url=...
 *
 * El componente acepta el listado actual via props y avisa cambios al padre
 * con `onChange`. La subida y eliminación se hacen aquí (incluyendo auth con
 * el token guardado en localStorage).
 */
interface ManifestUploaderProps {
  tripId: string;
  photos: string[];
  onChange: (photos: string[]) => void;
  /** Permite ocultar las acciones para vistas read-only. */
  editable?: boolean;
}

const INK1 = "#f4f4f5"; const INK2 = "#e4e4e7";
const INK5 = "#71717a"; const INK6 = "#52525b"; const INK9 = "#18181b";
const RED = "#DC2626"; const RED_BG = "#FFF5F5"; const RED_BD = "#FCA5A5";

const ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB hard limit antes de pedir compresión

export function ManifestUploader({
  tripId, photos, onChange, editable = true,
}: ManifestUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  /** Comprime client-side si el archivo > 2 MB. Devuelve un Blob jpeg. */
  const compressIfLarge = useCallback(async (file: File): Promise<Blob> => {
    if (file.size <= 2 * 1024 * 1024) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const maxDim = 1800;
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const blob: Blob | null = await new Promise(resolve =>
        canvas.toBlob(b => resolve(b), "image/jpeg", 0.85),
      );
      return blob ?? file;
    } catch {
      return file;
    }
  }, []);

  const uploadOne = useCallback(async (file: File) => {
    if (!ACCEPT.split(",").includes(file.type)) {
      throw new Error(`Formato no soportado: ${file.type}`);
    }
    if (file.size > MAX_BYTES) {
      throw new Error("Archivo demasiado grande (máx 10 MB).");
    }
    const blob = await compressIfLarge(file);
    const fd = new FormData();
    const finalName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    // Backend espera key "file" (no "photo"). El upload se reescribe a webp
    // server-side con sharp y devuelve { url, id, manifestPhotoUrls }.
    fd.append("file", blob, finalName);
    const token = typeof window !== "undefined" ? localStorage.getItem("sfit_access_token") : null;
    const res = await fetch(`/api/viajes/${tripId}/manifest-photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token ?? ""}` },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(data?.error ?? "Error al subir foto");
    }
    return String(data.data?.url ?? "");
  }, [tripId, compressIfLarge]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    const ok: string[] = [];
    const errs: string[] = [];
    for (const f of list) {
      try {
        const url = await uploadOne(f);
        if (url) ok.push(url);
      } catch (e) {
        errs.push(`${f.name}: ${(e as Error).message}`);
      }
    }
    setUploading(false);
    if (ok.length > 0) onChange([...photos, ...ok]);
    if (errs.length > 0) setError(errs.join(" · "));
  }, [photos, onChange, uploadOne]);

  async function handleDelete(url: string) {
    if (!confirm("¿Eliminar esta foto del manifiesto?")) return;
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("sfit_access_token") : null;
      const res = await fetch(`/api/viajes/${tripId}/manifest-photo?url=${encodeURIComponent(url)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? "Error al eliminar foto");
      }
      onChange(photos.filter(p => p !== url));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Cierra el modal de zoom con Esc
  useEffect(() => {
    if (!zoomUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomUrl]);

  return (
    <div style={{
      background: "#fff", border: `1px solid ${INK2}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 16px", borderBottom: `1px solid ${INK1}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: INK1, border: `1px solid ${INK2}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <FileImage size={14} color={INK6} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: INK9, lineHeight: 1.25 }}>
            Manifiesto firmado
          </div>
          <div style={{ fontSize: "0.75rem", color: INK5, lineHeight: 1.3, marginTop: 1 }}>
            {photos.length === 0
              ? "Aún no subes fotos del manifiesto."
              : `${photos.length} ${photos.length === 1 ? "foto" : "fotos"} adjuntas`}
          </div>
        </div>
      </div>

      {/* Drop area */}
      {editable && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
          }}
          style={{
            margin: "12px 16px",
            padding: "20px 16px",
            border: `2px dashed ${dragOver ? INK9 : INK2}`,
            borderRadius: 10,
            background: dragOver ? INK1 : "#fff",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            textAlign: "center", cursor: "pointer",
            transition: "border-color 150ms, background 150ms",
          }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef} type="file" accept={ACCEPT} multiple
            onChange={e => e.target.files && handleFiles(e.target.files)}
            style={{ display: "none" }}
          />
          {uploading ? (
            <Loader2 size={20} color={INK6} style={{ animation: "spin 0.7s linear infinite" }} />
          ) : (
            <Upload size={20} color={INK6} />
          )}
          <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: INK9 }}>
            {uploading ? "Subiendo…" : "Arrastra fotos aquí o click para seleccionar"}
          </div>
          <div style={{ fontSize: "0.6875rem", color: INK5 }}>
            PNG, JPG o WEBP · Máx. 10 MB · Se comprime a 2 MB automáticamente
          </div>
        </div>
      )}

      {error && (
        <div style={{
          margin: "0 16px 12px",
          padding: "8px 12px", background: RED_BG, border: `1px solid ${RED_BD}`,
          borderRadius: 8, color: RED, fontSize: "0.75rem", fontWeight: 500,
          display: "flex", alignItems: "flex-start", gap: 6,
        }}>
          <AlertCircle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ flex: 1, wordBreak: "break-word" }}>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{
              background: "transparent", border: "none", color: RED,
              cursor: "pointer", padding: 0, lineHeight: 0,
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Grid de fotos */}
      {photos.length === 0 ? (
        <div style={{
          padding: "20px 16px 24px", textAlign: "center", color: INK5,
          fontSize: "0.8125rem",
        }}>
          <ImageIcon size={22} color={INK5} style={{ marginBottom: 6, opacity: 0.5 }} />
          <div>Sin fotos del manifiesto firmado.</div>
        </div>
      ) : (
        <div className="manifest-grid" style={{
          padding: "0 16px 16px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 10,
        }}>
          {photos.map((url) => (
            <div
              key={url}
              style={{
                position: "relative",
                aspectRatio: "4 / 3",
                background: INK1, border: `1px solid ${INK2}`,
                borderRadius: 8, overflow: "hidden",
                cursor: "zoom-in",
              }}
              onClick={() => { setZoom(1); setZoomUrl(url); }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Manifiesto firmado"
                style={{
                  width: "100%", height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
              {editable && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); void handleDelete(url); }}
                  title="Eliminar foto"
                  className="manifest-delete-btn"
                  style={{
                    position: "absolute", top: 6, right: 6,
                    width: 26, height: 26, borderRadius: 6,
                    border: `1px solid ${RED_BD}`, background: RED_BG, color: RED,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de zoom fullscreen */}
      {zoomUrl && (
        <div
          onClick={() => setZoomUrl(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(9, 9, 11, 0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          {/* Toolbar */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute", top: 14, right: 14,
              display: "flex", gap: 6, alignItems: "center",
            }}
          >
            <ZoomBtn onClick={() => setZoom(z => Math.max(0.3, z - 0.25))}>
              <ZoomOut size={14} />
            </ZoomBtn>
            <span style={{
              color: "rgba(255,255,255,0.85)", fontSize: "0.75rem",
              fontVariantNumeric: "tabular-nums", minWidth: 40, textAlign: "center",
            }}>
              {Math.round(zoom * 100)}%
            </span>
            <ZoomBtn onClick={() => setZoom(z => Math.min(4, z + 0.25))}>
              <ZoomIn size={14} />
            </ZoomBtn>
            <ZoomBtn onClick={() => setZoomUrl(null)} title="Cerrar (Esc)">
              <X size={14} />
            </ZoomBtn>
          </div>

          {/* Imagen */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: "92vw", maxHeight: "88vh",
              overflow: "auto", borderRadius: 8,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomUrl}
              alt="Manifiesto firmado en zoom"
              style={{
                display: "block",
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
                transition: "transform 120ms ease",
                maxWidth: "100%",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ZoomBtn({
  children, onClick, title,
}: { children: React.ReactNode; onClick?: () => void; title?: string }) {
  return (
    <button
      type="button" onClick={onClick} title={title}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: 7,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.92)",
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}
