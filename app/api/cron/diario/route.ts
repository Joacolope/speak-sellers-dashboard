import { NextResponse, type NextRequest } from 'next/server';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { bearerValido, env } from '@/lib/env';
import { syncGhl } from '@/lib/sync/ghl';
import { syncMetaAds, syncMetaCampanas } from '@/lib/sync/meta';
import { syncIgOrganico } from '@/lib/sync/ig';
import { syncTiempoRespuesta } from '@/lib/sync/respuesta';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Cron diario (06:00 AR = 09:00 UTC, ver vercel.json).
 * Probar a mano: GET /api/cron/diario?dry=1 con header Authorization: Bearer $CRON_SECRET.
 * Si una fuente falla, las otras siguen; el error queda en log_agente.
 */
export async function GET(req: NextRequest) {
  // CRON_SECRET es obligatorio (mín. 32 caracteres); Vercel lo manda solo en el header.
  if (!bearerValido(req.headers.get('authorization'), env.cronSecret())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!supabaseConfigurado()) return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 });

  const dry = req.nextUrl.searchParams.get('dry') === '1';
  const sb = supabase();
  const resultados: Record<string, string> = {};
  const errores: string[] = [];

  const correr = async (nombre: string, fn: () => Promise<string>) => {
    try {
      resultados[nombre] = await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errores.push(`${nombre} error: ${msg}`);
      resultados[nombre] = `error: ${msg}`;
    }
  };

  await correr('GHL', () => syncGhl(sb, dry));
  await correr('Meta', () => syncMetaAds(sb, dry));
  await correr('Campañas', () => syncMetaCampanas(sb, dry));
  await correr('IG', () => syncIgOrganico(sb, dry));
  await correr('Respuesta', () => syncTiempoRespuesta(sb, dry));

  const resumen = `cron ${errores.length ? 'con errores' : 'ok'}: ${Object.entries(resultados).map(([k, v]) => `${k} ${v}`).join(', ')}`;
  if (!dry) {
    await sb.from('log_agente').insert({ fecha: new Date().toISOString(), resumen, cambios: resultados, pendientes: errores, source: 'ghl' });
  }
  return NextResponse.json({ ok: errores.length === 0, dry, resultados, errores });
}
