import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';
import { cuentaInstagram } from '@/lib/sync/cuentaIg';

export const dynamic = 'force-dynamic';

/**
 * Estado de las fuentes automáticas (solo lectura): últimas corridas del cron y hasta qué día hay datos.
 * GET con "Authorization: Bearer $CARGA_API_TOKEN" o sesión de editor. No devuelve datos de clientes.
 */
/** Prueba de solo lectura: qué métricas de mensajes deja leer Meta con el token actual. */
async function probarMensajes() {
  const token = process.env.META_TOKEN;
  const page = process.env.META_PAGE_ID;
  if (!token || !page) return { error: 'Falta META_TOKEN o META_PAGE_ID' };
  const G = 'https://graph.facebook.com/v21.0';
  const pedir = async (path: string, params: Record<string, string>, tk: string) => {
    const u = new URL(`${G}/${path}`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    u.searchParams.set('access_token', tk);
    const r = await fetch(u, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, j } : { ok: false, error: (j as { error?: { message?: string } }).error?.message ?? String(r.status) };
  };
  const pt = await pedir(page, { fields: 'access_token' }, token);
  const pageToken = pt.ok ? (pt.j as { access_token: string }).access_token : token;
  const hasta = Math.floor(Date.now() / 1000);
  const desde = hasta - 28 * 86400;
  const out: Record<string, unknown> = {};
  const metricas = [
    'page_messages_total_messaging_connections', 'page_messages_new_conversations_unique', 'page_messages_active_threads_unique',
    'page_messages_blocked_conversations_unique', 'page_messages_reported_conversations_unique', 'page_messages_feedback_by_action_unique',
  ];
  for (const m of metricas) {
    const r = await pedir(`${page}/insights`, { metric: m, period: 'day', since: String(desde), until: String(hasta) }, pageToken);
    out[`page:${m}`] = r.ok ? { ok: true, total: ((r.j as { data?: { values?: { value: unknown }[] }[] }).data?.[0]?.values ?? []).reduce((a: number, v) => a + (typeof v.value === 'number' ? v.value : 0), 0) } : r.error;
  }
  const campos = await pedir(page, { fields: 'response_time,responsiveness,messenger_ads_default_icebreakers' }, pageToken);
  out['page:campos_respuesta'] = campos.ok ? campos.j : campos.error;
  try {
    const ig = await cuentaInstagram();
    for (const m of ['total_interactions', 'replies', 'conversations_started', 'messaging_conversations_started']) {
      const r = await pedir(`${ig}/insights`, { metric: m, period: 'day', metric_type: 'total_value', since: String(desde), until: String(hasta) }, token);
      out[`ig:${m}`] = r.ok ? r.j : r.error;
    }
  } catch (e) {
    out.ig = String(e);
  }
  return out;
}

export async function GET(req: Request) {
  const auth = await exigir('editor', { permitirToken: true });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (new URL(req.url).searchParams.get('probar') === 'mensajes') return NextResponse.json(await probarMensajes());
  const sb = supabase();
  const hace40 = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
  const [log, ads, campanas, setter, ig] = await Promise.all([
    sb.from('log_agente').select('fecha, resumen, pendientes').order('fecha', { ascending: false }).limit(5),
    sb.from('ads_diario').select('fecha, campana, inversion, conversaciones, comentarios, seguidores, registros, source').gte('fecha', hace40).order('fecha', { ascending: false }),
    sb.from('campanas_meta').select('nombre, estado, tipo, inversion_7d, resultados_7d, updated_at').order('updated_at', { ascending: false }).limit(10),
    sb.from('setter_diario').select('fecha, conv_api, tr_mediana_min, source').gte('fecha', hace40).order('fecha', { ascending: false }).limit(10),
    sb.from('organico_diario').select('fecha').order('fecha', { ascending: false }).limit(1),
  ]);
  // Leads repetidos por nombre (para detectar duplicados entre GHL y lo cargado a mano)
  const { data: leads } = await sb.from('leads').select('nombre, source, ghl_contact_id');
  const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const cuenta = new Map<string, { nombre: string; fuentes: string[] }>();
  for (const l of leads ?? []) {
    const k = norm(l.nombre ?? '');
    const g = cuenta.get(k) ?? { nombre: String(l.nombre), fuentes: [] as string[] };
    g.fuentes.push(`${l.source}${l.ghl_contact_id ? '+ghl' : ''}`);
    cuenta.set(k, g);
  }
  const repetidos = Array.from(cuenta.values()).filter((g) => g.fuentes.length > 1);
  return NextResponse.json({
    cron: log.data ?? [],
    ads: ads.data ?? [],
    campanas: campanas.error ? { error: campanas.error.message } : campanas.data,
    setter: setter.data ?? [],
    organico_ultimo: ig.data?.[0]?.fecha ?? null,
    leads_repetidos: repetidos,
  });
}
