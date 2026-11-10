import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Estado de las fuentes automáticas (solo lectura): últimas corridas del cron y hasta qué día hay datos.
 * GET con "Authorization: Bearer $CARGA_API_TOKEN" o sesión de editor. No devuelve datos de clientes.
 */
/** Ventas y señas desde una fecha, con el perfil del lead y sus cobros (para trazabilidad). */
async function ventasDesde(desde: string) {
  const sb = supabase();
  const { data: ags, error } = await sb.from('agendas')
    .select('id, lead_id, closer, fecha_llamada, asistio, compro, cash_collected, revenue, metodo_pago, notas, source')
    .gte('fecha_llamada', `${desde}T00:00:00-03:00`).order('fecha_llamada');
  if (error) return { error: error.message };
  const ids = Array.from(new Set((ags ?? []).map((a) => a.lead_id)));
  const [{ data: leads }, { data: cobs }] = await Promise.all([
    sb.from('leads').select('id, nombre, fuente, funnel, canal, pais, primer_punto_contacto, ultimo_punto_contacto, closer_en_actividad, rango_comisiones, nicho, dato_previo, utm_source, utm_medium, utm_campaign, utm_content, notas, ghl_contact_id, manychat_url, seguidor_desde, como_agendo, intervino_setter, recorrido, manychat_tags, manychat_desde, instagram').in('id', ids),
    sb.from('cobranzas').select('agenda_id, fecha_cobro, monto_cobrado, pendiente, cuotas_restantes, proximo_vencimiento, notas').in('agenda_id', (ags ?? []).map((a) => a.id)),
  ]);
  const porId = new Map((leads ?? []).map((l) => [l.id, l]));
  return (ags ?? []).map((a) => ({ ...a, lead: porId.get(a.lead_id) ?? null, cobros: (cobs ?? []).filter((c) => c.agenda_id === a.id) }));
}

export async function GET(req: Request) {
  const auth = await exigir('editor', { permitirToken: true });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const ventas = new URL(req.url).searchParams.get('ventas');
  if (ventas && /^\d{4}-\d{2}-\d{2}$/.test(ventas)) return NextResponse.json(await ventasDesde(ventas));
  const sb = supabase();
  const hace40 = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
  const [log, ads, campanas, setter, ig, webinars] = await Promise.all([
    sb.from('log_agente').select('fecha, resumen, pendientes').order('fecha', { ascending: false }).limit(5),
    sb.from('ads_diario').select('fecha, campana, inversion, conversaciones, comentarios, seguidores, registros, source').gte('fecha', hace40).order('fecha', { ascending: false }),
    sb.from('campanas_meta').select('nombre, estado, tipo, inversion_7d, resultados_7d, updated_at').order('updated_at', { ascending: false }).limit(10),
    sb.from('setter_diario').select('fecha, conv_api, tr_mediana_min, source').gte('fecha', hace40).order('fecha', { ascending: false }).limit(10),
    sb.from('organico_diario').select('fecha').order('fecha', { ascending: false }).limit(1),
    sb.from('webinars').select('fecha, nombre, presupuesto, registrados, asistentes, notas').order('fecha', { ascending: false }).limit(10),
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
    webinars: webinars.data ?? [],
    leads_repetidos: repetidos,
  });
}
