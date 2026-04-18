import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { getSession } from "@/lib/auth/guard";

/**
 * RF-18: Marca todas las notificaciones no leídas del usuario como leídas.
 */
export async function PATCH(request: NextRequest) {
  const session = getSession(request);
  if (!session) return apiUnauthorized();

  try {
    await connectDB();

    const result = await Notification.updateMany(
      { userId: session.userId, readAt: null },
      { $set: { readAt: new Date() } },
    );

    return apiResponse({ modified: result.modifiedCount });
  } catch (error) {
    console.error("[notifications/read-all PATCH]", error);
    return apiError("Error al actualizar notificaciones", 500);
  }
}
