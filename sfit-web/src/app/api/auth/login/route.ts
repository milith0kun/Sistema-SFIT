import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { apiResponse, apiError, apiValidationError } from "@/lib/api/response";
import { USER_STATUS } from "@/lib/constants";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const STATUS_MESSAGES: Record<string, string> = {
  pendiente: "Tu cuenta está pendiente de aprobación por el administrador.",
  rechazado: "Tu solicitud fue rechazada.",
  suspendido: "Tu cuenta está suspendida.",
};

/**
 * RF-01-06: Inicio de sesión web con correo y contraseña.
 * RF-01-08: Access 15 min / Refresh 7 días.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    const { email, password } = parsed.data;

    await connectDB();

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return apiError("Credenciales incorrectas", 401);
    }

    if (user.provider === "google") {
      return apiError(
        "Esta cuenta usa Google. Ingresa con Google.",
        400
      );
    }

    const validPassword = await bcrypt.compare(password, user.password ?? "");
    if (!validPassword) {
      return apiError("Credenciales incorrectas", 401);
    }

    // Suspendido: bloquear totalmente (no tokens)
    if (user.status === USER_STATUS.SUSPENDIDO) {
      return apiError(
        STATUS_MESSAGES[user.status] ?? "Acceso denegado",
        403
      );
    }

    const payload = {
      userId: user._id.toString(),
      role: user.role,
      municipalityId: user.municipalityId?.toString(),
      provinceId: user.provinceId?.toString(),
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      refreshToken,
      refreshTokenExpiry: refreshExpiry,
      lastLoginAt: new Date(),
    });

    // RF-01-03/04: pendiente/rechazado → devolver tokens pero el cliente
    // enrutará a la pantalla correspondiente según user.status
    return apiResponse({
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        status: user.status,
        municipalityId: user.municipalityId?.toString(),
        provinceId: user.provinceId?.toString(),
      },
    });
  } catch (error) {
    console.error("[login]", error);
    return apiError("Error interno del servidor", 500);
  }
}
