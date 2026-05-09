import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Municipality } from "@/models/Municipality";
import { Driver } from "@/models/Driver";
import { Company } from "@/models/Company";
import {
  apiResponse, apiError, apiUnauthorized, apiValidationError,
} from "@/lib/api/response";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { ROLES } from "@/lib/constants";
import { isValidObjectId } from "mongoose";

/**
 * POST /api/auth/onboarding/complete
 *
 * Permite al usuario autenticado completar su perfil al primer login:
 *   - DNI (RENIEC, único nacional)
 *   - Teléfono
 *   - Foto (image URL, opcional)
 *   - Cambiar password si tiene mustChangePassword=true
 *   - Si role=admin_municipal y su municipalidad aún no tiene datos
 *     institucionales, registra ruc + razonSocial y la marca como
 *     dataCompleted=true.
 *
 * Marca profileCompleted=true y mustChangePassword=false.
 */

const Schema = z.object({
  dni:   z.string().regex(/^\d{6,12}$/, "DNI debe tener entre 6 y 12 dígitos"),
  // Teléfono opcional — el sistema no lo requiere para operar (los flujos
  // críticos usan email/notificaciones in-app). Acepta vacío.
  phone: z.string().min(7).max(30).optional().or(z.literal("")),
  image: z.string().url("URL de imagen inválida").optional(),
  newPassword: z.string().min(8, "Mínimo 8 caracteres").max(128).optional(),
  // Datos personales auto-resueltos por RENIEC (apiperu). Si llegan y el
  // User.name viene incompleto desde Google, lo actualizamos.
  reniec: z.object({
    nombres:         z.string().max(120).optional(),
    apellidoPaterno: z.string().max(80).optional(),
    apellidoMaterno: z.string().max(80).optional(),
  }).optional(),
  // Datos institucionales — sólo se aplican si el usuario es admin_municipal
  // y su municipalidad aún no los tiene.
  municipality: z.object({
    ruc:         z.string().regex(/^\d{11}$/, "RUC debe tener 11 dígitos"),
    razonSocial: z.string().min(2).max(200).trim(),
  }).optional(),
  // Datos de empresa de transporte — sólo aplican si el rol es OPERADOR y
  // aún no tiene companyId asignada. Auto-rellenado desde SUNAT (RUC) en la
  // app: el operador escribe el RUC y se popula razón social + domicilio +
  // ubigeo. Acá creamos/upserteamos la Company y la vinculamos al User.
  company: z.object({
    ruc:         z.string().regex(/^\d{11}$/, "RUC debe tener 11 dígitos"),
    razonSocial: z.string().min(2).max(200).trim(),
    domicilio:   z.string().max(300).optional(),
    departmentCode: z.string().regex(/^\d{2}$/).optional(),
    provinceCode:   z.string().regex(/^\d{4}$/).optional(),
    districtCode:   z.string().regex(/^\d{6}$/).optional(),
  }).optional(),
  // Datos de conductor — sólo se aplican si el rol del usuario es conductor.
  // Crea/actualiza el documento Driver vinculado por dni del propio usuario.
  driver: z.object({
    licenseNumber:   z.string().min(4).max(20).trim(),
    licenseCategory: z.string().min(2).max(10).trim(),
    companyId:       z.string().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  // Auth manual (no usar requireRole — onboarding aplica a cualquier rol)
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return apiUnauthorized();

  let session;
  try {
    session = verifyAccessToken(authHeader.substring(7));
  } catch {
    return apiUnauthorized();
  }

  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "general";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  const { dni, phone, image, newPassword, reniec, municipality, company, driver } = parsed.data;

  try {
    await connectDB();

    const user = await User.findById(session.userId).select("+password");
    if (!user) return apiError("Usuario no encontrado", 404);

    // DNI único nacional
    const dupDni = await User.findOne({ dni, _id: { $ne: user._id } });
    if (dupDni) return apiError("El DNI ya está registrado en otra cuenta", 409);

    user.dni   = dni;
    if (phone && phone.trim().length > 0) {
      user.phone = phone.trim();
    }
    if (image) user.image = image;

    // Datos RENIEC: completan/sobreescriben el nombre cuando llega el bloque
    // (típicamente cuando el operador llenó el DNI y la app mostró RENIEC).
    // No bloqueamos si vienen vacíos — son best-effort.
    if (reniec && (reniec.nombres || reniec.apellidoPaterno || reniec.apellidoMaterno)) {
      const fullName = [reniec.nombres, reniec.apellidoPaterno, reniec.apellidoMaterno]
        .filter((s) => s && s.trim().length > 0)
        .join(" ")
        .trim();
      if (fullName.length >= 3) {
        user.name = fullName;
      }
    }

    if (newPassword) {
      user.password = await bcrypt.hash(newPassword, 12);
      user.mustChangePassword = false;
    }

    user.profileCompleted = true;
    // Save inicial para persistir DNI/teléfono/nombre. Se hará un segundo
    // save() al final si los bloques `company`/`driver` modificaron user
    // (companyId, etc.).
    await user.save();

    // Si es admin_municipal y vino bloque `municipality`, completar los datos
    // institucionales de su municipalidad (sólo si aún no estaban completos —
    // el flujo del primer login no debe sobrescribir datos verificados).
    let municipalityDataCompleted: boolean | null = null;
    if (user.role === ROLES.ADMIN_MUNICIPAL && user.municipalityId) {
      const muni = await Municipality.findById(user.municipalityId);
      if (!muni) return apiError("Municipalidad asociada no encontrada", 404);

      if (!muni.dataCompleted && municipality) {
        // RUC único nacional entre municipalidades.
        const dupRuc = await Municipality.findOne({
          ruc: municipality.ruc,
          _id: { $ne: muni._id },
        });
        if (dupRuc) {
          return apiError("Ese RUC ya está registrado en otra municipalidad", 409);
        }
        muni.ruc           = municipality.ruc;
        muni.razonSocial   = municipality.razonSocial;
        muni.dataCompleted = true;
        await muni.save();
      }
      municipalityDataCompleted = muni.dataCompleted;
    }

    // Si es operador y vino bloque `company`, upsert la empresa por RUC y
    // vincular User.companyId. Si la empresa ya existe (otro operador o
    // admin la creó), simplemente reusamos su _id sin sobrescribir datos.
    if (user.role === ROLES.OPERADOR && company) {
      if (!user.municipalityId) {
        return apiError(
          "El operador requiere municipalidad asociada antes de registrar empresa",
          422,
        );
      }
      let companyDoc = await Company.findOne({ ruc: company.ruc });
      if (!companyDoc) {
        companyDoc = await Company.create({
          municipalityId: user.municipalityId,
          razonSocial: company.razonSocial,
          ruc: company.ruc,
          representanteLegal: { name: user.name, dni },
          vehicleTypeKeys: [],
          documents: [],
          active: true,
          reputationScore: 100,
          serviceScope: "urbano_provincial",
          coverage: {
            departmentCodes: company.departmentCode ? [company.departmentCode] : [],
            provinceCodes:   company.provinceCode   ? [company.provinceCode]   : [],
            districtCodes:   company.districtCode   ? [company.districtCode]   : [],
          },
          authorizations: [],
        });
      }
      // Vincular User.companyId si aún no está seteado. No sobrescribimos
      // si el operador ya tenía empresa (cambio de empresa requiere flujo
      // distinto con auditoría).
      if (!user.companyId) {
        user.companyId = companyDoc._id;
        await user.save();
      }
    }

    // Si es conductor y vino bloque `driver`, creamos o actualizamos el
    // documento Driver vinculado por DNI. El conductor puede entrar sin
    // companyId (lo asociará después en pantalla "Mi empresa") o con uno
    // ya elegido del listado público.
    if (user.role === ROLES.CONDUCTOR && driver) {
      if (!user.municipalityId) {
        return apiError(
          "El conductor requiere municipalidad asociada antes de completar perfil",
          422,
        );
      }
      if (driver.companyId && !isValidObjectId(driver.companyId)) {
        return apiError("companyId inválido", 400);
      }
      const dupLicense = await Driver.findOne({
        licenseNumber: driver.licenseNumber,
        dni: { $ne: dni },
      });
      if (dupLicense) {
        return apiError("La licencia ya está registrada con otro DNI", 409);
      }
      await Driver.findOneAndUpdate(
        { dni },
        {
          $set: {
            municipalityId: user.municipalityId,
            name: user.name,
            dni,
            phone,
            licenseNumber:   driver.licenseNumber,
            licenseCategory: driver.licenseCategory,
            ...(driver.companyId ? { companyId: driver.companyId } : {}),
          },
        },
        { upsert: true, new: true, runValidators: true },
      );
    }

    return apiResponse({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      status: user.status,
      municipalityId: user.municipalityId?.toString(),
      provinceId: user.provinceId?.toString(),
      phone: user.phone,
      dni: user.dni,
      profileCompleted: user.profileCompleted,
      mustChangePassword: user.mustChangePassword,
      municipalityDataCompleted,
    });
  } catch (error) {
    console.error("[onboarding/complete]", error);
    return apiError("Error al completar onboarding", 500);
  }
}
