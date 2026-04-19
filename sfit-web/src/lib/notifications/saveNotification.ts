/**
 * Helper para persistir notificaciones en BD (RF-18).
 *
 * Llama a esto desde los mismos sitios donde se envía el push FCM,
 * para que la bandeja in-app quede sincronizada con el push.
 *
 * Falla silenciosamente — nunca debe romper el flujo principal.
 */
import { createNotification } from "./create";
import type { NotificationCategory, NotificationType } from "@/models/Notification";

/**
 * Persiste una notificación en BD para un usuario específico.
 *
 * @param userId      - ObjectId del usuario destino (string)
 * @param title       - Título de la notificación
 * @param body        - Cuerpo / descripción
 * @param type        - Tipo visual: "info" | "success" | "warning" | "error" | "action_required"
 * @param category    - Categoría funcional: "sistema" | "aprobacion" | "sancion" | etc.
 * @param link        - Ruta relativa o URL opcional para navegación al tocar
 * @param metadata    - Datos adicionales arbitrarios (referenceId, etc.)
 */
export async function saveNotification(
  userId: string,
  title: string,
  body: string,
  type: NotificationType = "info",
  category: NotificationCategory = "otro",
  link?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await createNotification({ userId, title, body, type, category, link, metadata });
}
