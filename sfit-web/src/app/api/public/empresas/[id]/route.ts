import { NextRequest } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Company } from "@/models/Company";
import { Vehicle } from "@/models/Vehicle";
import { Driver } from "@/models/Driver";
import "@/models/Municipality";
import { apiError, apiNotFound, apiResponse } from "@/lib/api/response";

/**
 * GET /api/public/empresas/[id]
 *
 * Endpoint público (sin auth) — el ciudadano puede ver el perfil de la
 * empresa que opera un bus desde el feed/QR/buscar vehículo. Sólo expone
 * campos no sensibles: razón social, RUC, municipio, tipo de servicio,
 * tipos de vehículo permitidos, totales agregados (flota, conductores) y
 * reputación promedio. Nunca expone representante legal ni contactos.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  try {
    await connectDB();
    const company = await Company.findById(id)
      .populate("municipalityId", "name ubigeoCode")
      .select("ruc razonSocial municipalityId serviceScope vehicleTypeKeys reputationScore active approvedAt createdAt")
      .lean<{
        _id: Types.ObjectId;
        ruc: string;
        razonSocial: string;
        municipalityId: { _id: Types.ObjectId; name?: string; ubigeoCode?: string } | null;
        serviceScope?: string;
        vehicleTypeKeys?: string[];
        reputationScore?: number;
        active?: boolean;
        approvedAt?: Date;
        createdAt?: Date;
      } | null>();
    if (!company || company.active === false || !company.approvedAt) return apiNotFound("Empresa no encontrada");

    // Agregaciones rápidas sobre la flota.
    const [vehicleCount, vehicleAggregate, driverCount] = await Promise.all([
      Vehicle.countDocuments({ companyId: company._id }),
      Vehicle.aggregate<{ avg: number }>([
        { $match: { companyId: company._id } },
        { $group: { _id: null, avg: { $avg: "$reputationScore" } } },
      ]),
      Driver.countDocuments({ companyId: company._id, active: true }),
    ]);

    const fleetReputation = vehicleAggregate[0]?.avg ?? null;

    return apiResponse({
      id: String(company._id),
      ruc: company.ruc,
      razonSocial: company.razonSocial,
      municipalityName: company.municipalityId?.name ?? null,
      ubigeoCode: company.municipalityId?.ubigeoCode ?? null,
      serviceScope: company.serviceScope ?? null,
      vehicleTypeKeys: company.vehicleTypeKeys ?? [],
      reputationScore: company.reputationScore ?? null,
      vehicleCount,
      driverCount,
      fleetReputation: fleetReputation != null ? Math.round(fleetReputation) : null,
      memberSince: company.createdAt ?? null,
    });
  } catch (error) {
    console.error("[public/empresas/:id GET]", error);
    return apiError("Error al obtener empresa", 500);
  }
}
