import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import {
  Notification,
  type NotificationType,
  type NotificationCategory,
} from "@/models/Notification";
import { User } from "@/models/User";
import { Municipality } from "@/models/Municipality";
import { USER_STATUS, type Role } from "@/lib/constants";

/**
 * Parámetros para crear una notificación individual.
 */
export interface CreateNotificationParams {
  userId: string;
  title: string;
  body: string;
  type?: NotificationType;
  category?: NotificationCategory;
  link?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Crea una notificación para un usuario (RF-18).
 * Silencioso en caso de error — la creación de notificaciones nunca debe
 * tumbar el flujo principal (registro, aprobación, sanción, etc.).
 */
export async function createNotification(
  params: CreateNotificationParams,
): Promise<void> {
  try {
    if (!isValidObjectId(params.userId)) return;
    await connectDB();
    await Notification.create({
      userId: params.userId,
      title: params.title,
      body: params.body,
      type: params.type ?? "info",
      category: params.category ?? "otro",
      link: params.link,
      metadata: params.metadata,
    });
  } catch (error) {
    console.error("[createNotification]", error);
  }
}

/**
 * Parámetros comunes para notificaciones bulk por rol.
 */
interface BulkBase {
  title: string;
  body: string;
  type?: NotificationType;
  category?: NotificationCategory;
  link?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Crea una notificación para todos los usuarios activos de un rol.
 * Si se pasa `municipalityId`, limita el alcance a ese tenant.
 * Si se pasa `provinceId`, limita al nivel provincial (incluye usuarios
 * cuyo provinceId coincide o cuya municipalidad pertenece a la provincia).
 */
export async function createNotificationForRole(
  role: Role,
  opts: BulkBase & { municipalityId?: string; provinceId?: string },
): Promise<void> {
  return createNotificationForRoles([role], opts);
}

/**
 * Variante multi-rol.
 */
export async function createNotificationForRoles(
  roles: Role[],
  opts: BulkBase & { municipalityId?: string; provinceId?: string },
): Promise<void> {
  try {
    if (!roles.length) return;
    await connectDB();

    const filter: Record<string, unknown> = {
      role: { $in: roles },
      status: USER_STATUS.ACTIVO,
    };

    if (opts.municipalityId && isValidObjectId(opts.municipalityId)) {
      filter.municipalityId = opts.municipalityId;
    } else if (opts.provinceId && isValidObjectId(opts.provinceId)) {
      // Usuarios con provinceId directo o con municipalidad dentro de la provincia.
      const munis = await Municipality.find({ provinceId: opts.provinceId })
        .select("_id")
        .lean<{ _id: unknown }[]>();
      const muniIds = munis.map((m) => m._id);
      filter.$or = [
        { provinceId: opts.provinceId },
        { municipalityId: { $in: muniIds } },
      ];
    }

    const recipients = await User.find(filter)
      .select("_id")
      .lean<{ _id: unknown }[]>();

    if (!recipients.length) return;

    const docs = recipients.map((u) => ({
      userId: u._id,
      title: opts.title,
      body: opts.body,
      type: opts.type ?? "info",
      category: opts.category ?? "otro",
      link: opts.link,
      metadata: opts.metadata,
    }));

    await Notification.insertMany(docs, { ordered: false });
  } catch (error) {
    console.error("[createNotificationForRoles]", error);
  }
}
