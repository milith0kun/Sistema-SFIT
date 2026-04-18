import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { FleetEntry } from "@/models/FleetEntry";
import { apiResponse, apiError, apiForbidden, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

const CreateSchema = z.object({
  municipalityId: z.string().refine(isValidObjectId).optional(),
  vehicleId: z.string().refine(isValidObjectId),
  routeId: z.string().refine(isValidObjectId).optional(),
  driverId: z.string().refine(isValidObjectId),
  date: z.string().optional(),
  departureTime: z.string().optional(),
  returnTime: z.string().optional(),
  km: z.number().min(0).optional(),
  status: z.enum(["disponible", "en_ruta", "cerrado", "auto_cierre", "mantenimiento", "fuera_de_servicio"]).optional(),
  observations: z.string().max(500).optional(),
  checklistComplete: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");
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

    if (dateParam) {
      const d = new Date(dateParam);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      filter.date = { $gte: d, $lt: next };
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      filter.date = { $gte: today, $lt: tomorrow };
    }

    const items = await FleetEntry.find(filter)
      .populate("vehicleId", "plate brand model vehicleTypeKey")
      .populate("routeId", "code name")
      .populate("driverId", "name status continuousHours restHours")
      .sort({ departureTime: 1 })
      .lean();

    return apiResponse({
      items: items.map((e) => ({
        id: String(e._id),
        municipalityId: String(e.municipalityId),
        date: e.date,
        vehicle: e.vehicleId as unknown as Record<string, unknown>,
        route: e.routeId as unknown as Record<string, unknown> | null,
        driver: e.driverId as unknown as Record<string, unknown>,
        departureTime: e.departureTime,
        returnTime: e.returnTime,
        km: e.km,
        status: e.status,
        observations: e.observations,
        checklistComplete: e.checklistComplete,
        createdAt: e.createdAt,
      })),
      total: items.length,
    });
  } catch (error) {
    console.error("[flota GET]", error);
    return apiError("Error al obtener flota del día", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.OPERADOR]);
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

    let municipalityId = parsed.data.municipalityId;
    if (auth.session.role !== ROLES.SUPER_ADMIN) {
      if (!auth.session.municipalityId) return apiForbidden();
      municipalityId = auth.session.municipalityId;
    }
    if (!municipalityId) return apiError("municipalityId requerido", 400);

    await connectDB();

    const created = await FleetEntry.create({
      municipalityId,
      vehicleId: parsed.data.vehicleId,
      routeId: parsed.data.routeId,
      driverId: parsed.data.driverId,
      date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      departureTime: parsed.data.departureTime,
      returnTime: parsed.data.returnTime,
      km: parsed.data.km ?? 0,
      status: parsed.data.status ?? "disponible",
      observations: parsed.data.observations,
      checklistComplete: parsed.data.checklistComplete ?? false,
      registeredBy: auth.session.userId,
    });

    return apiResponse({ id: String(created._id), ...created.toObject() }, 201);
  } catch (error) {
    console.error("[flota POST]", error);
    return apiError("Error al registrar entrada de flota", 500);
  }
}
