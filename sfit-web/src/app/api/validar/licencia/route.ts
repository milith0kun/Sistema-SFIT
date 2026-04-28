import { NextRequest } from "next/server";
import { z } from "zod";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { consultarLicencia, FactilizaError } from "@/lib/factiliza/client";

// Factiliza consulta licencias por DNI del titular (8 dígitos).
const Schema = z.object({
  dni: z.string().regex(/^\d{8}$/, "DNI debe tener 8 dígitos"),
});

export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "DNI inválido", 400);
    }

    const data = await consultarLicencia(parsed.data.dni);
    return apiResponse(data);
  } catch (err) {
    if (err instanceof FactilizaError) {
      console.error(`[validar/licencia] ${err.kind}: ${err.message}`);
      switch (err.kind) {
        case "config":   return apiError("MTC no está configurado en el servidor (falta FACTILIZA_TOKEN).", 500);
        case "auth":     return apiError("El token de Factiliza es inválido o expiró.", 502);
        case "notfound": return apiError(err.message || "No se encontró licencia para ese DNI", 404);
        default:         return apiError("No se pudo conectar con MTC. Intenta nuevamente.", 503);
      }
    }
    const msg = err instanceof Error ? err.message : "Error al consultar licencia";
    console.error("[validar/licencia] inesperado:", msg);
    return apiError("No se pudo verificar la licencia.", 503);
  }
}
