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
    return apiResponse({
      id: String(apel._id),
      inspection: {
        id: String((apel.inspectionId as { _id: unknown })._id),
        date: (apel.inspectionId as { date?: string }).date,
        result: (apel.inspectionId as { result?: string }).result,
        score: (apel.inspectionId as { score?: number }).score ?? 0,
        vehicle: (apel.inspectionId as { vehicleId?: { plate?: string } }).vehicleId,
      },
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
