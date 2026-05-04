import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Apelacion } from "@/models/Apelacion";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { sendPushToUser } from "@/lib/notifications/fcm";
import { logAction } from "@/lib/audit/logAction";

const ResolveSchema = z.object({
  status: z.enum(["aprobada", "rechazada"]),
  resolution: z.string().min(5, "La resolución debe tener al menos 5 caracteres").max(2000),
});

// ── PATCH /api/apelaciones/[id]/resolver ─────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }

  const parsed = ResolveSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "general";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  try {
    await connectDB();

    const apelacion = await Apelacion.findById(id);
    if (!apelacion) return apiNotFound("Apelación no encontrada");

    // Scope: admin_municipal y fiscal solo resuelven de su municipio
    if (auth.session.role === ROLES.ADMIN_MUNICIPAL || auth.session.role === ROLES.FISCAL) {
      if (String(apelacion.municipalityId) !== String(auth.session.municipalityId)) return apiForbidden();
    }

    if (apelacion.status !== "pendiente") {
      return apiError("Solo se pueden resolver apelaciones en estado pendiente", 422);
    }

    apelacion.status = parsed.data.status;
    apelacion.resolution = parsed.data.resolution;
    apelacion.resolvedBy = auth.session.userId as unknown as typeof apelacion.resolvedBy;
    apelacion.resolvedAt = new Date();
    await apelacion.save();

    const updated = await Apelacion.findById(id)
      .populate("inspectionId", "result date score")
      .populate("vehicleId", "plate vehicleTypeKey brand model")
      .populate("submittedBy", "name email")
      .populate("resolvedBy", "name")
      .lean();

    if (!updated) return apiError("Error al recuperar apelación tras resolver", 500);

    // RF-18 — Notificar al operador que presentó la apelación (no-bloqueante)
    try {
      const statusLabel =
        parsed.data.status === "aprobada" ? "aprobada ✓" : "rechazada ✗";
      await sendPushToUser(
        String(apelacion.submittedBy),
        "Resolución de apelación",
        `Tu apelación fue ${statusLabel}`,
        {
          type: "apelacion_resuelta",
          apelacionId: id,
          status: parsed.data.status,
        },
      );
    } catch {
      // Silencioso — la notificación es best-effort
    }

    // Audit log — no-bloqueante
    void logAction({
      userId: auth.session.userId,
      action: parsed.data.status === "aprobada" ? "approve" : "reject",
      resource: "appeal",
      resourceId: id,
      details: { status: parsed.data.status, resolution: parsed.data.resolution },
      req: request,
      municipalityId: auth.session.municipalityId,
      role: auth.session.role,
    });

    type Pop<T> = T | null;
    type PInsp   = Pop<{ _id: unknown; result?: string; date?: Date | string; score?: number }>;
    type PVeh    = Pop<{ _id: unknown; plate?: string; vehicleTypeKey?: string; brand?: string; model?: string }>;
    type PUser   = Pop<{ _id: unknown; name?: string; email?: string }>;
    type PResolv = Pop<{ _id: unknown; name?: string }>;

    const insp     = updated.inspectionId as unknown as PInsp;
    const veh      = updated.vehicleId    as unknown as PVeh;
    const submit   = updated.submittedBy  as unknown as PUser;
    const resolver = updated.resolvedBy   as unknown as PResolv;

    return apiResponse({
      id: String(updated._id),
      inspection: insp
        ? { id: String(insp._id), result: insp.result, date: insp.date, score: insp.score ?? 0 }
        : null,
      vehicle: veh
        ? { id: String(veh._id), plate: veh.plate, vehicleTypeKey: veh.vehicleTypeKey, brand: veh.brand, model: veh.model }
        : null,
      submittedBy: submit
        ? { id: String(submit._id), name: submit.name, email: submit.email }
        : null,
      reason:     updated.reason,
      evidence:   updated.evidence ?? [],
      status:     updated.status,
      resolution: updated.resolution,
      resolvedAt: updated.resolvedAt,
      resolvedBy: resolver
        ? { id: String(resolver._id), name: resolver.name }
        : null,
      createdAt:  updated.createdAt,
    });
  } catch (error) {
    console.error("[apelaciones/resolver PATCH]", error);
    return apiError("Error al resolver apelación", 500);
  }
}
