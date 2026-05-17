"use client";

import { useSyncExternalStore } from "react";

/**
 * Total de items pendientes en el centro de aprobaciones (usuarios + empresas
 * + conductores + vehículos). Se consulta cada 60s mientras hay suscriptores
 * activos y se exhibe como badge en el sidebar.
 *
 * Espejo del patrón de useUnreadCount (in-memory + useSyncExternalStore +
 * polling). Solo super_admin y admin_municipal verán un valor > 0; otros
 * roles reciben 403 del endpoint y el contador queda en 0.
 */

let count = 0;
let inflight = false;
let intervalId: number | null = null;
const listeners = new Set<() => void>();

function getToken(): string {
  return typeof window === "undefined"
    ? ""
    : localStorage.getItem("sfit_access_token") ?? "";
}

async function fetchPending(): Promise<void> {
  if (inflight) return;
  const token = getToken();
  if (!token) return;
  inflight = true;
  try {
    const res = await fetch("/api/admin/aprobaciones/resumen", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      success?: boolean;
      data?: { counts?: { total?: number } };
    };
    if (data?.success && typeof data?.data?.counts?.total === "number") {
      setCount(data.data.counts.total);
    }
  } catch {
    // silencioso — el badge degradará a su último valor conocido
  } finally {
    inflight = false;
  }
}

function setCount(n: number): void {
  const next = Math.max(0, n | 0);
  if (next === count) return;
  count = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    void fetchPending();
    intervalId = window.setInterval(() => void fetchPending(), 60_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null && typeof window !== "undefined") {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot(): number {
  return count;
}

function getServerSnapshot(): number {
  return 0;
}

export function useApprovalsPending(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function refreshApprovalsPending(): void {
  void fetchPending();
}
