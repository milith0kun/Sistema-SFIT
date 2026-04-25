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

    let user = await User.findOne({ email: payload.email }).select("+password");

    const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
    const isInitialAdmin =
      !!initialAdminEmail && payload.email.toLowerCase() === initialAdminEmail;

    // Registro automático si no existe (RF-01-01)
    if (!user) {
      user = await User.create({
        name: payload.name ?? payload.email.split("@")[0],
        email: payload.email,
        image: payload.picture,
        provider: "google",
        providerId: payload.sub,
        role: isInitialAdmin ? ROLES.SUPER_ADMIN : ROLES.CIUDADANO,
        status: USER_STATUS.ACTIVO,
      });
    } else {
      // Vinculación automática: si la cuenta ya existe (con cualquier provider)
      // y el email está verificado por Google, enlazamos Google con la cuenta.
      // RF-01: el correo es la identidad única; los proveedores son métodos de acceso.
      let mutated = false;

      if (!user.providerId) {
        user.providerId = payload.sub;
        mutated = true;
      }
      // Solo marcamos provider "google" si la cuenta NO tiene contraseña
      // (fue creada exclusivamente con Google). Si tiene contraseña, mantenemos
      // "credentials" para reflejar que soporta ambos métodos.
      if (!user.password && user.provider !== "google") {
        user.provider = "google";
        mutated = true;
      }
      if (!user.image && payload.picture) {
        user.image = payload.picture;
        mutated = true;
      }
      if (isInitialAdmin && user.role !== ROLES.SUPER_ADMIN) {
        user.role = ROLES.SUPER_ADMIN;
        user.status = USER_STATUS.ACTIVO;
        mutated = true;
      }
      if (mutated) {
        await user.save();
      }
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
        phone: user.phone ?? null,
        dni:   user.dni   ?? null,
      },
    });
  } catch (error) {
    console.error("[auth/google] fatal:", error);
    const msg = error instanceof Error ? error.message : "desconocido";
    return apiError(`Error interno: ${msg}`, 500);
  }
}
