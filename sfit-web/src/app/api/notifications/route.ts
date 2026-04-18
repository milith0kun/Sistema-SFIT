import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import {
  Notification,
  NOTIFICATION_CATEGORIES,
} from "@/models/Notification";
import {
  apiResponse,
  apiError,
  apiUnauthorized,
} from "@/lib/api/response";
import { getSession } from "@/lib/auth/guard";

/**
 * RF-18: Bandeja de notificaciones del usuario autenticado.
 * Filtros opcionales: unread=true, category, limit (máx 100, default 50).
 */
export async function GET(request: NextRequest) {
  const session = getSession(request);
  if (!session) return apiUnauthorized();

  try {
    await connectDB();

    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unread") === "true";
    const categoryParam = url.searchParams.get("category");
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
    );

    const filter: Record<string, unknown> = { userId: session.userId };
    if (unreadOnly) filter.readAt = null;
    if (
      categoryParam &&
      (NOTIFICATION_CATEGORIES as readonly string[]).includes(categoryParam)
    ) {
      filter.category = categoryParam;
    }

    const items = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return apiResponse({
      items: items.map((n) => ({
        id: String(n._id),
        title: n.title,
        body: n.body,
        type: n.type,
        category: n.category,
        link: n.link,
        metadata: n.metadata,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
    });
  } catch (error) {
    console.error("[notifications GET]", error);
    return apiError("Error al listar notificaciones", 500);
  }
}
