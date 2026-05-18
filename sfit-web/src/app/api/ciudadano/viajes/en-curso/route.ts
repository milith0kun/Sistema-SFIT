/**
 * GET /api/ciudadano/viajes/en-curso
 *
 * Devuelve los viajes interprovinciales activos en los que el ciudadano se
 * registró. NO incluye `lat`/`lng` ni track points por privacidad (rutas
 * interprovinciales de pocas personas — exponer su trazado violaría la
 * política). Solo expone metadatos del bus, empresa, conductor (si hay) y
 * velocidad instantánea.
 *
 * El cliente hace polling cada ~10s a este endpoint para refrescar la
 * velocidad mientras está a bordo.
 */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { CitizenTripRegistration } from "@/models/CitizenTripRegistration";
import { Trip } from "@/models/Trip";
import { Vehicle } from "@/models/Vehicle";
import { Company } from "@/models/Company";
import { FleetEntry } from "@/models/FleetEntry";
import { Driver } from "@/models/Driver";
import {
  apiResponse,
  apiUnauthorized,
  apiForbidden,
} from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();
  if (session.role !== ROLES.CIUDADANO) return apiForbidden();

  await connectDB();

  // Registros activos del ciudadano (sin endedAt). Suele ser 0 o 1, pero el
  // modelo permite múltiples (poco probable: implicaría viajar en 2 buses).
  const registrations = await CitizenTripRegistration.find({
    userId: session.userId,
    endedAt: { $exists: false },
  })
    .sort({ boardedAt: -1 })
    .lean();

  if (registrations.length === 0) {
    return apiResponse({ items: [] });
  }

  const tripIds = registrations
    .map((r) => r.tripId)
    .filter((id): id is NonNullable<typeof id> => id != null);
  const vehicleIds = registrations.map((r) => r.vehicleId);

  const [trips, vehicles, fleetEntries] = await Promise.all([
    Trip.find({ _id: { $in: tripIds } })
      .select("_id status driverId startTime routeId companyId vehicleId")
      .lean(),
    Vehicle.find({ _id: { $in: vehicleIds } })
      .select("_id plate brand model photoUrl vehicleTypeKey companyId")
      .lean(),
    // FleetEntry activo del vehículo da la velocidad actual del conductor.
    FleetEntry.find({
      vehicleId: { $in: vehicleIds },
      status: "en_ruta",
      "currentLocation.updatedAt": {
        $gte: new Date(Date.now() - 3 * 60_000),
      },
    })
      .select("vehicleId currentLocation departureTime")
      .lean(),
  ]);

  const tripById = new Map(trips.map((t) => [String(t._id), t]));
  const vehicleById = new Map(vehicles.map((v) => [String(v._id), v]));
  const fleetByVehicle = new Map(
    fleetEntries.map((f) => [String(f.vehicleId), f]),
  );

  // Empresas y conductores referenciados — únicos para evitar N+1.
  const companyIds = Array.from(
    new Set(
      vehicles
        .map((v) => (v.companyId ? String(v.companyId) : null))
        .filter((x): x is string => x != null),
    ),
  );
  const driverIds = Array.from(
    new Set(
      trips
        .map((t) => (t.driverId ? String(t.driverId) : null))
        .filter((x): x is string => x != null),
    ),
  );
  const [companies, drivers] = await Promise.all([
    companyIds.length > 0
      ? Company.find({ _id: { $in: companyIds } })
          .select("_id razonSocial ruc")
          .lean()
      : Promise.resolve([]),
    driverIds.length > 0
      ? Driver.find({ _id: { $in: driverIds } })
          .select("_id name licenseCategory")
          .lean()
      : Promise.resolve([]),
  ]);
  const companyById = new Map(companies.map((c) => [String(c._id), c]));
  const driverById = new Map(drivers.map((d) => [String(d._id), d]));

  const items = registrations.map((reg) => {
    const trip = reg.tripId ? tripById.get(String(reg.tripId)) : null;
    const vehicle = vehicleById.get(String(reg.vehicleId));
    const company =
      vehicle?.companyId ? companyById.get(String(vehicle.companyId)) : null;
    const driver =
      trip?.driverId ? driverById.get(String(trip.driverId)) : null;
    const fleet = fleetByVehicle.get(String(reg.vehicleId));
    return {
      registrationId: String(reg._id),
      tripId: trip ? String(trip._id) : null,
      tripStatus: trip?.status ?? null,
      startTime: trip?.startTime ?? null,
      boardedAt: reg.boardedAt,
      registeredVia: reg.registeredVia,
      vehicle: vehicle
        ? {
            id: String(vehicle._id),
            plate: vehicle.plate,
            brand: vehicle.brand,
            model: vehicle.model,
            photoUrl: vehicle.photoUrl ?? null,
          }
        : null,
      company: company
        ? {
            id: String(company._id),
            razonSocial: company.razonSocial,
            ruc: company.ruc,
          }
        : null,
      driver: driver
        ? {
            id: String(driver._id),
            name: driver.name,
            licenseCategory: driver.licenseCategory ?? null,
          }
        : null,
      // Velocidad instantánea (m/s). El cliente convierte a km/h. NO
      // exponemos lat/lng por privacidad — solo el dato cinemático.
      speedMs: fleet?.currentLocation?.speed ?? null,
      // `lastLocationUpdate` permite a la UI mostrar "Última actualización
      // hace Xs" sin revelar dónde está el bus.
      lastLocationUpdate: fleet?.currentLocation?.updatedAt ?? null,
      departureTime: fleet?.departureTime ?? null,
    };
  });

  return apiResponse({ items });
}
