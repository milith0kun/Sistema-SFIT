import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Company } from "@/models/Company";
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
import { createNotificationForRoles } from "@/lib/notifications/create";

const RepresentanteLegalSchema = z.object({
  name: z.string().min(2).max(160),
  dni: z.string().min(6).max(20),
  phone: z.string().max(30).optional(),
});

const DocumentSchema = z.object({
  name: z.string().min(1).max(160),
  url: z.string().url(),
});

const UpdateCompanySchema = z.object({
  razonSocial: z.string().min(2).max(200).optional(),
  ruc: z.string().min(8).max(20).optional(),
  representanteLegal: RepresentanteLegalSchema.optional(),
  vehicleTypeKeys: z.array(z.string().min(1).max(80)).optional(),
  documents: z.array(DocumentSchema).optional(),
  active: z.boolean().optional(),
  reputationScore: z.number().min(0).max(100).optional(),
});

/**
 * RF-04-02 / RF-04-03 / RF-04-05.
 * DELETE = soft delete (active: false, suspendedAt: now) (RF-04-05).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_PROVINCIAL,
    ROLES.ADMIN_MUNICIPAL,
    ROLES.FISCAL,
    ROLES.OPERADOR,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    await connectDB();

    const company = await Company.findById(id).lean<{
      _id: unknown;
      municipalityId: unknown;
      razonSocial: string;
      ruc: string;
      representanteLegal: { name: string; dni: string; phone?: string };
      vehicleTypeKeys: string[];
      documents: { name: string; url: string }[];
      active: boolean;
      suspendedAt?: Date;
      reputationScore: number;
      createdAt: Date;
      updatedAt: Date;
    } | null>();
    if (!company) return apiNotFound("Empresa no encontrada");

    if (
      !(await canAccessMunicipality(
        auth.session,
        String(company.municipalityId),
      ))
    ) {
      return apiForbidden();
    }

    return apiResponse({
      id: String(company._id),
      municipalityId: String(company.municipalityId),
      razonSocial: company.razonSocial,
      ruc: company.ruc,
      representanteLegal: company.representanteLegal,
      vehicleTypeKeys: company.vehicleTypeKeys,
      documents: company.documents,
      active: company.active,
      suspendedAt: company.suspendedAt,
      reputationScore: company.reputationScore,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    });
  } catch (error) {
    console.error("[empresas/:id GET]", error);
    return apiError("Error al obtener empresa", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    const body = await request.json().catch(() => ({}));
    const parsed = UpdateCompanySchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();

    const existing = await Company.findById(id);
    if (!existing) return apiNotFound("Empresa no encontrada");

    if (
      !(await canAccessMunicipality(
        auth.session,
        String(existing.municipalityId),
      ))
    ) {
      return apiForbidden();
    }

    const wasActive = existing.active;
    Object.assign(existing, parsed.data);
    // Si se reactiva, limpiar `suspendedAt`
    if (parsed.data.active === true) {
      existing.suspendedAt = undefined;
    }
    // Si pasa a suspendida vía PATCH active: false, sellar suspendedAt.
    const becameSuspended =
      wasActive && parsed.data.active === false && !existing.suspendedAt;
    if (becameSuspended) {
      existing.suspendedAt = new Date();
    }
    await existing.save();

    if (becameSuspended) {
      await logAudit(request, auth.session, {
        action: "company.suspended",
        resourceType: "company",
        resourceId: String(existing._id),
        metadata: {
          razonSocial: existing.razonSocial,
          municipalityId: String(existing.municipalityId),
        },
      });

      await createNotificationForRoles(
        [ROLES.OPERADOR, ROLES.ADMIN_MUNICIPAL],
        {
          municipalityId: String(existing.municipalityId),
          title: "Empresa suspendida",
          body: `La empresa ${existing.razonSocial} fue suspendida por el administrador.`,
          type: "warning",
          category: "sancion",
          metadata: { companyId: String(existing._id) },
        },
      );
    } else {
      await logAudit(request, auth.session, {
        action: "company.updated",
        resourceType: "company",
        resourceId: String(existing._id),
      });
    }

    return apiResponse({
      id: String(existing._id),
      municipalityId: String(existing.municipalityId),
      razonSocial: existing.razonSocial,
      ruc: existing.ruc,
      representanteLegal: existing.representanteLegal,
      vehicleTypeKeys: existing.vehicleTypeKeys,
      documents: existing.documents,
      active: existing.active,
      suspendedAt: existing.suspendedAt,
      reputationScore: existing.reputationScore,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    });
  } catch (error) {
    console.error("[empresas/:id PATCH]", error);
    return apiError("Error al actualizar empresa", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN_MUNICIPAL,
  ]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    await connectDB();

    const existing = await Company.findById(id);
    if (!existing) return apiNotFound("Empresa no encontrada");

    if (
      !(await canAccessMunicipality(
        auth.session,
        String(existing.municipalityId),
      ))
    ) {
      return apiForbidden();
    }

    // RF-04-05: soft delete
    existing.active = false;
    existing.suspendedAt = new Date();
    await existing.save();

    await logAudit(request, auth.session, {
      action: "company.suspended",
      resourceType: "company",
      resourceId: String(existing._id),
      metadata: {
        razonSocial: existing.razonSocial,
        municipalityId: String(existing.municipalityId),
      },
    });

    await createNotificationForRoles(
      [ROLES.OPERADOR, ROLES.ADMIN_MUNICIPAL],
      {
        municipalityId: String(existing.municipalityId),
        title: "Empresa suspendida",
        body: `La empresa ${existing.razonSocial} fue suspendida por el administrador.`,
        type: "warning",
        category: "sancion",
        metadata: { companyId: String(existing._id) },
      },
    );

    return apiResponse({
      id: String(existing._id),
      active: existing.active,
      suspendedAt: existing.suspendedAt,
    });
  } catch (error) {
    console.error("[empresas/:id DELETE]", error);
    return apiError("Error al suspender empresa", 500);
  }
}
