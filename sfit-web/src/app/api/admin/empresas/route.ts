import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Company, SERVICE_SCOPES, AUTHORITY_LEVELS } from "@/models/Company";
import { Municipality } from "@/models/Municipality";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
  apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { scopedCompanyFilter } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit/log";

/**
 * /api/admin/empresas
 *
 * Vista nacional de empresas para super_admin (todas, sin filtro de tenant) y
 * admin_provincial (las que cubren su provincia o están sediadas en ella).
 *
 * GET — listado con filtros: serviceScope, departmentCode, provinceCode, ruc, q.
 * POST — solo super_admin: crea empresas con scope >= interprovincial_regional.
 *        Las urbano_distrital se crean por /api/empresas (admin_municipal).
 */

const RepresentanteLegalSchema = z.object({
  name: z.string().min(2).max(160),
  dni: z.string().min(6).max(20),
  phone: z.string().max(30).optional(),
});

const CoverageSchema = z.object({
  departmentCodes: z.array(z.string().regex(/^\d{2}$/)).default([]),
  provinceCodes:   z.array(z.string().regex(/^\d{4}$/)).default([]),
  districtCodes:   z.array(z.string().regex(/^\d{6}$/)).default([]),
});

const AuthorizationSchema = z.object({
  level: z.enum(AUTHORITY_LEVELS as [string, ...string[]]),
  scope: z.enum(SERVICE_SCOPES as [string, ...string[]]),
  issuedBy: z.string().max(200).optional(),
  resolutionNumber: z.string().max(80).optional(),
  issuedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  documentUrl: z.string().url().optional(),
});

const CreateNationalCompanySchema = z.object({
  municipalityId: z.string().refine(isValidObjectId, "municipalityId inválido"),
  razonSocial: z.string().min(2).max(200),
  ruc: z.string().min(8).max(20),
  representanteLegal: RepresentanteLegalSchema,
  serviceScope: z.enum([
    "interprovincial_regional",
    "interregional_nacional",
  ]),
  coverage: CoverageSchema,
  authorizations: z.array(AuthorizationSchema).min(1, "Debe incluir al menos una autorización"),
  vehicleTypeKeys: z.array(z.string().min(1).max(80)).optional(),
  active: z.boolean().optional(),
});

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
      200,
      Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
    );
    const serviceScope    = url.searchParams.get("serviceScope");
    const departmentCode  = url.searchParams.get("departmentCode");
    const provinceCode    = url.searchParams.get("provinceCode");
    const districtCode    = url.searchParams.get("districtCode");
    const ruc             = url.searchParams.get("ruc");
    const activeRaw       = url.searchParams.get("active");
    const q               = url.searchParams.get("q")?.trim();

    const baseFilter = await scopedCompanyFilter(auth.session);
    const filter: Record<string, unknown> = { ...baseFilter };

    if (serviceScope && (SERVICE_SCOPES as string[]).includes(serviceScope)) {
      filter.serviceScope = serviceScope;
    }
    if (departmentCode && /^\d{2}$/.test(departmentCode)) {
      filter["coverage.departmentCodes"] = departmentCode;
    }
    if (provinceCode && /^\d{4}$/.test(provinceCode)) {
      filter["coverage.provinceCodes"] = provinceCode;
    }
    if (districtCode && /^\d{6}$/.test(districtCode)) {
      filter["coverage.districtCodes"] = districtCode;
    }
    if (ruc) filter.ruc = ruc.trim();
    if (q && q.length > 0) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.razonSocial = { $regex: escaped, $options: "i" };
    }
    if (activeRaw === "true")  filter.active = true;
    if (activeRaw === "false") filter.active = false;

    const [items, total] = await Promise.all([
      Company.find(filter)
        .sort({ razonSocial: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: "municipalityId", select: "name ubigeoCode departmentName" })
        .lean(),
      Company.countDocuments(filter),
    ]);

    type PopulatedMuni = {
      _id: unknown;
      name?: string;
      ubigeoCode?: string;
      departmentName?: string;
    } | null | undefined;

    return apiResponse({
      items: items.map((c) => {
        const muni = c.municipalityId as unknown as PopulatedMuni;
        return {
          id: String(c._id),
          municipalityId: muni && typeof muni === "object" && muni._id
            ? String(muni._id)
            : String(c.municipalityId),
          headquarters: muni
            ? {
                name: muni.name,
                ubigeoCode: muni.ubigeoCode,
                departmentName: muni.departmentName,
              }
            : null,
          razonSocial: c.razonSocial,
          ruc: c.ruc,
          representanteLegal: c.representanteLegal,
          serviceScope: c.serviceScope,
          coverage: c.coverage,
          authorizations: c.authorizations,
          vehicleTypeKeys: c.vehicleTypeKeys,
          active: c.active,
          suspendedAt: c.suspendedAt,
          reputationScore: c.reputationScore,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      }),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[admin/empresas GET]", error);
    return apiError("Error al listar empresas", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateNationalCompanySchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();

    // Validar coverage según scope
    if (
      parsed.data.serviceScope === "interprovincial_regional" &&
      parsed.data.coverage.provinceCodes.length < 2
    ) {
      return apiError(
        "Una empresa interprovincial_regional debe cubrir al menos 2 provincias",
        422,
      );
    }
    if (
      parsed.data.serviceScope === "interregional_nacional" &&
      parsed.data.coverage.departmentCodes.length < 2
    ) {
      return apiError(
        "Una empresa interregional_nacional debe cubrir al menos 2 departamentos",
        422,
      );
    }

    // Validar que la sede exista y esté activa
    const sede = await Municipality.findById(parsed.data.municipalityId)
      .select("_id active ubigeoCode")
      .lean<{ _id: unknown; active?: boolean; ubigeoCode?: string } | null>();
    if (!sede) return apiError("La municipalidad sede no existe", 400);
    if (!sede.active) {
      return apiError("La municipalidad sede no está activa en el sistema", 422);
    }

    // RUC único nacional
    const dup = await Company.findOne({ ruc: parsed.data.ruc });
    if (dup) return apiError("Ya existe una empresa con ese RUC", 409);

    const created = await Company.create({
      municipalityId: parsed.data.municipalityId,
      razonSocial: parsed.data.razonSocial,
      ruc: parsed.data.ruc,
      representanteLegal: parsed.data.representanteLegal,
      vehicleTypeKeys: parsed.data.vehicleTypeKeys ?? [],
      serviceScope: parsed.data.serviceScope,
      coverage: parsed.data.coverage,
      authorizations: parsed.data.authorizations,
      active: parsed.data.active ?? true,
    });

    await logAudit(request, auth.session, {
      action: "company.created.national",
      resourceType: "company",
      resourceId: String(created._id),
      metadata: {
        ruc: created.ruc,
        razonSocial: created.razonSocial,
        serviceScope: created.serviceScope,
      },
    });

    return apiResponse(
      {
        id: String(created._id),
        municipalityId: String(created.municipalityId),
        razonSocial: created.razonSocial,
        ruc: created.ruc,
        serviceScope: created.serviceScope,
        coverage: created.coverage,
        authorizations: created.authorizations,
        active: created.active,
        createdAt: created.createdAt,
      },
      201,
    );
  } catch (error) {
    console.error("[admin/empresas POST]", error);
    return apiError("Error al crear empresa", 500);
  }
}
