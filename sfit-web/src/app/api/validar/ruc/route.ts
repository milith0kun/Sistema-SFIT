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
 * Consulta RUC con doble proveedor:
 *   1) Intenta apiperu.dev primero (más rápido cuando el origen está autorizado).
 *   2) Si apiperu falla por config/origin/auth/network, hace fallback a Factiliza.
 *   3) Si ambos fallan o el RUC no existe en ninguno, devuelve el error más útil.
 *
 * Ambos clientes devuelven `razon_social` en snake_case — el front no necesita cambiar.
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

  // ── Intento 1: apiperu.dev ──────────────────────────────────────────────
  try {
    const data = await consultarRucApiPeru(ruc);
    return apiResponse({ ...data, _provider: "apiperu" });
  } catch (err) {
    if (err instanceof ApiPeruError) {
      console.warn(`[validar/ruc] apiperu falló (${err.kind}): ${err.message}`);
      // 404 = RUC realmente no existe — no probar fallback (gastaríamos otra llamada).
      if (err.kind === "notfound") {
        return apiError(err.message || "No se encontraron datos para ese RUC", 404);
      }
      // El resto (config/origin/auth/network) → caer al fallback Factiliza.
    } else {
      console.error("[validar/ruc] apiperu inesperado:", err);
    }
  }

  // ── Intento 2: Factiliza (sin whitelist de IP) ──────────────────────────
  try {
    const data = await consultarRucFactiliza(ruc);
    return apiResponse({
      // Renombramos al shape que ya consume el frontend
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
      switch (err.kind) {
        case "config":
          return apiError("SUNAT no está configurado en el servidor (falta APIPERU_TOKEN o FACTILIZA_TOKEN).", 500);
        case "auth":
          return apiError("El token del servicio SUNAT es inválido o expiró.", 502);
        case "notfound":
          return apiError(err.message || "No se encontraron datos para ese RUC", 404);
        case "network":
        default:
          return apiError("No se pudo conectar con SUNAT. Intenta nuevamente.", 503);
      }
    }
    const msg = err instanceof Error ? err.message : "Error al consultar RUC";
    console.error("[validar/ruc] factiliza inesperado:", msg);
    return apiError("No se pudo verificar el RUC. Intenta nuevamente.", 503);
  }
}
