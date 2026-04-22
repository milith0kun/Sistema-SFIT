/**
 * RF-18: Emails transaccionales via Resend.
 * Si RESEND_API_KEY no está configurada, degrada silenciosamente.
 */
import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY no configurada —', subject, '->', to);
    return;
  }
  try {
    await resend.emails.send({
      from: 'SFIT <noreply@sfit.ecosdelseo.com>',
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('[email] Error:', err);
    // No propagar — best-effort
  }
}
