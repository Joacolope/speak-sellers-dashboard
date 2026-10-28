import 'server-only';

/** Manda un mail con Resend (https://resend.com). Devuelve el id del envío. */
export async function enviarMail({ para, asunto, html }: { para: string[]; asunto: string; html: string }): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('Falta RESEND_API_KEY');
  if (!para.length) throw new Error('No hay destinatarios');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESUMEN_DESDE || 'Speak Sellers <onboarding@resend.dev>', to: para, subject: asunto, html }),
    cache: 'no-store',
  });
  const cuerpo = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(`Resend ${res.status}: ${cuerpo.message ?? 'error'}`);
  return cuerpo.id ?? '';
}
