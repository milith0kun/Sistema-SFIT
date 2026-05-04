import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Province } from "@/models/Province";
import { Municipality } from "@/models/Municipality";
import { Vehicle } from "@/models/Vehicle";
import { Driver } from "@/models/Driver";
import { Inspection } from "@/models/Inspection";
import { CitizenReport } from "@/models/CitizenReport";
import { Sanction } from "@/models/Sanction";
import {
  apiResponse, apiError, apiForbidden, apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * GET /api/admin/stats/regional
 *
 * KPI consolidado por región: suma todos los datos de las provincias dentro
 * de la región, agrupado.
 *
 * Acceso: super_admin (con ?regionId=...), admin_regional (su región).
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_REGIONAL]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { session } = auth;

  let regionId: string | undefined;
  if (session.role === ROLES.SUPER_ADMIN) {
    regionId = new URL(request.url).searchParams.get("regionId") ?? undefined;
  } else {
    regionId = session.regionId;
  }

  if (!regionId) return apiError("regionId requerido", 400);

  let regOid: mongoose.Types.ObjectId;
  try {
    regOid = new mongoose.Types.ObjectId(regionId);
  } catch {
    return apiError("regionId inválido", 400);
  }

  try {
    await connectDB();

    const provs = await Province.find({ regionId: regOid })
      .select("_id name")
      .sort({ name: 1 })
      .lean();
    const provIds = provs.map((p) => p._id);

    const munis = provIds.length > 0
      ? await Municipality.find({ provinceId: { $in: provIds } })
          .select("_id provinceId")
          .lean()
      : [];
    const muniIds = munis.map((m) => m._id);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      activeVehicles,
      activeDrivers,
      inspectionsThisMonth,
      reportsPending,
      sanctionsThisMonth,
      perProv,
    ] = await Promise.all([
      Vehicle.countDocuments({ municipalityId: { $in: muniIds }, active: true }),
      Driver.countDocuments({ municipalityId: { $in: muniIds }, active: true }),
      Inspection.countDocuments({
        municipalityId: { $in: muniIds },
        date: { $gte: monthStart },
      }),
      CitizenReport.countDocuments({
        municipalityId: { $in: muniIds },
        status: "pendiente",
      }),
      Sanction.countDocuments({
        municipalityId: { $in: muniIds },
        createdAt: { $gte: monthStart },
      }),
      // Breakdown por provincia
      Promise.all(provs.map(async (p) => {
        const provMuniIds = munis
          .filter((m) => String(m.provinceId) === String(p._id))
          .map((m) => m._id);
        const [veh, dri, ins, rep, san] = await Promise.all([
          Vehicle.countDocuments({ municipalityId: { $in: provMuniIds }, active: true }),
          Driver.countDocuments({ municipalityId: { $in: provMuniIds }, active: true }),
          Inspection.countDocuments({
            municipalityId: { $in: provMuniIds },
            date: { $gte: monthStart },
          }),
          CitizenReport.countDocuments({
            municipalityId: { $in: provMuniIds },
            status: "pendiente",
          }),
          Sanction.countDocuments({
            municipalityId: { $in: provMuniIds },
            createdAt: { $gte: monthStart },
          }),
        ]);
        return {
          provinceId: String(p._id),
          name: p.name,
          activeVehicles: veh,
          activeDrivers: dri,
          inspectionsThisMonth: ins,
          reportsPending: rep,
          sanctionsThisMonth: san,
          municipalities: provMuniIds.length,
        };
      })),
    ]);

    return apiResponse({
      regionId: String(regOid),
      kpis: {
        activeVehicles,
        activeDrivers,
        inspectionsThisMonth,
        reportsPending,
        sanctionsThisMonth,
        provinces: provs.length,
        municipalities: munis.length,
      },
      provinces: perProv,
    });
  } catch (error) {
    console.error("[admin/stats/regional GET]", error);
    return apiError("Error al obtener estadísticas regionales", 500);
  }
}
