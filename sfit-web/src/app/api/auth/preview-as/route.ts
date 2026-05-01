import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import {
  apiResponse,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiValidationError,
} from "@/lib/api/response";
import { requireRole } from "@/lib/auth/guard";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { logAuditRaw } from "@/lib/audit/log";

const PreviewAsSchema = z.object({
  role: z.enum([
    ROLES.CIUDADANO,
    ROLES.CONDUCTOR,
    ROLES.FISCAL,
    ROLES.OPERADOR,
  ]),
});

/**
 * POST /api/auth/preview-as
 *
 * Permite a un super_admin "entrar como" un usuario activo de uno de los
 * 4 roles operativos del app móvil (ciudadano/conductor/fiscal/operador).
 * Útil para QA y demos: el super_admin selecciona un rol al hacer login
 * en el app móvil y se le devuelven los tokens del primer usuario activo
 * de ese rol.
 *
 * Seguridad:
 *  - Solo super_admin (validado por JWT del caller).
 *  - Auditado en el log con `action: 'auth.preview_as'` para trazabilidad.
 *  - El cliente debe persistir el accessToken+refreshToken originales
 *    si quiere ofrecer un botón "volver a super admin".
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, [ROLES.SUPER_ADMIN]);
  if ("error" in auth) {
    return auth.error === "unauthorized" ? apiUnauthorized() : apiForbidden();
  }

  try {
    const body = await request.json();
    const parsed = PreviewAsSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    const { role } = parsed.data;

    await connectDB();

    // Tomamos el usuario activo más reciente del rol — los seeds suelen
    // estar arriba; si no hay sembrados, cualquier real activo sirve.
    const target = await User.findOne({
      role,
      status: USER_STATUS.ACTIVO,
    })
      .sort({ createdAt: 1 })
      .lean();

    if (!target) {
      return apiError(
        `No hay usuarios activos con el rol '${role}' para previsualizar`,
        404,
      );
    }

    const payload = {
      userId: target._id.toString(),
      role: target.role,
      municipalityId: target.municipalityId?.toString(),
      provinceId: target.provinceId?.toString(),
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await User.findByIdAndUpdate(target._id, {
      refreshToken,
      refreshTokenExpiry: refreshExpiry,
      lastLoginAt: new Date(),
    });

    // RNF-16: auditoría de impersonación.
    await logAuditRaw(
      request,
      {
        actorId: auth.session.userId,
        actorRole: auth.session.role,
      },
      {
        action: "auth.preview_as",
        resourceType: "user",
        resourceId: target._id.toString(),
        metadata: { previewRole: role, targetUserId: target._id.toString() },
      },
    );

    // Poblar nombres territoriales para que el cliente los muestre.
    let municipalityName: string | null = null;
    let provinceName: string | null = null;
    if (target.municipalityId) {
      try {
        const { Municipality } = await import("@/models/Municipality");
        const muni = await Municipality.findById(target.municipalityId)
          .select("name")
          .lean();
        if (muni && typeof muni === "object" && "name" in muni) {
          municipalityName = muni.name as string;
        }
      } catch {
        /* silent */
      }
    }
    if (target.provinceId) {
      try {
        const { Province } = await import("@/models/Province");
        const prov = await Province.findById(target.provinceId)
          .select("name")
          .lean();
        if (prov && typeof prov === "object" && "name" in prov) {
          provinceName = prov.name as string;
        }
      } catch {
        /* silent */
      }
    }

    return apiResponse({
      accessToken,
      refreshToken,
      expiresIn: 2 * 60 * 60,
      user: {
        id: target._id.toString(),
        name: target.name,
        email: target.email,
        image: target.image,
        role: target.role,
        status: target.status,
        municipalityId: target.municipalityId?.toString(),
        provinceId: target.provinceId?.toString(),
        municipalityName,
        provinceName,
        phone: target.phone ?? null,
        dni: target.dni ?? null,
        profileCompleted: target.profileCompleted ?? true,
        mustChangePassword: false,
      },
    });
  } catch (error) {
    console.error("[preview-as]", error);
    return apiError("Error interno al cambiar de rol", 500);
  }
}
