const BASE = "https://apiperu.dev/api";

function getHeaders() {
  const token = process.env.APIPERU_TOKEN;
  if (!token) throw new Error("APIPERU_TOKEN no configurado");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
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
  const res = await fetch(`${BASE}/dni`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ dni }),
    // Sin cache para datos siempre frescos de RENIEC
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API Perú DNI ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (!json.success) throw new Error(json.message ?? "Sin datos para ese DNI");

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
  const res = await fetch(`${BASE}/ruc`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ ruc }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API Perú RUC ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (!json.success) throw new Error(json.message ?? "Sin datos para ese RUC");

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
