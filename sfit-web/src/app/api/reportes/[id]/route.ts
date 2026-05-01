import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { CitizenReport } from "@/models/CitizenReport";
import { User } from "@/models/User";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { awardCoins } from "@/lib/coins/awardCoins";
import { triggerWebhook } from "@/lib/webhooks/triggerWebhook";
import { adjustVehicleReputation } from "@/lib/reputation/updateReputation";
import { sendPushToUser } from "@/lib/notifications/fcm";
import { createNotification } from "@/lib/notifications/create";

const UpdateSchema = z.object({
  status: z.enum(["pendiente", "revision", "validado", "rechazado"]).optional(),
  assignedFiscalId: z.string().refine(isValidObjectId).optional(),
  fraudScore: z.number().min(0).max(100).optional(),
  rejectionReason: z.string().trim().min(5, "El motivo debe tener al menos 5 caracteres").max(1000).optional(),
});

const REJECTIONS_BEFORE_SUSPENSION = 3;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const report = await CitizenReport.findById(id)
    .populate("vehicleId", "plate vehicleTypeKey brand model")
    .populate("citizenId", "name")
    .lean();
  if (!report) return apiNotFound("Reporte no encontrado");
  if (!(await canAccessMunicipality(auth.session, String(report.municipalityId)))) return apiForbidden();

  return apiResponse({
    id: String(report._id),
    municipalityId: String(report.municipalityId),
    vehicle: report.vehicleId,
    citizen: report.citizenId,
    category: report.category,
    vehicleTypeKey: report.vehicleTypeKey,
    citizenReputationLevel: report.citizenReputationLevel,
    status: report.status,
    description: report.description,
    evidenceUrl: report.evidenceUrl,
    imageUrls: report.imageUrls,
    qrVerified: report.qrVerified,
    fraudScore: report.fraudScore,
    fraudLayers: report.fraudLayers,
    latitude: report.latitude,
    longitude: report.longitude,
    rejectionReason: report.rejectionReason,
    assignedFiscalId: report.assignedFiscalId,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const body = await request.json().catch(() => ({}));
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "general";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  await connectDB();
  const report = await CitizenReport.findById(id);
  if (!report) return apiNotFound("Reporte no encontrado");
  if (!(await canAccessMunicipality(auth.session, String(report.municipalityId)))) return apiForbidden();

  // Reglas de transición: rechazar requiere motivo escrito (RF-12).
  if (parsed.data.status === "rechazado" && !parsed.data.rejectionReason) {
    return apiValidationError({ rejectionReason: ["Debes indicar el motivo del rechazo"] });
  }

  const previousStatus = report.status;
  Object.assign(report, parsed.data);
  await report.save();

  const newStatus = parsed.data.status;
  const statusChanged = !!newStatus && newStatus !== previousStatus;
  const ciudadanoId = report.citizenId ? String(report.citizenId) : null;

  // Anti-fraude RF-12: el contador de rechazos consecutivos vive en User.
  // Validar resetea, rechazar incrementa; al alcanzar el umbral, suspender.
  let suspendedNow = false;
  if (statusChanged && ciudadanoId) {
    if (newStatus === "validado") {
      await User.updateOne(
        { _id: ciudadanoId },
        { $set: { consecutiveRejectedReports: 0 } },
      );
    } else if (newStatus === "rechazado") {
      const updated = await User.findByIdAndUpdate(
        ciudadanoId,
        { $inc: { consecutiveRejectedReports: 1 } },
        { returnDocument: "after", projection: { consecutiveRejectedReports: 1, status: 1 } },
      );
      if (
        updated &&
        updated.consecutiveRejectedReports >= REJECTIONS_BEFORE_SUSPENSION &&
        updated.status === "activo"
      ) {
        await User.updateOne({ _id: ciudadanoId }, { $set: { status: "suspendido" } });
        suspendedNow = true;
      }
    }
  }

  // RF-12-10: Notificación push + in-app al ciudadano cuando cambia el estado de su reporte
  if (statusChanged && ciudadanoId && newStatus) {
    const reasonSuffix = report.rejectionReason ? ` Motivo: ${report.rejectionReason}` : "";
    const notifMsgs: Partial<Record<string, { title: string; body: string }>> = {
      revision:  { title: "Tu reporte está siendo revisado",    body: "Un fiscal está analizando tu denuncia. Te notificaremos cuando haya novedades." },
      validado:  { title: "¡Tu reporte fue validado!",          body: "Tu denuncia fue confirmada. Ganaste 20 SFITCoins por contribuir al transporte seguro." },
      rechazado: { title: "Resultado de tu reporte",            body: `Tu reporte fue revisado y no pudo ser validado.${reasonSuffix}` },
    };
    const msg = notifMsgs[newStatus];
    if (msg) {
      void sendPushToUser(ciudadanoId, msg.title, msg.body, { type: "reporte" });
      void createNotification({
        userId: ciudadanoId,
        title: msg.title,
        body: msg.body,
        type: "info",
        category: "reporte",
        link: "/mis-reportes",
      });
    }
    if (suspendedNow) {
      const title = "Cuenta suspendida temporalmente";
      const body = `Acumulaste ${REJECTIONS_BEFORE_SUSPENSION} reportes rechazados consecutivos. Tu cuenta fue suspendida y no podrás enviar nuevos reportes hasta que un administrador la reactive.`;
      void sendPushToUser(ciudadanoId, title, body, { type: "cuenta" });
      void createNotification({
        userId: ciudadanoId,
        title,
        body,
        type: "warning",
        category: "sistema",
      });
    }
  }

  // RF-15: Si el reporte pasa a 'validado', otorgar 20 SFITCoins al ciudadano y reducir reputación del vehículo
  if (newStatus === "validado" && previousStatus !== "validado" && ciudadanoId) {
    void awardCoins(ciudadanoId, 20, "reporte_validado", String(report._id));
    if (report.vehicleId) void adjustVehicleReputation(report.vehicleId, -5);

    // Webhook — no-bloqueante (RF integración externa)
    void triggerWebhook(String(report.municipalityId), "report.validated", {
      reportId: String(report._id),
      plate: report.vehicleId ? String(report.vehicleId) : null,
      category: report.category,
    });
  }

  return apiResponse({ id: String(report._id), ...report.toObject() });
}
