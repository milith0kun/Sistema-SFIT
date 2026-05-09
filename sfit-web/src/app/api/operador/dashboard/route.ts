/**
 * GET /api/operador/dashboard
 *
 * Resumen agregado de la empresa del operador para el home de la app
 * móvil. Reemplaza los KPIs hardcodeados (45/32/28/2) del
 * `operator_dashboard_page.dart`.
 *
 * Filtra TODO por la `companyId` resuelta vía `getOperatorCompanyId()` —
 * sin empresa asignada el endpoint devuelve un payload con `company: null`
 * y contadores en cero (la app muestra estado vacío sin error).
 */
import { NextRequest } from "next/server";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Company } from "@/models/Company";
import { Vehicle } from "@/models/Vehicle";
import { Driver } from "@/models/Driver";
import { FleetEntry } from "@/models/FleetEntry";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";

const SOAT_ALERT_WINDOW_DAYS = 30;

interface StatusCount {
  _id: string;
  count: number;
}

function startOfTodayUTC(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function emptyPayload() {
  return {
    company: null,
    vehicles: { total: 0, disponible: 0, en_ruta: 0, en_mantenimiento: 0, fuera_de_servicio: 0 },
    drivers:  { total: 0, apto: 0, riesgo: 0, no_apto: 0 },
    fleetToday: { totalEntries: 0, enRuta: 0, cerradas: 0, kmTotalToday: 0 },
    alerts: { soatProxVencer: 0, conductoresEnRiesgo: 0, vehiculosOffRoute: 0 },
  };
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.OPERADOR,
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const companyId = await getOperatorCompanyId(auth.session.userId);
    if (!companyId) {
      return apiResponse(emptyPayload());
    }

    await connectDB();

    const today = startOfTodayUTC();
    const soatThreshold = new Date(Date.now() + SOAT_ALERT_WINDOW_DAYS * 86400000);

    // Resolver IDs de los vehículos de la empresa una sola vez — las dos
    // consultas de FleetEntry los necesitan.
    const companyVehicleIds = await Vehicle.find({ companyId })
      .select("_id")
      .lean<{ _id: Types.ObjectId }[]>();
    const vehicleIds: Types.ObjectId[] = companyVehicleIds.map((v) => v._id);

    const [
      company,
      vehicleStatusCounts,
      driverStatusCounts,
      fleetToday,
      soatProxVencer,
      conductoresEnRiesgo,
      vehiculosOffRoute,
    ] = await Promise.all([
      Company.findById(companyId)
        .select("razonSocial ruc serviceScope coverage")
        .lean<{
          _id: unknown;
          razonSocial: string;
          ruc: string;
          serviceScope?: string;
          coverage?: { departmentCodes: string[]; provinceCodes: string[]; districtCodes: string[] };
        } | null>(),
      Vehicle.aggregate<StatusCount>([
        { $match: { companyId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Driver.aggregate<StatusCount>([
        { $match: { companyId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      vehicleIds.length === 0
        ? Promise.resolve([])
        : FleetEntry.aggregate<{ _id: string | null; count: number; km: number }>([
            { $match: { vehicleId: { $in: vehicleIds }, date: { $gte: today } } },
            { $group: { _id: "$status", count: { $sum: 1 }, km: { $sum: { $ifNull: ["$km", 0] } } } },
          ]),
      Vehicle.countDocuments({
        companyId,
        active: true,
        soatExpiry: { $exists: true, $ne: null, $lte: soatThreshold },
      }),
      Driver.countDocuments({ companyId, status: "riesgo" }),
      vehicleIds.length === 0
        ? Promise.resolve(0)
        : FleetEntry.countDocuments({
            vehicleId: { $in: vehicleIds },
            status: "en_ruta",
            offRouteSince: { $ne: null },
          }),
    ]);

    // Normaliza arreglos de aggregate a contadores nominales.
    const vCounts = Object.fromEntries(vehicleStatusCounts.map((c) => [c._id, c.count]));
    const dCounts = Object.fromEntries(driverStatusCounts.map((c) => [c._id, c.count]));
    const fCounts = Object.fromEntries(fleetToday.map((c) => [c._id ?? "sin_status", c.count]));
    const fKm = fleetToday.reduce((sum, c) => sum + (c.km ?? 0), 0);

    const vehicles = {
      total: vehicleStatusCounts.reduce((s, c) => s + c.count, 0),
      disponible:        vCounts["disponible"]        ?? 0,
      en_ruta:           vCounts["en_ruta"]           ?? 0,
      en_mantenimiento:  vCounts["en_mantenimiento"]  ?? 0,
      fuera_de_servicio: vCounts["fuera_de_servicio"] ?? 0,
    };
    const drivers = {
      total:   driverStatusCounts.reduce((s, c) => s + c.count, 0),
      apto:    dCounts["apto"]    ?? 0,
      riesgo:  dCounts["riesgo"]  ?? 0,
      no_apto: dCounts["no_apto"] ?? 0,
    };
    const fleetTodayResult = {
      totalEntries: fleetToday.reduce((s, c) => s + c.count, 0),
      enRuta:   fCounts["en_ruta"] ?? 0,
      cerradas: (fCounts["cerrado"] ?? 0) + (fCounts["auto_cierre"] ?? 0),
      kmTotalToday: Math.round(fKm),
    };

    return apiResponse({
      company: company
        ? {
            id: String(company._id),
            razonSocial: company.razonSocial,
            ruc: company.ruc,
            serviceScope: company.serviceScope ?? "urbano_distrital",
            departmentCodes: company.coverage?.departmentCodes ?? [],
            provinceCodes:   company.coverage?.provinceCodes   ?? [],
            districtCodes:   company.coverage?.districtCodes   ?? [],
          }
        : null,
      vehicles,
      drivers,
      fleetToday: fleetTodayResult,
      alerts: {
        soatProxVencer,
        conductoresEnRiesgo,
        vehiculosOffRoute,
      },
    });
  } catch (error) {
    console.error("[operador/dashboard GET]", error);
    return apiError("Error al obtener el dashboard del operador", 500);
  }
}
