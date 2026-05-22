import { NextRequest } from "next/server";
import { z } from "zod";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { consultarRuc as consultarRucApiPeru, ApiPeruError } from "@/lib/apiperu/client";
import { consultarRuc as consultarRucFactiliza, FactilizaError } from "@/lib/factiliza/client";

const Schema = z.object({
  ruc: z.string().regex(/^\d{11}$/, "RUC debe tener exactamente 11 dígitos"),
});

/**
 * Consulta RUC con doble proveedor + mock fallback (solo desarrollo):
 *   1) apiperu.dev — más rápido cuando el origen está autorizado.
 *   2) Factiliza — sin whitelist de IP, como fallback.
 *   3) Si ambos fallan y ENABLE_RUC_MOCK=true, devuelve datos de prueba
 *      (útil en localhost donde apiperu.dev rechaza por origen no whitelisted).
 *
 * En producción (sfit.ecosdelseo.com) los proveedores reales funcionan
 * normalmente porque el dominio está whitelisted. El mock nunca se activa
 * a menos que AMBOS proveedores estén caídos simultáneamente.
 */
export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  const body = await request.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "RUC inválido", 400);
  }
  const { ruc } = parsed.data;

  let lastErrorKind: string | undefined;

  // ── Intento 1: apiperu.dev ──────────────────────────────────────────────
  try {
    const data = await consultarRucApiPeru(ruc);
    return apiResponse({ ...data, _provider: "apiperu" });
  } catch (err) {
    if (err instanceof ApiPeruError) {
      console.warn(`[validar/ruc] apiperu falló (${err.kind}): ${err.message}`);
      if (err.kind === "notfound") {
        return apiError(err.message || "No se encontraron datos para ese RUC", 404);
      }
      lastErrorKind = err.kind;
    } else {
      console.error("[validar/ruc] apiperu inesperado:", err);
    }
  }

  // ── Intento 2: Factiliza (sin whitelist de IP) ──────────────────────────
  try {
    const data = await consultarRucFactiliza(ruc);
    return apiResponse({
      ruc: data.numero,
      razon_social: data.razon_social,
      nombre_comercial: data.nombre_comercial,
      estado: data.estado,
      condicion: data.condicion,
      domicilio: data.direccion_completa ?? data.direccion,
      departamento: data.departamento,
      provincia: data.provincia,
      distrito: data.distrito,
      ubigeo: data.ubigeo_sunat,
      _provider: "factiliza",
    });
  } catch (err) {
    if (err instanceof FactilizaError) {
      console.error(`[validar/ruc] factiliza ${err.kind}: ${err.message}`);
      if (err.kind === "notfound") {
        return apiError(err.message || "No se encontraron datos para ese RUC", 404);
      }
      lastErrorKind = err.kind;
    } else {
      const msg = err instanceof Error ? err.message : "Error al consultar RUC";
      console.error("[validar/ruc] factiliza inesperado:", msg);
    }
  }

  // ── Fallback mock (solo desarrollo) ─────────────────────────────────────
  // Se activa únicamente cuando AMBOS proveedores reales fallaron y
  // ENABLE_RUC_MOCK=true. En producción este flag no existe, así que
  // se devuelve 503 normalmente.
  if (process.env.ENABLE_RUC_MOCK === "true") {
    console.warn(`[mock] Ambos proveedores fallaron (last: ${lastErrorKind}). Devolviendo mock de RUC.`);
    return apiResponse({
      ruc,
      razon_social: `EMPRESA MOCK ${ruc.slice(0, 3)}`,
      nombre_comercial: `Comercial Mock ${ruc.slice(0, 3)}`,
      estado: "ACTIVO",
      condicion: "HABIDO",
      domicilio: "Av. Los Girasoles 123, Cusco",
      departamento: "CUSCO",
      provincia: "CUSCO",
      distrito: "CUSCO",
      ubigeo_sunat: "080101",
      _provider: "mock",
    });
  }

  return apiError("No se pudo verificar el RUC. Intenta nuevamente.", 503);
}
