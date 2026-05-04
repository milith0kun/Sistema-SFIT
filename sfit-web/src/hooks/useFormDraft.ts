"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Hook para autosave de formularios largos en localStorage.
 *
 * Lee el borrador al montar (si existe), expone setter que escribe al
 * estado y al storage (debounced 500ms), y `clearDraft()` para limpiar
 * después de un submit exitoso.
 *
 * Devuelve también `hasDraft` que es true cuando se recuperó algo de
 * localStorage al montar — útil para mostrar un badge "Borrador recuperado".
 *
 * @example
 * const [form, setForm, clearDraft, { hasDraft }] = useFormDraft("user-new", {
 *   name: "", email: "", role: "ciudadano",
 * });
 * // En el submit success:
 * clearDraft();
 */

const KEY_PREFIX = "sfit_draft_";
const DEBOUNCE_MS = 500;

export function useFormDraft<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void, () => void, { hasDraft: boolean }] {
  const fullKey = KEY_PREFIX + key;

  // Lee el draft de forma síncrona en el primer render para evitar flash.
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(fullKey);
      if (!raw) return initial;
      const parsed = JSON.parse(raw) as T;
      // Merge superficial con `initial` para que campos nuevos del schema
      // que aún no estén en el draft se inicialicen correctamente.
      if (typeof initial === "object" && initial !== null && !Array.isArray(initial)) {
        return { ...initial, ...parsed } as T;
      }
      return parsed;
    } catch {
      return initial;
    }
  });

  const [hasDraft, setHasDraft] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(fullKey) !== null;
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState(prev => {
        const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          try {
            localStorage.setItem(fullKey, JSON.stringify(value));
            setHasDraft(true);
          } catch { /* quota exceeded — silent */ }
        }, DEBOUNCE_MS);
        return value;
      });
    },
    [fullKey],
  );

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(fullKey);
    } catch { /* silent */ }
    setHasDraft(false);
  }, [fullKey]);

  // Cleanup del timer al desmontar
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return [state, set, clearDraft, { hasDraft }];
}
