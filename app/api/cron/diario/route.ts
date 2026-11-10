import { NextResponse, type NextRequest } from 'next/server';
import { refrescarDatos } from '@/lib/data';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { bearerValido, env } from '@/lib/env';
import { syncGhl } from '@/lib/sync/ghl';
import { syncMetaAds, syncMetaCampanas } from '@/lib/sync/meta';
import { syncIgOrganico } from '@/lib/sync/ig';
import { syncManychat } from '@/lib/sync/manychat';
import { vencimientoMeta } from '@/lib/sync/vencimiento';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Cron diario (06:00 AR = 09:00 UTC, ver vercel.json).
 * Probar a mano: GET /api/cron/diario?dry=1 con header Authorization: Bearer $CRON_SECRET.
 * Si una fuente falla, las otras siguen; el error queda en log_agente.
 */
async function manejarGET(req: NextRequest) {
  // Vercel manda CRON_SECRET (mín. 32 caracteres) en el header. También se puede correr a mano con CARGA_API_TOKEN.
  const authz = req.headers.get('authorization');
  if (!bearerValido(authz, env.cronSecret()) && !bearerValido(authz, env.cargaToken())) {
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

  // ?solo=manychat corre una sola fuente (para probar o refrescar sin esperar a la mañana)
  const solo = req.nextUrl.searchParams.get('solo');
  if (solo === 'manychat') {
    await correr('ManyChat', () => syncManychat(sb, dry));
    return NextResponse.json({ ok: errores.length === 0, dry, resultados, errores });
  }

  await correr('GHL', () => syncGhl(sb, dry));
  await correr('Meta', () => syncMetaAds(sb, dry));
  await correr('Campañas', () => syncMetaCampanas(sb, dry));
  await correr('IG', () => syncIgOrganico(sb, dry));
  if (process.env.MANYCHAT_TOKEN) await correr('ManyChat', () => syncManychat(sb, dry));
  // Tiempo de respuesta por DMs: Meta no lo permite sin "acceso avanzado"; sale de Business Suite (Setter)

  // El token de Meta de 60 días vence: avisar 10 días antes (queda en Avisos del Inicio)
  const vence = await vencimientoMeta().catch(() => null);
  const dias = vence ? Math.ceil((vence.getTime() - Date.now()) / 86400000) : null;
  if (dias !== null && dias <= 10) {
    errores.push(`El token de Meta vence ${dias <= 0 ? 'hoy' : `en ${dias} días`} (${vence!.toISOString().slice(0, 10)}): renovarlo en developers.facebook.com/tools/explorer y actualizar META_TOKEN en Vercel`);
  }

  if (env.cronSecret().length < 32) {
    errores.push('Falta CRON_SECRET en Vercel (mín. 32 caracteres): el sync automático de las 6:00 no puede correr. Cargalo en Settings → Environment Variables y redeployá.');
  }

  const resumen = `cron ${errores.length ? 'con errores' : 'ok'}: ${Object.entries(resultados).map(([k, v]) => `${k} ${v}`).join(', ')}`;
  if (!dry) {
    await sb.from('log_agente').insert({ fecha: new Date().toISOString(), resumen, cambios: resultados, pendientes: errores, source: 'ghl' });
  }
  return NextResponse.json({ ok: errores.length === 0, dry, resultados, errores });
}

/** Después de escribir se descarta la caché de datos, así el dashboard muestra lo nuevo al instante. */
export async function GET(...args: Parameters<typeof manejarGET>) {
  const res = await manejarGET(...args);
  refrescarDatos();
  return res;
}
