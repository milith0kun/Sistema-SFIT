import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Sanction } from "@/models/Sanction";
import { apiResponse, apiError, apiForbidden, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { adjustVehicleReputation, adjustDriverReputation } from "@/lib/reputation/updateReputation";
import { sendEmail } from "@/lib/email/email_service";
import { sanctionEmailHtml } from "@/lib/email/templates";
import { Company } from "@/models/Company";
import { Vehicle } from "@/models/Vehicle";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";

const SANCTION_STATUS_VALUES = ["emitida", "notificada", "apelada", "confirmada", "anulada"] as const;

const CreateSchema = z.object({
  municipalityId: z.string().refine(isValidObjectId).optional(),
  vehicleId: z.string().refine(isValidObjectId),
  driverId: z.string().refine(isValidObjectId).optional(),
  companyId: z.string().refine(isValidObjectId).optional(),
  reportId: z.string().refine(isValidObjectId).optional(),
  inspectionId: z.string().refine(isValidObjectId).optional(),
  faultType: z.string().min(2).max(200),
  // amountSoles must be a positive value (> 0) when provided
  amountSoles: z.number().positive("El monto debe ser un valor positivo mayor a 0"),
  amountUIT: z.string().min(1).max(30),
  // Optional explicit status override — defaults to "emitida" in the handler
  status: z.enum(SANCTION_STATUS_VALUES).optional(),
});

export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN, ROLES.ADMIN_PROVINCIAL, ROLES.ADMIN_MUNICIPAL, ROLES.FISCAL,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const statusParam = url.searchParams.get("status");
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

    if (statusParam) filter.status = statusParam;

    // Filtro global (sin status) para los KPIs — se mantienen consistentes
    // aunque el usuario aplique un filtro de estado en la UI.
    const globalFilter: Record<string, unknown> = { ...filter };
    delete globalFilter.status;

    const [items, total, statsAgg] = await Promise.all([
      Sanction.find(filter)
        .populate("vehicleId", "plate")
        .populate("driverId", "name")
        .populate("companyId", "razonSocial")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Sanction.countDocuments(filter),
      Sanction.aggregate([
        { $match: globalFilter },
        { $group: { _id: "$status", count: { $sum: 1 }, montoTotal: { $sum: "$amountSoles" } } },
      ]),
    ]);

    const stats = {
      emitida: 0, notificada: 0, apelada: 0, confirmada: 0, anulada: 0,
      montoConfirmado: 0,
    };
    for (const row of statsAgg as { _id: string; count: number; montoTotal: number }[]) {
      if (row._id in stats) (stats as unknown as Record<string, number>)[row._id] = row.count;
      if (row._id === "confirmada") stats.montoConfirmado = row.montoTotal;
    }

    return apiResponse({
      items: items.map((s) => ({
        id: String(s._id),
        municipalityId: String(s.municipalityId),
        vehicle: s.vehicleId as unknown as Record<string, unknown>,
        driver: s.driverId as unknown as Record<string, unknown> | null,
        company: s.companyId as unknown as Record<string, unknown> | null,
        faultType: s.faultType,
        amountSoles: s.amountSoles,
        amountUIT: s.amountUIT,
        status: s.status,
        notifications: s.notifications,
        appealNotes: s.appealNotes,
        resolvedAt: s.resolvedAt,
        createdAt: s.createdAt,
      })),
      total,
      page,
      limit,
      stats,
    });
  } catch (error) {
    console.error("[sanciones GET]", error);
    return apiError("Error al listar sanciones", 500);
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

    // Derivar companyId, driverId y datos para notificaciones desde el vehículo
    const vehicle = await Vehicle.findById(parsed.data.vehicleId).select("plate companyId currentDriverId").lean() as { _id: unknown; plate?: string; companyId?: unknown; currentDriverId?: unknown } | null;
    if (!vehicle) return apiError("Vehículo no encontrado", 404);

    const companyId = parsed.data.companyId ?? (vehicle.companyId ? String(vehicle.companyId) : undefined);
    const driverId = parsed.data.driverId ?? (vehicle.currentDriverId ? String(vehicle.currentDriverId) : undefined);

    const [driver, company] = await Promise.all([
      driverId ? Driver.findById(driverId).select("name phone userId").lean() as Promise<{ name?: string; phone?: string; userId?: unknown } | null> : Promise.resolve(null),
      companyId ? Company.findById(companyId).select("razonSocial representanteLegal").lean() as Promise<{ razonSocial?: string; representanteLegal?: { phone?: string } } | null> : Promise.resolve(null),
    ]);

    // Buscar email del operador asociado a la empresa (si existe usuario operador en la municipalidad)
    const operadorUser = companyId
      ? await User.findOne({ municipalityId, role: "operador", status: "activo" }).select("email").lean() as { email?: string } | null
      : null;

    const notifications: { channel: "email" | "whatsapp" | "push"; target: string; status: "pendiente" }[] = [];
    if (operadorUser?.email) {
      notifications.push({ channel: "email", target: operadorUser.email, status: "pendiente" });
    }
    const whatsappTarget = driver?.phone ?? company?.representanteLegal?.phone;
    if (whatsappTarget) {
      notifications.push({ channel: "whatsapp", target: whatsappTarget, status: "pendiente" });
    }
    if (driver?.userId) {
      notifications.push({ channel: "push", target: String(driver.userId), status: "pendiente" });
    }

    const created = await Sanction.create({
      municipalityId,
      vehicleId: parsed.data.vehicleId,
      driverId,
      companyId,
      reportId: parsed.data.reportId,
      inspectionId: parsed.data.inspectionId,
      faultType: parsed.data.faultType,
      amountSoles: parsed.data.amountSoles,
      amountUIT: parsed.data.amountUIT,
      status: "emitida",
      issuedBy: auth.session.userId,
      notifications,
    });

    // RF-15: Sanciones reducen reputación del vehículo y conductor
    if (created.vehicleId) void adjustVehicleReputation(created.vehicleId, -8);
    if (created.driverId) void adjustDriverReputation(created.driverId, -5);

    // RF-18: Email de notificación al operador de la empresa — void, no bloqueante
    if (operadorUser?.email && company?.razonSocial) {
      const operadorEmail = operadorUser.email;
      const companyName = company.razonSocial;
      const plate = vehicle.plate ?? "—";
      void (async () => {
        try {
          const html = sanctionEmailHtml({
            companyName,
            plate,
            faultType: created.faultType,
            amountSoles: created.amountSoles,
          });
          await sendEmail(operadorEmail, `[SFIT] Sanción emitida — ${plate}`, html);
        } catch (e) { console.error('[sanciones email]', e); }
      })();
    }

    return apiResponse({ id: String(created._id), ...created.toObject() }, 201);
  } catch (error) {
    console.error("[sanciones POST]", error);
    return apiError("Error al crear sanción", 500);
  }
}
