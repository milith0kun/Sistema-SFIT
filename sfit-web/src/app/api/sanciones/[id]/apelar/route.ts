import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Sanction } from "@/models/Sanction";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { logAction } from "@/lib/audit/logAction";
import { createNotificationForRoles } from "@/lib/notifications/create";

const Schema = z.object({
  reason: z.string().trim().min(20, "El motivo debe tener al menos 20 caracteres").max(2000),
  evidence: z.array(z.string().url("URL de evidencia inválida")).max(5).optional(),
});

/**
 * POST /api/sanciones/[id]/apelar
 *
 * El conductor afectado por una sanción puede apelarla. Sólo se permite si
 * el `driverId` de la sanción corresponde al `Driver` del usuario autenticado
 * (vínculo por `userId`, fallback a DNI+municipio igual que en /viajes).
 *
 * Cambia `status` de la sanción a "apelada" y guarda el motivo + evidencia
 * en `appealNotes` (acumulando si ya había notas previas). Una sanción sólo
 * se puede apelar una vez (rechazamos si ya está en estado apelada/anulada).
 *
 * Notifica a fiscales y admin_municipal de la muni — RF-18.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.CONDUCTOR]);
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

    // Resolver el Driver del conductor autenticado (igual que en /sanciones GET).
    let driver = await Driver.findOne({ userId: auth.session.userId })
      .select("_id municipalityId")
      .lean();
    if (!driver && auth.session.municipalityId) {
      const user = await User.findById(auth.session.userId).select("dni").lean();
      if (user?.dni) {
        driver = await Driver.findOne({
          dni: user.dni,
          municipalityId: auth.session.municipalityId,
        }).select("_id municipalityId").lean();
      }
    }
    if (!driver) return apiForbidden();

    const sanction = await Sanction.findById(id);
    if (!sanction) return apiNotFound("Sanción no encontrada");

    // El conductor sólo puede apelar SUS sanciones.
    if (!sanction.driverId || String(sanction.driverId) !== String(driver._id)) {
      return apiForbidden();
    }

    if (sanction.status === "apelada") {
      return apiError("Esta sanción ya fue apelada", 409);
    }
    if (sanction.status === "anulada") {
      return apiError("No se puede apelar una sanción anulada", 422);
    }
    if (sanction.status === "confirmada") {
      return apiError("No se puede apelar una sanción confirmada", 422);
    }

    sanction.status = "apelada";
    const prevNotes = sanction.appealNotes ? sanction.appealNotes + "\n\n" : "";
    const evidenceLine = parsed.data.evidence && parsed.data.evidence.length > 0
      ? `\nEvidencia: ${parsed.data.evidence.join(", ")}`
      : "";
    sanction.appealNotes = `${prevNotes}[APELADA por conductor] ${parsed.data.reason}${evidenceLine}`;
    await sanction.save();

    void logAction({
      userId: auth.session.userId,
      action: "sanction.appealed",
      resource: "sanction",
      resourceId: String(sanction._id),
      details: {
        municipalityId: String(sanction.municipalityId),
        evidenceCount: parsed.data.evidence?.length ?? 0,
      },
      req: request,
      municipalityId: auth.session.municipalityId,
      role: auth.session.role,
    });

    // Notificar a fiscales y admin_municipal — best-effort, no bloquea.
    void createNotificationForRoles(
      [ROLES.FISCAL, ROLES.ADMIN_MUNICIPAL],
      {
        title: "Sanción apelada",
        body: "Un conductor apeló una sanción y requiere revisión.",
        type: "info",
        category: "apelacion",
        link: `/sanciones/${String(sanction._id)}`,
        metadata: {
          type: "sancion_apelada",
          sanctionId: String(sanction._id),
          driverId: String(driver._id),
        },
        municipalityId: String(sanction.municipalityId),
      },
    ).catch(() => {});

    return apiResponse({
      id: String(sanction._id),
      status: sanction.status,
      appealNotes: sanction.appealNotes,
    });
  } catch (error) {
    console.error("[sanciones/:id/apelar POST]", error);
    return apiError("Error al apelar sanción", 500);
  }
}
