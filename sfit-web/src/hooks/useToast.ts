"use client";

import { useEffect, useState, useCallback, useRef } from "react";

/**
 * Toast notification system con queue. Múltiples toasts se apilan y cada
 * uno se cierra automáticamente tras `duration` ms.
 *
 * Implementación con un mini event bus en `globalThis` para que cualquier
 * componente pueda emitir toasts sin pasar el setter por props. El
 * componente `<Toaster />` (renderizado una vez en el layout) escucha
 * el bus y renderiza la cola.
 */

export type ToastVariant = "success" | "error" | "info" | "warn";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  createdAt: number;
}

interface ToastBusGlobal {
  __sfitToastBus?: {
    listeners: Set<(t: Toast) => void>;
    emit: (t: Omit<Toast, "id" | "createdAt">) => void;
  };
}

function getBus() {
  const g = globalThis as ToastBusGlobal;
  if (!g.__sfitToastBus) {
    const listeners = new Set<(t: Toast) => void>();
    g.__sfitToastBus = {
      listeners,
      emit: (t) => {
        const full: Toast = {
          ...t,
          id: Math.random().toString(36).slice(2),
          createdAt: Date.now(),
        };
        listeners.forEach((l) => l(full));
      },
    };
  }
  return g.__sfitToastBus!;
}

/**
 * Hook para emitir toasts desde cualquier componente.
 * @example
 * const toast = useToast();
 * toast.success("Guardado correctamente");
 * toast.error("No se pudo guardar");
 */
export function useToast() {
  const bus = getBus();
  const emit = useCallback(
    (variant: ToastVariant, message: string, duration = 3500) =>
      bus.emit({ variant, message, duration }),
    [bus],
  );
  return {
    success: (msg: string, duration?: number) => emit("success", msg, duration),
    error: (msg: string, duration?: number) => emit("error", msg, duration),
    info: (msg: string, duration?: number) => emit("info", msg, duration),
    warn: (msg: string, duration?: number) => emit("warn", msg, duration),
  };
}

/**
 * Hook interno usado por el componente `<Toaster />`. Escucha el bus y
 * mantiene la lista activa.
 */
export function useToastQueue() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const bus = getBus();
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const onToast = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
        timersRef.current.delete(t.id);
      }, t.duration);
      timersRef.current.set(t.id, timer);
    };
    bus.listeners.add(onToast);
    const timersMap = timersRef.current;
    return () => {
      bus.listeners.delete(onToast);
      timersMap.forEach((t) => clearTimeout(t));
      timersMap.clear();
    };
  }, [bus]);

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return { toasts, dismiss };
}
