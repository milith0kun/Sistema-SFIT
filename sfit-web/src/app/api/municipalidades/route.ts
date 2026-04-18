import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Municipality } from "@/models/Municipality";
import { Province } from "@/models/Province";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
  apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { scopedMunicipalityFilter } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit/log";

const CreateMunicipalitySchema = z.object({
  name: z.string().min(2).max(160),
  provinceId: z.string().refine(isValidObjectId, "provinceId inválido"),
  logoUrl: z.string().url().optional(),
  active: z.boolean().optional(),
});

/**
 * RF-02-04 / RF-02-05.
 * GET — listado paginado scoped por rol.
 * POST — Super Admin (cualquier provincia) o Admin Provincial (solo su provincia).
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_MUNICIPAL,
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
    const provinceIdParam = url.searchParams.get("provinceId");

    const filter: Record<string, unknown> = scopedMunicipalityFilter(
      auth.session,
    );

    // Super Admin puede filtrar opcionalmente por provincia
    if (
      auth.session.role === ROLES.SUPER_ADMIN &&
      provinceIdParam &&
      isValidObjectId(provinceIdParam)
    ) {
      filter.provinceId = provinceIdParam;
    }

    const [items, total] = await Promise.all([
      Municipality.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Municipality.countDocuments(filter),
    ]);

    return apiResponse({
      items: items.map((m) => ({
        id: String(m._id),
        name: m.name,
        provinceId: String(m.provinceId),
        logoUrl: m.logoUrl,
        active: m.active,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[municipalidades GET]", error);
    return apiError("Error al listar municipalidades", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateMunicipalitySchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    // Admin Provincial solo puede crear dentro de su provincia
    if (
      auth.session.role === ROLES.ADMIN_PROVINCIAL &&
      String(auth.session.provinceId) !== String(parsed.data.provinceId)
    ) {
      return apiForbidden();
    }

    await connectDB();

    const province = await Province.findById(parsed.data.provinceId).select(
      "_id",
    );
    if (!province) return apiError("Provincia no existe", 400);

    const duplicate = await Municipality.findOne({
      provinceId: parsed.data.provinceId,
      name: parsed.data.name,
    });
    if (duplicate) {
      return apiError("Ya existe una municipalidad con ese nombre", 409);
    }

    const muni = await Municipality.create({
      name: parsed.data.name,
      provinceId: parsed.data.provinceId,
      logoUrl: parsed.data.logoUrl,
      active: parsed.data.active ?? true,
    });

    await logAudit(request, auth.session, {
      action: "municipality.created",
      resourceType: "municipality",
      resourceId: String(muni._id),
      metadata: {
        name: muni.name,
        provinceId: String(muni.provinceId),
      },
    });

    return apiResponse(
      {
        id: String(muni._id),
        name: muni.name,
        provinceId: String(muni.provinceId),
        logoUrl: muni.logoUrl,
        active: muni.active,
        createdAt: muni.createdAt,
        updatedAt: muni.updatedAt,
      },
      201,
    );
  } catch (error) {
    console.error("[municipalidades POST]", error);
    return apiError("Error al crear municipalidad", 500);
  }
}
