import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { RouteCapture } from "@/models/RouteCapture";
import { Route } from "@/models/Route";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { ROLES } from "@/lib/constants";

const Body = z.object({
  routeId: z.string().refine(isValidObjectId, "routeId inválido"),
});

/**
 * POST /api/rutas/candidatas/[id]/asignar
 *
 * Vincula la captura a una Route ya existente. La captura pasa a "raw"
 * (alimenta convergencia de la ruta destino) y guarda `routeId`.
 * Validaciones: la Route destino debe existir y pertenecer a la misma muni
 * que la captura (no se permiten cross-muni).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0]?.toString() ?? "general";
      errors[k] = [...(errors[k] ?? []), i.message];
    }
    return apiValidationError(errors);
  }

  await connectDB();
  const cap = await RouteCapture.findById(id);
  if (!cap) return apiNotFound("Captura no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(cap.municipalityId)))) return apiForbidden();

  const route = await Route.findById(parsed.data.routeId).select("_id municipalityId").lean();
  if (!route) return apiNotFound("Ruta destino no encontrada");

  if (String(route.municipalityId) !== String(cap.municipalityId)) {
    return apiError("La ruta destino debe pertenecer a la misma municipalidad de la captura", 422);
  }

  cap.routeId = route._id as typeof cap.routeId;
  cap.status = "raw";
  await cap.save();

  return apiResponse({
    id: String(cap._id),
    routeId: String(cap.routeId),
    status: cap.status,
  });
}
