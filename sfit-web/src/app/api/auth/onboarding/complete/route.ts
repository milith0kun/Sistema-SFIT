import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import {
  apiResponse, apiError, apiUnauthorized, apiValidationError,
} from "@/lib/api/response";
import { verifyAccessToken } from "@/lib/auth/jwt";

/**
 * POST /api/auth/onboarding/complete
 *
 * Permite al usuario autenticado completar su perfil al primer login:
 *   - DNI (RENIEC, único nacional)
 *   - Teléfono
 *   - Foto (image URL, opcional)
 *   - Cambiar password si tiene mustChangePassword=true
 *
 * Marca profileCompleted=true y mustChangePassword=false.
 */

const Schema = z.object({
  dni:   z.string().regex(/^\d{6,12}$/, "DNI debe tener entre 6 y 12 dígitos"),
  phone: z.string().min(7).max(30),
  image: z.string().url("URL de imagen inválida").optional(),
  newPassword: z.string().min(8, "Mínimo 8 caracteres").max(128).optional(),
});

export async function POST(request: NextRequest) {
  // Auth manual (no usar requireRole — onboarding aplica a cualquier rol)
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return apiUnauthorized();

  let session;
  try {
    session = verifyAccessToken(authHeader.substring(7));
  } catch {
    return apiUnauthorized();
  }

  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "general";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  const { dni, phone, image, newPassword } = parsed.data;

  try {
    await connectDB();

    const user = await User.findById(session.userId).select("+password");
    if (!user) return apiError("Usuario no encontrado", 404);

    // DNI único nacional
    const dupDni = await User.findOne({ dni, _id: { $ne: user._id } });
    if (dupDni) return apiError("El DNI ya está registrado en otra cuenta", 409);

    user.dni   = dni;
    user.phone = phone;
    if (image) user.image = image;

    if (newPassword) {
      user.password = await bcrypt.hash(newPassword, 12);
      user.mustChangePassword = false;
    }

    user.profileCompleted = true;
    await user.save();

    return apiResponse({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      status: user.status,
      municipalityId: user.municipalityId?.toString(),
      provinceId: user.provinceId?.toString(),
      phone: user.phone,
      dni: user.dni,
      profileCompleted: user.profileCompleted,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error) {
    console.error("[onboarding/complete]", error);
    return apiError("Error al completar onboarding", 500);
  }
}
