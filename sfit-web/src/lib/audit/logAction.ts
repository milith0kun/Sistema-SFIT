import { connectDB } from "@/lib/db/mongoose";
import { AuditLog } from "@/models/AuditLog";
import { isValidObjectId } from "mongoose";

/**
 * Helper no-bloqueante para registrar acciones en el audit log.
 * Nunca lanza — cualquier error es silenciado internamente.
 */
export async function logAction(params: {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: object;
  req?: Request;
  municipalityId?: string;
  role?: string;
}): Promise<void> {
  try {
    if (!params.userId || !isValidObjectId(params.userId)) return;

    // Extraer IP del request si está disponible
    let ipAddress: string | undefined;
    let userAgent: string | undefined;
    if (params.req) {
      const xff = params.req.headers.get("x-forwarded-for");
      if (xff) {
        ipAddress = xff.split(",")[0]?.trim();
      } else {
        const realIp = params.req.headers.get("x-real-ip");
        if (realIp) ipAddress = realIp.trim();
      }
      userAgent = params.req.headers.get("user-agent") ?? undefined;
    }

    await connectDB();
    await AuditLog.create({
      actorId: params.userId,
      actorRole: params.role ?? "unknown",
      action: params.action,
      resourceType: params.resource,
      resourceId: params.resourceId,
      municipalityId:
        params.municipalityId && isValidObjectId(params.municipalityId)
          ? params.municipalityId
          : undefined,
      metadata: params.details,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    console.error("[logAction]", err);
  }
}
