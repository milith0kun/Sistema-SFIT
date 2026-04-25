import { NextRequest } from "next/server";
import { z } from "zod";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { consultarDni } from "@/lib/apiperu/client";

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
    const msg = err instanceof Error ? err.message : "Error al consultar DNI";
    console.error("[validar/dni]", msg);
    return apiError("No se pudo verificar el DNI. Intenta nuevamente.", 503);
  }
}
