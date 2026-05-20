/**
 * Cliente API centralizado para el dashboard web.
 *
 * Elimina el boilerplate de `localStorage.getItem("sfit_access_token")` +
 * `Authorization: Bearer ...` que se repite en 42 archivos.
 *
 * Uso:
 *   import { apiFetch, apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
 *   const data = await apiGet<{ items: Route[] }>("/api/rutas");
 */

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("sfit_access_token") ?? "";
}

function redirectToLogin() {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

/**
 * Fetch genérico con auth automática. Lanza error si la respuesta no es ok.
 * Redirige a /login en 401.
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    redirectToLogin();
    throw new Error("No autorizado");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (data as { error?: string }).error ?? `Error ${res.status}`;
    throw new Error(msg);
  }

  return { ok: true, status: res.status, data: data as T };
}

/** GET con auth. */
export async function apiGet<T = unknown>(url: string): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, { method: "GET" });
}

/** POST con auth. */
export async function apiPost<T = unknown>(
  url: string,
  body?: Record<string, JsonValue>,
): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** PATCH con auth. */
export async function apiPatch<T = unknown>(
  url: string,
  body?: Record<string, JsonValue>,
): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** DELETE con auth. */
export async function apiDelete<T = unknown>(url: string): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, { method: "DELETE" });
}
