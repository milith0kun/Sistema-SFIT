import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Inspection } from "@/models/Inspection";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  await connectDB();
  const insp = await Inspection.findById(id)
    .populate("vehicleId", "plate vehicleTypeKey brand model")
    .populate("fiscalId", "name")
    .populate("driverId", "name")
    .lean();
  if (!insp) return apiNotFound("Inspección no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(insp.municipalityId)))) return apiForbidden();

  const vehicleObj = insp.vehicleId as unknown as { _id?: unknown; plate?: string; vehicleTypeKey?: string; brand?: string; model?: string } | null;
  const fiscalObj = insp.fiscalId as unknown as { _id?: unknown; name?: string } | null;
  const driverObj = insp.driverId as unknown as { _id?: unknown; name?: string } | null;

  return apiResponse({
    id: String(insp._id),
    municipalityId: String(insp.municipalityId),
    vehicleId: vehicleObj?._id ? String(vehicleObj._id) : undefined,
    vehiclePlate: vehicleObj?.plate,
    vehicle: vehicleObj,
    fiscalId: fiscalObj?._id ? String(fiscalObj._id) : undefined,
    fiscalName: fiscalObj?.name,
    fiscal: fiscalObj,
    driverId: driverObj?._id ? String(driverObj._id) : undefined,
    driverName: driverObj?.name,
    driver: driverObj,
    vehicleTypeKey: insp.vehicleTypeKey,
    checklistResults: insp.checklistResults,
    score: insp.score,
    result: insp.result,
    observations: insp.observations,
    evidenceUrls: insp.evidenceUrls,
    qrCode: insp.qrCode,
    date: insp.date,
    createdAt: insp.createdAt,
    updatedAt: insp.updatedAt,
  });
}
