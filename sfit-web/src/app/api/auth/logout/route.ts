import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { extractTokenFromHeader } from "@/lib/auth/jwt";
import { apiResponse, apiError } from "@/lib/api/response";

/** RF-01-10: Cierre de sesión — invalida el refresh token de inmediato. */
export async function POST(request: NextRequest) {
  try {
    const payload = extractTokenFromHeader(
      request.headers.get("Authorization")
    );
    if (!payload) return apiError("No autorizado", 401);

    await connectDB();

    await User.findByIdAndUpdate(payload.userId, {
      $unset: { refreshToken: 1, refreshTokenExpiry: 1 },
    });

    return apiResponse({ message: "Sesión cerrada correctamente" });
  } catch (error) {
    console.error("[logout]", error);
    return apiError("Error interno del servidor", 500);
  }
}
