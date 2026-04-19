import { createHmac } from "node:crypto";
import { connectDB } from "@/lib/db/mongoose";
import { Webhook } from "@/models/Webhook";

/**
 * Firma un payload JSON con HMAC-SHA256 usando el secret del webhook.
 * Usa el mismo patrón que lib/qr/hmac.ts.
 */
function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Dispara los webhooks activos de un municipio para el evento dado.
 * Operación no-bloqueante: fire-and-forget con try/catch por webhook.
 *
 * @param municipalityId  ID de la municipalidad
 * @param event           Nombre del evento (e.g. 'inspection.created')
 * @param payload         Datos del evento a enviar
 */
export async function triggerWebhook(
  municipalityId: string,
  event: string,
  payload: object,
): Promise<void> {
  try {
    await connectDB();

    // Incluir el `secret` explícitamente (select: false en el schema)
    const webhooks = await Webhook.find({
      municipalityId,
      active: true,
      events: event,
    })
      .select("+secret")
      .lean();

    if (webhooks.length === 0) return;

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

    // Disparar todos los webhooks en paralelo, sin bloquear
    await Promise.allSettled(
      webhooks.map(async (wh) => {
        try {
          const signature = signPayload(body, wh.secret);
          await fetch(wh.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-SFIT-Signature": `sha256=${signature}`,
              "X-SFIT-Event": event,
            },
            body,
            // Timeout de 10 segundos para no bloquear el proceso
            signal: AbortSignal.timeout(10_000),
          });
        } catch {
          // Silencioso — el webhook es best-effort. En producción se loguearía en audit.
        }
      }),
    );
  } catch {
    // Silencioso — nunca debe romper el flujo principal
  }
}
