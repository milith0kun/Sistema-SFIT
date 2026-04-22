import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Apelacion } from "@/models/Apelacion";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);
  try {
    await connectDB();
    const apel = await Apelacion.findById(id)
      .populate("inspectionId", "date result score vehicleId")
      .populate("submittedBy", "name role")
      .populate("resolvedBy", "name")
      .lean();
    if (!apel) return apiNotFound("Apelación no encontrada");

    // Scope: admin_municipal y fiscal solo ven su municipio; operador solo las suyas
    if (auth.session.role === ROLES.ADMIN_MUNICIPAL || auth.session.role === ROLES.FISCAL) {
      if (String(apel.municipalityId) !== String(auth.session.municipalityId)) return apiForbidden();
    } else if (auth.session.role === ROLES.OPERADOR) {
      if (String(apel.submittedBy) !== auth.session.userId) return apiForbidden();
    }
    const insp = apel.inspectionId as { _id: unknown; date?: string; result?: string; score?: number; vehicleId?: { plate?: string } } | null;
    return apiResponse({
      id: String(apel._id),
      inspection: insp ? {
        id: String(insp._id),
        date: insp.date,
        result: insp.result,
        score: insp.score ?? 0,
        vehicle: insp.vehicleId,
      } : null,
      submittedBy: apel.submittedBy,
      reason: apel.reason,
      evidence: apel.evidence ?? [],
      status: apel.status,
      resolution: apel.resolution,
      resolvedAt: apel.resolvedAt,
      resolvedBy: apel.resolvedBy,
      createdAt: apel.createdAt,
    });
  } catch (e) {
    console.error("[apelaciones/[id] GET]", e);
    return apiError("Error al obtener apelación", 500);
  }
}
