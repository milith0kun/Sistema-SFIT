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

/**
 * Endpoint del catálogo UBIGEO de municipalidades (distritos).
 *
 * GET — listado paginado scoped por rol con filtros UBIGEO.
 * POST — creación libre DEPRECADA. El catálogo proviene del INEI; usar
 *        scripts/seed-ubigeo.ts para sembrar y PATCH /api/admin/municipalidades/[id]/activar
 *        para incorporar al sistema. Se mantiene como escape hatch para super_admin
 *        siempre que envíe ubigeoCode.
 */

const CreateMunicipalitySchema = z.object({
  name: z.string().min(2).max(160),
  provinceId: z.string().refine(isValidObjectId, "provinceId inválido"),
  ubigeoCode: z.string().regex(/^\d{6}$/, "ubigeoCode debe ser de 6 dígitos"),
  departmentCode: z.string().regex(/^\d{2}$/).optional(),
  provinceCode: z.string().regex(/^\d{4}$/).optional(),
  logoUrl: z.string().url().optional(),
  active: z.boolean().optional(),
});

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
      200,
      Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
    );

    const provinceIdParam   = url.searchParams.get("provinceId");
    const departmentCodeRaw = url.searchParams.get("departmentCode");
    const provinceCodeRaw   = url.searchParams.get("provinceCode");
    const ubigeoCodeRaw     = url.searchParams.get("ubigeoCode");
    const activeRaw         = url.searchParams.get("active");
    const q                 = url.searchParams.get("q")?.trim();

    // Base scope por rol
    const filter: Record<string, unknown> = scopedMunicipalityFilter(auth.session);

    // Super Admin puede filtrar opcionalmente por provincia (legacy)
    if (
      auth.session.role === ROLES.SUPER_ADMIN &&
      provinceIdParam &&
      isValidObjectId(provinceIdParam)
    ) {
      filter.provinceId = provinceIdParam;
    }

    // Filtros UBIGEO — disponibles para super_admin y admin_provincial.
    // Para admin_municipal no aplican (el filtro base ya restringe a su _id).
    const isPrivileged =
      auth.session.role === ROLES.SUPER_ADMIN ||
      auth.session.role === ROLES.ADMIN_PROVINCIAL;

    if (isPrivileged) {
      if (departmentCodeRaw && /^\d{2}$/.test(departmentCodeRaw)) {
        filter.departmentCode = departmentCodeRaw;
      }
      if (provinceCodeRaw && /^\d{4}$/.test(provinceCodeRaw)) {
        filter.provinceCode = provinceCodeRaw;
      }
      if (ubigeoCodeRaw && /^\d{6}$/.test(ubigeoCodeRaw)) {
        filter.ubigeoCode = ubigeoCodeRaw;
      }
    }

    if (activeRaw === "true")  filter.active = true;
    if (activeRaw === "false") filter.active = false;

    if (q && q.length > 0) {
      // Búsqueda case-insensitive sobre nombre. Escape de regex para evitar inyección.
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.name = { $regex: escaped, $options: "i" };
    }

    const [items, total] = await Promise.all([
      Municipality.find(filter)
        .sort({ ubigeoCode: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: "provinceId", select: "name departmentName departmentCode" })
        .lean(),
      Municipality.countDocuments(filter),
    ]);

    type PopulatedProvince = {
      _id: unknown;
      name?: string;
      departmentName?: string;
      departmentCode?: string;
    } | null | undefined;

    return apiResponse({
      items: items.map((m) => {
        const prov = m.provinceId as unknown as PopulatedProvince;
        return {
          id: String(m._id),
          name: m.name,
          provinceId: prov && typeof prov === "object" && prov._id
            ? String(prov._id)
            : String(m.provinceId),
          provinceName: prov?.name,
          ubigeoCode: m.ubigeoCode,
          departmentCode: m.departmentCode ?? prov?.departmentCode,
          provinceCode: m.provinceCode,
          departmentName: prov?.departmentName,
          logoUrl: m.logoUrl,
          active: m.active,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        };
      }),
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
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const body = await request.json().catch(() => ({}));

    // Sin ubigeoCode → creación libre, deprecada.
    if (!body || typeof body !== "object" || !("ubigeoCode" in body)) {
      return apiError(
        "El catálogo proviene de UBIGEO. Para incorporar una municipalidad al sistema usa PATCH /api/admin/municipalidades/[id]/activar.",
        410,
      );
    }

    const parsed = CreateMunicipalitySchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();

    const province = await Province.findById(parsed.data.provinceId)
      .select("_id departmentCode")
      .lean<{ _id: unknown; departmentCode?: string } | null>();
    if (!province) return apiError("Provincia no existe", 400);

    const duplicate = await Municipality.findOne({
      ubigeoCode: parsed.data.ubigeoCode,
    });
    if (duplicate) {
      return apiError(
        "Ya existe una municipalidad con ese ubigeoCode",
        409,
      );
    }

    const muni = await Municipality.create({
      name: parsed.data.name,
      provinceId: parsed.data.provinceId,
      ubigeoCode: parsed.data.ubigeoCode,
      departmentCode:
        parsed.data.departmentCode ?? parsed.data.ubigeoCode.slice(0, 2),
      provinceCode:
        parsed.data.provinceCode ?? parsed.data.ubigeoCode.slice(0, 4),
      logoUrl: parsed.data.logoUrl,
      active: parsed.data.active ?? false,
    });

    await logAudit(request, auth.session, {
      action: "municipality.created",
      resourceType: "municipality",
      resourceId: String(muni._id),
      metadata: {
        name: muni.name,
        ubigeoCode: muni.ubigeoCode,
        provinceId: String(muni.provinceId),
      },
    });

    return apiResponse(
      {
        id: String(muni._id),
        name: muni.name,
        provinceId: String(muni.provinceId),
        ubigeoCode: muni.ubigeoCode,
        departmentCode: muni.departmentCode,
        provinceCode: muni.provinceCode,
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
