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
import { canAccessMunicipality, recordMuniScope } from "@/lib/auth/rbac";
import { Municipality } from "@/models/Municipality";
import { rolesFor } from "@/lib/auth/roleMatrix";

const RepresentanteLegalSchema = z.object({
  name: z.string().min(2).max(160),
  dni: z.string().min(6).max(20),
  phone: z.string().max(30).optional(),
});

const DocumentSchema = z.object({
  name: z.string().min(1).max(160),
  url: z.string().url(),
});

const SERVICE_SCOPE_ENUM = ["urbano", "interprovincial"] as const;
const AUTHORITY_LEVEL_ENUM = [
  "municipal_distrital",
  "municipal_provincial",
  "regional",
  "mtc",
] as const;

const CoverageSchema = z.object({
  departmentCodes: z.array(z.string().regex(/^\d{2}$/)).max(30).optional(),
  provinceCodes:   z.array(z.string().regex(/^\d{4}$/)).max(60).optional(),
  districtCodes:   z.array(z.string().regex(/^\d{6}$/)).max(200).optional(),
});

const AuthorizationSchema = z
  .object({
    level: z.enum(AUTHORITY_LEVEL_ENUM),
    scope: z.enum(SERVICE_SCOPE_ENUM),
    issuedBy: z.string().max(200).optional(),
    resolutionNumber: z.string().max(80).optional(),
    issuedAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
    documentUrl: z.string().url().optional(),
  })
  .refine(
    (a) => !a.issuedAt || !a.expiresAt || a.expiresAt.getTime() > a.issuedAt.getTime(),
    { message: "expiresAt debe ser posterior a issuedAt", path: ["expiresAt"] },
  );

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
  /** Modalidad de servicio. Default `urbano` cuando no se envía. */
  serviceScope: z.enum(SERVICE_SCOPE_ENUM).optional(),
  /** Cobertura geográfica. Si no se envía, se infiere desde la sede municipal. */
  coverage: CoverageSchema.optional(),
  /** Autorizaciones iniciales. Si no se envían, se crea una autorización
   *  base municipal sin fecha de vencimiento (vigente indefinida). */
  authorizations: z.array(AuthorizationSchema).max(10).optional(),
});

/**
 * RF-04.
 * GET — listado paginado filtrado por municipalidad (RNF-03).
 * POST — Admin Municipal registra empresa (RF-04-01).
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [...rolesFor("empresas", "view")]);
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
    } else if (auth.session.role === ROLES.ADMIN_MUNICIPAL) {
      // Modelo mono-muni administrativo: Cotabambas Provincial administra
      // los 6 distritos como un solo tenant. El admin debe ver TODAS las
      // empresas del sistema (mismo criterio que `/api/public/empresas`
      // usado por el app del conductor para elegir empresa).
      // `recordMuniScope` devuelve {} para admin_municipal.
      Object.assign(filter, recordMuniScope(auth.session));
    } else {
      // Otros roles operativos (fiscal/operador, si llegasen acá): scope
      // clásico por su propia municipalidad.
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
        approvedAt: c.approvedAt,
        approvedBy: c.approvedBy ? String(c.approvedBy) : null,
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
  const auth = requireRole(request, [...rolesFor("empresas", "create")]);
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
    // urbano y poblamos coverage desde el ubigeoCode de la sede.
    const muniDoc = await Municipality.findById(municipalityId)
      .select("ubigeoCode provinceCode departmentCode name")
      .lean<{
        ubigeoCode?: string;
        provinceCode?: string;
        departmentCode?: string;
        name?: string;
      } | null>();

    // serviceScope: respeta el del cliente, default urbano.
    const serviceScope = parsed.data.serviceScope ?? "urbano";
    const canonicalVehicleTypeKey =
      serviceScope === "interprovincial"
        ? "transporte_interprovincial"
        : "transporte_urbano";

    // coverage: respeta el del cliente; en su defecto infiere desde la sede.
    const coverage = parsed.data.coverage ?? {
      districtCodes:   muniDoc?.ubigeoCode     ? [muniDoc.ubigeoCode]     : [],
      provinceCodes:   muniDoc?.provinceCode   ? [muniDoc.provinceCode]   : [],
      departmentCodes: muniDoc?.departmentCode ? [muniDoc.departmentCode] : [],
    };

    // authorizations: respeta las del cliente; en su defecto crea una base
    // municipal vigente indefinida (compat con flujo anterior).
    const authorizations =
      parsed.data.authorizations && parsed.data.authorizations.length > 0
        ? parsed.data.authorizations
        : [
            {
              level: "municipal_distrital",
              scope: serviceScope,
              issuedBy: muniDoc?.name ? `Municipalidad de ${muniDoc.name}` : undefined,
            },
          ];

    const created = await Company.create({
      municipalityId,
      razonSocial: parsed.data.razonSocial,
      ruc: parsed.data.ruc,
      representanteLegal: parsed.data.representanteLegal,
      vehicleTypeKeys: [canonicalVehicleTypeKey],
      documents: parsed.data.documents ?? [],
      active: parsed.data.active ?? true,
      serviceScope,
      coverage,
      authorizations,
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
