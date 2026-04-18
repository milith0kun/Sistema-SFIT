import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";
import {
  apiResponse,
  apiError,
  apiNotFound,
  apiUnauthorized,
} from "@/lib/api/response";
import { getSession } from "@/lib/auth/guard";

/**
 * RF-18: Marca una notificación como leída.
 * Solo el destinatario puede marcarla.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSession(request);
  if (!session) return apiUnauthorized();

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    await connectDB();

    const updated = await Notification.findOneAndUpdate(
      { _id: id, userId: session.userId },
      { $set: { readAt: new Date() } },
      { new: true },
    );

    if (!updated) return apiNotFound("Notificación no encontrada");

    return apiResponse({
      id: String(updated._id),
      readAt: updated.readAt,
    });
  } catch (error) {
    console.error("[notifications/:id/read PATCH]", error);
    return apiError("Error al marcar notificación", 500);
  }
}
