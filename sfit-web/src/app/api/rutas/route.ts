import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Route } from "@/models/Route";
import { apiResponse, apiError, apiForbidden, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality, scopedCompanyFilter } from "@/lib/auth/rbac";
import { Company, SERVICE_SCOPES, type IAuthorization } from "@/models/Company";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";
import { rolesFor } from "@/lib/auth/roleMatrix";
import { isCompanyAuthorizationValid } from "@/lib/company-authorization";
import { collectRouteDistrictCodes, validateRouteByScope } from "@/lib/routing/validation";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const WaypointInputSchema = z.object({
  order: z.number().int().min(0),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().max(100).optional(),
  districtCode: z.string().min(2).max(8).optional(),
});

const HoraPicoCreateSchema = z.object({
  from: z.string().regex(TIME_REGEX, "Formato HH:mm requerido"),
  to:   z.string().regex(TIME_REGEX, "Formato HH:mm requerido"),
});

const ParametersCreateSchema = z
  .object({
    frecuenciaMinutos: z.number().min(0).max(240).nullable().optional(),
    capacidadAsientos: z.number().min(0).max(200).nullable().optional(),
    horarioPico: z.array(HoraPicoCreateSchema).max(8).optional(),
    observaciones: z.string().max(500).nullable().optional(),
  })
  .strict();

const CreateSchema = z.object({
  municipalityId: z.string().refine(isValidObjectId).optional(),
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(200),
  type: z.enum(["ruta", "zona"]).optional(),
  stops: z.number().min(0).optional(),
  length: z.string().max(20).optional(),
  area: z.string().max(20).optional(),
  vehicleTypeKey: z.string().optional(),
  companyId: z.string().refine(isValidObjectId).optional(),
  /**
   * Ruta urbana compartida por múltiples empresas (caso Cotabambas: misma
   * ruta operada por varias empresas con misma tarifa y paraderos).
   * Cuando es true, companyId queda null y companyIds lista los operadores.
   */
  isShared: z.boolean().optional(),
  companyIds: z.array(z.string().refine(isValidObjectId)).max(20).optional(),
  vehicleCount: z.number().min(0).optional(),
  status: z.enum(["activa", "suspendida"]).optional(),
  frequencies: z.array(z.string().max(80)).optional(),
  waypoints: z.array(WaypointInputSchema).max(200).optional(),
  serviceScope: z.enum(SERVICE_SCOPES as [string, ...string[]]).optional(),
  originDistrictCode: z.string().min(2).max(8).optional(),
  destinationDistrictCode: z.string().min(2).max(8).optional(),
  departureSchedules: z
    .array(z.string().regex(TIME_REGEX, "Formato HH:mm requerido"))
    .max(48)
    .optional(),
  tags: z.array(z.string().min(1).max(40)).max(16).optional(),
  parameters: ParametersCreateSchema.optional(),
});



