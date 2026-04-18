import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog } from "@/models/AuditLog";
import type { JwtPayload } from "@/lib/auth/jwt";

export interface LogAuditParams {
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Extrae la IP del cliente desde los headers estándar tras un proxy.
 */
function extractIpAddress(request: NextRequest): string | undefined {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return undefined;
}

/**
 * Registra una entrada de auditoría (RNF-16).
 * `session` puede ser null cuando el actor aún no está autenticado
 * (p. ej. intento de login fallido). En ese caso se usa el user id
 * provisto por metadata o se omite el log.
 *
 * Silencioso en caso de error — la auditoría nunca tumba el flujo principal.
 */
export async function logAudit(
  request: NextRequest,
  session: JwtPayload | null,
  params: LogAuditParams,
): Promise<void> {
  try {
    if (!session?.userId || !isValidObjectId(session.userId)) return;

    await connectDB();

    await AuditLog.create({
      actorId: session.userId,
      actorRole: session.role,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      municipalityId:
        session.municipalityId && isValidObjectId(session.municipalityId)
          ? session.municipalityId
          : undefined,
      provinceId:
        session.provinceId && isValidObjectId(session.provinceId)
          ? session.provinceId
          : undefined,
      metadata: params.metadata,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
  } catch (error) {
    console.error("[logAudit]", error);
  }
}

/**
 * Variante para eventos donde no hay sesión JWT (login fallido, registro).
 * Recibe explícitamente el actorId y rol.
 */
export async function logAuditRaw(
  request: NextRequest,
  actor: {
    actorId: string;
    actorRole: string;
    municipalityId?: string;
    provinceId?: string;
  },
  params: LogAuditParams,
): Promise<void> {
  try {
    if (!actor.actorId || !isValidObjectId(actor.actorId)) return;
    await connectDB();

    await AuditLog.create({
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      municipalityId:
        actor.municipalityId && isValidObjectId(actor.municipalityId)
          ? actor.municipalityId
          : undefined,
      provinceId:
        actor.provinceId && isValidObjectId(actor.provinceId)
          ? actor.provinceId
          : undefined,
      metadata: params.metadata,
      ipAddress: extractIpAddress(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
  } catch (error) {
    console.error("[logAuditRaw]", error);
  }
}
