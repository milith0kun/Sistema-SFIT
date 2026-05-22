import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { VehicleType } from "@/models/VehicleType";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiUnauthorized,
  apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, VEHICLE_TYPES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

const PREDEFINED_KEYS: readonly string[] = Object.values(VEHICLE_TYPES);

/**
 * Catálogo de tipos predefinidos para auto-seed. Cuando una municipalidad
 * estrena el sistema y aún no tiene ningún VehicleType creado, el primer
 * GET dispara la creación silenciosa de estos dos para evitar la pantalla
 * "No hay tipos de vehículo activos" en el resto del flujo (crear empresa,
 * asignar vehículo, etc.). Los datos son los mismos que muestra
 * `/tipos-vehiculo/page.tsx` en sus cards predefinidas.
 */
const PREDEFINED_TYPES_SEED = [
  {
    key: "transporte_urbano",
    name: "Transporte urbano",
    description:
      "Combis y colectivos que operan dentro de los 6 distritos de Cotabambas. Rutas con paraderos definidos.",
  },
  {
    key: "transporte_interprovincial",
    name: "Transporte interprovincial",
    description:
      "Buses que salen de Cotabambas hacia Cusco, Abancay o Arequipa. Rutas origen-destino sin paraderos intermedios.",
  },
] as const;

async function ensurePredefinedTypes(municipalityId: string): Promise<void> {
  // Antes verificábamos `countDocuments({ municipalityId }) > 0` — eso fallaba
  // cuando la muni tenía tipos legacy/personalizados pero NO los predefinidos:
  // el seed nunca corría y la página mostraba "Inicializando tipo…" para
  // siempre. Ahora chequeamos los keys uno por uno e insertamos los faltantes.
  const predefKeys = PREDEFINED_TYPES_SEED.map((t) => t.key);
  const existingDocs = await VehicleType.find(
    { municipalityId, key: { $in: predefKeys } },
    { key: 1 },
  ).lean<{ key: string }[]>();
  const existingSet = new Set(existingDocs.map((d) => d.key));
  const missing = PREDEFINED_TYPES_SEED.filter((t) => !existingSet.has(t.key));
  if (missing.length === 0) return;

  await VehicleType.insertMany(
    missing.map((t) => ({
      municipalityId,
      key: t.key,
      name: t.name,
      description: t.description,
      checklistItems: [],
      inspectionFields: [],
      reportCategories: [],
      isCustom: false,
      active: true,
    })),
    // ordered:false → si una colisiona por la unique {municipalityId, key} las
    // demás se siguen insertando. Esto evita un race cuando dos requests
    // disparan el seed casi simultáneamente.
    { ordered: false },
  ).catch((err: unknown) => {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return; // duplicate key — otro request ya sembró, OK.
    }
    throw err;
  });
}

const InspectionFieldSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(160),
  type: z.enum(["boolean", "scale", "text"]),
});

const CreateVehicleTypeSchema = z.object({
  municipalityId: z
    .string()
    .refine(isValidObjectId, "municipalityId inválido")
    .optional(),
  key: z.string().min(2).max(80),
  name: z.string().min(2).max(160),
  description: z.string().max(500).optional(),
  icon: z.string().max(200).optional(),
  checklistItems: z.array(z.string().min(1).max(200)).optional(),
  inspectionFields: z.array(InspectionFieldSchema).optional(),
  reportCategories: z.array(z.string().min(1).max(160)).optional(),
  isCustom: z.boolean().optional(),
  active: z.boolean().optional(),
});

