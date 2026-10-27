import { NextResponse, type NextRequest } from 'next/server';
import { supabase, supabaseConfigurado } from '@/lib/supabase';

/**
 * Carga manual (formulario /cargar o Claude vía fetch).
 * Acepta form-data o JSON. Protegido con PIN_CARGA.
 * Busca la agenda más reciente del lead por nombre (ilike). Si hay más de un lead, devuelve error.
 */
export async function POST(req: NextRequest) {
  const esForm = req.headers.get('content-type')?.includes('form');
  const data: Record<string, string> = {};
  if (esForm) {
    const fd = await req.formData();
    fd.forEach((v, k) => (data[k] = String(v)));
  } else {
    Object.assign(data, await req.json());
  }
  const volver = (q: Record<string, string>) => {
    if (!esForm) return NextResponse.json(q, { status: q.error ? 400 : 200 });
    const url = new URL('/cargar', req.url);
    for (const [k, v] of Object.entries(q)) url.searchParams.set(k, v);
    return NextResponse.redirect(url, 303);
  };

  if (!process.env.PIN_CARGA || data.pin !== process.env.PIN_CARGA) return volver({ error: 'PIN incorrecto' });
  if (!supabaseConfigurado()) return volver({ error: 'Modo demo: Supabase no está configurado' });

  const sb = supabase();
  const nombre = (data.nombre ?? '').trim();
  if (!nombre) return volver({ error: 'Falta el nombre' });

  const { data: leads, error: eLeads } = await sb.from('leads').select('id, nombre').ilike('nombre', `%${nombre}%`);
  if (eLeads) return volver({ error: eLeads.message });
  if (!leads?.length) return volver({ error: `No encontré ningún lead que se llame "${nombre}"` });
  if (leads.length > 1) return volver({ error: `Hay ${leads.length} leads que matchean "${nombre}": ${leads.map((l) => l.nombre).join(', ')}. Pasá el nombre completo.` });
  const lead = leads[0];

  const { data: agendas, error: eAg } = await sb.from('agendas').select('*').eq('lead_id', lead.id).order('fecha_llamada', { ascending: false }).limit(1);
  if (eAg) return volver({ error: eAg.message });
  const agenda = agendas?.[0];
  if (!agenda) return volver({ error: `${lead.nombre} no tiene agendas` });

  const n = (v: string | undefined) => (v === undefined || v === '' ? null : Number(v));
  const ahora = new Date().toISOString();

  if (data.tipo === 'venta') {
    const compro = data.compro ?? 'Si';
    const patch = {
      asistio: 'Asistió',
      oferta_hecha: true,
      compro,
      metodo_pago: compro === 'No' ? null : data.metodo_pago ?? null,
      cash_collected: n(data.cash_collected),
      revenue: n(data.revenue) ?? n(data.cash_collected),
      producto: data.producto || null,
      source: 'manual',
      updated_at: ahora,
    };
    const { error } = await sb.from('agendas').update(patch).eq('id', agenda.id);
    if (error) return volver({ error: error.message });
    if (patch.cash_collected && compro !== 'No') {
      await sb.from('cobranzas').insert({
        agenda_id: agenda.id,
        fecha_cobro: ahora.slice(0, 10),
        monto_cobrado: patch.cash_collected,
        pendiente: 0,
        cuotas_restantes: 0,
        closer: agenda.closer,
        es_reembolso: false,
        source: 'manual',
      });
    }
    return volver({ ok: `${lead.nombre} · ${compro} · ${patch.cash_collected ?? 0} USD` });
  }

  if (data.tipo === 'cobranza') {
    const monto = n(data.monto_cobrado);
    if (monto === null) return volver({ error: 'Falta el monto' });
    const { error } = await sb.from('cobranzas').insert({
      agenda_id: agenda.id,
      fecha_cobro: data.fecha_cobro || ahora.slice(0, 10),
      monto_cobrado: monto,
      pendiente: n(data.pendiente),
      cuotas_restantes: n(data.cuotas_restantes),
      proximo_vencimiento: data.proximo_vencimiento || null,
      closer: agenda.closer,
      es_reembolso: monto < 0,
      source: 'manual',
      notas: data.notas || null,
    });
    if (error) return volver({ error: error.message });
    // Cash collected acumulado en la agenda
    const { data: cobs } = await sb.from('cobranzas').select('monto_cobrado').eq('agenda_id', agenda.id);
    const total = (cobs ?? []).reduce((s, c) => s + Number(c.monto_cobrado), 0);
    const patch: Record<string, unknown> = { cash_collected: total, source: 'manual', updated_at: ahora };
    if (monto < 0 && total <= 0) patch.compro = 'No';
    await sb.from('agendas').update(patch).eq('id', agenda.id);
    return volver({ ok: `${lead.nombre} · ${monto} USD · acumulado ${total} USD` });
  }

  if (data.tipo === 'asistencia') {
    const patch: Record<string, unknown> = { asistio: data.asistio, source: 'manual', updated_at: ahora };
    if (data.oferta_hecha) patch.oferta_hecha = data.oferta_hecha === 'true';
    if (data.closer) patch.closer = data.closer;
    const { error } = await sb.from('agendas').update(patch).eq('id', agenda.id);
    if (error) return volver({ error: error.message });
    if (data.cualificacion_economica) {
      await sb.from('leads').update({ cualificacion_economica: n(data.cualificacion_economica), updated_at: ahora }).eq('id', lead.id);
    }
    return volver({ ok: `${lead.nombre} · ${data.asistio}` });
  }

  return volver({ error: `Tipo desconocido: ${data.tipo}` });
}
