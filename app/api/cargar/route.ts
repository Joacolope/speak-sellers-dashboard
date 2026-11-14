import { NextResponse, type NextRequest } from 'next/server';
import { refrescarDatos } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';
import { CLOSERS, PLATAFORMAS } from '@/lib/types';
import { paisPorPrefijo } from '@/lib/sync/ghl';

const FUENTES = ['Instagram', 'WhatsApp', 'Webinar', 'YouTube', 'Referido', 'Otro'];
const CLOSERS_OK: string[] = CLOSERS;
const esFecha = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const sumarDias = (f: string, d: number) => new Date(Date.parse(`${f}T12:00:00Z`) + d * 86400000).toISOString().slice(0, 10);

/**
 * Carga manual (formulario /cargar o Claude).
 * Acepta form-data (usuario editor con sesión de Google) o JSON con
 * "Authorization: Bearer $CARGA_API_TOKEN" (Claude / scripts).
 * Busca el lead por nombre (ilike). Si hay más de un lead, devuelve error.
 * Con "fecha" (AAAA-MM-DD) usa la agenda de ±3 días de esa fecha; sin fecha, la más reciente.
 * Venta con "crear": true crea el lead y/o la agenda si no existen (pide closer).
 * Un cobro igual (misma agenda, fecha y monto) no se carga dos veces.
 * "fathom_url" guarda el link de la grabación en la llamada (solo eso con tipo "fathom").
 */
