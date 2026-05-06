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

const BodySchema = z.object({
  /** ID de la empresa a la que asociar al conductor. Si no se pasa,
   *  se usa la empresa del operador (resuelta desde su user.companyId). */
  companyId: z
    .string()
    .refine(isValidObjectId, { message: "companyId inválido" })
    .optional(),
});

/**
 * POST /api/operador/conductores/[id]/asociar
 *
 * El operador asocia un conductor (de su misma muni) a su empresa. Esto es
 * la otra mitad del onboarding crowd: el conductor puede elegir empresa
 * por sí mismo (PATCH /api/conductores/me) Y el operador puede asignarlo
 * directamente. Cualquiera de los dos lados completa el vínculo.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.OPERADOR]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID de conductor inválido", 400);

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "general";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  await connectDB();

  // Resolver la empresa destino: la pasada en el body o la del operador.
  const operatorUser = await User.findById(auth.session.userId)
    .select("municipalityId companyId")
    .lean<{ municipalityId?: unknown; companyId?: unknown } | null>();
  if (!operatorUser?.municipalityId) {
    return apiError("El operador no tiene municipio asignado", 400);
  }

  let targetCompanyId = parsed.data.companyId;
  if (!targetCompanyId) {
    if (!operatorUser.companyId) {
      // Fallback: tomar la primera empresa activa de la muni del operador.
      const myCompany = await Company.findOne({
        municipalityId: operatorUser.municipalityId,
        status: "activo",
      }).select("_id").lean();
      if (!myCompany) {
        return apiError("No se encontró una empresa asociada al operador", 400);
      }
      targetCompanyId = String(myCompany._id);
    } else {
      targetCompanyId = String(operatorUser.companyId);
    }
  }

  // Validar empresa.
  const company = await Company.findById(targetCompanyId)
    .select("_id status municipalityId razonSocial")
    .lean<{ _id?: unknown; status?: string; municipalityId?: unknown; razonSocial?: string } | null>();
  if (!company) return apiNotFound("Empresa no encontrada");
  if (company.status !== "activo") return apiError("La empresa no está activa", 400);
  if (String(company.municipalityId) !== String(operatorUser.municipalityId)) {
    return apiForbidden();
  }

  // Buscar conductor en la misma muni.
  const driver = await Driver.findById(id);
  if (!driver) return apiNotFound("Conductor no encontrado");
  if (String(driver.municipalityId) !== String(operatorUser.municipalityId)) {
    return apiForbidden();
  }

  driver.companyId = company._id as never;
  await driver.save();

  return apiResponse({
    id: String(driver._id),
    name: driver.name,
    companyId: String(company._id),
    companyName: company.razonSocial ?? null,
  });
}
