import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
} from "@/lib/auth/jwt";
import { apiResponse, apiError } from "@/lib/api/response";

const RefreshSchema = z.object({ refreshToken: z.string().min(1) });

/** RF-01-08: Renovación automática de tokens. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RefreshSchema.safeParse(body);
    if (!parsed.success) return apiError("Token requerido", 400);

    const { refreshToken } = parsed.data;

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return apiError("Token inválido o expirado", 401);
    }

    await connectDB();

    const user = await User.findById(payload.userId).select(
      "+refreshToken +refreshTokenExpiry"
    );

    if (
      !user ||
      user.refreshToken !== refreshToken ||
      !user.refreshTokenExpiry ||
      user.refreshTokenExpiry < new Date()
    ) {
      return apiError("Token inválido o expirado", 401);
    }

    const newPayload = {
      userId: user._id.toString(),
      role: user.role,
      municipalityId: user.municipalityId?.toString(),
      provinceId: user.provinceId?.toString(),
    };

    const newAccessToken = signAccessToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);

    await User.findByIdAndUpdate(user._id, {
      refreshToken: newRefreshToken,
      refreshTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return apiResponse({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60,
    });
  } catch (error) {
    console.error("[refresh]", error);
    return apiError("Error interno del servidor", 500);
  }
}
