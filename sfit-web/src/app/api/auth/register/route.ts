import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import {
  apiResponse,
  apiError,
  apiValidationError,
} from "@/lib/api/response";
import { ROLES, USER_STATUS } from "@/lib/constants";
import type { Role } from "@/lib/constants";

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
 * RF-01-03: Solicitud de rol al registrarse — queda en estado PENDIENTE.
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

    // bcrypt 12 rounds (RNF-04)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Bootstrap: primer usuario con email INITIAL_ADMIN_EMAIL → super_admin activo
    const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
    const isInitialAdmin =
      initialAdminEmail && email.toLowerCase() === initialAdminEmail;

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      provider: "credentials",
      municipalityId: municipalityId ?? undefined,
      role: isInitialAdmin ? ROLES.SUPER_ADMIN : ROLES.CIUDADANO,
      requestedRole: isInitialAdmin ? undefined : requestedRole,
      status: isInitialAdmin ? USER_STATUS.ACTIVO : USER_STATUS.PENDIENTE,
    });

    return apiResponse(
      {
        message: isInitialAdmin
          ? "Cuenta de administrador creada. Ya puedes iniciar sesión."
          : "Registro exitoso. Tu solicitud está pendiente de aprobación por el administrador.",
        userId: user._id.toString(),
      },
      201,
    );
  } catch (error) {
    console.error("[register]", error);
    return apiError("Error interno del servidor", 500);
  }
}
