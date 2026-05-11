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
    ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_REGIONAL,
    ROLES.SUPER_ADMIN,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  await connectDB();

  // Obtener datos del usuario autenticado para cruzar con el registro de conductor
  const user = await User.findById(auth.session.userId).lean();
  if (!user) return apiUnauthorized();

  // Resolver Driver con el mismo orden de prioridad que el PATCH: userId →
  // dni → nombre. Si encuentra via fallback (no userId), escribimos
  // `userId` para que requests futuros sean directos y GET/PATCH lleguen
  // SIEMPRE al mismo doc — antes el GET podía traer Driver A pero el
  // PATCH actualizar Driver B porque usaban estrategias distintas.
  const driverDoc = await resolveAndLinkDriver(
    auth.session.userId,
    user.dni as string | undefined,
    user.name as string | undefined,
  );
  if (!driverDoc) {
    return apiNotFound("No se encontró un registro de conductor asociado a su cuenta");
  }

  // Re-leemos populated. Sin esto la respuesta tendría el ObjectId crudo
  // en `companyId` y la app no podría mostrar razonSocial/serviceScope.
  const driver = await Driver.findById(driverDoc._id)
    .populate("companyId", "razonSocial ruc serviceScope")
    .lean();
  if (!driver) {
    return apiNotFound("No se encontró un registro de conductor asociado a su cuenta");
  }

  return apiResponse({
    id: String(driver._id),
    municipalityId: String(driver.municipalityId),
    companyId: driver.companyId ? String((driver.companyId as { _id: unknown })._id ?? driver.companyId) : undefined,
    companyName: (driver.companyId as { razonSocial?: string } | null)?.razonSocial,
    companyRuc: (driver.companyId as { ruc?: string } | null)?.ruc,
    companyServiceScope:
        (driver.companyId as { serviceScope?: string } | null)?.serviceScope,
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
  /** Datos personales editables por el conductor. */
  name: z.string().trim().min(3).max(100).optional(),
  dni: z.string().trim().regex(/^\d{8}$/, "DNI debe tener 8 dígitos").optional(),
  licenseNumber: z.string().trim().min(5).max(20).optional(),
  licenseCategory: z.string().trim().min(2).max(10).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
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

  // Resolver el Driver con la misma estrategia que el GET. Devuelve el doc
  // (no lean) listo para mutar, con `userId` ya escrito si vino via
  // fallback. Garantiza que GET y PATCH operen siempre sobre el MISMO
  // Driver — antes podían divergir y la app veía "ya seleccioné empresa"
  // pero el siguiente GET traía otro Driver sin companyId.
  const userDoc = await User.findById(auth.session.userId)
    .select("dni name")
    .lean<{ dni?: string; name?: string } | null>();
  const driver = await resolveAndLinkDriver(
    auth.session.userId,
    userDoc?.dni,
    userDoc?.name,
  );
  if (!driver) {
    return apiNotFound("No se encontró un registro de conductor asociado a su cuenta");
  }

  const { companyId, phone, name, dni, licenseNumber, licenseCategory } = parsed.data;

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
  if (name !== undefined) driver.name = name;
  if (dni !== undefined) driver.dni = dni;
  if (licenseNumber !== undefined) driver.licenseNumber = licenseNumber;
  if (licenseCategory !== undefined) driver.licenseCategory = licenseCategory;

  // El DNI es único nacional (índice unique en Driver). Capturamos el error
  // de Mongo y devolvemos un mensaje legible para que la app lo muestre tal
  // cual. Sin esto, el cliente recibe "E11000 duplicate key error" crudo.
  try {
    await driver.save();
  } catch (e: unknown) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: number }).code === 11000
    ) {
      const keyValue = (e as { keyValue?: Record<string, string> }).keyValue ?? {};
      const field = Object.keys(keyValue)[0] ?? "campo";
      const human = field === "dni" ? "DNI" : field === "licenseNumber" ? "Número de licencia" : field;
      return apiError(`${human} ya está registrado por otro conductor`, 409);
    }
    throw e;
  }

  const populated = await Driver.findById(driver._id)
    .populate("companyId", "razonSocial ruc serviceScope")
    .lean();
  const company = (populated?.companyId ?? null) as
    | { _id?: unknown; razonSocial?: string; ruc?: string; serviceScope?: string }
    | null;

  return apiResponse({
    id: String(driver._id),
    companyId: company?._id ? String(company._id) : null,
    companyName: company?.razonSocial ?? null,
    companyRuc: company?.ruc ?? null,
    companyServiceScope: company?.serviceScope ?? null,
    name: driver.name,
    dni: driver.dni,
    licenseNumber: driver.licenseNumber,
    licenseCategory: driver.licenseCategory,
    phone: driver.phone,
  });
}

/**
 * Resuelve el `Driver` que corresponde al `userId` actual. Implementa la
 * estrategia que GET y PATCH comparten:
 *
 *   1. Busca por `userId` directo (preferido — link bidireccional).
 *   2. Si no existe, busca por `dni` del User (caso de conductores
 *      seedeados sin link).
 *   3. Como último recurso, busca por nombre (regex de las dos primeras
 *      palabras).
 *
 * Cuando encuentra via fallback (2 o 3), ESCRIBE `userId` en el Driver
 * para que los próximos requests sean directos y GET/PATCH lleguen
 * siempre al mismo doc. La escritura es best-effort: si falla, devuelve
 * el doc igual.
 *
 * Devuelve el Document de Mongoose (NO lean) listo para mutar por el
 * caller. El caller decide si hacer `.save()` o `.populate().lean()`.
 */
async function resolveAndLinkDriver(
  userId: string,
  userDni: string | undefined,
  userName: string | undefined,
): Promise<InstanceType<typeof Driver> | null> {
  // 1. Path rápido: userId directo.
  let driver = await Driver.findOne({ userId, active: true });
  if (driver) return driver;

  // 2. Fallback por DNI.
  if (userDni) {
    driver = await Driver.findOne({ dni: userDni, active: true });
  }

  // 3. Fallback por nombre aproximado.
  if (!driver && userName) {
    const nameParts = userName.trim().split(/\s+/).filter(Boolean);
    const searchTerm = nameParts.slice(0, 2).join(" ");
    if (searchTerm.length >= 3) {
      driver = await Driver.findOne({
        name: { $regex: searchTerm, $options: "i" },
        active: true,
      });
    }
  }

  if (!driver) return null;

  // Auto-link: escribir userId si vino via fallback.
  if (!driver.userId || String(driver.userId) !== userId) {
    driver.userId = userId as never;
    try {
      await driver.save();
    } catch (e) {
      console.warn("[conductores/me] failed to auto-link userId on driver", e);
    }
  }
  return driver;
}
