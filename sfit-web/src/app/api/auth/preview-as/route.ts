import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
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
 * Permite a un super_admin "entrar como" un rol operativo del app móvil
 * (ciudadano/conductor/fiscal/operador) usando SU MISMA cuenta. El JWT
 * resultante mantiene el `userId` del super_admin pero cambia el `role`,
 * para que las APIs sirvan datos del super_admin filtrados/protegidos
 * según el rol elegido.
 *
 * Importante:
 *  - NO se actualiza `User.refreshToken` en BD: el refresh original del
 *    super_admin sigue válido para que pueda revertir el preview con
 *    sus tokens guardados en el cliente.
 *  - El refresh del propio token preview NO funcionará en /api/auth/refresh
 *    (no está persistido). Consecuencia: la sesión preview vive ~2h, lo
 *    que basta para QA/demo.
 *
 * Seguridad:
 *  - Solo super_admin (validado por JWT del caller).
 *  - Auditado en el log con `action: 'auth.preview_as'`.
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

    const me = await User.findById(auth.session.userId).lean();
    if (!me) return apiError("Usuario no encontrado", 404);
    if (me.status !== USER_STATUS.ACTIVO) {
      return apiError("Tu cuenta no está activa", 403);
    }

    // JWT con MI userId + el rol elegido (no impersonamos a otro usuario,
    // solo cambiamos el rol del propio super_admin).
    //
    // El super_admin no tiene `municipalityId` propio (es global), pero los
    // endpoints operativos (rutas, flota, viajes, conductores, vehiculos)
    // requieren uno en sesión cuando el rol no es super_admin. Resolver el
    // muni desde el Driver record asociado al super_admin, así su preview-as
    // queda anclado a una jurisdicción concreta y los listados no rompen
    // con "Acceso denegado".
    let effectiveMunicipalityId = me.municipalityId?.toString();
    let effectiveProvinceId = me.provinceId?.toString();
    if (!effectiveMunicipalityId && role === ROLES.CONDUCTOR) {
      const driver = await Driver.findOne({ userId: me._id })
        .select("municipalityId")
        .lean<{ municipalityId?: { toString(): string } } | null>();
      if (driver?.municipalityId) {
        effectiveMunicipalityId = String(driver.municipalityId);
      }
    }

    const payload = {
      userId: me._id.toString(),
      role,
      municipalityId: effectiveMunicipalityId,
      provinceId: effectiveProvinceId,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // RNF-16: auditoría.
    await logAuditRaw(
      request,
      {
        actorId: auth.session.userId,
        actorRole: auth.session.role,
        municipalityId: auth.session.municipalityId,
        provinceId: auth.session.provinceId,
      },
      {
        action: "auth.preview_as",
        resourceType: "user",
        resourceId: me._id.toString(),
        metadata: { previewRole: role },
      },
    );

    // Poblar nombres territoriales (si los tiene el super_admin).
    let municipalityName: string | null = null;
    let provinceName: string | null = null;
    if (me.municipalityId) {
      try {
        const { Municipality } = await import("@/models/Municipality");
        const muni = await Municipality.findById(me.municipalityId)
          .select("name")
          .lean();
        if (muni && typeof muni === "object" && "name" in muni) {
          municipalityName = muni.name as string;
        }
      } catch {
        /* silent */
      }
    }
    if (me.provinceId) {
      try {
        const { Province } = await import("@/models/Province");
        const prov = await Province.findById(me.provinceId)
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
        id: me._id.toString(),
        name: me.name,
        email: me.email,
        image: me.image,
        role, // ← rol previsualizado (no super_admin)
        status: me.status,
        municipalityId: me.municipalityId?.toString(),
        provinceId: me.provinceId?.toString(),
        municipalityName,
        provinceName,
        phone: me.phone ?? null,
        dni: me.dni ?? null,
        profileCompleted: me.profileCompleted ?? true,
        mustChangePassword: false,
      },
    });
  } catch (error) {
    console.error("[preview-as]", error);
    return apiError("Error interno al cambiar de rol", 500);
  }
}
