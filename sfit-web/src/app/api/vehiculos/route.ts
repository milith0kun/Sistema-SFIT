import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";
import { apiResponse, apiError, apiForbidden, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, VEHICLE_STATUS } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

const CreateVehicleSchema = z.object({
  municipalityId: z.string().refine(isValidObjectId).optional(),
  companyId: z.string().refine(isValidObjectId).optional(),
  plate: z.string().min(5).max(10),
  vehicleTypeKey: z.string().min(1).max(80),
  brand: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  year: z.number().min(1990).max(new Date().getFullYear() + 1),
  status: z.enum(["disponible", "en_ruta", "en_mantenimiento", "fuera_de_servicio"]).optional(),
  soatExpiry: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL,
    ROLES.FISCAL, ROLES.OPERADOR, ROLES.CONDUCTOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const statusParam = url.searchParams.get("status");
    const typeParam = url.searchParams.get("type");
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

    if (statusParam && Object.values(VEHICLE_STATUS).includes(statusParam as never)) filter.status = statusParam;
    if (typeParam) filter.vehicleTypeKey = typeParam;
    if (search) {
      filter.$or = [
        { plate: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { model: { $regex: search, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      Vehicle.find(filter)
        .populate("companyId", "razonSocial")
        .populate("currentDriverId", "name")
        .sort({ plate: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Vehicle.countDocuments(filter),
    ]);

    return apiResponse({
      items: items.map((v) => ({
        id: String(v._id),
        municipalityId: String(v.municipalityId),
        companyId: v.companyId ? String(v.companyId) : undefined,
        companyName: (v.companyId as { razonSocial?: string } | null)?.razonSocial,
        plate: v.plate,
        vehicleTypeKey: v.vehicleTypeKey,
        brand: v.brand,
        model: v.model,
        year: v.year,
        status: v.status,
        currentDriverName: (v.currentDriverId as { name?: string } | null)?.name,
        lastInspectionStatus: v.lastInspectionStatus,
        reputationScore: v.reputationScore,
        soatExpiry: v.soatExpiry,
        qrHmac: v.qrHmac,
        active: v.active,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[vehiculos GET]", error);
    return apiError("Error al listar vehículos", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateVehicleSchema.safeParse(body);
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

    const duplicate = await Vehicle.findOne({ municipalityId, plate: parsed.data.plate.toUpperCase() });
    if (duplicate) return apiError("Ya existe un vehículo con esa placa", 409);

    const created = await Vehicle.create({
      municipalityId,
      companyId: parsed.data.companyId,
      plate: parsed.data.plate.toUpperCase(),
      vehicleTypeKey: parsed.data.vehicleTypeKey,
      brand: parsed.data.brand,
      model: parsed.data.model,
      year: parsed.data.year,
      status: parsed.data.status ?? VEHICLE_STATUS.DISPONIBLE,
      soatExpiry: parsed.data.soatExpiry ? new Date(parsed.data.soatExpiry) : undefined,
    });

    return apiResponse({ id: String(created._id), ...created.toObject() }, 201);
  } catch (error) {
    console.error("[vehiculos POST]", error);
    return apiError("Error al crear vehículo", 500);
  }
}
