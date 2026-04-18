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
 * RF-18: Elimina una notificación del usuario autenticado.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSession(request);
  if (!session) return apiUnauthorized();

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return apiError("ID inválido", 400);

    await connectDB();

    const deleted = await Notification.findOneAndDelete({
      _id: id,
      userId: session.userId,
    });

    if (!deleted) return apiNotFound("Notificación no encontrada");

    return apiResponse({ id: String(deleted._id) });
  } catch (error) {
    console.error("[notifications/:id DELETE]", error);
    return apiError("Error al eliminar notificación", 500);
  }
}
