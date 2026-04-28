import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import {
  apiResponse,
  apiForbidden,
  apiNotFound,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

/**
 * GET /api/conductores/me
 * Devuelve el registro de conductor asociado al usuario autenticado.
 * Busca primero por DNI exacto; si no encuentra, intenta por nombre aproximado.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.CONDUCTOR,
    ROLES.OPERADOR,
    ROLES.FISCAL,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.SUPER_ADMIN,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  await connectDB();

  // Obtener datos del usuario autenticado para cruzar con el registro de conductor
  const user = await User.findById(auth.session.userId).lean();
  if (!user) return apiUnauthorized();

  // 1. Buscar por DNI exacto (campo dni del usuario, si existe)
  let driver = null;

  if (user.dni) {
    driver = await Driver.findOne({ dni: user.dni, active: true })
      .populate("companyId", "razonSocial")
      .lean();
  }

  // 2. Fallback: buscar por nombre aproximado (regex case-insensitive)
  if (!driver && user.name) {
    const nameParts = user.name.trim().split(/\s+/).filter(Boolean);
    // Usar las primeras dos palabras del nombre para mayor precisión
    const searchTerm = nameParts.slice(0, 2).join(" ");
    driver = await Driver.findOne({
      name: { $regex: searchTerm, $options: "i" },
      active: true,
    })
      .populate("companyId", "razonSocial")
      .lean();
  }

  if (!driver) {
    return apiNotFound("No se encontró un registro de conductor asociado a su cuenta");
  }

  return apiResponse({
    id: String(driver._id),
    municipalityId: String(driver.municipalityId),
    companyId: driver.companyId ? String((driver.companyId as { _id: unknown })._id ?? driver.companyId) : undefined,
    companyName: (driver.companyId as { razonSocial?: string } | null)?.razonSocial,
    name: driver.name,
    dni: driver.dni,
    licenseNumber: driver.licenseNumber,
    licenseCategory: driver.licenseCategory,
    phone: driver.phone,
    status: driver.status,
    continuousHours: driver.continuousHours,
    restHours: driver.restHours,
    reputationScore: driver.reputationScore,
    currentVehicleId: driver.currentVehicleId ? String(driver.currentVehicleId) : undefined,
    active: driver.active,
    createdAt: driver.createdAt,
    updatedAt: driver.updatedAt,
  });
}
