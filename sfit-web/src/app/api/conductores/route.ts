import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { apiResponse, apiError, apiForbidden, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, DRIVER_STATUS } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

const CreateDriverSchema = z.object({
  municipalityId: z.string().refine(isValidObjectId, "municipalityId inválido").optional(),
  companyId: z.string().refine(isValidObjectId).optional(),
  name: z.string().min(2).max(160),
  dni: z.string().min(6).max(20),
  licenseNumber: z.string().min(4).max(30),
  licenseCategory: z.string().min(2).max(20),
  phone: z.string().max(30).optional(),
  status: z.enum(["apto", "riesgo", "no_apto"]).optional(),
  continuousHours: z.number().min(0).max(24).optional(),
  restHours: z.number().min(0).max(24).optional(),
  reputationScore: z.number().min(0).max(100).optional(),
});

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const statusParam = url.searchParams.get("status");
    const search = url.searchParams.get("q");
    const municipalityIdParam = url.searchParams.get("municipalityId");

    const filter: Record<string, unknown> = {};

    if (auth.session.role === ROLES.SUPER_ADMIN) {
      if (municipalityIdParam) {
        if (!isValidObjectId(municipalityIdParam)) return apiError("municipalityId inválido", 400);
        filter.municipalityId = municipalityIdParam;
      }
    } else {
      const targetId = municipalityIdParam ?? auth.session.municipalityId;
      if (!targetId || !isValidObjectId(targetId)) return apiForbidden();
      if (!(await canAccessMunicipality(auth.session, targetId))) return apiForbidden();
      filter.municipalityId = targetId;
    }

    if (statusParam && Object.values(DRIVER_STATUS).includes(statusParam as never)) {
      filter.status = statusParam;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { dni: { $regex: search, $options: "i" } },
        { licenseNumber: { $regex: search, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      Driver.find(filter)
        .populate("companyId", "razonSocial")
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Driver.countDocuments(filter),
    ]);

    const counts = await Driver.aggregate([
      { $match: { municipalityId: items[0]?.municipalityId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).catch(() => []);

    const statusCounts = Object.fromEntries(counts.map((c: { _id: string; count: number }) => [c._id, c.count]));

    return apiResponse({
      items: items.map((d) => ({
        id: String(d._id),
        municipalityId: String(d.municipalityId),
        companyId: d.companyId ? String((d.companyId as { _id?: unknown })._id ?? d.companyId) : undefined,
        companyName: (d.companyId as { razonSocial?: string } | null)?.razonSocial,
        name: d.name,
        dni: d.dni,
        licenseNumber: d.licenseNumber,
        licenseCategory: d.licenseCategory,
        phone: d.phone,
        status: d.status,
        continuousHours: d.continuousHours,
        restHours: d.restHours,
        reputationScore: d.reputationScore,
        active: d.active,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
      total,
      page,
      limit,
      statusCounts,
    });
  } catch (error) {
    console.error("[conductores GET]", error);
    return apiError("Error al listar conductores", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateDriverSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    let municipalityId = parsed.data.municipalityId;
    if (auth.session.role !== ROLES.SUPER_ADMIN) {
      if (!auth.session.municipalityId) return apiForbidden();
      municipalityId = auth.session.municipalityId;
    }
    if (!municipalityId) return apiError("municipalityId requerido", 400);

    await connectDB();
    if (!(await canAccessMunicipality(auth.session, municipalityId))) return apiForbidden();

    const duplicate = await Driver.findOne({ municipalityId, dni: parsed.data.dni });
    if (duplicate) return apiError("Ya existe un conductor con ese DNI", 409);

    const created = await Driver.create({
      municipalityId,
      companyId: parsed.data.companyId,
      name: parsed.data.name,
      dni: parsed.data.dni,
      licenseNumber: parsed.data.licenseNumber,
      licenseCategory: parsed.data.licenseCategory,
      phone: parsed.data.phone,
      status: parsed.data.status ?? DRIVER_STATUS.APTO,
      continuousHours: parsed.data.continuousHours ?? 0,
      restHours: parsed.data.restHours ?? 8,
      reputationScore: parsed.data.reputationScore ?? 100,
    });

    return apiResponse({ id: String(created._id), ...created.toObject() }, 201);
  } catch (error) {
    console.error("[conductores POST]", error);
    return apiError("Error al crear conductor", 500);
  }
}
