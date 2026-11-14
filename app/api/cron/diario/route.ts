import { NextResponse, type NextRequest } from 'next/server';
import { refrescarDatos } from '@/lib/data';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { bearerValido, env } from '@/lib/env';
import { syncGhl } from '@/lib/sync/ghl';
import { syncMetaAds, syncMetaCampanas } from '@/lib/sync/meta';
import { historialPublicaciones, revisarAutomatizacion, syncIgOrganico } from '@/lib/sync/ig';
import { CLIENTE } from '@/lib/cliente';
import { manychat, syncManychat } from '@/lib/sync/manychat';
import { vencimientoMeta } from '@/lib/sync/vencimiento';
import { controlPlanilla } from '@/lib/sync/planilla';
import { mesActual, mesAnterior } from '@/lib/format';

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
  // ?solo=buscar&nombre=...&email=... busca un contacto en ManyChat (solo lee): id, nombre, usuario de IG y etiquetas
  if (solo === 'buscar') {
    const q = req.nextUrl.searchParams;
    type S = { id: string; name?: string; ig_username?: string | null; subscribed?: string | null; tags?: { name: string }[] };
    const hallados: S[] = [];
    const nombre = q.get('nombre')?.trim();
    const email = q.get('email')?.trim();
    // ?id= devuelve la ficha completa del contacto (campos personalizados incluidos)
    const id = q.get('id')?.trim();
    if (id && /^\d+$/.test(id)) return NextResponse.json(await manychat<unknown>('/fb/subscriber/getInfo', { subscriber_id: id }).catch((e) => ({ error: String(e) })));
    if (nombre) hallados.push(...(await manychat<S[]>('/fb/subscriber/findByName', { name: nombre }).catch(() => [] as S[])));
    if (email) {
      const uno = await manychat<S | S[] | null>('/fb/subscriber/findBySystemField', { email }).catch(() => null);
      hallados.push(...(Array.isArray(uno) ? uno : uno ? [uno] : []));
    }
    return NextResponse.json(hallados.slice(0, 20).map((h) => ({ id: h.id, nombre: h.name, ig: h.ig_username, desde: h.subscribed, tags: (h.tags ?? []).map((t) => t.name) })));
  }
  // ?solo=automatizacion&dias=7 → por cada publicación reciente, cuántos comentarios recibieron la respuesta automática
  if (solo === 'automatizacion') {
    const dias = Math.min(60, Math.max(1, Number(req.nextUrl.searchParams.get('dias')) || 7));
    try {
      return NextResponse.json(await revisarAutomatizacion(dias, CLIENTE.meta.instagram ?? ''));
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
    }
  }
  // ?solo=planilla&mes=AAAA-MM compara el mes contra la planilla de finanzas y devuelve las diferencias (solo lee)
  if (solo === 'planilla') {
    const mes = /^\d{4}-\d{2}$/.test(req.nextUrl.searchParams.get('mes') ?? '') ? req.nextUrl.searchParams.get('mes')! : mesActual();
    try {
      const r = await controlPlanilla(sb, mes);
      return NextResponse.json({ ok: !r.aviso, mes, resumen: r.resumen, aviso: r.aviso, detalle: r.detalle });
    } catch (e) {
      return NextResponse.json({ ok: false, mes, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
    }
  }
  // ?solo=historial&dias=365 trae los links de publicaciones viejas (sin métricas), para el recorrido de los compradores
  if (solo === 'historial') {
    const dias = Math.min(1095, Math.max(7, Number(req.nextUrl.searchParams.get('dias')) || 365));
    await correr('Historial IG', () => historialPublicaciones(sb, dias, dry));
    return NextResponse.json({ ok: errores.length === 0, dry, resultados, errores });
  }

  await correr('GHL', () => syncGhl(sb, dry));
  await correr('Meta', () => syncMetaAds(sb, dry));
  await correr('Campañas', () => syncMetaCampanas(sb, dry));
  await correr('IG', () => syncIgOrganico(sb, dry));
  if (process.env.MANYCHAT_TOKEN) await correr('ManyChat', () => syncManychat(sb, dry));
  // ¿ManyChat está respondiendo los comentarios? Publicaciones de los últimos 3 días con comentarios y casi ninguna respuesta
  if (process.env.META_TOKEN && process.env.MANYCHAT_TOKEN && CLIENTE.meta.instagram) await correr('Automatización', async () => {
    const reels = await revisarAutomatizacion(3, CLIENTE.meta.instagram ?? '');
    const caidos = reels.filter((r) => (r.palabra && r.comentarios >= 5 && r.respondidos / r.comentarios < 0.2) || (r.comentarios >= 8 && r.respondidos === 0));
    if (caidos.length) {
      errores.push(`ManyChat no está respondiendo los comentarios: ${caidos.map((r) => `${r.palabra ? `«${r.palabra}»` : 'publicación'} del ${Number(r.fecha.slice(8, 10))}/${Number(r.fecha.slice(5, 7))} tiene ${r.comentarios} comentarios y ${r.respondidos} ${r.respondidos === 1 ? 'respuesta' : 'respuestas'}`).join(' · ')}. Revisar la automatización y los permisos de Instagram en ManyChat.`);
    }
    return `${reels.length} publicaciones revisadas${caidos.length ? `, ${caidos.length} sin respuesta automática` : ''}`;
  });
  // Control contra la planilla de finanzas: el mes en curso y, la primera semana, también el anterior
  if (process.env.PLANILLA_FINANZAS_ID) {
    const meses = [mesActual()];
    if (new Date().getUTCDate() <= 7) meses.unshift(mesAnterior(meses[0]));
    for (const mes of meses) {
      await correr(`Planilla ${mes}`, async () => {
        const r = await controlPlanilla(sb, mes);
        if (r.aviso) errores.push(r.aviso);
        return r.resumen;
      });
    }
  }
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
