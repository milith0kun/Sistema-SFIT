import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
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
 * GET /api/admin/stats/provincial
 *
 * KPI consolidado por provincia: suma inspecciones, reportes, sanciones,
 * vehículos y conductores de TODAS las munis dentro de la provincia.
 *
 * Acceso: super_admin (con ?provinceId=...), admin_provincial (su provincia),
 * admin_regional (cualquier provincia de su región).
 *
 * Adicionalmente devuelve breakdown por municipalidad para que el dashboard
 * pueda mostrar la tabla "muni a muni" sin pegar tantos round-trips.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_REGIONAL, ROLES.ADMIN_PROVINCIAL,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  const { session } = auth;

  // Resolver provinceId según rol
  let provinceId: string | undefined;
  if (session.role === ROLES.SUPER_ADMIN || session.role === ROLES.ADMIN_REGIONAL) {
    provinceId = new URL(request.url).searchParams.get("provinceId") ?? undefined;
  } else {
    provinceId = session.provinceId;
  }

  if (!provinceId) {
    return apiError("provinceId requerido", 400);
  }

  let provOid: mongoose.Types.ObjectId;
  try {
    provOid = new mongoose.Types.ObjectId(provinceId);
  } catch {
    return apiError("provinceId inválido", 400);
  }

  try {
    await connectDB();

    // Si admin_regional → validar que la provincia esté en su región
    if (session.role === ROLES.ADMIN_REGIONAL) {
      const { Province } = await import("@/models/Province");
      const prov = await Province.findById(provOid).select("regionId").lean();
      if (!prov || String(prov.regionId) !== String(session.regionId)) {
        return apiForbidden("Provincia fuera de su región");
      }
    }

    const munis = await Municipality.find({ provinceId: provOid })
      .select("_id name")
      .sort({ name: 1 })
      .lean();
    const muniIds = munis.map((m) => m._id);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      activeVehicles,
      activeDrivers,
      inspectionsThisMonth,
      reportsPending,
      sanctionsThisMonth,
      perMuni,
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
      // Breakdown por muni en una sola pasada
      Promise.all(munis.map(async (m) => {
        const [veh, dri, ins, rep, san] = await Promise.all([
          Vehicle.countDocuments({ municipalityId: m._id, active: true }),
          Driver.countDocuments({ municipalityId: m._id, active: true }),
          Inspection.countDocuments({
            municipalityId: m._id,
            date: { $gte: monthStart },
          }),
          CitizenReport.countDocuments({
            municipalityId: m._id,
            status: "pendiente",
          }),
          Sanction.countDocuments({
            municipalityId: m._id,
            createdAt: { $gte: monthStart },
          }),
        ]);
        return {
          municipalityId: String(m._id),
          name: m.name,
          activeVehicles: veh,
          activeDrivers: dri,
          inspectionsThisMonth: ins,
          reportsPending: rep,
          sanctionsThisMonth: san,
        };
      })),
    ]);

    return apiResponse({
      provinceId: String(provOid),
      kpis: {
        activeVehicles,
        activeDrivers,
        inspectionsThisMonth,
        reportsPending,
        sanctionsThisMonth,
        municipalities: munis.length,
      },
      municipalities: perMuni,
    });
  } catch (error) {
    console.error("[admin/stats/provincial GET]", error);
    return apiError("Error al obtener estadísticas provinciales", 500);
  }
}
