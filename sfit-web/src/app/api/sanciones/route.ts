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

const SANCTION_STATUS_VALUES = ["emitida", "apelada", "resuelta", "anulada"] as const;

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

    const [items, total] = await Promise.all([
      Sanction.find(filter)
        .populate("vehicleId", "plate")
        .populate("driverId", "name")
        .populate("companyId", "razonSocial")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Sanction.countDocuments(filter),
    ]);

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

    const created = await Sanction.create({
      municipalityId,
      vehicleId: parsed.data.vehicleId,
      driverId: parsed.data.driverId,
      companyId: parsed.data.companyId,
      reportId: parsed.data.reportId,
      inspectionId: parsed.data.inspectionId,
      faultType: parsed.data.faultType,
      amountSoles: parsed.data.amountSoles,
      amountUIT: parsed.data.amountUIT,
      status: "emitida",
      issuedBy: auth.session.userId,
      notifications: [
        { channel: "email", target: "empresa@empresa.com", status: "pendiente" },
        { channel: "whatsapp", target: "+51 984 000 000", status: "pendiente" },
        { channel: "push", target: "conductor_id", status: "pendiente" },
      ],
    });

    // RF-15: Sanciones reducen reputación del vehículo y conductor
    if (created.vehicleId) void adjustVehicleReputation(created.vehicleId, -8);
    if (created.driverId) void adjustDriverReputation(created.driverId, -5);

    // RF-18: Email de notificación — void, no bloqueante
    void (async () => {
      try {
        const company = created.companyId
          ? await Company.findById(created.companyId).select('name email').lean()
          : null;
        if (!company) return;
        const companyDoc = company as { name?: string; email?: string };
        if (!companyDoc.email) return;
        const vehicle = created.vehicleId
          ? await Vehicle.findById(created.vehicleId).select('plate').lean()
          : null;
        const vehicleDoc = vehicle as { plate?: string } | null;
        const html = sanctionEmailHtml({
          companyName: companyDoc.name ?? 'Empresa',
          plate: vehicleDoc?.plate ?? '—',
          faultType: created.faultType,
          amountSoles: created.amountSoles,
        });
        await sendEmail(companyDoc.email, `[SFIT] Sanción emitida — ${vehicleDoc?.plate ?? 'Vehículo'}`, html);
      } catch (e) { console.error('[sanciones email]', e); }
    })();

    return apiResponse({ id: String(created._id), ...created.toObject() }, 201);
  } catch (error) {
    console.error("[sanciones POST]", error);
    return apiError("Error al crear sanción", 500);
  }
}