async function manejarPOST(req: NextRequest) {
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
    if (data.presupuesto !== undefined && String(data.presupuesto) !== '') {
      const p = Number(data.presupuesto);
      if (!Number.isFinite(p) || p < 0 || p > 1e7) return volver({ error: 'Presupuesto inválido' });
      fila.presupuesto = p;
    }
    if (data.notas) fila.notas = String(data.notas).slice(0, 2000);
    const { error } = await sb.from('webinars').upsert(fila, { onConflict: 'fecha' });
    if (error) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
    return volver({ ok: `Webinar ${data.fecha} · ${registrados ?? '—'} registrados · ${calificados ?? '—'} calificados · ${asistentes ?? '—'} asistentes${fila.presupuesto !== undefined ? ` · presupuesto ${fila.presupuesto} USD` : ''}` });
  }

  const nombre = (data.nombre ?? '').trim().slice(0, 120);
  if (!nombre) return volver({ error: 'Falta el nombre' });
  // ilike con comodines escapados: el nombre no puede inyectar patrones
  const patron = nombre.replace(/[\\%_]/g, (c) => `\\${c}`);

  const crear = String(data.crear) === 'true' && data.tipo === 'venta';
  const fecha = esFecha(data.fecha) ? data.fecha : null;
  if (data.fecha && !fecha) return volver({ error: 'La fecha tiene que ser AAAA-MM-DD' });
  const closerNuevo = CLOSERS_OK.includes(String(data.closer)) ? String(data.closer) : null;
  const notasTxt = data.notas ? String(data.notas).slice(0, 2000) : null;
  const juntarNotas = (previas: string | null | undefined, nuevas: string | null) =>
    !nuevas ? previas ?? null : previas && previas.includes(nuevas) ? previas : [previas, nuevas].filter(Boolean).join(' · ');

  const { data: leads, error: eLeads } = await sb.from('leads').select('id, nombre, notas, fuente, pais').ilike('nombre', `%${patron}%`);
  if (eLeads) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
  if (leads && leads.length > 1) return volver({ error: `Hay ${leads.length} leads que matchean "${nombre}": ${leads.map((l) => l.nombre).join(', ')}. Pasá el nombre completo.` });
  let lead = leads?.[0];
  const fuente = FUENTES.includes(String(data.fuente)) ? String(data.fuente) : null;
  const pais = paisPorPrefijo(data.telefono ? String(data.telefono) : null);
  if (!lead) {
    if (!crear) return volver({ error: `No encontré ningún lead que se llame "${nombre}"` });
    if (!closerNuevo || !fecha) return volver({ error: 'Para crear el lead hacen falta closer y fecha' });
    const { data: nuevo, error } = await sb.from('leads')
      .insert({ nombre, fuente, pais, notas: notasTxt, source: 'manual', editado_por: auth.quien })
      .select('id, nombre, notas, fuente, pais').single();
    if (error || !nuevo) return volver({ error: 'No se pudo crear el lead.' });
    lead = nuevo;
  } else if (crear && (notasTxt || fuente || pais)) {
    await sb.from('leads').update({
      notas: juntarNotas(lead.notas, notasTxt), fuente: lead.fuente ?? fuente, pais: lead.pais ?? pais, updated_at: new Date().toISOString(),
    }).eq('id', lead.id);
  }

  // Link de la conversación de ManyChat: se guarda en el lead (sirve para ver de dónde vino la venta)
  if (data.manychat_url) {
    const many = /^https:\/\/app\.manychat\.com\/fb\d+\/chat\/\d+/.exec(String(data.manychat_url).trim())?.[0];
    if (!many) return volver({ error: 'El link de ManyChat tiene que ser https://app.manychat.com/fb.../chat/...' });
    await sb.from('leads').update({ manychat_url: many, updated_at: new Date().toISOString() }).eq('id', lead.id);
  }

  let q = sb.from('agendas').select('*').eq('lead_id', lead.id).eq('ignorada', false);
  if (fecha) q = q.gte('fecha_llamada', `${sumarDias(fecha, -3)}T00:00:00-03:00`).lte('fecha_llamada', `${sumarDias(fecha, 3)}T23:59:59-03:00`);
  const { data: agendas, error: eAg } = await q.order('fecha_llamada', { ascending: false }).limit(1);
  if (eAg) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
  let agenda = agendas?.[0];
  if (!agenda && fecha && !crear) {
    // Sin agenda cerca de esa fecha: se usa la más reciente (ej.: una cuota de una venta vieja)
    const { data: ult } = await sb.from('agendas').select('*').eq('lead_id', lead.id).eq('ignorada', false).order('fecha_llamada', { ascending: false }).limit(1);
    agenda = ult?.[0];
  }
  if (!agenda && crear) {
    if (!closerNuevo || !fecha) return volver({ error: 'Para crear la llamada hacen falta closer y fecha' });
    const { data: nueva, error } = await sb.from('agendas')
      .insert({ lead_id: lead.id, closer: closerNuevo, fecha_llamada: `${fecha}T19:00:00-03:00`, asistio: 'Asistió', source: 'manual', notas: notasTxt, editado_por: auth.quien })
      .select('*').single();
    if (error || !nueva) return volver({ error: 'No se pudo crear la llamada.' });
    agenda = nueva;
  }
  if (!agenda) return volver({ error: `${lead.nombre} no tiene agendas` });

  // Link a la grabación de la llamada (Fathom): se guarda en la llamada. Con tipo "fathom" no se toca nada más.
  if (data.fathom_url) {
    const fathom = /^https:\/\/([a-z0-9-]+\.)?fathom\.video\/\S+$/i.test(String(data.fathom_url).trim()) ? String(data.fathom_url).trim().slice(0, 300) : null;
    if (!fathom) return volver({ error: 'El link de Fathom tiene que ser https://fathom.video/...' });
    const { error } = await sb.from('agendas').update({ fathom_url: fathom, updated_at: new Date().toISOString() }).eq('id', agenda.id);
    if (error) return volver({ error: 'No se pudo guardar el link de Fathom.' });
    if (data.tipo === 'fathom') return volver({ ok: `${lead.nombre} · link de la llamada guardado` });
  } else if (data.tipo === 'fathom') return volver({ error: 'Falta el link de Fathom' });

  /** true si ya hay un cobro igual (para no duplicar si se carga dos veces lo mismo) */
  const cobroRepetido = async (fechaCobro: string, monto: number) => {
    const { data: igual } = await sb.from('cobranzas').select('id').eq('agenda_id', agenda.id).eq('fecha_cobro', fechaCobro).eq('monto_cobrado', monto).limit(1);
    return Boolean(igual?.length);
  };

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
      // "Renovación" o "Upsell": cuenta como back end. Sin indicar, se deduce sola.
      ...(['Nueva', 'Renovación', 'Upsell'].includes(String(data.tipo_venta)) ? { tipo_venta: String(data.tipo_venta) } : {}),
      notas: juntarNotas(agenda.notas, notasTxt),
      source: 'manual',
      editado_por: auth.quien,
      updated_at: ahora,
    };
    const { error } = await sb.from('agendas').update(patch).eq('id', agenda.id);
    if (error) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
    const fechaCobro = fecha ?? ahora.slice(0, 10);
    if (patch.cash_collected && compro !== 'No' && !(await cobroRepetido(fechaCobro, patch.cash_collected))) {
      await sb.from('cobranzas').insert({
        agenda_id: agenda.id,
        fecha_cobro: fechaCobro,
        monto_cobrado: patch.cash_collected,
        // Lo que falta del valor total queda como pendiente (no cuenta en facturación hasta cobrarse)
        pendiente: Math.max(0, Number(patch.revenue ?? 0) - Number(patch.cash_collected)),
        cuotas_restantes: Number(patch.revenue ?? 0) > Number(patch.cash_collected) ? 1 : 0,
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
    const fechaCobro = esFecha(data.fecha_cobro) ? data.fecha_cobro : ahora.slice(0, 10);
    if (await cobroRepetido(fechaCobro, monto)) return volver({ ok: `${lead.nombre} · ese cobro ya estaba cargado` });
    const { error } = await sb.from('cobranzas').insert({
      agenda_id: agenda.id,
      fecha_cobro: fechaCobro,
      monto_cobrado: monto,
      pendiente: n(data.pendiente),
      cuotas_restantes: n(data.cuotas_restantes),
      proximo_vencimiento: data.proximo_vencimiento || null,
      closer: agenda.closer,
      comision_setter: n(data.comision_setter),
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
    if (data.closer && CLOSERS_OK.includes(data.closer)) patch.closer = data.closer;
    const { error } = await sb.from('agendas').update(patch).eq('id', agenda.id);
    if (error) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
    if (data.cualificacion_economica) {
      await sb.from('leads').update({ cualificacion_economica: n(data.cualificacion_economica), updated_at: ahora }).eq('id', lead.id);
    }
    return volver({ ok: `${lead.nombre} · ${data.asistio}` });
  }

  return volver({ error: `Tipo desconocido: ${data.tipo}` });
}

/** Después de escribir se descarta la caché de datos, así el dashboard muestra lo nuevo al instante. */
export async function POST(...args: Parameters<typeof manejarPOST>) {
  const res = await manejarPOST(...args);
  refrescarDatos();
  return res;
}
