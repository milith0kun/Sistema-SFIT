import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Webhook } from "@/models/Webhook";
import { apiResponse, apiError, apiForbidden, apiUnauthorized, apiValidationError } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES } from "@/lib/constants";
import { canAccessMunicipality } from "@/lib/auth/rbac";

const VALID_EVENTS = ["inspection.created", "report.validated", "sanction.issued"] as const;

const CreateSchema = z.object({
  url: z.string().url("URL de destino inválida"),
  events: z
    .array(z.enum(VALID_EVENTS))
    .min(1, "Debe suscribirse a al menos un evento"),
  municipalityId: z.string().refine(isValidObjectId).optional(),
});

/**
 * GET /api/admin/webhooks
 * Lista los webhooks activos de la municipalidad.
 * Requiere rol admin_municipal o superior.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_MUNICIPAL,
  ]);
  if ("error" in auth) return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();

  try {
    await connectDB();
    const url = new URL(request.url);
    const municipalityIdParam = url.searchParams.get("municipalityId");

    let municipalityId: string | undefined;

    if (auth.session.role === ROLES.SUPER_ADMIN) {
      municipalityId = municipalityIdParam ?? undefined;
    } else {
      const targetId = municipalityIdParam ?? auth.session.municipalityId;
      if (!targetId || !isValidObjectId(targetId)) return apiForbidden();
      if (!(await canAccessMunicipality(auth.session, targetId))) return apiForbidden();
      municipalityId = targetId;
    }

    const filter: Record<string, unknown> = {};
    if (municipalityId) filter.municipalityId = municipalityId;

    // El secret nunca se expone en el listado
    const webhooks = await Webhook.find(filter).lean();

    return apiResponse(
      webhooks.map((wh) => ({
        id: String(wh._id),
        municipalityId: String(wh.municipalityId),
        url: wh.url,
        events: wh.events,
        active: wh.active,
        createdAt: wh.createdAt,
      })),
    );
  } catch (error) {
    console.error("[webhooks GET]", error);
    return apiError("Error al listar webhooks", 500);
  }
}

/**
 * POST /api/admin/webhooks
 * Crea un nuevo webhook. Genera el secret automáticamente.
 * Devuelve el secret UNA SOLA VEZ — no vuelve a exponerse.
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN, ROLES.ADMIN_MUNICIPAL]);
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

    // Generar secret aleatorio de 32 bytes (64 hex chars)
    const secret = randomBytes(32).toString("hex");

    const created = await Webhook.create({
      municipalityId,
      url: parsed.data.url,
      events: parsed.data.events,
      secret,
      active: true,
    });

    // El secret se devuelve aquí por única vez
    return apiResponse(
      {
        id: String(created._id),
        municipalityId: String(created.municipalityId),
        url: created.url,
        events: created.events,
        active: created.active,
        secret, // ← única exposición del secret
        createdAt: created.createdAt,
        message: "Guarda este secret de forma segura. No volverá a mostrarse.",
      },
      201,
    );
  } catch (error) {
    console.error("[webhooks POST]", error);
    return apiError("Error al crear webhook", 500);
  }
}
