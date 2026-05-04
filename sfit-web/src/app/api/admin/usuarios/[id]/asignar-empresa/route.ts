import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Company } from "@/models/Company";
import { Driver } from "@/models/Driver";
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
import { logAudit } from "@/lib/audit/log";

const AssignSchema = z.object({
  companyId: z.string().refine(isValidObjectId, "companyId inválido").nullable(),
  // Si true, además crea un Driver vinculado al user (para mantener flujos
  // antiguos que aún resuelven la empresa via Driver).
  createDriverLink: z.boolean().optional().default(false),
});

/**
 * PATCH /api/admin/usuarios/[id]/asignar-empresa
 *
 * Asigna (o desasigna pasando `companyId: null`) la empresa cuyo flota
 * gestiona el operador. Solo super_admin.
 *
 * - Setea `User.companyId`.
 * - Opcional `createDriverLink`: si el operador no tiene Driver propio,
 *   crea uno vinculado para no romper integraciones que aún consultan
 *   `Driver.findOne({ userId })` para resolver la empresa.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    const body = await request.json().catch(() => ({}));
    const parsed = AssignSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    await connectDB();

    const target = await User.findById(id);
    if (!target) return apiNotFound("Usuario no encontrado");

    if (target.role !== ROLES.OPERADOR) {
      return apiError(
        `Solo se puede asignar empresa a usuarios con rol 'operador' (rol actual: ${target.role})`,
        400,
      );
    }

    let companyDoc:
      | { _id: import("mongoose").Types.ObjectId; razonSocial?: string; municipalityId?: unknown }
      | null = null;
    if (parsed.data.companyId) {
      companyDoc = await Company.findById(parsed.data.companyId)
        .select("_id razonSocial municipalityId")
        .lean<{
          _id: import("mongoose").Types.ObjectId;
          razonSocial?: string;
          municipalityId?: unknown;
        } | null>();
      if (!companyDoc) return apiError("Empresa no existe", 400);
    }

    const prevCompanyId = target.companyId ? String(target.companyId) : null;

    target.set("companyId", parsed.data.companyId ?? undefined);
    await target.save();

    // Crear Driver vinculado opcionalmente, solo cuando se ASIGNA empresa
    // (no al desasignar) y el usuario no tiene ya un Driver registrado.
    let driverCreated = false;
    if (parsed.data.createDriverLink && parsed.data.companyId && companyDoc) {
      const existingDriver = await Driver.findOne({ userId: target._id })
        .select("_id")
        .lean();
      if (!existingDriver && target.municipalityId && target.dni) {
        try {
          await Driver.create({
            municipalityId: target.municipalityId,
            userId: target._id,
            companyId: companyDoc._id,
            name: target.name,
            dni: target.dni,
            licenseNumber: `OP-${target.dni}`, // placeholder — el operador no conduce
            licenseCategory: "A-IIB",
            phone: target.phone,
          });
          driverCreated = true;
        } catch (e) {
          // No bloquea la asignación principal — sólo registra la falla.
          console.warn("[asignar-empresa] no se pudo crear Driver linked", e);
        }
      }
    }

    await logAudit(request, auth.session, {
      action: "user.assigned_company",
      resourceType: "user",
      resourceId: target._id.toString(),
      metadata: {
        prevCompanyId,
        newCompanyId: parsed.data.companyId,
        companyName: companyDoc?.razonSocial,
        driverCreated,
      },
    });

    return apiResponse({
      id: target._id.toString(),
      name: target.name,
      email: target.email,
      role: target.role,
      companyId: target.companyId?.toString() ?? null,
      companyName: companyDoc?.razonSocial,
      driverCreated,
    });
  } catch (error) {
    console.error("[admin/usuarios/:id/asignar-empresa]", error);
    return apiError("Error al asignar empresa", 500);
  }
}
