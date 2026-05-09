import { NextRequest } from "next/server";
import { isValidObjectId, type Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";
import { Driver } from "@/models/Driver";
import { Trip } from "@/models/Trip";
import { Sanction } from "@/models/Sanction";
import { Route as RouteModel } from "@/models/Route";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, VEHICLE_STATUS, DRIVER_STATUS } from "@/lib/constants";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";

/**
 * GET /api/flota/analytics
 *
 * Analítica detallada de flota — alimenta el dashboard de operador
 * (sfit-app `fleet_analytics_page`) y la vista equivalente en web.
 *
 * Devuelve KPIs operativos por empresa: viajes hoy/semana, km, sanciones,
 * top rutas, y conteos de vehículos/conductores activos. Filtrado por
 * `companyId`:
 *   - Operador: forzado a su propia empresa (ignora ?companyId).
 *   - Admins: pueden pasar ?companyId para ver una empresa específica;
 *     si no lo pasan reciben totales agregados de su jurisdicción.
 *
 * Responde 400 si un OPERADOR no tiene empresa asignada — ese caso
 * antes daba lista vacía silenciosa, lo que enmascaraba problemas de
 * onboarding de empresas.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.OPERADOR,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_REGIONAL,
    ROLES.SUPER_ADMIN,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    await connectDB();
    const url = new URL(request.url);
    const companyIdParam = url.searchParams.get("companyId");

    // Resolución del scope (companyId + municipalityId)
    let companyId: string | null = null;
    if (auth.session.role === ROLES.OPERADOR) {
      companyId = await getOperatorCompanyId(auth.session.userId);
      if (!companyId) return apiError("Sin empresa asignada", 400);
    } else if (companyIdParam) {
      if (!isValidObjectId(companyIdParam)) {
        return apiError("companyId inválido", 400);
      }
      companyId = companyIdParam;
    }

    // Vehículos del scope: si hay companyId filtramos; si no, usamos
    // municipalityId del admin (admins sin companyId param ven todo su
    // territorio).
    const vehicleFilter: Record<string, unknown> = { active: true };
    if (companyId) {
      vehicleFilter.companyId = companyId;
    } else if (auth.session.role !== ROLES.SUPER_ADMIN) {
      if (!auth.session.municipalityId) return apiForbidden();
      vehicleFilter.municipalityId = auth.session.municipalityId;
    }

    const vehicles = await Vehicle.find(vehicleFilter)
      .select("_id status")
      .lean<Array<{ _id: Types.ObjectId; status?: string }>>();
    const vehicleIds = vehicles.map((v) => v._id);

    // Ventanas de tiempo (zona horaria del runtime; el cliente no necesita
    // alineación exacta para contadores agregados).
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const tripFilter = { vehicleId: { $in: vehicleIds } };
    const sanctionFilter = { vehicleId: { $in: vehicleIds } };

    // Query paralela: KPIs de viajes y sanciones + top rutas.
    const [
      tripsToday,
      tripsThisWeek,
      tripsAggWeek,
      tripsAggMonth,
      activeVehiclesCount,
      vehiclesEnRutaCount,
      activeDriversCount,
      sanctionsThisMonth,
      topRoutesAgg,
    ] = await Promise.all([
      Trip.countDocuments({ ...tripFilter, startTime: { $gte: todayStart } }),
      Trip.countDocuments({ ...tripFilter, startTime: { $gte: weekStart } }),
      Trip.aggregate([
        { $match: { ...tripFilter, startTime: { $gte: weekStart } } },
        {
          $group: {
            _id: null,
            kmTotal: { $sum: "$km" },
            passengersTotal: { $sum: "$passengers" },
            count: { $sum: 1 },
          },
        },
      ]),
      Trip.aggregate([
        { $match: { ...tripFilter, startTime: { $gte: monthStart } } },
        {
          $group: {
            _id: null,
            kmTotal: { $sum: "$km" },
          },
        },
      ]),
      Promise.resolve(
        vehicles.filter((v) =>
          [VEHICLE_STATUS.DISPONIBLE, VEHICLE_STATUS.EN_RUTA].includes(
            v.status as never,
          ),
        ).length,
      ),
      Promise.resolve(
        vehicles.filter((v) => v.status === VEHICLE_STATUS.EN_RUTA).length,
      ),
      Driver.countDocuments({
        ...(companyId ? { companyId } : {}),
        ...(auth.session.municipalityId && !companyId
          ? { municipalityId: auth.session.municipalityId }
          : {}),
        active: true,
        status: DRIVER_STATUS.APTO,
      }),
      Sanction.countDocuments({
        ...sanctionFilter,
        createdAt: { $gte: monthStart },
        status: { $ne: "anulada" },
      }),
      Trip.aggregate([
        {
          $match: {
            ...tripFilter,
            startTime: { $gte: monthStart },
            routeId: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: "$routeId",
            count: { $sum: 1 },
            kmTotal: { $sum: "$km" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const weekKm = tripsAggWeek[0]?.kmTotal ?? 0;
    const weekPassengers = tripsAggWeek[0]?.passengersTotal ?? 0;
    const weekTripCount = tripsAggWeek[0]?.count ?? 0;
    const monthKm = tripsAggMonth[0]?.kmTotal ?? 0;

    // Resolver nombres de rutas en bloque para no hacer N populates.
    const routeIds = (topRoutesAgg as Array<{ _id: Types.ObjectId }>)
      .map((r) => r._id)
      .filter((id): id is Types.ObjectId => Boolean(id));
    const routes = routeIds.length > 0
      ? await RouteModel.find({ _id: { $in: routeIds } })
          .select("code name")
          .lean<Array<{ _id: Types.ObjectId; code: string; name: string }>>()
      : [];
    const routeMap = new Map(routes.map((r) => [String(r._id), r]));

    const topRoutes = topRoutesAgg.map((r: { _id: unknown; count: number; kmTotal: number }) => {
      const route = routeMap.get(String(r._id));
      return {
        routeId: String(r._id),
        code: route?.code ?? "—",
        name: route?.name ?? "Ruta desconocida",
        trips: r.count,
        km: r.kmTotal,
      };
    });

    return apiResponse({
      scope: {
        companyId: companyId ?? null,
        municipalityId: companyId ? null : auth.session.municipalityId ?? null,
        role: auth.session.role,
      },
      vehicles: {
        total: vehicles.length,
        active: activeVehiclesCount,
        enRuta: vehiclesEnRutaCount,
      },
      drivers: {
        activeApto: activeDriversCount,
      },
      trips: {
        today: tripsToday,
        thisWeek: tripsThisWeek,
        weekKm,
        weekPassengers,
        weekAvgPassengersPerTrip: weekTripCount > 0
          ? Math.round((weekPassengers / weekTripCount) * 10) / 10
          : 0,
        monthKm,
      },
      sanctions: {
        thisMonth: sanctionsThisMonth,
      },
      topRoutes,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("[flota/analytics GET]", error);
    return apiError("Error al calcular analítica de flota", 500);
  }
}
