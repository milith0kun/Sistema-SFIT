import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { apiResponse, apiError } from "@/lib/api/response";

const Schema = z.object({
  token:       z.string().min(1, "Token requerido"),
  newPassword: z.string().min(8, "Mínimo 8 caracteres"),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return apiError(msg, 422);
  }

  const { token, newPassword } = parsed.data;

  try {
    await connectDB();

    const user = await User.findOne({
      passwordResetToken:  token,
      passwordResetExpiry: { $gt: new Date() },
    }).select("+passwordResetToken +passwordResetExpiry");

    if (!user) {
      return apiError("El enlace no es válido o ya expiró. Solicita uno nuevo.", 400);
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await User.findByIdAndUpdate(user._id, {
      $set:   { password: hashed },
      $unset: { passwordResetToken: "", passwordResetExpiry: "" },
    });

    return apiResponse({ reset: true });
  } catch (err) {
    console.error("[reset-password/confirm]", err);
    return apiError("Error interno", 500);
  }
}