export async function GET(request: NextRequest) {
  const auth = requireRole(request, [...rolesFor("rutas", "view")]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const typeParam = url.searchParams.get("type");
    const statusParam = url.searchParams.get("status");
    const municipalityIdParam = url.searchParams.get("municipalityId");

    const filter: Record<string, unknown> = {};

    if (auth.session.role === ROLES.SUPER_ADMIN) {
      if (municipalityIdParam) {
        if (!isValidObjectId(municipalityIdParam)) return apiError("municipalityId inválido", 400);
        filter.municipalityId = municipalityIdParam;
      }
    } else {
      // Conductor usa su municipalityId del JWT (igual que otros roles operativos)
      const targetId = municipalityIdParam ?? auth.session.municipalityId;
      if (!targetId || !isValidObjectId(targetId)) return apiForbidden();
      if (!(await canAccessMunicipality(auth.session, targetId))) return apiForbidden();
      filter.municipalityId = targetId;
    }

    if (typeParam === "ruta" || typeParam === "zona") filter.type = typeParam;
    if (statusParam === "activa" || statusParam === "suspendida") filter.status = statusParam;

    // Filtro por departamento (UBIGEO 2 dígitos). Match contra:
    //   - originDistrictCode (rutas interprovinciales) — primeros 2 chars
    //   - traversedDistrictCodes (cualquier ruta) — primeros 2 chars
    // Útil cuando la empresa cubre varios departamentos y el operador quiere
    // ver solo las rutas del departamento que está revisando.
    const departmentCode = url.searchParams.get("departmentCode");
    if (departmentCode && /^\d{2}$/.test(departmentCode)) {
      const prefix = `^${departmentCode}`;
      filter.$or = [
        { originDistrictCode: { $regex: prefix } },
        { traversedDistrictCodes: { $regex: prefix } },
        { "waypoints.districtCode": { $regex: prefix } },
      ];
    }

    // Operador: SIEMPRE acota a las rutas de su empresa (multi-tenant).
    // Si no tiene empresa todavía devolvemos lista vacía (no es error de auth).
    // El alias `?companyId=mine` se mantiene como compat hacia adelante.
    const companyIdParam = url.searchParams.get("companyId");
    if (auth.session.role === ROLES.OPERADOR) {
      const companyId = await getOperatorCompanyId(auth.session.userId);
      if (!companyId) return apiResponse({ items: [], total: 0 });
      filter.companyId = companyId;
    } else if (
      companyIdParam &&
      companyIdParam !== "mine" &&
      isValidObjectId(companyIdParam)
    ) {
      filter.companyId = companyIdParam;
    }

    const [items, total] = await Promise.all([
      Route.find(filter)
        .populate("companyId", "razonSocial")
        .sort({ code: 1 })
        .lean(),
      Route.countDocuments(filter),
    ]);

    return apiResponse({
      items: items.map((r) => ({
        id: String(r._id),
        municipalityId: String(r.municipalityId),
        code: r.code,
        name: r.name,
        type: r.type,
        stops: r.stops,
        length: r.length,
        area: r.area,
        vehicleTypeKey: r.vehicleTypeKey,
        companyId: r.companyId ? String((r.companyId as { _id?: unknown })._id ?? r.companyId) : undefined,
        companyName: (r.companyId as { razonSocial?: string } | null)?.razonSocial,
        isShared: r.isShared ?? false,
        companyIds: (r.companyIds ?? []).map((c) => String(c)),
        serviceScope: r.serviceScope,
        originDistrictCode: r.originDistrictCode,
        destinationDistrictCode: r.destinationDistrictCode,
        vehicleCount: r.vehicleCount,
        status: r.status,
        frequencies: r.frequencies,
        waypoints: r.waypoints ?? [],
        // Geometría real siguiendo calles (Google Routes snap-to-roads). Sin
        // esto el frontend pinta líneas rectas waypoint-a-waypoint que
        // atraviesan manzanas/casas. Puede ser null si Google no respondió;
        // en ese caso la app cae al fallback de líneas rectas.
        polylineGeometry: r.polylineGeometry ?? null,
        // Override manual del operador. Si está presente, la UI debe pintar
        // esa pasada como "MEJOR (manual)" — gana sobre el isBest automático.
        preferredCaptureId: r.preferredCaptureId ? String(r.preferredCaptureId) : null,
        preferredAt: r.preferredAt ?? null,
        // Metadata operativa editable por el operador.
        tags: r.tags ?? [],
        parameters: r.parameters ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      total,
    });
  } catch (error) {
    console.error("[rutas GET]", error);
    return apiError("Error al listar rutas", 500);
  }
}

export async function POST(request: NextRequest) {
  // Operador puede crear rutas para su empresa además de admins.
  const auth = requireRole(request, [...rolesFor("rutas", "create")]);
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

    // municipalityId según rol:
    //   - admin_municipal/fiscal/operador: usa el del JWT.
    //   - super_admin/admin_regional/admin_provincial: viene del body.
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

    // Validación específica por modalidad: urbanas exigen waypoints; las
    // interprovinciales en cambio exigen UBIGEOs de origen/destino.
    const scopeErrors = validateRouteByScope(parsed.data.serviceScope, {
      waypoints: parsed.data.waypoints,
      originDistrictCode: parsed.data.originDistrictCode,
      destinationDistrictCode: parsed.data.destinationDistrictCode,
    });
    if (scopeErrors) return apiValidationError(scopeErrors);

    await connectDB();
    if (!(await canAccessMunicipality(auth.session, municipalityId))) return apiForbidden();

    // companyId / isShared / companyIds:
    //   - operador: solo puede crear rutas NO compartidas, forzadas a su empresa.
    //   - admins (super_admin / admin_municipal):
    //       * isShared=true → companyId queda null y companyIds debe traer >=1
    //         empresa válida (scopedCompanyFilter).
    //       * isShared=false (default) → companyId opcional; si viene se valida.
    //
    // Para cada empresa involucrada se valida vigencia de autorizaciones —
    // sin autorización vigente la empresa no puede crear/asociarse a rutas.
    // super_admin bypasea con ?override=true (auditable) por si necesita
    // crear ruta administrativa antes de aprobar la autorización.
    const overrideAuth =
      new URL(request.url).searchParams.get("override") === "true"
      && auth.session.role === ROLES.SUPER_ADMIN;

    const routeDistrictCodes = collectRouteDistrictCodes({
      waypoints: parsed.data.waypoints,
      originDistrictCode: parsed.data.originDistrictCode,
      destinationDistrictCode: parsed.data.destinationDistrictCode,
    });

    /** Cruza la ruta contra la cobertura declarada por la empresa. Sólo
     *  bloquea si la empresa SÍ declaró cobertura y la ruta sale de ahí.
     *  Empresas sin cobertura declarada quedan exentas — el admin debería
     *  pedirles que la registren, pero no es bloqueante. */
    const validateCoverage = (
      company: { coverage?: { districtCodes?: string[] }; razonSocial?: string },
    ): string | null => {
      const cov = company.coverage?.districtCodes ?? [];
      if (cov.length === 0) return null; // sin cobertura → no validamos
      if (routeDistrictCodes.length === 0) return null; // ruta sin códigos → no validamos
      const outside = routeDistrictCodes.filter((c) => !cov.includes(c));
      if (outside.length === 0) return null;
      return `Distritos fuera de la cobertura de ${company.razonSocial ?? "la empresa"}: ${outside.join(", ")}`;
    };

    const dataForCreate: Record<string, unknown> = { ...parsed.data };
    if (auth.session.role === ROLES.OPERADOR) {
      if (parsed.data.isShared) {
        return apiForbidden("El operador no puede crear rutas compartidas");
      }
      const myCompanyId = await getOperatorCompanyId(auth.session.userId);
      if (!myCompanyId) return apiError("Sin empresa asignada", 400);
      const company = await Company.findById(myCompanyId)
        .select("municipalityId authorizations coverage razonSocial")
        .lean<{ municipalityId?: unknown; authorizations?: IAuthorization[]; coverage?: { districtCodes?: string[] }; razonSocial?: string } | null>();
      if (!company || String(company.municipalityId) !== String(auth.session.municipalityId)) {
        return apiForbidden();
      }
      if (!isCompanyAuthorizationValid(company.authorizations)) {
        return apiError(
          "Tu empresa no tiene autorización vigente para operar rutas. Renueva la autorización antes de crear rutas.",
          422,
        );
      }
      const coverageErr = validateCoverage(company);
      if (coverageErr) return apiError(coverageErr, 422);
      dataForCreate.companyId = myCompanyId;
      dataForCreate.companyIds = [];
    } else if (parsed.data.isShared) {
      if (!parsed.data.companyIds || parsed.data.companyIds.length === 0) {
        return apiValidationError({
          companyIds: ["Las rutas compartidas requieren al menos una empresa autorizada"],
        });
      }
      const filter = await scopedCompanyFilter(auth.session);
      const valid = await Company.find({
        _id: { $in: parsed.data.companyIds },
        ...filter,
      })
        .select("_id authorizations coverage razonSocial")
        .lean<Array<{ _id: unknown; authorizations?: IAuthorization[]; coverage?: { districtCodes?: string[] }; razonSocial?: string }>>();
      if (valid.length !== parsed.data.companyIds.length) {
        return apiForbidden("Una o más empresas no son accesibles en tu scope");
      }
      if (!overrideAuth) {
        const sinAutorizacion = valid.filter(
          (c) => !isCompanyAuthorizationValid(c.authorizations),
        );
        if (sinAutorizacion.length > 0) {
          return apiError(
            `Sin autorización vigente: ${sinAutorizacion
              .map((c) => c.razonSocial ?? String(c._id))
              .join(", ")}`,
            422,
          );
        }
        // Cobertura: cada empresa asociada debe cubrir todos los distritos
        // de la ruta. Si una sola no los cubre, la ruta queda fuera.
        for (const c of valid) {
          const err = validateCoverage(c);
          if (err) return apiError(err, 422);
        }
      }
      dataForCreate.companyId = undefined;
    } else if (parsed.data.companyId) {
      const filter = await scopedCompanyFilter(auth.session);
      const match = await Company.findOne({ _id: parsed.data.companyId, ...filter })
        .select("_id authorizations coverage razonSocial")
        .lean<{ _id: unknown; authorizations?: IAuthorization[]; coverage?: { districtCodes?: string[] }; razonSocial?: string } | null>();
      if (!match) return apiForbidden();
      if (!overrideAuth && !isCompanyAuthorizationValid(match.authorizations)) {
        return apiError(
          `La empresa ${match.razonSocial ?? ""} no tiene autorización vigente para operar rutas.`,
          422,
        );
      }
      if (!overrideAuth) {
        const err = validateCoverage(match);
        if (err) return apiError(err, 422);
      }
    }

    const duplicate = await Route.findOne({ municipalityId, code: parsed.data.code });
    if (duplicate) return apiError("Ya existe una ruta con ese código", 409);

    const created = await Route.create({ municipalityId, ...dataForCreate });

    // Recompute geometry siguiendo calles reales en background si hay
    // suficientes waypoints. No bloquea la respuesta de creación.
    if (created.waypoints && created.waypoints.length >= 2) {
      void (async () => {
        try {
          const { routeAlongWaypoints } = await import("@/lib/routing/routingService");
          const geom = await routeAlongWaypoints(
            created.waypoints.map(w => ({ lat: w.lat, lng: w.lng })),
          );
          if (geom) {
            await Route.findByIdAndUpdate(created._id, {
              polylineGeometry: {
                coords: geom.coords,
                distanceMeters: geom.distanceMeters,
                durationSecondsBaseline: geom.durationSeconds,
                computedAt: new Date(),
              },
            });
          }
        } catch (err) {
          console.warn("[rutas POST] recompute geometry failed", err);
        }
      })();
    }

    return apiResponse({ id: String(created._id), ...created.toObject() }, 201);
  } catch (error) {
    console.error("[rutas POST]", error);
    return apiError("Error al crear ruta", 500);
  }
}
