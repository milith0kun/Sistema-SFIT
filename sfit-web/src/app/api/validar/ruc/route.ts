import { NextRequest } from "next/server";
import { z } from "zod";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { consultarRuc, ApiPeruError } from "@/lib/apiperu/client";

const Schema = z.object({
  ruc: z.string().regex(/^\d{11}$/, "RUC debe tener exactamente 11 dígitos"),
});

export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "RUC inválido", 400);
    }

    const data = await consultarRuc(parsed.data.ruc);
    return apiResponse(data);
  } catch (err) {
    if (err instanceof ApiPeruError) {
      console.error(`[validar/ruc] ${err.kind}: ${err.message}`, err.code ?? "");
      switch (err.kind) {
        case "config":
          return apiError("SUNAT no está configurado en el servidor (falta APIPERU_TOKEN).", 500);
        case "origin":
          return apiError(
            "El servicio de SUNAT rechazó la solicitud: este dominio/IP no está autorizado en apiperu.dev.",
            502
          );
        case "auth":
          return apiError("El token de apiperu.dev es inválido o expiró.", 502);
        case "notfound":
          return apiError(err.message || "No se encontraron datos para ese RUC", 404);
        case "network":
        default:
          return apiError("No se pudo conectar con SUNAT. Intenta nuevamente.", 503);
      }
    }
    const msg = err instanceof Error ? err.message : "Error al consultar RUC";
    console.error("[validar/ruc] inesperado:", msg);
    return apiError("No se pudo verificar el RUC. Intenta nuevamente.", 503);
  }
}
