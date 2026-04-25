import { NextRequest } from "next/server";
import { z } from "zod";
import { apiResponse, apiError } from "@/lib/api/response";
import { consultarDni } from "@/lib/apiperu/client";

const Schema = z.object({
  dni: z.string().regex(/^\d{8}$/, "DNI debe tener exactamente 8 dígitos"),
});

// Endpoint público para usar durante el registro (sin token JWT).
// Solo devuelve nombres — no expone otros datos personales.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "DNI inválido", 400);
    }

    const data = await consultarDni(parsed.data.dni);
    // Solo exponemos el nombre — no el dígito verificador
    return apiResponse({
      nombres: data.nombres,
      apellido_paterno: data.apellido_paterno,
      apellido_materno: data.apellido_materno,
      nombre_completo: data.nombre_completo,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al consultar DNI";
    console.error("[public/validar-dni]", msg);
    return apiError("No se pudo verificar el DNI.", 503);
  }
}
