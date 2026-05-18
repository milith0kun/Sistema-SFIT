import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";
import { Vehicle } from "@/models/Vehicle";
import { Company, type IAuthorization } from "@/models/Company";
import { apiResponse, apiError, apiForbidden, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { getOperatorCompanyId } from "@/lib/auth/operatorCompany";
import { rolesFor } from "@/lib/auth/roleMatrix";
import { isCompanyAuthorizationValid } from "@/lib/company-authorization";

const CreateSchema = z.object({
  municipalityId: z.string().refine(isValidObjectId).optional(),
  vehicleId: z.string().refine(isValidObjectId),
  driverId: z.string().refine(isValidObjectId),
  routeId: z.string().refine(isValidObjectId).optional(),
  fleetEntryId: z.string().refine(isValidObjectId).optional(),
  startTime: z.string().optional(),
  km: z.number().min(0).optional(),
  passengers: z.number().min(0).optional(),
});

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [...rolesFor("viajes", "view")]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const period = url.searchParams.get("period");
    const statusParam = url.searchParams.get("status");
    const municipalityIdParam = url.searchParams.get("municipalityId");

    const filter: Record<string, unknown> = {};

    if (auth.session.role === ROLES.CONDUCTOR) {
      // Conductor ve solo sus propios viajes — busca su Driver record
      let driver = await Driver.findOne({ userId: auth.session.userId }).select("_id municipalityId").lean();
      if (!driver && auth.session.municipalityId) {
        const user = await User.findById(auth.session.userId).select("dni municipalityId").lean();
        if (user?.dni) {
          driver = await Driver.findOne({ dni: user.dni, municipalityId: auth.session.municipalityId })
            .select("_id municipalityId").lean();
        }
      }
      // Sin registro de conductor aún → lista vacía (no es error de autorización)
      if (!driver) return apiResponse({ items: [], total: 0, page, limit });
      filter.driverId = driver._id;
      filter.municipalityId = driver.municipalityId;
    } else if (auth.session.role === ROLES.SUPER_ADMIN) {
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

    // Operador: SIEMPRE acota a los viajes cuya unidad pertenezca a su
    // empresa. Trip no guarda companyId, así que se infiere a través del
    // vehicleId. Sin empresa asignada → lista vacía (no es error de auth).
    if (auth.session.role === ROLES.OPERADOR) {
      const companyId = await getOperatorCompanyId(auth.session.userId);
      if (!companyId) return apiResponse({ items: [], total: 0, page, limit });
      const vehicleIds = await Vehicle.find({ companyId })
        .select("_id")
        .lean<Array<{ _id: unknown }>>();
      if (vehicleIds.length === 0) {
        return apiResponse({ items: [], total: 0, page, limit });
      }
      filter.vehicleId = { $in: vehicleIds.map((v) => v._id) };
    }

    if (statusParam) filter.status = statusParam;

    // Auto-cierre pasivo: cierra viajes viejos al listar (silencioso, no bloquea el listado)
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
    await Trip.updateMany(
      { status: "en_curso", startTime: { $lte: cutoff } },
      { $set: { status: "auto_cierre", endTime: new Date() } },
    ).catch(() => {});

    const now = new Date();
    if (period === "hoy") {
      // Ventana de ±24h en lugar de "hoy" estricto: el server corre en UTC y
      // los registros se crean en hora local del cliente (Perú UTC-5), lo que
      // causa que el filtro "hoy en UTC" pierda registros al cruzar medianoche.
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      filter.startTime = { $gte: start, $lte: end };
    } else if (period === "semana") {
      const start = new Date(now); start.setDate(start.getDate() - 7);
      filter.startTime = { $gte: start };
    } else if (period === "mes") {
      const start = new Date(now); start.setDate(start.getDate() - 30);
      filter.startTime = { $gte: start };
    }

    const [items, total] = await Promise.all([
      Trip.find(filter)
        .populate("vehicleId", "plate brand model")
        .populate("driverId", "name")
        .populate("routeId", "code name")
        .sort({ startTime: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Trip.countDocuments(filter),
    ]);

    return apiResponse({
      items: items.map((t) => ({
        id: String(t._id),
        municipalityId: String(t.municipalityId),
        vehicle: t.vehicleId as unknown as Record<string, unknown>,
        driver: t.driverId as unknown as Record<string, unknown>,
        route: t.routeId as unknown as Record<string, unknown> | null,
        startTime: t.startTime,
        endTime: t.endTime,
        km: t.km,
        passengers: t.passengers,
        status: t.status,
        createdAt: t.createdAt,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[viajes GET]", error);
    return apiError("Error al listar viajes", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [...rolesFor("viajes", "create")]);
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
    //   - super_admin: viene del body.
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

    // Operador: bloquear creación si no tiene empresa, y validar que el
    // vehicleId pertenezca a SU empresa (no permitir crear viajes con buses
    // de otras empresas).
    let companyId: string | undefined;
    if (auth.session.role === ROLES.OPERADOR) {
      const myCompanyId = await getOperatorCompanyId(auth.session.userId);
      if (!myCompanyId) return apiError("Sin empresa asignada", 400);
      const vehicle = await Vehicle.findById(parsed.data.vehicleId)
        .select("companyId")
        .lean<{ companyId?: unknown } | null>();
      if (!vehicle || String(vehicle.companyId ?? "") !== String(myCompanyId)) {
        return apiForbidden();
      }
      companyId = String(myCompanyId);
    } else {
      // Para admin_municipal/super_admin: derivar companyId desde el vehículo.
      // En rutas urbanas compartidas se sobrescribirá si el body lo indica.
      const vehicle = await Vehicle.findById(parsed.data.vehicleId)
        .select("companyId")
        .lean<{ companyId?: unknown } | null>();
      if (vehicle?.companyId) companyId = String(vehicle.companyId);
    }

    // Validar autorización vigente de la empresa que opera el viaje. Sin
    // autorización al día no se aceptan viajes. super_admin puede bypasear
    // con ?override=true (queda en audit log a través de los hooks).
    if (companyId) {
      const overrideAuth = new URL(request.url).searchParams.get("override") === "true"
        && auth.session.role === ROLES.SUPER_ADMIN;
      if (!overrideAuth) {
        const company = await Company.findById(companyId)
          .select("authorizations razonSocial")
          .lean<{ authorizations?: IAuthorization[]; razonSocial?: string } | null>();
        if (!company || !isCompanyAuthorizationValid(company.authorizations)) {
          return apiError(
            `La empresa ${company?.razonSocial ?? ""} no tiene autorización vigente para operar viajes.`,
            422,
          );
        }
      }
    }

    // Adopción de Trip "auto" creado por un ciudadano vía
    // `POST /api/ciudadano/viajes/registrar` (interprov). Si existe un Trip
    // activo del mismo vehículo SIN driver, lo adoptamos en lugar de crear
    // un duplicado — así los ciudadanos que ya escanearon su QR quedan
    // enlazados con el viaje del conductor sin manualmente reasociarse.
    const adoptable = await Trip.findOneAndUpdate(
      {
        vehicleId: parsed.data.vehicleId,
        driverId: { $exists: false },
        status: { $in: ["en_curso", "aceptado"] },
        endTime: { $exists: false },
      },
      {
        $set: {
          driverId: parsed.data.driverId,
          routeId: parsed.data.routeId,
          fleetEntryId: parsed.data.fleetEntryId,
          companyId,
          ...(parsed.data.startTime
            ? { startTime: new Date(parsed.data.startTime) }
            : {}),
          ...(parsed.data.km != null ? { km: parsed.data.km } : {}),
          ...(parsed.data.passengers != null
            ? { passengers: parsed.data.passengers }
            : {}),
          status: "en_curso",
        },
      },
      { new: true, sort: { startTime: -1 } },
    );

    if (adoptable) {
      return apiResponse(
        {
          id: String(adoptable._id),
          adopted: true,
          ...adoptable.toObject(),
        },
        200,
      );
    }

    const created = await Trip.create({
      municipalityId,
      vehicleId: parsed.data.vehicleId,
      companyId,
      driverId: parsed.data.driverId,
      routeId: parsed.data.routeId,
      fleetEntryId: parsed.data.fleetEntryId,
      startTime: parsed.data.startTime ? new Date(parsed.data.startTime) : new Date(),
      km: parsed.data.km ?? 0,
      passengers: parsed.data.passengers ?? 0,
      status: "en_curso",
    });

    return apiResponse({ id: String(created._id), ...created.toObject() }, 201);
  } catch (error) {
    console.error("[viajes POST]", error);
    return apiError("Error al crear viaje", 500);
  }
}
