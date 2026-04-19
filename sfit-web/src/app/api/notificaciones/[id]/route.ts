/**
 * RF-18 — Marcar una notificación individual como leída
 *
 * PATCH /api/notificaciones/:id → Marca la notificación como leída
 */
import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";
import {
  apiResponse,
  apiError,
  apiNotFound,
  apiUnauthorized,
  apiForbidden,
} from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";

// ── PATCH /api/notificaciones/:id ─────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("ID inválido", 400);

  try {
    await connectDB();

    const notification = await Notification.findById(id);
    if (!notification) return apiNotFound("Notificación no encontrada");

    // Solo el propio usuario puede marcar su notificación
    if (String(notification.userId) !== session.userId) return apiForbidden();

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    return apiResponse({
      id: String(notification._id),
      read: true,
      readAt: notification.readAt,
    });
  } catch (error) {
    console.error("[notificaciones/:id PATCH]", error);
    return apiError("Error al marcar notificación como leída", 500);
  }
}
