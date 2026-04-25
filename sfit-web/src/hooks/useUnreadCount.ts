"use client";

import { useSyncExternalStore } from "react";

let count = 0;
let inflight = false;
let intervalId: number | null = null;
const listeners = new Set<() => void>();

function getToken(): string {
  return typeof window === "undefined"
    ? ""
    : localStorage.getItem("sfit_access_token") ?? "";
}

async function fetchUnread(): Promise<void> {
  if (inflight) return;
  const token = getToken();
  if (!token) return;
  inflight = true;
  try {
    const res = await fetch("/api/notifications/unread-count", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { success?: boolean; data?: { count?: number } };
    if (data?.success && typeof data?.data?.count === "number") {
      setCount(data.data.count);
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
    void fetchUnread();
    intervalId = window.setInterval(() => void fetchUnread(), 30_000);
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

export function useUnreadCount(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function refreshUnreadCount(): void {
  void fetchUnread();
}

export function setUnreadCountValue(n: number): void {
  setCount(n);
}

export function decrementUnreadCount(by: number = 1): void {
  setCount(count - by);
}
