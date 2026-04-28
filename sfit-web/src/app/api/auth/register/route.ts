import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import {
  apiResponse,
  apiError,
  apiValidationError,
} from "@/lib/api/response";
import { ROLES, USER_STATUS } from "@/lib/constants";
import type { Role } from "@/lib/constants";
import { createNotificationForRole } from "@/lib/notifications/create";
import { logAuditRaw } from "@/lib/audit/log";

const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  municipalityId: z.string().optional(),
  requestedRole: z.enum([
    ROLES.FISCAL,
    ROLES.OPERADOR,
    ROLES.CONDUCTOR,
    ROLES.CIUDADANO,
  ] as [Role, ...Role[]]),
});

/**
 * RF-01-02: Registro con correo y contraseña.
 * RF-01-03: Ciudadano → activo inmediatamente (igual que Google).
 *           Roles operativos → pendiente hasta aprobación del admin municipal.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    const { name, email, password, municipalityId, requestedRole } =
      parsed.data;

    await connectDB();

    const existing = await User.findOne({ email });
    if (existing) {
      return apiError("El correo ya está registrado", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Bootstrap: email en INITIAL_ADMIN_EMAIL → super_admin activo
    const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
    const isInitialAdmin =
      !!initialAdminEmail && email.toLowerCase() === initialAdminEmail;

    // Ciudadano no requiere aprobación (consistente con flujo Google)
    const isCiudadano = requestedRole === ROLES.CIUDADANO;
    const status = isInitialAdmin || isCiudadano
      ? USER_STATUS.ACTIVO
      : USER_STATUS.PENDIENTE;

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      provider: "credentials",
      municipalityId: municipalityId ?? undefined,
      role: isInitialAdmin ? ROLES.SUPER_ADMIN : ROLES.CIUDADANO,
      requestedRole: isInitialAdmin ? undefined : requestedRole,
      status,
    });

    // Notificar al admin municipal solo si es rol operativo con municipalidad
    if (!isInitialAdmin && !isCiudadano && municipalityId) {
      await createNotificationForRole(ROLES.ADMIN_MUNICIPAL, {
        municipalityId,
        title: "Nueva solicitud de registro",
        body: `${name} solicita acceso como ${requestedRole}. Revisa y aprueba o rechaza.`,
        type: "action_required",
        category: "aprobacion",
        link: "/dashboard/municipalidad/solicitudes",
        metadata: { userId: user._id.toString(), requestedRole },
      });
    }

    await logAuditRaw(
      request,
      {
        actorId: user._id.toString(),
        actorRole: user.role,
        municipalityId: municipalityId,
      },
      {
        action: "user.registered",
        resourceType: "user",
        resourceId: user._id.toString(),
        metadata: {
          email,
          requestedRole: isInitialAdmin ? null : requestedRole,
          isInitialAdmin,
          autoApproved: isInitialAdmin || isCiudadano,
        },
      },
    );

    // Generar tokens para auto-login inmediato (el cliente enruta según status)
    const tokenPayload = {
      userId: user._id.toString(),
      role: user.role,
      municipalityId: user.municipalityId?.toString(),
      provinceId: user.provinceId?.toString(),
    };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      refreshToken,
      refreshTokenExpiry: refreshExpiry,
      lastLoginAt: new Date(),
    });

    return apiResponse(
      {
        accessToken,
        refreshToken,
        expiresIn: 2 * 60 * 60,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          status: user.status,
          municipalityId: user.municipalityId?.toString(),
          provinceId: user.provinceId?.toString(),
          phone: user.phone ?? null,
          dni:   user.dni   ?? null,
        },
      },
      201,
    );
  } catch (error) {
    console.error("[register]", error);
    return apiError("Error interno del servidor", 500);
  }
}
