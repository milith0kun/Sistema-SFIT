import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiNotFound,
  apiUnauthorized,
  apiValidationError,
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

const PatchSchema = z.object({
  /** ID de la empresa a la que el conductor se asocia. null para desasociarse. */
  companyId: z
    .string()
    .refine(isValidObjectId, { message: "companyId inválido" })
    .nullable()
    .optional(),
  /** Teléfono de contacto editable por el conductor. */
  phone: z.string().min(6).max(20).optional(),
});

/**
 * PATCH /api/conductores/me
 *
 * El propio conductor puede actualizar su `companyId` (asociarse a una
 * empresa de transporte) y `phone`. No se le permite cambiar campos
 * sensibles (DNI, licencia, status, municipalityId) — eso queda reservado
 * a operador/admin.
 *
 * Sin este endpoint el conductor estaba bloqueado en el onboarding por el
 * RBAC del PATCH /api/conductores/[id] que solo permite admin/operador.
 */
export async function PATCH(request: NextRequest) {
  const auth = requireRole(request, [ROLES.CONDUCTOR]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const body = await request.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "general";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  await connectDB();

  // Resolvemos el Driver por userId (vínculo directo) para no depender del DNI.
  const driver = await Driver.findOne({ userId: auth.session.userId, active: true });
  if (!driver) {
    return apiNotFound("No se encontró un registro de conductor asociado a su cuenta");
  }

  const { companyId, phone } = parsed.data;

  if (companyId !== undefined) {
    if (companyId === null) {
      driver.companyId = undefined;
    } else {
      // Validar que la empresa exista y esté activa antes de asociarla.
      const company = await Company.findById(companyId).select("_id status").lean();
      if (!company) return apiError("Empresa no encontrada", 404);
      if ((company as { status?: string }).status !== "activo") {
        return apiError("La empresa no está activa", 400);
      }
      driver.companyId = company._id as never;
    }
  }

  if (phone !== undefined) driver.phone = phone;

  await driver.save();

  const populated = await Driver.findById(driver._id)
    .populate("companyId", "razonSocial ruc")
    .lean();
  const company = (populated?.companyId ?? null) as
    | { _id?: unknown; razonSocial?: string; ruc?: string }
    | null;

  return apiResponse({
    id: String(driver._id),
    companyId: company?._id ? String(company._id) : null,
    companyName: company?.razonSocial ?? null,
    companyRuc: company?.ruc ?? null,
    phone: driver.phone,
  });
}
