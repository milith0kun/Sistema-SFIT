import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Company } from "@/models/Company";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
  apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { Municipality } from "@/models/Municipality";

const RepresentanteLegalSchema = z.object({
  name: z.string().min(2).max(160),
  dni: z.string().min(6).max(20),
  phone: z.string().max(30).optional(),
});

const DocumentSchema = z.object({
  name: z.string().min(1).max(160),
  url: z.string().url(),
});

const CreateCompanySchema = z.object({
  municipalityId: z
    .string()
    .refine(isValidObjectId, "municipalityId inválido")
    .optional(),
  razonSocial: z.string().min(2).max(200),
  ruc: z.string().min(8).max(20),
  representanteLegal: RepresentanteLegalSchema,
  vehicleTypeKeys: z.array(z.string().min(1).max(80)).optional(),
  documents: z.array(DocumentSchema).optional(),
  active: z.boolean().optional(),
});

/**
 * RF-04.
 * GET — listado paginado filtrado por municipalidad (RNF-03).
 * POST — Admin Municipal registra empresa (RF-04-01).
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.FISCAL,
    ROLES.OPERADOR,
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
    const activeParam = url.searchParams.get("active");
    const vehicleTypeKey = url.searchParams.get("vehicleTypeKey");
    const municipalityIdParam = url.searchParams.get("municipalityId");

    const filter: Record<string, unknown> = {};

    if (auth.session.role === ROLES.SUPER_ADMIN) {
      if (municipalityIdParam) {
        if (!isValidObjectId(municipalityIdParam)) {
          return apiError("municipalityId inválido", 400);
        }
        filter.municipalityId = municipalityIdParam;
      }
    } else {
      const targetMunicipalityId =
        municipalityIdParam ?? auth.session.municipalityId;
      if (!targetMunicipalityId || !isValidObjectId(targetMunicipalityId)) {
        return apiForbidden();
      }
      if (!(await canAccessMunicipality(auth.session, targetMunicipalityId))) {
        return apiForbidden();
      }
      filter.municipalityId = targetMunicipalityId;
    }

    if (activeParam === "true") filter.active = true;
    else if (activeParam === "false") filter.active = false;
    if (vehicleTypeKey) filter.vehicleTypeKeys = vehicleTypeKey;

    const [items, total] = await Promise.all([
      Company.find(filter)
        .sort({ razonSocial: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Company.countDocuments(filter),
    ]);

    return apiResponse({
      items: items.map((c) => ({
        id: String(c._id),
        municipalityId: String(c.municipalityId),
        razonSocial: c.razonSocial,
        ruc: c.ruc,
        representanteLegal: c.representanteLegal,
        vehicleTypeKeys: c.vehicleTypeKeys,
        documents: c.documents,
        active: c.active,
        suspendedAt: c.suspendedAt,
        reputationScore: c.reputationScore,
        serviceScope: c.serviceScope,
        coverage: c.coverage,
        authorizations: c.authorizations,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[empresas GET]", error);
    return apiError("Error al listar empresas", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateCompanySchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    let municipalityId = parsed.data.municipalityId;
    if (auth.session.role === ROLES.ADMIN_MUNICIPAL) {
      if (!auth.session.municipalityId) return apiForbidden();
      if (
        municipalityId &&
        String(municipalityId) !== String(auth.session.municipalityId)
      ) {
        return apiForbidden();
      }
      municipalityId = auth.session.municipalityId;
    }
    if (!municipalityId) {
      return apiError("municipalityId es requerido para Super Admin", 400);
    }

    await connectDB();

    if (!(await canAccessMunicipality(auth.session, municipalityId))) {
      return apiForbidden();
    }

    // RUC único nacional (SUNAT).
    const duplicate = await Company.findOne({ ruc: parsed.data.ruc });
    if (duplicate) {
      return apiError(
        "Ya existe una empresa nacional con ese RUC",
        409,
      );
    }

    // Para empresas creadas por este endpoint (admin_municipal o super_admin
    // operando sobre una municipalidad concreta), inferimos serviceScope =
    // urbano_distrital y poblamos coverage desde el ubigeoCode de la sede.
    const muniDoc = await Municipality.findById(municipalityId)
      .select("ubigeoCode provinceCode departmentCode name")
      .lean<{
        ubigeoCode?: string;
        provinceCode?: string;
        departmentCode?: string;
        name?: string;
      } | null>();

    const created = await Company.create({
      municipalityId,
      razonSocial: parsed.data.razonSocial,
      ruc: parsed.data.ruc,
      representanteLegal: parsed.data.representanteLegal,
      vehicleTypeKeys: parsed.data.vehicleTypeKeys ?? [],
      documents: parsed.data.documents ?? [],
      active: parsed.data.active ?? true,
      serviceScope: "urbano_distrital",
      coverage: {
        districtCodes:   muniDoc?.ubigeoCode    ? [muniDoc.ubigeoCode]    : [],
        provinceCodes:   muniDoc?.provinceCode  ? [muniDoc.provinceCode]  : [],
        departmentCodes: muniDoc?.departmentCode ? [muniDoc.departmentCode] : [],
      },
      authorizations: [
        {
          level: "municipal_distrital",
          scope: "urbano_distrital",
          issuedBy: muniDoc?.name ? `Municipalidad de ${muniDoc.name}` : undefined,
        },
      ],
    });

    return apiResponse(
      {
        id: String(created._id),
        municipalityId: String(created.municipalityId),
        razonSocial: created.razonSocial,
        ruc: created.ruc,
        representanteLegal: created.representanteLegal,
        vehicleTypeKeys: created.vehicleTypeKeys,
        documents: created.documents,
        active: created.active,
        suspendedAt: created.suspendedAt,
        reputationScore: created.reputationScore,
        serviceScope: created.serviceScope,
        coverage: created.coverage,
        authorizations: created.authorizations,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
      201,
    );
  } catch (error) {
    console.error("[empresas POST]", error);
    return apiError("Error al crear empresa", 500);
  }
}
