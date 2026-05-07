import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { RouteCapture } from "@/models/RouteCapture";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { ROLES } from "@/lib/constants";

/**
 * POST /api/rutas/candidatas/[id]/descartar
 *
 * Marca la captura como `rejected`. No la borra (auditoría / pueden
 * restaurarse desde Mongo si fue accidente). El operador descarta
 * cuando el trazado es inutil (GPS errático, recorrido incompleto, etc.).
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

  await connectDB();
  const cap = await RouteCapture.findById(id);
  if (!cap) return apiNotFound("Captura no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(cap.municipalityId)))) return apiForbidden();

  cap.status = "rejected";
  await cap.save();

  return apiResponse({
    id: String(cap._id),
    status: cap.status,
  });
}
