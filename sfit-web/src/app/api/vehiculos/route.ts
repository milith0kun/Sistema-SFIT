import { NextRequest } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
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
import { triggerVehicleScraping } from "@/lib/scraper/trigger";
import { computeDocStatus } from "@/lib/vehicle-status";

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
  soatInsurer: z.string().max(120).optional(),
  soatCertificate: z.string().max(60).optional(),
  ownerName: z.string().max(200).optional(),
  lastInspectionDate: z.string().optional(),
  lastInspectionStatus: z.enum(["aprobada", "observada", "rechazada", "pendiente"]).optional(),
  lastInspectionCertificate: z.string().max(60).optional(),
  citvExpiryDate: z.string().optional(),
  photoUrl: z.string().url(),
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

    const filter: Record<string, unknown> = { active: true };
    // Permitir ver inactivos con ?incluirInactivos=true (para admins que auditan)
    if (url.searchParams.get("incluirInactivos") === "true") {
      delete filter.active;
    }

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
    // Filtro de verificación admin. "true" o "false" — cualquier otro valor ignora el filtro.
    const verifiedParam = url.searchParams.get("verified");
    if (verifiedParam === "true") filter.verified = true;
    else if (verifiedParam === "false") filter.verified = { $ne: true };
    // Filtro por empresa (solo admins; operador ya tiene su companyId forzado)
    const companyIdParam = url.searchParams.get("companyId");
    if (companyIdParam && auth.session.role !== ROLES.OPERADOR) {
      if (!isValidObjectId(companyIdParam)) return apiError("companyId inválido", 400);
      const scopeFilter = await scopedCompanyFilter(auth.session);
      const companyExists = await Company.findOne({ _id: companyIdParam, ...scopeFilter }).select("_id").lean();
      if (!companyExists) return apiForbidden();
      filter.companyId = companyIdParam;
    }
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
        currentDriverId: v.currentDriverId
          ? String((v.currentDriverId as { _id?: unknown })._id ?? v.currentDriverId)
          : null,
        currentDriverName: (v.currentDriverId as { name?: string } | null)?.name,
        lastInspectionStatus: v.lastInspectionStatus,
        lastInspectionDate: v.lastInspectionDate ?? null,
        lastInspectionCertificate: v.lastInspectionCertificate ?? null,
        reputationScore: v.reputationScore,
        soatExpiry: v.soatExpiry ?? null,
        soatInsurer: v.soatInsurer ?? null,
        soatCertificate: v.soatCertificate ?? null,
        ownerName: v.ownerName ?? null,
        citvExpiryDate: v.citvExpiryDate ?? null,
        qrHmac: v.qrHmac,
        photoUrl: v.photoUrl,
        active: v.active,
        verified: v.verified ?? false,
        verifiedAt: v.verifiedAt ?? null,
        soatStatus: computeDocStatus(v.soatExpiry),
        citvStatus: computeDocStatus(v.citvExpiryDate, v.year),
        scrapingStatus: v.scrapingStatus ?? "idle",
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
      const company = await Company.findById(myCompanyId)
        .select("municipalityId active")
        .lean<{ municipalityId?: unknown; active?: boolean } | null>();
      if (!company || String(company.municipalityId) !== String(auth.session.municipalityId)) {
        return apiForbidden();
      }
      if (!company.active) {
        return apiError(
          "Tu empresa está pendiente de aprobación. Contacta al administrador municipal.",
          403,
        );
      }
      effectiveCompanyId = myCompanyId;
    } else if (effectiveCompanyId) {
      const filter = await scopedCompanyFilter(auth.session);
      const match = await Company.findOne({ _id: effectiveCompanyId, ...filter })
        .select("_id active")
        .lean<{ _id: unknown; active?: boolean } | null>();
      if (!match) return apiForbidden();
      if (!match.active) {
        return apiError(
          "La empresa indicada está inactiva o pendiente de aprobación.",
          403,
        );
      }
    }

    const normalizedPlate = parsed.data.plate.toUpperCase().replace(/[^A-Za-z0-9]/g, "").slice(0, 6);

    // Solo bloquear creación si ya existe un vehículo ACTIVO con la misma placa
    const activeDuplicate = await Vehicle.findOne({ plate: normalizedPlate, active: true });
    if (activeDuplicate) return apiError("Ya existe un vehículo activo con esa placa", 409);

    // Si existe un vehículo inactivo (soft-deleted) con la misma placa, reactivarlo
    const inactive = await Vehicle.findOne({ plate: normalizedPlate, active: false });
    if (inactive) {
      inactive.set({
        municipalityId: new mongoose.Types.ObjectId(municipalityId),
        companyId: effectiveCompanyId ? new mongoose.Types.ObjectId(effectiveCompanyId) : undefined,
        vehicleTypeKey: parsed.data.vehicleTypeKey,
        brand: parsed.data.brand,
        model: parsed.data.model,
        year: parsed.data.year,
        status: parsed.data.status ?? VEHICLE_STATUS.DISPONIBLE,
        soatExpiry: parsed.data.soatExpiry ? new Date(parsed.data.soatExpiry) : undefined,
        soatInsurer: parsed.data.soatInsurer,
        soatCertificate: parsed.data.soatCertificate,
        ownerName: parsed.data.ownerName,
        lastInspectionDate: parsed.data.lastInspectionDate ? new Date(parsed.data.lastInspectionDate) : undefined,
        lastInspectionStatus: parsed.data.lastInspectionStatus,
        lastInspectionCertificate: parsed.data.lastInspectionCertificate,
        citvExpiryDate: parsed.data.citvExpiryDate ? new Date(parsed.data.citvExpiryDate) : undefined,
        photoUrl: parsed.data.photoUrl || undefined,
        active: true,
        verified: false,
        verifiedAt: undefined,
        verifiedBy: undefined,
        scrapingStatus: "idle",
        currentDriverId: undefined,
        reputationScore: 100,
      });
      await inactive.save();

      triggerVehicleScraping(String(inactive._id), normalizedPlate).catch((err) => {
        console.error("[vehiculos POST] scrape trigger failed:", err);
      });

      return apiResponse({ id: String(inactive._id), reactivated: true, ...inactive.toObject() }, 200);
    }

    const created = await Vehicle.create({
      municipalityId,
      companyId: effectiveCompanyId,
      plate: normalizedPlate,
      vehicleTypeKey: parsed.data.vehicleTypeKey,
      brand: parsed.data.brand,
      model: parsed.data.model,
      year: parsed.data.year,
      status: parsed.data.status ?? VEHICLE_STATUS.DISPONIBLE,
      soatExpiry: parsed.data.soatExpiry ? new Date(parsed.data.soatExpiry) : undefined,
      soatInsurer: parsed.data.soatInsurer,
      soatCertificate: parsed.data.soatCertificate,
      ownerName: parsed.data.ownerName,
      lastInspectionDate: parsed.data.lastInspectionDate ? new Date(parsed.data.lastInspectionDate) : undefined,
      lastInspectionStatus: parsed.data.lastInspectionStatus,
      lastInspectionCertificate: parsed.data.lastInspectionCertificate,
      citvExpiryDate: parsed.data.citvExpiryDate ? new Date(parsed.data.citvExpiryDate) : undefined,
      photoUrl: parsed.data.photoUrl,
    });

    // Disparar scraping asíncrono (fire-and-forget)
    triggerVehicleScraping(String(created._id), normalizedPlate).catch((err) => {
      console.error("[vehiculos POST] scrape trigger failed:", err);
    });

    return apiResponse({ id: String(created._id), ...created.toObject() }, 201);
  } catch (error) {
    console.error("[vehiculos POST]", error);
    return apiError("Error al crear vehículo", 500);
  }
}
