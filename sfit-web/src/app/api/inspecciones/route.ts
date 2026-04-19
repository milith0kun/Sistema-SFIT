import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Inspection } from "@/models/Inspection";
import { apiResponse, apiError, apiForbidden, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { sendPushToTokens } from "@/lib/notifications/fcm";
import { User } from "@/models/User";

const ChecklistItemSchema = z.object({
  item: z.string().min(1).max(200),
  passed: z.boolean(),
  notes: z.string().max(500).optional(),
});

const CreateSchema = z.object({
  municipalityId: z.string().refine(isValidObjectId).optional(),
  vehicleId: z.string().refine(isValidObjectId),
  driverId: z.string().refine(isValidObjectId).optional(),
  vehicleTypeKey: z.string().min(1).max(80),
  checklistResults: z.array(ChecklistItemSchema).min(1),
  score: z.number().min(0).max(100),
  result: z.enum(["aprobada", "observada", "rechazada"]),
  observations: z.string().max(1000).optional(),
  evidenceUrls: z.array(z.string().url()).optional(),
});

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL, ROLES.OPERADOR,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const resultParam = url.searchParams.get("result");
    const vehicleIdParam = url.searchParams.get("vehicleId");
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

    if (resultParam) filter.result = resultParam;
    if (vehicleIdParam && isValidObjectId(vehicleIdParam)) filter.vehicleId = vehicleIdParam;

    const [items, total] = await Promise.all([
      Inspection.find(filter)
        .populate("vehicleId", "plate vehicleTypeKey brand model")
        .populate("fiscalId", "name")
        .populate("driverId", "name")
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Inspection.countDocuments(filter),
    ]);

    return apiResponse({
      items: items.map((i) => ({
        id: String(i._id),
        municipalityId: String(i.municipalityId),
        vehicle: i.vehicleId as unknown as Record<string, unknown>,
        fiscal: i.fiscalId as unknown as Record<string, unknown>,
        driver: i.driverId as unknown as Record<string, unknown> | null,
        vehicleTypeKey: i.vehicleTypeKey,
        date: i.date,
        score: i.score,
        result: i.result,
        observations: i.observations,
        evidenceUrls: i.evidenceUrls,
        qrCode: i.qrCode,
        createdAt: i.createdAt,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[inspecciones GET]", error);
    return apiError("Error al listar inspecciones", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL]);
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

    const created = await Inspection.create({
      municipalityId,
      vehicleId: parsed.data.vehicleId,
      driverId: parsed.data.driverId,
      fiscalId: auth.session.userId,
      vehicleTypeKey: parsed.data.vehicleTypeKey,
      checklistResults: parsed.data.checklistResults,
      score: parsed.data.score,
      result: parsed.data.result,
      observations: parsed.data.observations,
      evidenceUrls: parsed.data.evidenceUrls ?? [],
      date: new Date(),
    });

    // RF-18 — Notificar a operadores activos de la municipalidad (no-bloqueante).
    // Nota: cuando el esquema incluya User.companyId, filtrar también por companyId
    // para una notificación más precisa al operador del vehículo inspeccionado.
    try {
      const resultLabel =
        parsed.data.result === "aprobada"
          ? "Aprobada ✓"
          : parsed.data.result === "observada"
            ? "Con observaciones ⚠"
            : "Rechazada ✗";

      const operadores = await User.find({
        municipalityId,
        role: ROLES.OPERADOR,
        status: "activo",
        fcmTokens: { $exists: true, $not: { $size: 0 } },
      })
        .select("fcmTokens")
        .lean();

      const tokens = operadores.flatMap((u) => u.fcmTokens ?? []);

      if (tokens.length > 0) {
        await sendPushToTokens(
          tokens,
          "Nueva inspección registrada",
          `Inspección vehicular: ${resultLabel} — Score ${parsed.data.score}/100`,
          {
            type: "inspeccion_creada",
            inspeccionId: String(created._id),
            vehicleId: parsed.data.vehicleId,
            result: parsed.data.result,
          },
        );
      }
    } catch {
      // Silencioso — la notificación es best-effort
    }

    return apiResponse({ id: String(created._id), ...created.toObject() }, 201);
  } catch (error) {
    console.error("[inspecciones POST]", error);
    return apiError("Error al crear inspección", 500);
  }
}
