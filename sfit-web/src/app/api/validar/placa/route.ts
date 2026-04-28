import { NextRequest } from "next/server";
import { z } from "zod";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { consultarPlaca, FactilizaError } from "@/lib/factiliza/client";

// Las placas vehiculares peruanas tienen formatos como ABC-123, A0L-832,
// T1-2345 (motos). Se aceptan 6 a 7 caracteres alfanuméricos sin guion.
const Schema = z.object({
  placa: z.string().regex(/^[A-Z0-9]{6,7}$/i, "Placa inválida (6-7 caracteres alfanuméricos)"),
});

export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Placa inválida", 400);
    }

    const data = await consultarPlaca(parsed.data.placa);
    return apiResponse(data);
  } catch (err) {
    if (err instanceof FactilizaError) {
      console.error(`[validar/placa] ${err.kind}: ${err.message}`);
      switch (err.kind) {
        case "config":   return apiError("SUNARP no está configurado en el servidor (falta FACTILIZA_TOKEN).", 500);
        case "auth":     return apiError("El token de Factiliza es inválido o expiró.", 502);
        case "notfound": return apiError(err.message || "No se encontraron datos para esa placa", 404);
        default:         return apiError("No se pudo conectar con SUNARP. Intenta nuevamente.", 503);
      }
    }
    const msg = err instanceof Error ? err.message : "Error al consultar placa";
    console.error("[validar/placa] inesperado:", msg);
    return apiError("No se pudo verificar la placa.", 503);
  }
}
