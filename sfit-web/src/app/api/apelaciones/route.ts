import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Apelacion } from "@/models/Apelacion";
import { Inspection } from "@/models/Inspection";
import "@/models/Vehicle";
import "@/models/User";
import { apiResponse, apiError, apiForbidden, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";

const CreateSchema = z.object({
  inspectionId: z.string().refine(isValidObjectId, { message: "inspectionId inválido" }),
  reason: z.string().min(20, "El motivo debe tener al menos 20 caracteres").max(2000),
  evidence: z.array(z.string().url("URL de evidencia inválida")).optional(),
});

// ── POST /api/apelaciones — crear apelación (rol: operador) ──────────────────
export async function POST(request: NextRequest) {
  const auth = requireRole(request, [ROLES.OPERADOR]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }

  const parsed = CreateSchema.safeParse(body);
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

    // Verificar que la inspección exista
    const inspection = await Inspection.findById(parsed.data.inspectionId).lean();
    if (!inspection) return apiError("Inspección no encontrada", 404);

    // Solo se puede apelar inspecciones rechazadas u observadas
    if (inspection.result !== "rechazada" && inspection.result !== "observada") {
      return apiError("Solo se pueden apelar inspecciones con resultado rechazada u observada", 422);
    }

    // El vehículo de la inspección debe corresponder al municipio del operador
    if (
      auth.session.municipalityId &&
      String(inspection.municipalityId) !== String(auth.session.municipalityId)
    ) {
      return apiForbidden();
    }

    // Verificar que no exista ya una apelación para esta inspección
    const existing = await Apelacion.findOne({ inspectionId: parsed.data.inspectionId });
    if (existing) {
      return apiError("Ya existe una apelación para esta inspección", 409);
    }

    const apelacion = await Apelacion.create({
      inspectionId:   parsed.data.inspectionId,
      vehicleId:      inspection.vehicleId,
      municipalityId: inspection.municipalityId,
      submittedBy:    auth.session.userId,
      reason:         parsed.data.reason,
      evidence:       parsed.data.evidence ?? [],
      status:         "pendiente",
    });

    return apiResponse({ id: String(apelacion._id), ...apelacion.toObject() }, 201);
  } catch (error) {
    console.error("[apelaciones POST]", error);
    return apiError("Error al crear apelación", 500);
  }
}

// ── GET /api/apelaciones — listar apelaciones ────────────────────────────────
// fiscal/admin ven todas (de su municipio), operador ve las suyas
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
    const statusParam = url.searchParams.get("status");

    const filter: Record<string, unknown> = {};

    // Scoping por rol
    if (auth.session.role === ROLES.OPERADOR) {
      // Operador solo ve las que él mismo presentó
      filter.submittedBy = auth.session.userId;
    } else if (auth.session.role === ROLES.ADMIN_MUNICIPAL || auth.session.role === ROLES.FISCAL) {
      if (!auth.session.municipalityId) return apiForbidden();
      filter.municipalityId = auth.session.municipalityId;
    } else if (auth.session.role === ROLES.ADMIN_PROVINCIAL) {
      // Filtra apelaciones de municipios de su provincia
      const { Municipality } = await import("@/models/Municipality");
      const munis = await Municipality.find({ provinceId: auth.session.provinceId }).select("_id").lean();
      filter.municipalityId = { $in: munis.map((m) => m._id) };
    }
    // super_admin: sin filtro (ve todas)

    if (statusParam && ["pendiente", "aprobada", "rechazada"].includes(statusParam)) {
      filter.status = statusParam;
    }

    // Stats globales (sin filtro de status)
    const globalFilter: Record<string, unknown> = { ...filter };
    delete globalFilter.status;

    const [items, total, statsAgg] = await Promise.all([
      Apelacion.find(filter)
        .populate("inspectionId", "result date score observations")
        .populate("vehicleId", "plate vehicleTypeKey brand model")
        .populate("submittedBy", "name email")
        .populate("resolvedBy", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Apelacion.countDocuments(filter),
      Apelacion.aggregate([
        { $match: globalFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const stats = { pendiente: 0, aprobada: 0, rechazada: 0, total: 0 };
    for (const row of statsAgg as { _id: string; count: number }[]) {
      if (row._id in stats) (stats as unknown as Record<string, number>)[row._id] = row.count;
      stats.total += row.count;
    }

    return apiResponse({
      items: items.map((a) => ({
        id: String(a._id),
        inspection: a.inspectionId as unknown as Record<string, unknown>,
        vehicle: a.vehicleId as unknown as Record<string, unknown>,
        submittedBy: a.submittedBy as unknown as Record<string, unknown>,
        reason: a.reason,
        evidence: a.evidence,
        status: a.status,
        resolvedBy: a.resolvedBy as unknown as Record<string, unknown> | null,
        resolvedAt: a.resolvedAt,
        resolution: a.resolution,
        createdAt: a.createdAt,
      })),
      total,
      page,
      limit,
      stats,
    });
  } catch (error) {
    console.error("[apelaciones GET]", error);
    return apiError("Error al listar apelaciones", 500);
  }
}
