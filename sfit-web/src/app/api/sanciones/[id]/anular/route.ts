import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Sanction } from "@/models/Sanction";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { ROLES } from "@/lib/constants";
import { logAction } from "@/lib/audit/logAction";
import { createNotification } from "@/lib/notifications/create";

const Schema = z.object({
  reason: z.string().trim().min(5, "El motivo debe tener al menos 5 caracteres").max(500),
});

/**
 * POST /api/sanciones/[id]/anular
 *
 * Anula una sanción ya emitida. Reservado a super_admin, admin_municipal y
 * fiscal de la misma muni que emitió la sanción. Persiste el motivo en
 * appealNotes y dispara notificación al issuer.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const body = await request.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0]?.toString() ?? "general";
      errors[k] = [...(errors[k] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  try {
    await connectDB();
    const sanction = await Sanction.findById(id);
    if (!sanction) return apiNotFound("Sanción no encontrada");

    if (!(await canAccessMunicipality(auth.session, String(sanction.municipalityId)))) {
      return apiForbidden();
    }

    if (sanction.status === "anulada") {
      return apiError("La sanción ya está anulada", 422);
    }

    sanction.status = "anulada";
    const prevNotes = sanction.appealNotes ? sanction.appealNotes + "\n\n" : "";
    sanction.appealNotes = `${prevNotes}[ANULADA por ${auth.session.role}] ${parsed.data.reason}`;
    (sanction as unknown as { resolvedAt: Date }).resolvedAt = new Date();
    await sanction.save();

    void logAction({
      userId: auth.session.userId,
      action: "sanction.cancelled",
      resource: "sanction",
      resourceId: String(sanction._id),
      details: { reason: parsed.data.reason, municipalityId: String(sanction.municipalityId) },
      req: request,
      municipalityId: auth.session.municipalityId,
      role: auth.session.role,
    });

    // Notificación best-effort al issuer original (no-bloqueante)
    if (sanction.issuedBy) {
      void createNotification({
        userId: String(sanction.issuedBy),
        title: "Sanción anulada",
        body: `La sanción que emitiste fue anulada. Motivo: ${parsed.data.reason}`,
        type: "warning",
        category: "sancion",
        link: `/sanciones/${String(sanction._id)}`,
      }).catch(() => {});
    }

    return apiResponse({
      id: String(sanction._id),
      status: sanction.status,
      appealNotes: sanction.appealNotes,
      resolvedAt: sanction.resolvedAt,
    });
  } catch (error) {
    console.error("[sanciones/:id/anular POST]", error);
    return apiError("Error al anular sanción", 500);
  }
}
