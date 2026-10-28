import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';
import { PLATAFORMAS } from '@/lib/types';

/**
 * Carga manual (formulario /cargar o Claude).
 * Acepta form-data (usuario editor con sesión de Google) o JSON con
 * "Authorization: Bearer $CARGA_API_TOKEN" (Claude / scripts).
 * Busca la agenda más reciente del lead por nombre (ilike). Si hay más de un lead, devuelve error.
 */
export async function POST(req: NextRequest) {
  const esForm = req.headers.get('content-type')?.includes('form');
  const data: Record<string, string> = {};
  // Errores de base de datos: no se devuelven al cliente (no filtrar estructura interna)
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

  const auth = await exigir('editor', { permitirToken: true });
  if (!auth.ok) return esForm ? volver({ error: auth.error }) : NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = supabase();

  // Webinar: no depende de un lead
  if (data.tipo === 'webinar') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.fecha ?? '')) return volver({ error: 'Falta la fecha del webinar' });
    const entero = (v: unknown) => (v === undefined || v === '' || v === null ? null : Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) < 1e6 ? Number(v) : NaN);
    const registrados = entero(data.registrados);
    const calificados = entero(data.registrados_calificados);
    const asistentes = entero(data.asistentes);
    if (Number.isNaN(registrados) || Number.isNaN(calificados) || Number.isNaN(asistentes)) return volver({ error: 'Registrados, calificados y asistentes tienen que ser números enteros' });
    if (registrados !== null && calificados !== null && calificados > registrados) return volver({ error: 'Los calificados no pueden ser más que los registrados' });
    const fila: Record<string, unknown> = { fecha: data.fecha, source: 'manual', editado_por: auth.quien };
    if (data.nombre_webinar) fila.nombre = String(data.nombre_webinar).slice(0, 120);
    if (registrados !== null) fila.registrados = registrados;
    if (calificados !== null) fila.registrados_calificados = calificados;
    if (asistentes !== null) fila.asistentes = asistentes;
    const { error } = await sb.from('webinars').upsert(fila, { onConflict: 'fecha' });
    if (error) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
    return volver({ ok: `Webinar ${data.fecha} · ${registrados ?? '—'} registrados · ${calificados ?? '—'} calificados · ${asistentes ?? '—'} asistentes` });
  }

  const nombre = (data.nombre ?? '').trim().slice(0, 120);
  if (!nombre) return volver({ error: 'Falta el nombre' });
  // ilike con comodines escapados: el nombre no puede inyectar patrones
  const patron = nombre.replace(/[\\%_]/g, (c) => `\\${c}`);

  const { data: leads, error: eLeads } = await sb.from('leads').select('id, nombre').ilike('nombre', `%${patron}%`);
  if (eLeads) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
  if (!leads?.length) return volver({ error: `No encontré ningún lead que se llame "${nombre}"` });
  if (leads.length > 1) return volver({ error: `Hay ${leads.length} leads que matchean "${nombre}": ${leads.map((l) => l.nombre).join(', ')}. Pasá el nombre completo.` });
  const lead = leads[0];

  const { data: agendas, error: eAg } = await sb.from('agendas').select('*').eq('lead_id', lead.id).order('fecha_llamada', { ascending: false }).limit(1);
  if (eAg) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
  const agenda = agendas?.[0];
  if (!agenda) return volver({ error: `${lead.nombre} no tiene agendas` });

  const plataforma = data.plataforma && (PLATAFORMAS as string[]).includes(data.plataforma) ? data.plataforma : null;
  if (data.plataforma && !plataforma) return volver({ error: 'Plataforma de cobro inválida' });
  const n = (v: string | number | undefined) => {
    if (v === undefined || v === '' || v === null) return null;
    const x = Number(v);
    return Number.isFinite(x) && Math.abs(x) < 1e7 ? x : null;
  };
  const ahora = new Date().toISOString();

  if (data.tipo === 'venta') {
    const compro = data.compro ?? 'Si';
    if (!['Si', 'No', 'Reserva'].includes(compro)) return volver({ error: 'Valor de compra inválido' });
    if (data.metodo_pago && !['PIF', 'Cuotas', 'Reserva'].includes(data.metodo_pago)) return volver({ error: 'Método inválido' });
    const patch = {
      asistio: 'Asistió',
      oferta_hecha: true,
      compro,
      metodo_pago: compro === 'No' ? null : data.metodo_pago ?? null,
      cash_collected: n(data.cash_collected),
      revenue: n(data.revenue) ?? n(data.cash_collected),
      producto: data.producto || null,
      source: 'manual',
      editado_por: auth.quien,
      updated_at: ahora,
    };
    const { error } = await sb.from('agendas').update(patch).eq('id', agenda.id);
    if (error) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
    if (patch.cash_collected && compro !== 'No') {
      await sb.from('cobranzas').insert({
        agenda_id: agenda.id,
        fecha_cobro: ahora.slice(0, 10),
        monto_cobrado: patch.cash_collected,
        pendiente: 0,
        cuotas_restantes: 0,
        closer: agenda.closer,
        es_reembolso: false,
        plataforma,
        source: 'manual',
        editado_por: auth.quien,
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
      plataforma,
      source: 'manual',
      editado_por: auth.quien,
      notas: data.notas ? String(data.notas).slice(0, 2000) : null,
    });
    if (error) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
    // Cash collected acumulado en la agenda
    const { data: cobs } = await sb.from('cobranzas').select('monto_cobrado').eq('agenda_id', agenda.id);
    const total = (cobs ?? []).reduce((s, c) => s + Number(c.monto_cobrado), 0);
    const patch: Record<string, unknown> = { cash_collected: total, source: 'manual', editado_por: auth.quien, updated_at: ahora };
    if (monto < 0 && total <= 0) patch.compro = 'No';
    await sb.from('agendas').update(patch).eq('id', agenda.id);
    return volver({ ok: `${lead.nombre} · ${monto} USD · acumulado ${total} USD` });
  }

  if (data.tipo === 'asistencia') {
    if (!['Asistió', 'No show', 'Canceló', 'Pendiente'].includes(data.asistio)) return volver({ error: 'Valor de asistencia inválido' });
    const patch: Record<string, unknown> = { asistio: data.asistio, source: 'manual', editado_por: auth.quien, updated_at: ahora };
    if (data.oferta_hecha) patch.oferta_hecha = data.oferta_hecha === 'true';
    if (data.closer && ['Marcos', 'Andrea', 'Gonzalo'].includes(data.closer)) patch.closer = data.closer;
    const { error } = await sb.from('agendas').update(patch).eq('id', agenda.id);
    if (error) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
    if (data.cualificacion_economica) {
      await sb.from('leads').update({ cualificacion_economica: n(data.cualificacion_economica), updated_at: ahora }).eq('id', lead.id);
    }
    return volver({ ok: `${lead.nombre} · ${data.asistio}` });
  }

  return volver({ error: `Tipo desconocido: ${data.tipo}` });
}
