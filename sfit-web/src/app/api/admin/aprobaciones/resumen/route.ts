import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { Driver } from "@/models/Driver";
import { Vehicle } from "@/models/Vehicle";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import {
  scopedMunicipalityFilter,
  scopedCompanyFilter,
} from "@/lib/auth/rbac";

/**
 * RF-04 — Centro de aprobaciones.
 * Devuelve, scopeado a la municipalidad de la sesión:
 *   - usuarios pendientes (status: "pendiente")
 *   - empresas sin aprobar (active: false, sin suspendedAt)
 *   - conductores sin verificar (verified: false)
 *   - vehículos sin verificar (verified: false)
 *
 * super_admin ve todo. admin_municipal ve solo su muni / sus empresas.
 */
const PAGE_LIMIT = 50;

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    await connectDB();

    const muniFilter = scopedMunicipalityFilter(auth.session);
    const companyFilter = await scopedCompanyFilter(auth.session);

    // Para usuarios y empresas usamos municipalityId directo.
    const baseMuniMatch =
      auth.session.role === ROLES.SUPER_ADMIN
        ? {}
        : { municipalityId: auth.session.municipalityId };

    const userFilter = { ...baseMuniMatch, status: "pendiente" };
    const companyPendingFilter = {
      ...baseMuniMatch,
      active: false,
      suspendedAt: { $exists: false },
    };
    const driverPendingFilter = { ...baseMuniMatch, verified: false };
    const vehiclePendingFilter = { ...baseMuniMatch, verified: false };

    const [
      usersPendingCount,
      usersPendingItems,
      companiesPendingCount,
      companiesPendingItems,
      driversPendingCount,
      driversPendingItems,
      vehiclesPendingCount,
      vehiclesPendingItems,
    ] = await Promise.all([
      User.countDocuments(userFilter),
      User.find(userFilter)
        .select("name email role requestedRole dni phone municipalityId createdAt")
        .sort({ createdAt: -1 })
        .limit(PAGE_LIMIT)
        .lean(),
      Company.countDocuments(companyPendingFilter),
      Company.find(companyPendingFilter)
        .select("razonSocial ruc representanteLegal municipalityId createdAt")
        .sort({ createdAt: -1 })
        .limit(PAGE_LIMIT)
        .lean(),
      Driver.countDocuments(driverPendingFilter),
      Driver.find(driverPendingFilter)
        .select("name dni licenseNumber companyId municipalityId createdAt")
        .populate({ path: "companyId", select: "razonSocial" })
        .sort({ createdAt: -1 })
        .limit(PAGE_LIMIT)
        .lean(),
      Vehicle.countDocuments(vehiclePendingFilter),
      Vehicle.find(vehiclePendingFilter)
        .select("plate brand model year vehicleTypeKey companyId municipalityId createdAt")
        .populate({ path: "companyId", select: "razonSocial" })
        .sort({ createdAt: -1 })
        .limit(PAGE_LIMIT)
        .lean(),
    ]);

    // Marcar uso para evitar "unused var" warnings de TS — los filtros
    // ya están centralizados pero los importamos por si extendemos a
    // queries cross-muni en el futuro.
    void muniFilter;
    void companyFilter;

    type PopulatedCompany = { razonSocial?: string } | null | undefined;

    return apiResponse({
      counts: {
        users: usersPendingCount,
        companies: companiesPendingCount,
        drivers: driversPendingCount,
        vehicles: vehiclesPendingCount,
        total:
          usersPendingCount +
          companiesPendingCount +
          driversPendingCount +
          vehiclesPendingCount,
      },
      users: usersPendingItems.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        requestedRole: u.requestedRole ?? null,
        dni: u.dni ?? null,
        phone: u.phone ?? null,
        createdAt: u.createdAt,
      })),
      companies: companiesPendingItems.map((c) => ({
        id: String(c._id),
        razonSocial: c.razonSocial,
        ruc: c.ruc,
        representanteLegal: c.representanteLegal,
        createdAt: c.createdAt,
      })),
      drivers: driversPendingItems.map((d) => {
        const company = d.companyId as unknown as PopulatedCompany;
        return {
          id: String(d._id),
          name: d.name,
          dni: d.dni,
          licenseNumber: d.licenseNumber,
          companyName: company?.razonSocial ?? null,
          companyId: company && typeof company === "object" && "_id" in company
            ? String((company as { _id: unknown })._id)
            : null,
          createdAt: d.createdAt,
        };
      }),
      vehicles: vehiclesPendingItems.map((v) => {
        const company = v.companyId as unknown as PopulatedCompany;
        return {
          id: String(v._id),
          plate: v.plate,
          brand: v.brand,
          model: v.model,
          year: v.year,
          vehicleTypeKey: v.vehicleTypeKey,
          companyName: company?.razonSocial ?? null,
          companyId: company && typeof company === "object" && "_id" in company
            ? String((company as { _id: unknown })._id)
            : null,
          createdAt: v.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error("[admin/aprobaciones/resumen]", error);
    return apiError("Error al cargar el centro de aprobaciones", 500);
  }
}
