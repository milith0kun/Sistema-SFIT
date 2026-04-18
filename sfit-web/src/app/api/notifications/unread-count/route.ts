import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { getSession } from "@/lib/auth/guard";

/**
 * RF-18: Conteo de notificaciones no leídas para el badge del header.
 */
export async function GET(request: NextRequest) {
  const session = getSession(request);
  if (!session) return apiUnauthorized();

  try {
    await connectDB();
    const count = await Notification.countDocuments({
      userId: session.userId,
      readAt: null,
    });
    return apiResponse({ count });
  } catch (error) {
    console.error("[notifications/unread-count GET]", error);
    return apiError("Error al contar notificaciones", 500);
  }
}
