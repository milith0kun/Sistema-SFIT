/**
 * POST /api/operador/crear-empresa
 *
 * Permite a un operador autenticado registrar SU PROPIA empresa con datos
 * mínimos durante el onboarding (autoservicio). La empresa queda inactiva
 * (`active: false`) hasta que un admin la valide y reciba alguna
 * authorization. Mientras tanto el operador puede ver su empresa pendiente
 * pero NO accede a flota ni rutas.
 *
 * Reglas:
 *  - Solo operadores que aún NO tengan companyId asignado.
 *  - RUC único nacional (validado contra Company existente).
 *  - El operador queda con `companyId` apuntando a la empresa creada y se
 *    le marca `profileCompleted=true` (su rol ya está completo en cuanto a
 *    asociación con empresa).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import {
  apiResponse, apiError, apiUnauthorized, apiForbidden, apiValidationError,
} from "@/lib/api/response";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { ROLES } from "@/lib/constants";

const Schema = z.object({
  ruc:         z.string().regex(/^\d{11}$/, "RUC debe tener 11 dígitos"),
  razonSocial: z.string().min(2).max(200).trim(),
  representante: z.object({
    name:  z.string().min(2).max(120).trim(),
    dni:   z.string().regex(/^\d{8}$/, "DNI del representante debe tener 8 dígitos"),
    phone: z.string().min(7).max(30).optional(),
  }),
  // Por defecto entran como urbano_distrital (la modalidad más restrictiva).
  // El admin puede ampliar el scope al aprobar la empresa.
  serviceScope: z
    .enum([
      "urbano_distrital",
      "urbano_provincial",
      "interprovincial_regional",
      "interregional_nacional",
    ])
    .default("urbano_distrital"),
});

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return apiUnauthorized();

  let session;
  try {
    session = verifyAccessToken(authHeader.substring(7));
  } catch {
    return apiUnauthorized();
  }

  if (session.role !== ROLES.OPERADOR) {
    return apiForbidden("Solo operadores pueden registrar su empresa por autoservicio");
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

  try {
    await connectDB();

    const operador = await User.findById(session.userId);
    if (!operador) return apiError("Usuario no encontrado", 404);
    if (operador.companyId) {
      return apiForbidden("Ya tienes una empresa asociada");
    }
    if (!operador.municipalityId) {
      return apiError(
        "El operador requiere municipalidad asignada antes de registrar empresa",
        422,
      );
    }

    const dupRuc = await Company.findOne({ ruc: parsed.data.ruc });
    if (dupRuc) {
      return apiError("Ese RUC ya está registrado en otra empresa", 409);
    }

    const company = await Company.create({
      municipalityId: operador.municipalityId,
      razonSocial: parsed.data.razonSocial,
      ruc:         parsed.data.ruc,
      representanteLegal: parsed.data.representante,
      vehicleTypeKeys: [],
      documents: [],
      active: false, // pendiente de aprobación por admin
      reputationScore: 0,
      serviceScope: parsed.data.serviceScope,
      coverage: {
        departmentCodes: [],
        provinceCodes: [],
        districtCodes: [],
      },
      authorizations: [],
    });

    operador.companyId = company._id as typeof operador.companyId;
    operador.profileCompleted = true;
    await operador.save();

    return apiResponse({
      company: {
        id: company._id.toString(),
        razonSocial: company.razonSocial,
        ruc: company.ruc,
        active: company.active,
        serviceScope: company.serviceScope,
      },
      profileCompleted: true,
    });
  } catch (error) {
    console.error("[operador/crear-empresa]", error);
    return apiError("Error al registrar empresa", 500);
  }
}
