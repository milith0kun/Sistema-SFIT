import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { requireAuth } from "@/lib/auth/guard";
import { apiResponse, apiError, apiValidationError, apiUnauthorized } from "@/lib/api/response";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Contraseña actual requerida"),
  newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
});

/**
 * POST /api/auth/cambiar-password
 * Cambia la contraseña del usuario autenticado.
 * Body: { currentPassword, newPassword }
 */
export async function POST(request: NextRequest) {
  try {
    const session = requireAuth(request);
    if (!session) {
      return apiUnauthorized("Debes iniciar sesión para cambiar tu contraseña");
    }

    const body = await request.json();
    const parsed = ChangePasswordSchema.safeParse(body);

    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "general";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      return apiValidationError(errors);
    }

    const { currentPassword, newPassword } = parsed.data;

    await connectDB();

    const user = await User.findById(session.userId).select("+password");
    if (!user) {
      return apiError("Usuario no encontrado", 404);
    }

    // Cuentas creadas exclusivamente con Google no tienen contraseña
    if (!user.password) {
      return apiError(
        "Esta cuenta usa Google como método de acceso. Establece una contraseña primero desde la sección de recuperación.",
        400,
      );
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return apiError("La contraseña actual es incorrecta", 403);
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(session.userId, { password: hashed });

    return apiResponse({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("[auth/cambiar-password]", error);
    return apiError("Error interno del servidor", 500);
  }
}
