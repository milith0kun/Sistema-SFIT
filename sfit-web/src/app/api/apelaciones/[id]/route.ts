import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Apelacion } from "@/models/Apelacion";
import "@/models/Vehicle";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

type PopulatedSubmitter = { _id: unknown; name?: string; email?: string; role?: string } | null;
type PopulatedResolver  = { _id: unknown; name?: string } | null;
type PopulatedVehicle   = { _id: unknown; plate?: string; brand?: string; model?: string } | null;
type PopulatedInspection = {
  _id: unknown;
  date?: Date | string;
  result?: string;
  score?: number;
  vehicleId?: PopulatedVehicle;
} | null;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);
  try {
    await connectDB();
    const apel = await Apelacion.findById(id)
      .populate({
        path: "inspectionId",
        select: "date result score vehicleId",
        populate: { path: "vehicleId", select: "plate brand model" },
      })
      .populate("vehicleId", "plate brand model")
      .populate("submittedBy", "name email role")
      .populate("resolvedBy", "name")
      .lean();
    if (!apel) return apiNotFound("Apelación no encontrada");

    // Scope: admin_municipal y fiscal solo ven su municipio; operador solo las suyas
    if (auth.session.role === ROLES.ADMIN_MUNICIPAL || auth.session.role === ROLES.FISCAL) {
      if (String(apel.municipalityId) !== String(auth.session.municipalityId)) return apiForbidden();
    } else if (auth.session.role === ROLES.OPERADOR) {
      const submitter = apel.submittedBy as unknown as PopulatedSubmitter;
      const submitterId = submitter && submitter._id ? String(submitter._id) : String(apel.submittedBy);
      if (submitterId !== auth.session.userId) return apiForbidden();
    }

    const insp     = apel.inspectionId as unknown as PopulatedInspection;
    const submitter = apel.submittedBy  as unknown as PopulatedSubmitter;
    const resolver = apel.resolvedBy   as unknown as PopulatedResolver;
    const vehicle  = apel.vehicleId    as unknown as PopulatedVehicle;

    return apiResponse({
      id: String(apel._id),
      inspection: insp ? {
        id:     String(insp._id),
        date:   insp.date,
        result: insp.result,
        score:  insp.score ?? 0,
        vehicle: insp.vehicleId
          ? { id: String(insp.vehicleId._id), plate: insp.vehicleId.plate, brand: insp.vehicleId.brand, model: insp.vehicleId.model }
          : null,
      } : null,
      vehicle: vehicle
        ? { id: String(vehicle._id), plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model }
        : null,
      submittedBy: submitter
        ? { id: String(submitter._id), name: submitter.name, email: submitter.email, role: submitter.role }
        : null,
      reason:     apel.reason,
      evidence:   apel.evidence ?? [],
      status:     apel.status,
      resolution: apel.resolution,
      resolvedAt: apel.resolvedAt,
      resolvedBy: resolver
        ? { id: String(resolver._id), name: resolver.name }
        : null,
      createdAt:  apel.createdAt,
    });
  } catch (e) {
    console.error("[apelaciones/[id] GET]", e);
    return apiError("Error al obtener apelación", 500);
  }
}
