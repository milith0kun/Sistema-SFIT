import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { VehicleType } from "@/models/VehicleType";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
  apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

const InspectionFieldSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(160),
  type: z.enum(["boolean", "scale", "text"]),
});

const CreateVehicleTypeSchema = z.object({
  municipalityId: z
    .string()
    .refine(isValidObjectId, "municipalityId inválido")
    .optional(),
  key: z.string().min(2).max(80),
  name: z.string().min(2).max(160),
  description: z.string().max(500).optional(),
  icon: z.string().max(200).optional(),
  checklistItems: z.array(z.string().min(1).max(200)).optional(),
  inspectionFields: z.array(InspectionFieldSchema).optional(),
  reportCategories: z.array(z.string().min(1).max(160)).optional(),
  isCustom: z.boolean().optional(),
  active: z.boolean().optional(),
});

/**
 * RF-03.
 * GET — scoped por municipalidad del JWT. Super Admin puede pasar `?municipalityId=`.
 * POST — Admin Municipal crea un tipo (predefinido activado o personalizado).
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.FISCAL,
    ROLES.OPERADOR,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    await connectDB();

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") ?? 20)),
    );
    const municipalityIdParam = url.searchParams.get("municipalityId");

    const filter: Record<string, unknown> = {};

    if (auth.session.role === ROLES.SUPER_ADMIN) {
      if (municipalityIdParam) {
        if (!isValidObjectId(municipalityIdParam)) {
          return apiError("municipalityId inválido", 400);
        }
        filter.municipalityId = municipalityIdParam;
      }
    } else {
      // Todos los otros roles: scope al tenant. Aceptan override si está autorizado.
      const targetMunicipalityId =
        municipalityIdParam ?? auth.session.municipalityId;
      if (!targetMunicipalityId || !isValidObjectId(targetMunicipalityId)) {
        return apiForbidden();
      }
      if (!(await canAccessMunicipality(auth.session, targetMunicipalityId))) {
        return apiForbidden();
      }
      filter.municipalityId = targetMunicipalityId;
    }

    const [items, total] = await Promise.all([
      VehicleType.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      VehicleType.countDocuments(filter),
    ]);

    return apiResponse({
      items: items.map((t) => ({
        id: String(t._id),
        municipalityId: String(t.municipalityId),
        key: t.key,
        name: t.name,
        description: t.description,
        icon: t.icon,
        checklistItems: t.checklistItems,
        inspectionFields: t.inspectionFields,
        reportCategories: t.reportCategories,
        isCustom: t.isCustom,
        active: t.active,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[tipos-vehiculo GET]", error);
    return apiError("Error al listar tipos de vehículo", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateVehicleTypeSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    // Admin Municipal no puede salirse de su municipalidad
    let municipalityId = parsed.data.municipalityId;
    if (auth.session.role === ROLES.ADMIN_MUNICIPAL) {
      if (!auth.session.municipalityId) return apiForbidden();
      if (
        municipalityId &&
        String(municipalityId) !== String(auth.session.municipalityId)
      ) {
        return apiForbidden();
      }
      municipalityId = auth.session.municipalityId;
    }
    if (!municipalityId) {
      return apiError("municipalityId es requerido para Super Admin", 400);
    }

    await connectDB();

    if (!(await canAccessMunicipality(auth.session, municipalityId))) {
      return apiForbidden();
    }

    const duplicate = await VehicleType.findOne({
      municipalityId,
      key: parsed.data.key,
    });
    if (duplicate) {
      return apiError(
        "Ya existe un tipo de vehículo con esa key en la municipalidad",
        409,
      );
    }

    const created = await VehicleType.create({
      municipalityId,
      key: parsed.data.key,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      icon: parsed.data.icon,
      checklistItems: parsed.data.checklistItems ?? [],
      inspectionFields: parsed.data.inspectionFields ?? [],
      reportCategories: parsed.data.reportCategories ?? [],
      isCustom: parsed.data.isCustom ?? true,
      active: parsed.data.active ?? true,
    });

    return apiResponse(
      {
        id: String(created._id),
        municipalityId: String(created.municipalityId),
        key: created.key,
        name: created.name,
        description: created.description,
        icon: created.icon,
        checklistItems: created.checklistItems,
        inspectionFields: created.inspectionFields,
        reportCategories: created.reportCategories,
        isCustom: created.isCustom,
        active: created.active,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
      201,
    );
  } catch (error) {
    console.error("[tipos-vehiculo POST]", error);
    return apiError("Error al crear tipo de vehículo", 500);
  }
}
