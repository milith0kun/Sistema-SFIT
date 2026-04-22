/**
 * GET /api/health/smtp
 * Verifica que el proveedor de correo (Resend) esté configurado.
 * Sin autenticación — devuelve sólo si la clave está presente, nunca su valor.
 */
export async function GET() {
  const configured = !!process.env.RESEND_API_KEY;
  return Response.json({
    smtp: configured ? "configured" : "missing_key",
    provider: "resend",
  });
}
