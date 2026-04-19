import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Webhook } from "@/models/Webhook";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

/**
 * DELETE /api/admin/webhooks/[id]
 * Elimina un webhook por ID. Requiere ser admin del municipio propietario.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID de webhook inválido", 400);

  try {
    await connectDB();
    const webhook = await Webhook.findById(id).lean();
    if (!webhook) return apiNotFound("Webhook no encontrado");

    // Verificar acceso al municipio propietario del webhook
    if (auth.session.role !== ROLES.SUPER_ADMIN) {
      if (!(await canAccessMunicipality(auth.session, String(webhook.municipalityId)))) {
        return apiForbidden();
      }
    }

    await Webhook.deleteOne({ _id: id });
    return apiResponse({ deleted: true, id });
  } catch (error) {
    console.error("[webhooks DELETE]", error);
    return apiError("Error al eliminar webhook", 500);
  }
}
