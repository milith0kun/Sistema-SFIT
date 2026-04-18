import { NextRequest } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { apiResponse, apiError } from "@/lib/api/response";
import { USER_STATUS, ROLES } from "@/lib/constants";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const STATUS_MESSAGES: Record<string, string> = {
  pendiente: "Tu cuenta está pendiente de aprobación por el administrador.",
  rechazado: "Tu solicitud fue rechazada.",
  suspendido: "Tu cuenta está suspendida.",
};

/**
 * RF-01-01: Login / Registro con Google.
 * Recibe `idToken` del cliente (web GIS o Flutter google_sign_in).
 * Si el email no existe, crea una cuenta con rol `ciudadano` y status `activo`.
 * Si existe, valida estado y devuelve tokens JWT de SFIT.
 */
export async function POST(request: NextRequest) {
  try {
    if (!GOOGLE_CLIENT_ID) {
      return apiError("Google OAuth no configurado en el servidor", 500);
    }

    const { idToken } = await request.json();
    if (!idToken || typeof idToken !== "string") {
      return apiError("idToken requerido", 400);
    }

    // Verificar token con Google
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyError) {
      console.error("[auth/google] verifyIdToken failed:", verifyError);
      return apiError(
        `Token inválido: ${verifyError instanceof Error ? verifyError.message : "desconocido"}`,
        401,
      );
    }

    if (!payload?.email || !payload.email_verified) {
      return apiError("Correo de Google no verificado", 401);
    }

    await connectDB();

    let user = await User.findOne({ email: payload.email });

    // Registro automático si no existe (RF-01-01)
    if (!user) {
      user = await User.create({
        name: payload.name ?? payload.email.split("@")[0],
        email: payload.email,
        image: payload.picture,
        provider: "google",
        providerId: payload.sub,
        role: ROLES.CIUDADANO,
        status: USER_STATUS.ACTIVO,
      });
    } else if (user.provider !== "google") {
      return apiError(
        "Esta cuenta ya existe con correo/contraseña. Usa ese método.",
        400
      );
    }

    if (user.status === USER_STATUS.SUSPENDIDO) {
      return apiError(
        STATUS_MESSAGES[user.status] ?? "Acceso denegado",
        403
      );
    }

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
    console.error("[auth/google] fatal:", error);
    const msg = error instanceof Error ? error.message : "desconocido";
    return apiError(`Error interno: ${msg}`, 500);
  }
}
