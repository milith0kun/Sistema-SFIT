import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Vehicle } from "@/models/Vehicle";
import { Company } from "@/models/Company";
import { apiResponse, apiError, apiForbidden, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, VEHICLE_STATUS } from "@/lib/constants";
import { canAccessMunicipality, scopedCompanyFilter } from "@/lib/auth/rbac";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";
import { rolesFor } from "@/lib/auth/roleMatrix";

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
  photoUrl: z.string().url().optional(),
});

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [...rolesFor("vehiculos", "view")]);
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

    // Operador: acotar al companyId del operador (Vehicle.companyId directo).
    // Sin empresa asignada → lista vacía (no es error de auth).
    if (auth.session.role === ROLES.OPERADOR) {
      const companyId = await getOperatorCompanyId(auth.session.userId);
      if (!companyId) {
        return apiResponse({ items: [], total: 0, page, limit });
      }
      filter.companyId = companyId;
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
        companyId: v.companyId ? String((v.companyId as { _id?: unknown })._id ?? v.companyId) : undefined,
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
        photoUrl: v.photoUrl,
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
  const auth = requireRole(request, [...rolesFor("vehiculos", "create")]);
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

    // Resolver municipalityId según rol:
    //   - admin_municipal/fiscal/operador: usa el del JWT.
    //   - super_admin/admin_regional/admin_provincial: viene del body y se
    //     valida con canAccessMunicipality (cubre scope geográfico).
    let municipalityId = parsed.data.municipalityId;
    if (
      auth.session.role === ROLES.ADMIN_MUNICIPAL ||
      auth.session.role === ROLES.FISCAL ||
      auth.session.role === ROLES.OPERADOR
    ) {
      if (!auth.session.municipalityId) return apiForbidden();
      municipalityId = auth.session.municipalityId;
    }
    if (!municipalityId) return apiError("municipalityId requerido", 400);

    await connectDB();
    if (!(await canAccessMunicipality(auth.session, municipalityId))) return apiForbidden();

    // companyId:
    //   - operador: forzar a su empresa propia (ignora body) y validar muni.
    //   - admins (SA/AR/AP/AM): si viene en body, validar que pertenezca al
    //     scope geográfico vía scopedCompanyFilter.
    let effectiveCompanyId = parsed.data.companyId;
    if (auth.session.role === ROLES.OPERADOR) {
      const myCompanyId = await getOperatorCompanyId(auth.session.userId);
      if (!myCompanyId) return apiError("Sin empresa asignada", 400);
      const company = await Company.findById(myCompanyId).select("municipalityId").lean<{ municipalityId?: unknown } | null>();
      if (!company || String(company.municipalityId) !== String(auth.session.municipalityId)) {
        return apiForbidden();
      }
      effectiveCompanyId = myCompanyId;
    } else if (effectiveCompanyId) {
      const filter = await scopedCompanyFilter(auth.session);
      const match = await Company.findOne({ _id: effectiveCompanyId, ...filter })
        .select("_id")
        .lean();
      if (!match) return apiForbidden();
    }

    const duplicate = await Vehicle.findOne({ municipalityId, plate: parsed.data.plate.toUpperCase() });
    if (duplicate) return apiError("Ya existe un vehículo con esa placa", 409);

    const created = await Vehicle.create({
      municipalityId,
      companyId: effectiveCompanyId,
      plate: parsed.data.plate.toUpperCase(),
      vehicleTypeKey: parsed.data.vehicleTypeKey,
      brand: parsed.data.brand,
      model: parsed.data.model,
      year: parsed.data.year,
      status: parsed.data.status ?? VEHICLE_STATUS.DISPONIBLE,
      soatExpiry: parsed.data.soatExpiry ? new Date(parsed.data.soatExpiry) : undefined,
      photoUrl: parsed.data.photoUrl,
    });

    return apiResponse({ id: String(created._id), ...created.toObject() }, 201);
  } catch (error) {
    console.error("[vehiculos POST]", error);
    return apiError("Error al crear vehículo", 500);
  }
}
