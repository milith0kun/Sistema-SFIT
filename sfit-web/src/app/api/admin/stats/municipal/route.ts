import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";
import { Driver } from "@/models/Driver";
import { Inspection } from "@/models/Inspection";
import { CitizenReport } from "@/models/CitizenReport";
import { Sanction } from "@/models/Sanction";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * RF-19-01: Estadísticas municipales para admin_municipal (y super_admin).
 *
 * Devuelve:
 *  - KPIs: vehículos activos, conductores activos, inspecciones del mes,
 *          reportes ciudadanos pendientes.
 *  - inspeccionesPorResultado: conteo aprobada / observada / rechazada del
 *    último mes (para PieChart).
 *  - top5VehiculosBajaReputacion: array de hasta 5 vehículos con menor
 *    reputationScore (activos) en la municipalidad.
 *  - ultimasSanciones: últimas 5 sanciones emitidas en la municipalidad.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [ROLES.ADMIN_MUNICIPAL, ROLES.SUPER_ADMIN]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { session } = auth;

  // Para super_admin puede pasar municipalityId como query param.
  // Para admin_municipal se usa el del JWT.
  let municipalityId: string | undefined;
  if (session.role === ROLES.SUPER_ADMIN) {
    municipalityId =
      new URL(request.url).searchParams.get("municipalityId") ?? undefined;
  } else {
    municipalityId = session.municipalityId;
  }

  if (!municipalityId) {
    return apiError(
      "municipalityId requerido (incluido en el token o como query param)",
      400,
    );
  }

  let munOid: mongoose.Types.ObjectId;
  try {
    munOid = new mongoose.Types.ObjectId(municipalityId);
  } catch {
    return apiError("municipalityId inválido", 400);
  }

  try {
    await connectDB();

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      activeVehicles,
      activeDrivers,
      inspectionsThisMonth,
      reportsPending,
      inspectionsByResult,
      lowRepVehicles,
      lastSanctions,
    ] = await Promise.all([
      // KPI 1: vehículos activos
      Vehicle.countDocuments({ municipalityId: munOid, active: true }),

      // KPI 2: conductores activos
      Driver.countDocuments({ municipalityId: munOid, active: true }),

      // KPI 3: inspecciones del mes en curso
      Inspection.countDocuments({
        municipalityId: munOid,
        date: { $gte: firstOfMonth },
      }),

      // KPI 4: reportes ciudadanos pendientes
      CitizenReport.countDocuments({
        municipalityId: munOid,
        status: "pendiente",
      }),

      // Gráfico pie: inspecciones del último mes por resultado
      Inspection.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            municipalityId: munOid,
            date: { $gte: firstOfMonth },
          },
        },
        {
          $group: {
            _id: "$result",
            count: { $sum: 1 },
          },
        },
      ]),

      // Top 5 vehículos con menor reputación (activos)
      Vehicle.find({ municipalityId: munOid, active: true })
        .sort({ reputationScore: 1 })
        .limit(5)
        .select("plate brand model reputationScore lastInspectionStatus status")
        .lean(),

      // Últimas 5 sanciones
      Sanction.find({ municipalityId: munOid })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("vehicleId", "plate brand model")
        .lean(),
    ]);

    // Normalizar pie data para que siempre incluya los 3 resultados posibles
    const resultMap: Record<string, number> = {
      aprobada: 0,
      observada: 0,
      rechazada: 0,
    };
    for (const row of inspectionsByResult) {
      if (row._id in resultMap) resultMap[row._id] = row.count;
    }

    return apiResponse({
      kpis: {
        activeVehicles,
        activeDrivers,
        inspectionsThisMonth,
        reportsPending,
      },
      inspeccionesPorResultado: [
        { result: "aprobada", count: resultMap.aprobada },
        { result: "observada", count: resultMap.observada },
        { result: "rechazada", count: resultMap.rechazada },
      ],
      top5VehiculosBajaReputacion: lowRepVehicles,
      ultimasSanciones: lastSanctions,
    });
  } catch (error) {
    console.error("[admin/stats/municipal GET]", error);
    return apiError("Error al obtener estadísticas municipales", 500);
  }
}
