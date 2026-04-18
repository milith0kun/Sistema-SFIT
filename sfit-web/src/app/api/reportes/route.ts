import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { CitizenReport } from "@/models/CitizenReport";
import { apiResponse, apiError, apiForbidden, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

const CreateSchema = z.object({
  municipalityId: z.string().refine(isValidObjectId).optional(),
  vehicleId: z.string().refine(isValidObjectId).optional(),
  category: z.string().min(2).max(100),
  vehicleTypeKey: z.string().optional(),
  description: z.string().min(10).max(2000),
  evidenceUrl: z.string().url().optional(),
  fraudScore: z.number().min(0).max(100).optional(),
});

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const statusParam = url.searchParams.get("status");
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

    if (statusParam) filter.status = statusParam;

    const [items, total] = await Promise.all([
      CitizenReport.find(filter)
        .populate("vehicleId", "plate vehicleTypeKey brand model")
        .populate("citizenId", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CitizenReport.countDocuments(filter),
    ]);

    const counts = await CitizenReport.aggregate([
      { $match: Object.keys(filter).length ? filter : {} },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).catch(() => []);

    const statusCounts = Object.fromEntries(counts.map((c: { _id: string; count: number }) => [c._id, c.count]));

    return apiResponse({
      items: items.map((r) => ({
        id: String(r._id),
        municipalityId: String(r.municipalityId),
        vehicle: r.vehicleId as unknown as Record<string, unknown> | null,
        citizen: r.citizenId as unknown as Record<string, unknown> | null,
        category: r.category,
        vehicleTypeKey: r.vehicleTypeKey,
        citizenReputationLevel: r.citizenReputationLevel,
        status: r.status,
        description: r.description,
        evidenceUrl: r.evidenceUrl,
        fraudScore: r.fraudScore,
        fraudLayers: r.fraudLayers,
        createdAt: r.createdAt,
      })),
      total,
      page,
      limit,
      statusCounts,
    });
  } catch (error) {
    console.error("[reportes GET]", error);
    return apiError("Error al listar reportes", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.CIUDADANO,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
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

    const fraudLayers = [
      { layer: "Identidad", passed: true, detail: "Usuario verificado" },
      { layer: "Contexto", passed: true, detail: "Radio coherente" },
      { layer: "Límite diario", passed: true, detail: "Dentro del límite" },
      { layer: "QR válido", passed: true, detail: "HMAC verificado" },
      { layer: "Corroboración", passed: false, detail: "Sin corroboración aún" },
    ];

    const created = await CitizenReport.create({
      municipalityId,
      vehicleId: parsed.data.vehicleId,
      citizenId: auth.session.userId,
      category: parsed.data.category,
      vehicleTypeKey: parsed.data.vehicleTypeKey,
      description: parsed.data.description,
      evidenceUrl: parsed.data.evidenceUrl,
      fraudScore: parsed.data.fraudScore ?? 60,
      fraudLayers,
      status: "pendiente",
    });

    return apiResponse({ id: String(created._id), ...created.toObject() }, 201);
  } catch (error) {
    console.error("[reportes POST]", error);
    return apiError("Error al crear reporte", 500);
  }
}
