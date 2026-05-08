import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { CitizenReport } from "@/models/CitizenReport";
import {
  apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { logAction } from "@/lib/audit/logAction";
import { createNotificationForRoles } from "@/lib/notifications/create";
import { rolesFor } from "@/lib/auth/roleMatrix";

const Schema = z.object({
  reason: z.string().trim().min(20, "El motivo debe tener al menos 20 caracteres").max(2000),
  evidence: z.array(z.string().url("URL de evidencia inválida")).max(3).optional(),
});

/**
 * POST /api/reportes/[id]/apelar
 *
 * El ciudadano autor de un reporte puede apelar cuando un fiscal lo rechaza.
 * Cambia el status a "revision" para que vuelva a la cola del fiscal con el
 * motivo de apelación visible. Sólo se permite una apelación por reporte
 * (controlado por `appealedAt`).
 *
 * Notifica a fiscales y admin_municipal de la muni del reporte — RF-18.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [...rolesFor("reportes", "create")]);
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
    const report = await CitizenReport.findById(id);
    if (!report) return apiNotFound("Reporte no encontrado");

    // Sólo el autor del reporte puede apelarlo.
    if (!report.citizenId || String(report.citizenId) !== String(auth.session.userId)) {
      return apiForbidden();
    }
    if (report.status !== "rechazado") {
      return apiError("Sólo se pueden apelar reportes rechazados", 422);
    }
    if (report.appealedAt) {
      return apiError("Este reporte ya fue apelado", 409);
    }

    report.status = "revision";
    report.appealReason = parsed.data.reason;
    if (parsed.data.evidence && parsed.data.evidence.length > 0) {
      report.appealEvidence = parsed.data.evidence;
    }
    report.appealedAt = new Date();
    await report.save();

    void logAction({
      userId: auth.session.userId,
      action: "report.appealed",
      resource: "report",
      resourceId: String(report._id),
      details: {
        municipalityId: String(report.municipalityId),
        evidenceCount: parsed.data.evidence?.length ?? 0,
      },
      req: request,
      municipalityId: auth.session.municipalityId,
      role: auth.session.role,
    });

    void createNotificationForRoles(
      [ROLES.FISCAL, ROLES.ADMIN_MUNICIPAL],
      {
        title: "Reporte apelado",
        body: "Un ciudadano apeló su reporte rechazado y requiere re-revisión.",
        type: "info",
        category: "reporte",
        link: `/reportes/${String(report._id)}`,
        metadata: {
          type: "reporte_apelado",
          reportId: String(report._id),
        },
        municipalityId: String(report.municipalityId),
      },
    ).catch(() => {});

    return apiResponse({
      id: String(report._id),
      status: report.status,
      appealReason: report.appealReason,
      appealedAt: report.appealedAt,
    });
  } catch (error) {
    console.error("[reportes/:id/apelar POST]", error);
    return apiError("Error al apelar reporte", 500);
  }
}
