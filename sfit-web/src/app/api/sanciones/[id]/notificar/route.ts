import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Sanction } from "@/models/Sanction";
import { Driver } from "@/models/Driver";
import { Company } from "@/models/Company";
import { User } from "@/models/User";
import {
  apiResponse,
  apiError,
  apiForbidden,
  apiNotFound,
  apiUnauthorized,
  apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/email_service";
import { createNotification } from "@/lib/notifications/create";

const NotifySchema = z.object({
  channel: z.enum(["email", "whatsapp", "push"]).default("email"),
  /** Override del destino (email/teléfono). Si no se envía, se resuelve desde
   *  el conductor o el operador asociado a la empresa. */
  target: z.string().max(160).optional(),
});

/**
 * POST /api/sanciones/[id]/notificar
 *
 * Reenvía la notificación de una sanción al sujeto sancionado:
 *   - Email al operador de la empresa (canal por defecto).
 *   - Push al conductor si tiene cuenta vinculada.
 *
 * Agrega una entrada al array `notifications[]` con el resultado y
 * actualiza `status` a "notificada" si la sanción aún estaba "emitida".
 *
 * Idempotente desde el lado del modelo: cada intento queda registrado en
 * `notifications[]`, así que el admin puede ver el historial completo.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  const body = await request.json().catch(() => ({}));
  const parsed = NotifySchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "general";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  await connectDB();

  const sanction = await Sanction.findById(id);
  if (!sanction) return apiNotFound("Sanción no encontrada");
  if (!(await canAccessMunicipality(auth.session, String(sanction.municipalityId)))) {
    return apiForbidden();
  }

  // Resolver destino: el override del body manda; si no, intentamos conductor
  // (User vinculado por DNI) o el operador de la empresa.
  let target = parsed.data.target?.trim();
  if (!target) {
    if (sanction.driverId) {
      const driver = await Driver.findById(sanction.driverId)
        .select("dni name phone")
        .lean<{ dni?: string; name?: string; phone?: string } | null>();
      if (driver?.dni) {
        const driverUser = await User.findOne({ dni: driver.dni })
          .select("email")
          .lean<{ email?: string } | null>();
        target = driverUser?.email ?? driver.phone;
      }
    }
    if (!target && sanction.companyId) {
      // Fallback: operador de la empresa.
      const operadorUser = await User.findOne({
        role: ROLES.OPERADOR,
        companyId: sanction.companyId,
      })
        .select("email")
        .lean<{ email?: string } | null>();
      target = operadorUser?.email;
    }
    if (!target && sanction.companyId) {
      // Último recurso: razón social como identificador.
      const company = await Company.findById(sanction.companyId)
        .select("razonSocial")
        .lean<{ razonSocial?: string } | null>();
      target = company?.razonSocial;
    }
  }

  if (!target) {
    return apiError(
      "No se pudo resolver un destinatario. Especifica `target` en el body.",
      422,
    );
  }

  // Intento real: email si canal=email y target contiene '@'.
  let deliveryStatus: "enviado" | "pendiente" = "pendiente";
  if (parsed.data.channel === "email" && /@/.test(target)) {
    const html = `
      <p>Le notificamos la sanción <strong>${sanction.faultType}</strong> por un monto de
      <strong>S/ ${sanction.amountSoles.toLocaleString("es-PE")}</strong> (${sanction.amountUIT}).</p>
      <p>Estado actual: <strong>${sanction.status}</strong>.</p>
      <p>Sistema SFIT — Municipalidad Provincial de Cotabambas.</p>
    `;
    const ok = await sendEmail(target, `[SFIT] Sanción ${sanction.faultType}`, html).catch(() => false);
    deliveryStatus = ok ? "enviado" : "pendiente";
  } else if (parsed.data.channel === "push" && sanction.driverId) {
    // Push interno: notificación al conductor si tiene User vinculado.
    const driver = await Driver.findById(sanction.driverId)
      .select("dni")
      .lean<{ dni?: string } | null>();
    if (driver?.dni) {
      const driverUser = await User.findOne({ dni: driver.dni })
        .select("_id")
        .lean<{ _id: unknown } | null>();
      if (driverUser) {
        await createNotification({
          userId: String(driverUser._id),
          title: "Nueva sanción registrada",
          body: `${sanction.faultType} · S/ ${sanction.amountSoles}`,
          type: "warning",
          category: "sancion",
          link: `/sanciones/${String(sanction._id)}`,
        }).catch(() => null);
        deliveryStatus = "enviado";
      }
    }
  }

  sanction.notifications.push({
    channel: parsed.data.channel,
    target,
    status: deliveryStatus,
    sentAt: new Date(),
  });
  if (sanction.status === "emitida" && deliveryStatus === "enviado") {
    sanction.status = "notificada";
  }
  await sanction.save();

  await logAudit(request, auth.session, {
    action: "sanction.notified",
    resourceType: "sanction",
    resourceId: String(sanction._id),
    metadata: {
      channel: parsed.data.channel,
      target,
      status: deliveryStatus,
    },
  });

  return apiResponse({
    id: String(sanction._id),
    status: sanction.status,
    notifications: sanction.notifications,
    lastDelivery: deliveryStatus,
  });
}