/**
 * RF-03.
 * GET — scoped por municipalidad del JWT. Super Admin puede pasar `?municipalityId=`.
 * POST — Admin Municipal crea un tipo (predefinido activado o personalizado).
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    
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
    const municipalityIdParam = url.searchParams.get("municipalityId");
    const scopeParam = url.searchParams.get("scope");

    const filter: Record<string, unknown> = {};
    const isAdminMuni = auth.session.role === ROLES.ADMIN_MUNICIPAL;

    if (auth.session.role === ROLES.SUPER_ADMIN) {
      if (municipalityIdParam) {
        if (!isValidObjectId(municipalityIdParam)) {
          return apiError("municipalityId inválido", 400);
        }
        filter.municipalityId = municipalityIdParam;
      }
    } else if (isAdminMuni) {
      // Modelo mono-muni administrativo: Cotabambas Provincial administra
      // los 6 distritos como un solo tenant. El admin ve los tipos
      // sembrados en CUALQUIER UBIGEO del sistema; al devolver hacemos
      // dedupe por `key` para que el catálogo muestre 1 entrada por tipo
      // predefinido (no 6, una por distrito). Sin esto, en una muni
      // sembrada sin sus tipos propios el admin veía "0/2 tipos activos"
      // aunque otras munis sí tenían los predefinidos sembrados.
      // No fijamos `filter.municipalityId`.
    } else {
      // Roles operativos (fiscal/operador): scope clásico al tenant.
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

    // Scope filter: "urbano" excluye los de key interprovincial, "interprovincial"
    // deja solo los que contienen "interprov" en el key (convención existente).
    if (scopeParam === "urbano") {
      filter.key = { $not: /interprov/ };
    } else if (scopeParam === "interprovincial") {
      filter.key = /interprov/;
    }

    // Auto-seed: garantizar que existan los predefinidos.
    //  - admin_municipal: sembramos en SU muni (la del JWT) si la tiene.
    //    Aunque al listar mostremos también los de otras munis, el admin
    //    "es dueño" de su muni y debe poder configurar checklists ahí.
    //  - otros roles con filtro de muni: seed en la muni filtrada.
    if (isAdminMuni && auth.session.municipalityId) {
      await ensurePredefinedTypes(auth.session.municipalityId);
    } else if (filter.municipalityId && typeof filter.municipalityId === "string") {
      await ensurePredefinedTypes(filter.municipalityId);
    }

    const [rawItems, rawTotal] = await Promise.all([
      VehicleType.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      VehicleType.countDocuments(filter),
    ]);

    // Dedupe por `key` para admin_municipal. Priorizamos la instancia
    // sembrada en la muni del JWT (la "propia" del admin) cuando existe,
    // para que el botón "Configurar" del card lo lleve a configurar SU
    // muni. Si no hay match en su muni, cae a la primera encontrada.
    let items = rawItems;
    let total = rawTotal;
    if (isAdminMuni) {
      const ownMuniId = auth.session.municipalityId
        ? String(auth.session.municipalityId)
        : null;
      const byKey = new Map<string, (typeof rawItems)[number]>();
      for (const t of rawItems) {
        const prev = byKey.get(t.key);
        if (!prev) {
          byKey.set(t.key, t);
          continue;
        }
        // Si la previa NO es de la muni del admin y la nueva SÍ, reemplazar.
        if (
          ownMuniId &&
          String(prev.municipalityId) !== ownMuniId &&
          String(t.municipalityId) === ownMuniId
        ) {
          byKey.set(t.key, t);
        }
      }
      items = Array.from(byKey.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      total = items.length;
    }

    return apiResponse({
      items: items.map((t) => ({
        id: String(t._id),
        municipalityId: String(t.municipalityId),
        key: t.key,
        name: t.name,
        description: t.description,
        icon: t.icon,
        checklistItems: t.checklistItems,
        inspectionFields: t.inspectionFields,
        reportCategories: t.reportCategories,
        isCustom: t.isCustom,
        active: t.active,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[tipos-vehiculo GET]", error);
    return apiError("Error al listar tipos de vehículo", 500);
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
    const parsed = CreateVehicleTypeSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    // Admin Municipal no puede salirse de su municipalidad
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

    // Si NO es custom, la key debe coincidir con uno de los predefinidos
    // declarados en VEHICLE_TYPES. Sin esta verificación un cliente podría
    // crear `limpieza_residuos` (key obsoleta) como si fuera predefinido.
    const isCustom = parsed.data.isCustom ?? true;
    if (!isCustom && !PREDEFINED_KEYS.includes(parsed.data.key)) {
      return apiError(
        `Key inválida para tipo predefinido. Permitidos: ${PREDEFINED_KEYS.join(", ")}`,
        422,
      );
    }

    const duplicate = await VehicleType.findOne({
      municipalityId,
      key: parsed.data.key,
    });
    if (duplicate) {
      return apiError(
        "Ya existe un tipo de vehículo con esa key en la municipalidad",
        409,
      );
    }

    const created = await VehicleType.create({
      municipalityId,
      key: parsed.data.key,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      icon: parsed.data.icon,
      checklistItems: parsed.data.checklistItems ?? [],
      inspectionFields: parsed.data.inspectionFields ?? [],
      reportCategories: parsed.data.reportCategories ?? [],
      isCustom: parsed.data.isCustom ?? true,
      active: parsed.data.active ?? true,
    });

    return apiResponse(
      {
        id: String(created._id),
        municipalityId: String(created.municipalityId),
        key: created.key,
        name: created.name,
        description: created.description,
        icon: created.icon,
        checklistItems: created.checklistItems,
        inspectionFields: created.inspectionFields,
        reportCategories: created.reportCategories,
        isCustom: created.isCustom,
        active: created.active,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
      201,
    );
  } catch (error) {
    console.error("[tipos-vehiculo POST]", error);
    return apiError("Error al crear tipo de vehículo", 500);
  }
}
