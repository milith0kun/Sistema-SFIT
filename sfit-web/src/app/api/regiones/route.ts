import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Region } from "@/models/Region";
import { Province } from "@/models/Province";
import {
  apiResponse, apiError, apiForbidden, apiUnauthorized, apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

const CreateSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  code: z.string().regex(/^\d{2}$/, "Code debe ser 2 dígitos UBIGEO").optional(),
  active: z.boolean().optional(),
});

/**
 * GET /api/regiones — listar regiones (todos los roles autenticados pueden
 * leer; útil para selectores). El detalle/CRUD se restringe a super_admin.
 *
 * POST /api/regiones — crear región (super_admin only).
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_REGIONAL, ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const items = await Region.find({}).sort({ name: 1 }).lean();
    // Conteo de provincias por región para mostrar en el listado.
    const counts = await Province.aggregate([
      { $match: { regionId: { $exists: true, $ne: null } } },
      { $group: { _id: "$regionId", count: { $sum: 1 } } },
    ]).catch(() => [] as Array<{ _id: unknown; count: number }>);
    const countByRegion = new Map(counts.map((c) => [String(c._id), c.count]));
    return apiResponse({
      items: items.map((r) => ({
        id: String(r._id),
        name: r.name,
        code: r.code,
        active: r.active,
        provinceCount: countByRegion.get(String(r._id)) ?? 0,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      total: items.length,
    });
  } catch (error) {
    console.error("[regiones GET]", error);
    return apiError("Error al listar regiones", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0]?.toString() ?? "general";
        errors[k] = [...(errors[k] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();
    const dup = await Region.findOne({ name: parsed.data.name });
    if (dup) return apiError("Ya existe una región con ese nombre", 409);
    if (parsed.data.code) {
      const dupCode = await Region.findOne({ code: parsed.data.code });
      if (dupCode) return apiError("Ya existe una región con ese código UBIGEO", 409);
    }

    const created = await Region.create({
      name: parsed.data.name,
      code: parsed.data.code,
      active: parsed.data.active ?? true,
    });

    return apiResponse({
      id: String(created._id),
      name: created.name,
      code: created.code,
      active: created.active,
      provinceCount: 0,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    }, 201);
  } catch (error) {
    console.error("[regiones POST]", error);
    return apiError("Error al crear región", 500);
  }
}
