import { NextResponse, type NextRequest } from 'next/server';
import { bearerValido, env } from '@/lib/env';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { cargarBundle } from '@/lib/data';
import { destinatarios, enviarResumen } from '@/lib/resumen-envio';

export const dynamic = 'force-dynamic';

/**
 * Resumen semanal por mail: viernes 18:00 AR = 21:00 UTC (ver vercel.json).
 * Probar a mano: GET /api/cron/resumen con header Authorization: Bearer $CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!bearerValido(req.headers.get('authorization'), env.cronSecret())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!supabaseConfigurado()) return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 });
  const sb = supabase();
  try {
    const para = await destinatarios();
    const { id, asunto } = await enviarResumen(await cargarBundle(), para);
    await sb.from('log_agente').insert({ fecha: new Date().toISOString(), resumen: `Resumen semanal enviado a ${para.length}`, cambios: { id, asunto }, source: 'agente' });
    return NextResponse.json({ ok: true, enviados: para.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from('log_agente').insert({ fecha: new Date().toISOString(), resumen: 'Resumen semanal: error al enviar', pendientes: [`Resumen semanal no salió: ${msg}`], source: 'agente' });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
