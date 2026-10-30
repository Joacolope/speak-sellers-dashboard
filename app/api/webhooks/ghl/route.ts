import { NextResponse, type NextRequest } from 'next/server';
import { env, igualSeguro } from '@/lib/env';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { syncGhl } from '@/lib/sync/ghl';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Webhook de GoHighLevel: cada vez que se agenda, confirma, cancela o marca una cita,
 * un workflow de GHL hace POST acá y la agenda entra al dashboard al instante
 * (con las respuestas del formulario). Sin esto, entra igual con el cron de las 6:00.
 *
 * URL a configurar en GHL (acción "Webhook"):
 *   https://<dominio>/api/webhooks/ghl?token=<GHL_WEBHOOK_SECRET>
 * El secreto se define en Vercel (GHL_WEBHOOK_SECRET). No duplica: cada cita se identifica por su id.
 */
export async function POST(req: NextRequest) {
  const secreto = process.env.GHL_WEBHOOK_SECRET || env.cargaToken();
  const token = req.nextUrl.searchParams.get('token') ?? (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!secreto || secreto.length < 16 || !igualSeguro(token, secreto)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!supabaseConfigurado()) return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const eventoId = idDeCita(body);
  const sb = supabase();
  try {
    // Con id de cita se sincroniza solo esa; si el payload no lo trae, se corre el sync completo
    const resultado = await syncGhl(sb, false, eventoId ? { eventoId } : {});
    await sb.from('log_agente').insert({ fecha: new Date().toISOString(), resumen: `webhook GHL: ${resultado}`, cambios: { eventoId }, source: 'ghl' });
    return NextResponse.json({ ok: true, resultado });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from('log_agente').insert({ fecha: new Date().toISOString(), resumen: 'webhook GHL con error', pendientes: [`Webhook GHL error: ${msg}`], source: 'ghl' }).then(() => undefined, () => undefined);
    return NextResponse.json({ ok: false, error: 'No se pudo sincronizar' }, { status: 500 });
  }
}

/** GHL manda el id de la cita en lugares distintos según el trigger; se prueban todos. */
function idDeCita(b: Record<string, unknown>): string | null {
  const cal = (b.calendar ?? b.appointment ?? {}) as Record<string, unknown>;
  const candidatos = [cal.appointmentId, cal.id, b.appointmentId, b.appointment_id, b.eventId, b.id];
  const id = candidatos.find((v) => typeof v === 'string' && /^[A-Za-z0-9_-]{8,}$/.test(v));
  return (id as string | undefined) ?? null;
}
