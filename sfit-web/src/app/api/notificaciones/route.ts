/**
 * RF-18 — Bandeja de notificaciones del usuario autenticado
 *
 * GET   /api/notificaciones → Últimas 30 notificaciones del usuario, desc.
 * PATCH /api/notificaciones → Marca todas como leídas ({ markAllRead: true })
 */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";
import {
  apiResponse,
  apiError,
  apiUnauthorized,
} from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";

// ── GET /api/notificaciones ────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  try {
    await connectDB();

    const items = await Notification.find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const mapped = items.map((n) => ({
      id: String(n._id),
      title: n.title,
      body: n.body,
      type: n.type,
      category: n.category,
      link: n.link ?? null,
      metadata: n.metadata ?? null,
      read: !!n.readAt,
      readAt: n.readAt ?? null,
      createdAt: n.createdAt,
    }));

    const unreadCount = mapped.filter((n) => !n.read).length;

    return apiResponse({ items: mapped, unreadCount, total: mapped.length });
  } catch (error) {
    console.error("[notificaciones GET]", error);
    return apiError("Error al obtener notificaciones", 500);
  }
}

// ── PATCH /api/notificaciones ──────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { markAllRead } = body as Record<string, unknown>;

  if (markAllRead !== true) {
    return apiError("Parámetro markAllRead requerido", 400);
  }

  try {
    await connectDB();

    const result = await Notification.updateMany(
      { userId: session.userId, readAt: { $exists: false } },
      { $set: { readAt: new Date() } },
    );

    return apiResponse({ updated: result.modifiedCount });
  } catch (error) {
    console.error("[notificaciones PATCH]", error);
    return apiError("Error al marcar notificaciones como leídas", 500);
  }
}
