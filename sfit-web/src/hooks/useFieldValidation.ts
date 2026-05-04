"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hook unificado de validación + lookup async (RENIEC / SUNAT / placas / etc.)
 *
 * Reemplaza el patrón actual donde cada [id]/page.tsx tiene state spaghetti
 * para `dniLookup` + `dniHover` + timer manual + etc. Centraliza:
 *   - Validación síncrona (regex, longitud, etc.)
 *   - Lookup async con debounce (consulta a un endpoint que enriquece datos)
 *   - Estado consistente: `isValidating`, `isValid`, `error`, `result`
 *
 * @example
 * const dni = useFieldValidation<{ nombre: string }>({
 *   value: dniInput,
 *   validate: v => /^\d{8}$/.test(v) ? null : "Debe tener 8 dígitos",
 *   lookup: async v => {
 *     const r = await fetch("/api/validar/dni", { method: "POST", body: JSON.stringify({ dni: v }) });
 *     if (r.status === 404) return { error: "DNI no encontrado" };
 *     const data = await r.json();
 *     return data.success ? { result: data.data } : { error: data.error };
 *   },
 *   debounce: 350,
 * });
 *
 * // dni.isValidating, dni.isValid, dni.error, dni.result, dni.state
 */

export type ValidationState =
  | "idle"
  | "validating"
  | "valid"
  | "invalid"
  | "lookup_failed";

export interface ValidationResult<R> {
  state: ValidationState;
  isValidating: boolean;
  isValid: boolean;
  error: string | null;
  result: R | null;
}

export interface UseFieldValidationOptions<R> {
  /** Valor actual del input. */
  value: string;
  /** Validación síncrona — devuelve null si válido, string con error si inválido. */
  validate?: (value: string) => string | null;
  /** Lookup async tras pasar la validación síncrona. Devuelve {result} o {error}. */
  lookup?: (value: string) => Promise<{ result?: R; error?: string }>;
  /** Debounce en ms para el lookup. Default: 300. */
  debounce?: number;
  /** Si false, ignora validación cuando el valor es vacío (útil para campos opcionales). */
  validateEmpty?: boolean;
}

interface InternalState<R> {
  state: ValidationState;
  error: string | null;
  result: R | null;
}

const INITIAL: InternalState<unknown> = { state: "idle", error: null, result: null };

export function useFieldValidation<R = unknown>(
  opts: UseFieldValidationOptions<R>,
): ValidationResult<R> {
  const { value, validate, lookup, debounce = 300, validateEmpty = false } = opts;
  // Estado consolidado en un solo setter para evitar updates en cascada
  // dentro del effect (React lint regla react-hooks/set-state-in-effect).
  const [s, setS] = useState<InternalState<R>>(INITIAL as InternalState<R>);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Token para descartar respuestas viejas si el valor cambió mientras se hacía lookup.
  const tokenRef = useRef(0);

  // Memoizar validate/lookup para que useEffect no se dispare en cada render.
  const validateRef = useRef(validate);
  const lookupRef = useRef(lookup);
  useEffect(() => { validateRef.current = validate; });
  useEffect(() => { lookupRef.current = lookup; });

  /* eslint-disable react-hooks/set-state-in-effect --
     Este hook DEBE llamar setS al cambiar `value` para mirrorear el
     resultado de validación + lookup async. No se puede derivar de props
     porque la validación es async (debounce + fetch). Es un caso legítimo
     del patrón "state derivado de async work tras una prop". */
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // Empty handling — un solo setS evita "set-state-in-effect" cascada.
    if (!validateEmpty && (value === "" || value == null)) {
      setS({ state: "idle", error: null, result: null });
      return;
    }

    // Sync validation
    const syncError = validateRef.current?.(value) ?? null;
    if (syncError) {
      setS({ state: "invalid", error: syncError, result: null });
      return;
    }

    // Si no hay lookup async, basta con la validación síncrona.
    if (!lookupRef.current) {
      setS({ state: "valid", error: null, result: null });
      return;
    }

    // Async lookup con debounce
    setS({ state: "validating", error: null, result: null });
    const myToken = ++tokenRef.current;
    timerRef.current = setTimeout(async () => {
      try {
        const res = await lookupRef.current!(value);
        if (myToken !== tokenRef.current) return;  // valor cambió, descartar
        if (res.error) {
          setS({ state: "lookup_failed", error: res.error, result: null });
        } else if (res.result !== undefined) {
          setS({ state: "valid", error: null, result: res.result as R });
        } else {
          setS({ state: "valid", error: null, result: null });
        }
      } catch (err) {
        if (myToken !== tokenRef.current) return;
        setS({
          state: "lookup_failed",
          error: err instanceof Error ? err.message : "Error de lookup",
          result: null,
        });
      }
    }, debounce);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, debounce, validateEmpty]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return {
    state: s.state,
    isValidating: s.state === "validating",
    isValid: s.state === "valid",
    error: s.error,
    result: s.result,
  };
}
