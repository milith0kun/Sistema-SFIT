/**
 * Cliente para api.factiliza.com — usado para complementar los datos que
 * apiperu.dev no cubre: placa vehicular (SUNARP) y licencia de conducir (MTC).
 * El token va en `FACTILIZA_TOKEN` y la auth es Bearer JWT.
 *
 * Para mantener consistencia con `lib/apiperu/client.ts`, los errores se
 * envuelven en `FactilizaError` con el mismo `kind` (config / auth /
 * notfound / network) para que las rutas de API mapeen a HTTP semántico.
 */

const BASE = "https://api.factiliza.com/v1";

export type FactilizaErrorKind = "config" | "auth" | "notfound" | "network";

export class FactilizaError extends Error {
  readonly kind: FactilizaErrorKind;
  readonly status?: number;
  constructor(kind: FactilizaErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

function getHeaders() {
  const token = process.env.FACTILIZA_TOKEN;
  if (!token) throw new FactilizaError("config", "FACTILIZA_TOKEN no configurado en el servidor");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

async function buildError(res: Response): Promise<FactilizaError> {
  let body: { message?: string; success?: boolean } | null = null;
  try { body = await res.json(); } catch { /* respuesta no JSON */ }
  const message = body?.message;

  if (res.status === 401 || res.status === 403) {
    return new FactilizaError("auth", message ?? "Token de Factiliza inválido o sin permisos", res.status);
  }
  if (res.status === 404) {
    return new FactilizaError("notfound", message ?? "No se encontraron datos", res.status);
  }
  return new FactilizaError("network", message ?? `Factiliza respondió ${res.status}`, res.status);
}

async function fetchJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof FactilizaError) throw err;
    throw new FactilizaError("network", "No se pudo conectar con Factiliza");
  }

  if (!res.ok) throw await buildError(res);

  const json = await res.json() as { success?: boolean; data?: T; message?: string };
  if (!json.data) {
    throw new FactilizaError("notfound", json.message ?? "Sin datos para esa consulta");
  }
  return json.data;
}

// ── DNI ──────────────────────────────────────────────────────────────────────

export interface FactilizaDni {
  numero: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombre_completo: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  direccion_completa?: string;
  ubigeo_reniec?: string;
  ubigeo_sunat?: string;
  fecha_nacimiento?: string;
  estado_civil?: string;
  sexo?: string;
}

export function consultarDni(dni: string): Promise<FactilizaDni> {
  return fetchJson<FactilizaDni>(`/dni/info/${encodeURIComponent(dni)}`);
}

// ── Placa vehicular (SUNARP) ─────────────────────────────────────────────────

export interface FactilizaPlaca {
  placa: string;
  marca: string;
  modelo: string;
  serie: string;
  color: string;
  motor: string;
  vin: string;
}

export function consultarPlaca(placa: string): Promise<FactilizaPlaca> {
  return fetchJson<FactilizaPlaca>(`/placa/info/${encodeURIComponent(placa.toUpperCase())}`);
}

// ── Licencia de conducir (MTC) ───────────────────────────────────────────────

export interface FactilizaLicenciaItem {
  numero: string;
  categoria: string;          // "A I", "A IIa", etc.
  fecha_expedicion: string;   // dd/mm/yyyy
  fecha_vencimiento: string;  // dd/mm/yyyy
  estado: string;             // "VIGENTE", "VENCIDA", etc.
  restricciones: string;
}

export interface FactilizaLicencia {
  numero_documento: string;
  nombre_completo: string;
  licencia: FactilizaLicenciaItem;
}

export function consultarLicencia(dni: string): Promise<FactilizaLicencia> {
  return fetchJson<FactilizaLicencia>(`/licencia/info/${encodeURIComponent(dni)}`);
}
