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
      parsed.error.errors.forEach((e) => {
        const key = e.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), e.message];
      });
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

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      provider: "credentials",
      municipalityId: municipalityId ?? undefined,
      role: ROLES.CIUDADANO, // rol por defecto hasta aprobación
      requestedRole,
      status: USER_STATUS.PENDIENTE,
    });

    return apiResponse(
      {
        message:
          "Registro exitoso. Tu solicitud está pendiente de aprobación por el administrador.",
        userId: user._id.toString(),
      },
      201
    );
  } catch (error) {
    console.error("[register]", error);
    return apiError("Error interno del servidor", 500);
  }
}
