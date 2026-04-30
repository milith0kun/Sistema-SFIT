"use client";

import { useEffect, useSyncExternalStore } from "react";

// Override del último crumb del Topbar.
// Las páginas de detalle pueden inyectar el nombre legible del recurso
// (ej. nombre del usuario, razón social de empresa) para reemplazar el ID
// que aparecería por defecto en la URL.

let title: string | null = null;
const listeners = new Set<() => void>();

function setTitle(next: string | null): void {
  if (next === title) return;
  title = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string | null {
  return title;
}

function getServerSnapshot(): null {
  return null;
}

/** Lectura — para el Topbar. */
export function useBreadcrumbTitle(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Inyección — para páginas de detalle. Pasar `null` o cadena vacía
 * mientras el dato cargue mantiene el fallback estático del path.
 */
export function useSetBreadcrumbTitle(value: string | null | undefined): void {
  useEffect(() => {
    const v = value && value.trim() ? value.trim() : null;
    setTitle(v);
    return () => setTitle(null);
  }, [value]);
}
