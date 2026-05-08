"use client";

import { useCallback, useEffect, useState } from "react";

export type RegionItem = {
  id: string;
  name: string;
  code?: string;
  active?: boolean;
};

export type ProvinceItem = {
  id: string;
  name: string;
  ubigeoCode?: string;
  departmentCode?: string;
  departmentName?: string;
  active?: boolean;
};

export type MunicipalityItem = {
  id: string;
  name: string;
  provinceId?: string;
  ubigeoCode?: string;
  active?: boolean;
};

export type Scope = "admin" | "public";

const REGIONS_ENDPOINT: Record<Scope, string> = {
  admin: "/api/regiones",
  public: "/api/public/regiones",
};
const PROVINCES_ENDPOINT: Record<Scope, string> = {
  admin: "/api/provincias",
  public: "/api/public/provincias",
};
const MUNIS_ENDPOINT: Record<Scope, string> = {
  admin: "/api/municipalidades",
  public: "/api/public/municipalidades",
};

// Caché por scope para que múltiples LocationPickers en una página
// compartan el catálogo de 24 regiones (carga una sola vez por sesión).
const regionsCache: Partial<Record<Scope, Promise<RegionItem[]>>> = {};

function getToken(): string {
  return typeof window === "undefined"
    ? ""
    : localStorage.getItem("sfit_access_token") ?? "";
}

function authHeaders(scope: Scope): HeadersInit {
  if (scope === "public") return {};
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function fetchJson<T>(url: string, scope: Scope): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(scope) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const body = (await res.json()) as { success: boolean; data?: T };
  if (!body.success || body.data == null) {
    throw new Error("Respuesta inválida del catálogo");
  }
  return body.data;
}

export function useRegions(scope: Scope = "admin") {
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cached = regionsCache[scope];
      const promise =
        cached ??
        fetchJson<{ items: RegionItem[] }>(REGIONS_ENDPOINT[scope], scope).then(
          (d) => d.items.filter((r) => r.active !== false),
        );
      regionsCache[scope] = promise;
      const items = await promise;
      setRegions(items);
    } catch (e) {
      regionsCache[scope] = undefined;
      setError(e instanceof Error ? e.message : "Error al cargar regiones");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  return { regions, loading, error, retry: load };
}

export function useProvincesByRegion(
  region: RegionItem | null,
  scope: Scope = "admin",
) {
  const [provinces, setProvinces] = useState<ProvinceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!region) {
      setProvinces([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (region.code) params.set("departmentCode", region.code);
      const data = await fetchJson<{ items: ProvinceItem[] }>(
        `${PROVINCES_ENDPOINT[scope]}?${params.toString()}`,
        scope,
      );
      setProvinces(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar provincias");
    } finally {
      setLoading(false);
    }
  }, [region, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  return { provinces, loading, error, retry: load };
}

export function useMunicipalitiesByProvince(
  province: ProvinceItem | null,
  scope: Scope = "admin",
) {
  const [municipalities, setMunicipalities] = useState<MunicipalityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!province) {
      setMunicipalities([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        provinceId: province.id,
        limit: "200",
      });
      const data = await fetchJson<{ items: MunicipalityItem[] }>(
        `${MUNIS_ENDPOINT[scope]}?${params.toString()}`,
        scope,
      );
      setMunicipalities(data.items);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Error al cargar municipalidades",
      );
    } finally {
      setLoading(false);
    }
  }, [province, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  return { municipalities, loading, error, retry: load };
}
