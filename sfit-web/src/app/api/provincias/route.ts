import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
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
import { logAudit } from "@/lib/audit/log";

const CreateProvinceSchema = z.object({
  name: z.string().min(2).max(120),
  region: z.string().min(2).max(120),
  active: z.boolean().optional(),
});

/**
 * RF-02-01 / RF-02-07.
 * GET — Super Admin: todas las provincias. Admin Provincial: solo la suya.
 * POST — Solo Super Admin.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
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

    const filter: Record<string, unknown> = {};

    // RNF-03: Aislamiento multi-tenant
    if (auth.session.role === ROLES.ADMIN_PROVINCIAL) {
      if (!auth.session.provinceId) return apiForbidden();
      filter._id = auth.session.provinceId;
    }

    const [items, total] = await Promise.all([
      Province.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Province.countDocuments(filter),
    ]);

    return apiResponse({
      items: items.map((p) => ({
        id: String(p._id),
        name: p.name,
        region: p.region,
        active: p.active,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[provincias GET]", error);
    return apiError("Error al listar provincias", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateProvinceSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();

    const exists = await Province.findOne({ name: parsed.data.name });
    if (exists) return apiError("Ya existe una provincia con ese nombre", 409);

    const province = await Province.create({
      name: parsed.data.name,
      region: parsed.data.region,
      active: parsed.data.active ?? true,
    });

    await logAudit(request, auth.session, {
      action: "province.created",
      resourceType: "province",
      resourceId: String(province._id),
      metadata: {
        name: province.name,
        region: province.region,
      },
    });

    return apiResponse(
      {
        id: String(province._id),
        name: province.name,
        region: province.region,
        active: province.active,
        createdAt: province.createdAt,
        updatedAt: province.updatedAt,
      },
      201,
    );
  } catch (error) {
    console.error("[provincias POST]", error);
    return apiError("Error al crear provincia", 500);
  }
}
