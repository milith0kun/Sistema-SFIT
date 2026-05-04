"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

export function useFieldValidation<R = unknown>(
  opts: UseFieldValidationOptions<R>,
): ValidationResult<R> {
  const { value, validate, lookup, debounce = 300, validateEmpty = false } = opts;
  const [state, setState] = useState<ValidationState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<R | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Token para descartar respuestas viejas si el valor cambió mientras se hacía lookup.
  const tokenRef = useRef(0);

  // Memoizar validate/lookup para que useEffect no se dispare en cada render.
  const validateRef = useRef(validate);
  const lookupRef = useRef(lookup);
  useEffect(() => { validateRef.current = validate; });
  useEffect(() => { lookupRef.current = lookup; });

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // Empty handling
    if (!validateEmpty && (value === "" || value == null)) {
      setState("idle");
      setError(null);
      setResult(null);
      return;
    }

    // Sync validation
    const syncError = validateRef.current?.(value) ?? null;
    if (syncError) {
      setState("invalid");
      setError(syncError);
      setResult(null);
      return;
    }

    // Si no hay lookup async, basta con la validación síncrona.
    if (!lookupRef.current) {
      setState("valid");
      setError(null);
      return;
    }

    // Async lookup con debounce
    setState("validating");
    setError(null);
    const myToken = ++tokenRef.current;
    timerRef.current = setTimeout(async () => {
      try {
        const res = await lookupRef.current!(value);
        if (myToken !== tokenRef.current) return;  // valor cambió, descartar
        if (res.error) {
          setState("lookup_failed");
          setError(res.error);
          setResult(null);
        } else if (res.result !== undefined) {
          setState("valid");
          setError(null);
          setResult(res.result);
        } else {
          setState("valid");
          setError(null);
        }
      } catch (err) {
        if (myToken !== tokenRef.current) return;
        setState("lookup_failed");
        setError(err instanceof Error ? err.message : "Error de lookup");
        setResult(null);
      }
    }, debounce);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, debounce, validateEmpty]);

  return {
    state,
    isValidating: state === "validating",
    isValid: state === "valid",
    error,
    result,
  };
}
