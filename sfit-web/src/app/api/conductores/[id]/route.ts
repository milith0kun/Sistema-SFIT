import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import { apiResponse, apiError, apiForbidden, apiNotFound, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { rolesFor, FATIGUE_ROLES } from "@/lib/auth/roleMatrix";
import { canAccessMunicipality, scopedCompanyFilter } from "@/lib/auth/rbac";
import { Company } from "@/models/Company";

const UpdateSchema = z.object({
  companyId: z.string().refine(isValidObjectId).optional().nullable(),
  email: z.string().email("Correo electrónico inválido").optional(),
  name: z.string().min(2).max(160).optional(),
  dni: z.string().min(6).max(20).optional(),
  licenseNumber: z.string().min(4).max(30).optional(),
  licenseCategory: z.string().min(2).max(20).optional(),
  licenseIssuedAt: z.coerce.date().optional().nullable(),
  licenseExpiryDate: z.coerce.date().optional().nullable(),
  phone: z.string().max(30).optional(),
  photoUrl: z.string().url().nullable().optional(),
  status: z.enum(["apto", "riesgo", "no_apto"]).optional(),
  continuousHours: z.number().min(0).max(24).optional(),
  restHours: z.number().min(0).max(24).optional(),
  reputationScore: z.number().min(0).max(100).optional(),
  active: z.boolean().optional(),
}).refine(
  (d) =>
    !d.licenseIssuedAt ||
    !d.licenseExpiryDate ||
    d.licenseExpiryDate.getTime() > d.licenseIssuedAt.getTime(),
  {
    message: "La fecha de vencimiento debe ser posterior a la fecha de emisión",
    path: ["licenseExpiryDate"],
  },
);

async function resolveDriver(request: NextRequest, id: string) {
  if (!isValidObjectId(id)) return { error: "ID inválido" as const };
  await connectDB();
  const driver = await Driver.findById(id).populate("companyId", "razonSocial").lean();
  if (!driver) return { error: "not_found" as const };
  return { driver };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [...rolesFor("conductores", "view")]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    const { id } = await params;
    const res = await resolveDriver(request, id);
    if ("error" in res) return res.error === "not_found" ? apiNotFound("Conductor no encontrado") : apiError(res.error as string, 400);

    if (!(await canAccessMunicipality(auth.session, String(res.driver.municipalityId)))) return apiForbidden();

    // Resolver email desde el User vinculado
    let email: string | undefined;
    if (res.driver.userId) {
      const user = await User.findById(res.driver.userId).select("email").lean<{ email?: string } | null>();
      email = user?.email;
    }

    return apiResponse({
      id: String(res.driver._id),
      userId: res.driver.userId ? String(res.driver.userId) : null,
      municipalityId: String(res.driver.municipalityId),
      companyId: res.driver.companyId ? String((res.driver.companyId as { _id?: unknown })._id ?? res.driver.companyId) : undefined,
      companyName: (res.driver.companyId as { razonSocial?: string } | null)?.razonSocial,
      name: res.driver.name,
      dni: res.driver.dni,
      email: email ?? null,
      licenseNumber: res.driver.licenseNumber,
      licenseCategory: res.driver.licenseCategory,
      licenseIssuedAt: res.driver.licenseIssuedAt ?? null,
      licenseExpiryDate: res.driver.licenseExpiryDate ?? null,
      phone: res.driver.phone,
      status: res.driver.status,
      continuousHours: res.driver.continuousHours,
      restHours: res.driver.restHours,
      reputationScore: res.driver.reputationScore,
      active: res.driver.active,
      createdAt: res.driver.createdAt,
      updatedAt: res.driver.updatedAt,
    });
  } catch (error) {
    console.error("[conductores/:id GET]", error);
    return apiError("Error al obtener conductor", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [...rolesFor("conductores", "edit")]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    const body = await request.json().catch(() => ({}));
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();
    const driver = await Driver.findById(id);
    if (!driver) return apiNotFound("Conductor no encontrado");
    if (!(await canAccessMunicipality(auth.session, String(driver.municipalityId)))) return apiForbidden();

    // Gate adicional: cambiar el estado de fatiga (apto/riesgo/no_apto) sólo
    // pueden hacerlo quienes tienen autoridad de campo. El operador puede editar
    // datos administrativos del conductor pero no marcarlo "no apto" para
    // bypassear sus propias restricciones.
    if (parsed.data.status !== undefined && !(FATIGUE_ROLES as readonly string[]).includes(auth.session.role)) {
      return apiForbidden("No tienes permiso para cambiar el estado de fatiga del conductor.");
    }

    // Si se cambia el email, actualizar la cuenta de usuario vinculada.
    // Validar unicidad nacional para evitar colisiones.
    if (parsed.data.email !== undefined) {
      if (driver.userId) {
        const dup = await User.findOne({
          email: parsed.data.email,
          _id: { $ne: driver.userId },
        }).select("_id").lean();
        if (dup) return apiError("Ya existe una cuenta con ese correo electrónico", 409);
        await User.findByIdAndUpdate(driver.userId, { email: parsed.data.email });
      }
      // Quitar email del payload antes del Object.assign porque Driver no lo almacena
      delete parsed.data.email;
    }

    // Si se cambia companyId, validar que la empresa esté dentro del scope del
    // usuario. Sin esto un admin podría asignar el conductor a una empresa de
    // otra muni metiéndole el _id por API.
    if (parsed.data.companyId !== undefined && parsed.data.companyId !== null && parsed.data.companyId !== "") {
      const filter = await scopedCompanyFilter(auth.session);
      const match = await Company.findOne({ _id: parsed.data.companyId, ...filter })
        .select("_id active")
        .lean<{ _id: unknown; active?: boolean } | null>();
      if (!match) {
        return apiForbidden("La empresa indicada no es accesible en tu scope.");
      }
      if (!match.active) {
        return apiError("La empresa indicada está inactiva o pendiente de aprobación.", 422);
      }
    }

    Object.assign(driver, parsed.data);
    await driver.save();

    return apiResponse({ id: String(driver._id), ...driver.toObject() });
  } catch (error) {
    console.error("[conductores/:id PATCH]", error);
    return apiError("Error al actualizar conductor", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, [...rolesFor("conductores", "delete")]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    await connectDB();
    const driver = await Driver.findById(id);
    if (!driver) return apiNotFound("Conductor no encontrado");
    if (!(await canAccessMunicipality(auth.session, String(driver.municipalityId)))) return apiForbidden();

    driver.active = false;
    await driver.save();
    return apiResponse({ success: true });
  } catch (error) {
    console.error("[conductores/:id DELETE]", error);
    return apiError("Error al eliminar conductor", 500);
  }
}
