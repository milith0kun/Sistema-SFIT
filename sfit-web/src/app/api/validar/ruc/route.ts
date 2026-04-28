import { NextRequest } from "next/server";
import { z } from "zod";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { consultarRuc } from "@/lib/apiperu/client";

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
    const msg = err instanceof Error ? err.message : "Error al consultar RUC";
    console.error("[validar/ruc]", msg);
    return apiError("No se pudo verificar el RUC. Intente nuevamente.", 503);
  }
}
