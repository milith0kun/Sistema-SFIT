/**
 * RF-18 — Registro y eliminación de tokens FCM
 *
 * POST  /api/notificaciones/token  → Guarda (o actualiza) el token del dispositivo
 * DELETE /api/notificaciones/token → Elimina el token (usar en logout)
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import {
  apiResponse,
  apiError,
  apiUnauthorized,
  apiValidationError,
} from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";

const TokenSchema = z.object({
  token: z.string().min(10, "Token FCM inválido"),
  platform: z.enum(["android", "ios"]),
});

const DeleteSchema = z.object({
  token: z.string().min(10, "Token FCM inválido"),
});

// ── POST /api/notificaciones/token ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = TokenSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "general";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  try {
    await connectDB();

    // $addToSet evita duplicados en el array
    await User.findByIdAndUpdate(
      session.userId,
      { $addToSet: { fcmTokens: parsed.data.token } },
      { new: false },
    );

    return apiResponse({ message: "Token FCM registrado correctamente" });
  } catch (error) {
    console.error("[notificaciones/token POST]", error);
    return apiError("Error al registrar token FCM", 500);
  }
}

// ── DELETE /api/notificaciones/token ───────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "general";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    return apiValidationError(errors);
  }

  try {
    await connectDB();

    // $pull elimina el token del array
    await User.findByIdAndUpdate(
      session.userId,
      { $pull: { fcmTokens: parsed.data.token } },
      { new: false },
    );

    return apiResponse({ message: "Token FCM eliminado correctamente" });
  } catch (error) {
    console.error("[notificaciones/token DELETE]", error);
    return apiError("Error al eliminar token FCM", 500);
  }
}
