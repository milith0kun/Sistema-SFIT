import { NextRequest } from "next/server";
import { z } from "zod";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { consultarDni, ApiPeruError } from "@/lib/apiperu/client";

const Schema = z.object({
  dni: z.string().regex(/^\d{8}$/, "DNI debe tener exactamente 8 dígitos"),
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

    const data = await consultarDni(parsed.data.dni);
    return apiResponse(data);
  } catch (err) {
    if (err instanceof ApiPeruError) {
      console.error(`[validar/dni] ${err.kind}: ${err.message}`, err.code ?? "");
      switch (err.kind) {
        case "config":
          return apiError("RENIEC no está configurado en el servidor (falta APIPERU_TOKEN).", 500);
        case "origin":
          // 502: el upstream rechazó por origen no autorizado.
          return apiError(
            "El servicio de RENIEC rechazó la solicitud: este dominio/IP no está autorizado en apiperu.dev. Pide al administrador que añada el origen actual al panel de tokens en apiperu.dev.",
            502
          );
        case "auth":
          return apiError("El token de apiperu.dev es inválido o expiró. Renuévalo en el panel de apiperu.dev.", 502);
        case "notfound":
          return apiError(err.message || "No se encontraron datos para ese DNI", 404);
        case "network":
        default:
          return apiError("No se pudo conectar con RENIEC. Intente nuevamente.", 503);
      }
    }
    const msg = err instanceof Error ? err.message : "Error al consultar DNI";
    console.error("[validar/dni] inesperado:", msg);
    return apiError("No se pudo verificar el DNI. Intente nuevamente.", 503);
  }
}
