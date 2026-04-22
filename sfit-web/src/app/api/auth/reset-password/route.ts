import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { apiResponse, apiError } from "@/lib/api/response";

const Schema = z.object({
  email: z.string().email("Correo inválido"),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return apiError("Correo inválido", 422);

  const { email } = parsed.data;

  try {
    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+password +passwordResetToken +passwordResetExpiry")
      .lean();

    // Siempre devolver éxito (no revelar si el email existe)
    if (!user) {
      console.log("[reset-password] usuario no encontrado:", email);
      return apiResponse({ sent: true });
    }
    // Solo saltamos usuarios sin contraseña (Google puro).
    // Si un admin asignó contraseña a un usuario Google, sí puede resetearla.
    if (!user.password) {
      console.log("[reset-password] usuario sin contraseña (Google puro):", email);
      return apiResponse({ sent: true });
    }

    const token  = randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await User.findByIdAndUpdate(user._id, {
      passwordResetToken:  token,
      passwordResetExpiry: expiry,
    });

    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    console.log("[reset-password] enviando a:", user.email);
    await sendResetEmail(user.email, user.name, resetUrl);
    console.log("[reset-password] enviado OK a:", user.email);

    return apiResponse({ sent: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return apiError("Error interno", 500);
  }
}

// ── Envío de correo ────────────────────────────────────────────────────────────

async function sendResetEmail(to: string, name: string, url: string): Promise<void> {
  const html = buildEmail(name, url);
  const subject = "Recuperar contraseña — SFIT";

  // Opción A: Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);
    const from = process.env.RESEND_FROM_EMAIL ?? "noreply@sfit.pe";
    await resend.emails.send({ from, to, subject, html });
    return;
  }

  // Opción B: Gmail SMTP (nodemailer)
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpUser && smtpPass) {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({ from: `"SFIT" <${smtpUser}>`, to, subject, html });
    return;
  }

  // Sin configuración: imprimir en consola (solo desarrollo)
  console.log("[reset-password] Configura SMTP_USER + SMTP_PASS o RESEND_API_KEY");
  console.log("[reset-password] URL de recuperación:", url);
}

function buildEmail(name: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1.5px solid #e4e4e7;">
        <tr><td style="background:#0A1628;padding:28px 36px;">
          <p style="margin:0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">SFIT</p>
          <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.45);letter-spacing:1.5px;text-transform:uppercase;">Sistema de Fiscalización Inteligente de Transporte</p>
        </td></tr>
        <tr><td style="padding:36px 36px 28px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#71717a;letter-spacing:1.5px;text-transform:uppercase;">Recuperación de acceso</p>
          <h1 style="margin:0 0 20px;font-size:26px;font-weight:800;color:#18181b;line-height:1.15;">Restablecer contraseña</h1>
          <p style="margin:0 0 8px;font-size:15px;color:#52525b;line-height:1.6;">Hola, <strong style="color:#18181b;">${name}</strong>.</p>
          <p style="margin:0 0 28px;font-size:15px;color:#52525b;line-height:1.6;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta SFIT. Haz clic en el botón para crear una nueva contraseña.
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${url}" style="display:inline-block;padding:14px 28px;background:#0A1628;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:-0.1px;">
              Restablecer contraseña
            </a>
          </td></tr></table>
          <p style="margin:24px 0 0;font-size:13px;color:#71717a;line-height:1.55;">
            Este enlace vence en <strong>1 hora</strong>. Si no solicitaste este cambio, puedes ignorar este correo.
          </p>
        </td></tr>
        <tr><td style="padding:0 36px;"><hr style="border:none;border-top:1px solid #e4e4e7;margin:0;"></td></tr>
        <tr><td style="padding:20px 36px 28px;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
            O copia este enlace en tu navegador:<br>
            <span style="color:#52525b;word-break:break-all;">${url}</span>
          </p>
          <p style="margin:16px 0 0;font-size:11px;color:#a1a1aa;">© 2026 SFIT — Municipalidad</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
