import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';
import { getBundle } from '@/lib/data';
import { metricasMes, resumenCloser } from '@/lib/metrics';
import { CLOSERS } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Estado de las fuentes automáticas (solo lectura): últimas corridas del cron y hasta qué día hay datos.
 * GET con "Authorization: Bearer $CARGA_API_TOKEN" o sesión de editor. No devuelve datos de clientes.
 */
/** Ventas y señas desde una fecha, con el perfil del lead y sus cobros (para trazabilidad). */
async function ventasDesde(desde: string) {
  const sb = supabase();
  const { data: ags, error } = await sb.from('agendas')
    .select('id, lead_id, closer, fecha_llamada, fecha_agendada, asistio, compro, cash_collected, revenue, metodo_pago, notas, source, fathom_url')
    .eq('ignorada', false).gte('fecha_llamada', `${desde}T00:00:00-03:00`).order('fecha_llamada');
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
  // ?datos=AAAA-MM-DD,AAAA-MM-DD → filas crudas de ese rango (para armar reportes por fuera)
  const rango = new URL(req.url).searchParams.get('datos');
  if (rango && /^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/.test(rango)) {
    const [desde, hasta] = rango.split(',');
    const sbd = supabase();
    const [setterD, adsD, organicoD, piezasD, cobranzasD, webinarsD, campanasD] = await Promise.all([
      sbd.from('setter_diario').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      sbd.from('ads_diario').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      sbd.from('organico_diario').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      sbd.from('organico_piezas').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      sbd.from('cobranzas').select('*').gte('fecha_cobro', desde).lte('fecha_cobro', hasta).order('fecha_cobro'),
      sbd.from('webinars').select('*').order('fecha'),
      sbd.from('campanas_meta').select('*'),
    ]);
    return NextResponse.json({
      setter: setterD.data ?? [], ads: adsD.data ?? [], organico: organicoD.data ?? [], piezas: piezasD.data ?? [],
      cobranzas: cobranzasD.data ?? [], webinars: webinarsD.data ?? [], campanas: campanasD.data ?? [],
    });
  }
  // ?metricas=AAAA-MM → la plata del mes tal como la muestra el dashboard (mes completo, todos los closers y por closer)
  const mesPedido = new URL(req.url).searchParams.get('metricas');
  if (mesPedido && /^\d{4}-\d{2}$/.test(mesPedido)) {
    const b = await getBundle();
    const f = { mes: mesPedido, dia: null, desde: null, hasta: null, closer: 'todos' as const, fuente: 'todas' as const };
    const m = metricasMes(b, f);
    return NextResponse.json({
      mes: mesPedido,
      facturacion: m.revenue, cash_collected: m.cash_collected, front_end: m.new_cash, back_end: m.old_cash, reembolsos: m.reembolsos,
      inversion_ads: m.inversion_ads, software: m.costo_software, comisiones: m.comisiones, comisiones_plataformas: m.comisiones_plataformas, ganancia: m.ganancia,
      ventas: m.ventas, agendas: m.agendas,
      closers: CLOSERS.map((c) => { const r = resumenCloser(b, f, c); return { closer: c, facturacion: r.revenue, cash_collected: r.cash, front_end: r.front_end, back_end: r.back_end, ventas: r.cierres, agendas: r.agendas }; }),
    });
  }

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
