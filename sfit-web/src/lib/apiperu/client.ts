const BASE = "https://apiperu.dev/api";

/**
 * Error con clasificación específica para que la capa de API pueda mapear a
 * códigos HTTP y mensajes útiles al usuario final. `kind` distingue entre:
 *   - config:        falta/mal configurado APIPERU_TOKEN
 *   - origin:        el token existe pero la IP/dominio actual no está en la
 *                    lista blanca de apiperu.dev (`ORIGIN_NOT_ALLOWED`)
 *   - auth:          token inválido o expirado
 *   - notfound:      el DNI/RUC no existe en RENIEC/SUNAT
 *   - network:       fallo de red u otra cosa inesperada
 */
export type ApiPeruErrorKind = "config" | "origin" | "auth" | "notfound" | "network";

export class ApiPeruError extends Error {
  readonly kind: ApiPeruErrorKind;
  readonly code?: string;
  readonly status?: number;
  constructor(kind: ApiPeruErrorKind, message: string, opts: { code?: string; status?: number } = {}) {
    super(message);
    this.kind   = kind;
    this.code   = opts.code;
    this.status = opts.status;
  }
}

function getHeaders() {
  const token = process.env.APIPERU_TOKEN;
  if (!token) throw new ApiPeruError("config", "APIPERU_TOKEN no configurado en el servidor");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/** Clasifica una respuesta no-OK de apiperu.dev en un ApiPeruError tipado. */
async function buildError(res: Response): Promise<ApiPeruError> {
  let body: { code?: string; message?: string; success?: boolean } | null = null;
  try { body = await res.json(); } catch { /* respuesta no es JSON */ }

  const code    = body?.code;
  const message = body?.message;

  if (res.status === 403 || code === "ORIGIN_NOT_ALLOWED") {
    return new ApiPeruError(
      "origin",
      "El dominio o IP actual no está autorizado en apiperu.dev. Agrega este origen en el panel de apiperu.dev → Tokens.",
      { code, status: res.status }
    );
  }
  if (res.status === 401 || code === "INVALID_TOKEN" || code === "TOKEN_EXPIRED") {
    return new ApiPeruError("auth", message ?? "Token de apiperu.dev inválido o expirado", { code, status: res.status });
  }
  if (res.status === 404) {
    return new ApiPeruError("notfound", message ?? "No se encontraron datos para ese documento", { code, status: res.status });
  }
  return new ApiPeruError(
    "network",
    message ?? `apiperu.dev respondió ${res.status}`,
    { code, status: res.status }
  );
}

export interface DniData {
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombre_completo: string;
  codigo_verificacion?: string;
}

export interface RucData {
  ruc: string;
  razon_social: string;
  nombre_comercial?: string;
  estado: string;
  condicion: string;
  domicilio?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  ubigeo?: string;
}

export async function consultarDni(dni: string): Promise<DniData> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/dni`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ dni }),
      // Sin cache para datos siempre frescos de RENIEC
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof ApiPeruError) throw err;
    throw new ApiPeruError("network", "No se pudo conectar con apiperu.dev");
  }

  if (!res.ok) throw await buildError(res);

  const json = await res.json();
  if (!json.success) {
    throw new ApiPeruError(
      json.code === "ORIGIN_NOT_ALLOWED" ? "origin" : "notfound",
      json.message ?? "Sin datos para ese DNI",
      { code: json.code }
    );
  }

  const d = json.data;
  return {
    nombres: d.nombres ?? "",
    apellido_paterno: d.apellido_paterno ?? "",
    apellido_materno: d.apellido_materno ?? "",
    nombre_completo: [d.nombres, d.apellido_paterno, d.apellido_materno]
      .filter(Boolean)
      .join(" ")
      .trim(),
    codigo_verificacion: d.codigo_verificacion,
  };
}

export async function consultarRuc(ruc: string): Promise<RucData> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/ruc`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ ruc }),
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof ApiPeruError) throw err;
    throw new ApiPeruError("network", "No se pudo conectar con apiperu.dev");
  }

  if (!res.ok) throw await buildError(res);

  const json = await res.json();
  if (!json.success) {
    throw new ApiPeruError(
      json.code === "ORIGIN_NOT_ALLOWED" ? "origin" : "notfound",
      json.message ?? "Sin datos para ese RUC",
      { code: json.code }
    );
  }

  const d = json.data;
  return {
    ruc: d.ruc ?? ruc,
    razon_social: d.razon_social ?? "",
    nombre_comercial: d.nombre_comercial,
    estado: d.estado ?? "",
    condicion: d.condicion ?? "",
    domicilio: d.domicilio,
    departamento: d.departamento,
    provincia: d.provincia,
    distrito: d.distrito,
    ubigeo: d.ubigeo,
  };
}
