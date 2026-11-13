import { cache } from 'react';
import { unstable_cache, revalidateTag } from 'next/cache';
import type { Agenda, Lead, RawBundle, UltimaActualizacion } from './types';
import { sampleBundle } from './sample';
import { supabase, supabaseConfigurado } from './supabase';
import { getSesion } from './auth';

/**
 * Trae todo lo que el dashboard necesita. Si Supabase no está configurado,
 * devuelve los datos de ejemplo de la spec (modo demo).
 */
export const getBundle = cache(async (): Promise<RawBundle> => {
  // Segunda barrera: aunque el middleware falle, sin sesión válida no se lee nada.
  const sesion = await getSesion();
  if (!sesion) throw new Error('No autorizado');
  // Datos de ejemplo solo en desarrollo local sin Supabase; publicado, siempre datos reales.
  if (!supabaseConfigurado()) return sampleBundle();
  return bundleEnCache();
});

/**
 * Los datos cambian pocas veces al día (cron de la mañana, cargas a mano): se guardan en la caché de Next
 * y no se vuelven a leer de Supabase en cada clic. Cada escritura llama a refrescarDatos() y la caché se
 * descarta al instante; igual vence sola a la hora por si algo cambió por fuera (SQL directo).
 */
const bundleEnCache = unstable_cache(() => cargarBundle(), ['bundle-v1'], { revalidate: 3600, tags: ['bundle'] });

/** Llamar después de cualquier escritura en la base para que el dashboard muestre lo nuevo al instante. */
export function refrescarDatos() {
  try {
    revalidateTag('bundle');
  } catch {
    // Fuera de un request de Next (scripts): no hay caché que refrescar
  }
}

/** Lectura sin sesión: solo para procesos del servidor ya autorizados (cron con CRON_SECRET). */
export async function cargarBundle(): Promise<RawBundle> {
  if (!supabaseConfigurado()) return sampleBundle();
  const sb = supabase();
  const desde = new Date();
  desde.setUTCMonth(desde.getUTCMonth() - 14);
  const desdeIso = desde.toISOString().slice(0, 10);

  const [leads, agendas, cobranzas, setter, ads, campanas, organico, piezas, ajustes, costos, comisiones, comPlat, webinars, log, semanal, angulos] = await Promise.all([
    sb.from('leads').select('*'),
    sb.from('agendas').select('*').eq('ignorada', false).gte('fecha_llamada', desdeIso),
    sb.from('cobranzas').select('*').gte('fecha_cobro', desdeIso),
    sb.from('setter_diario').select('*').gte('fecha', desdeIso),
    sb.from('ads_diario').select('*').gte('fecha', desdeIso),
    sb.from('campanas_meta').select('*'),
    sb.from('organico_diario').select('*').gte('fecha', desdeIso),
    sb.from('organico_piezas').select('*').gte('fecha', desdeIso),
    sb.from('ajustes_mensuales').select('*'),
    sb.from('costos').select('*').order('fecha_alta'),
    sb.from('comisiones').select('*').order('fecha_alta'),
    sb.from('comisiones_plataformas').select('*').order('fecha_alta'),
    sb.from('webinars').select('*').order('fecha'),
    sb.from('log_agente').select('*').order('fecha', { ascending: false }).limit(30),
    // Tabla nueva: si todavía no existe (antes de aplicar la migración), se sigue sin ella
    sb.from('respuesta_semanal').select('*').order('semana'),
    // Ídem: ángulos de marketing
    sb.from('angulos').select('*').order('updated_at', { ascending: false }),
  ]);

  const errores = [leads, agendas, cobranzas, setter, ads, campanas, organico, piezas, ajustes, costos, comisiones, comPlat, webinars, log].map((r) => r.error).filter(Boolean);
  if (errores.length) throw new Error(`Supabase: ${errores.map((e) => e!.message).join('; ')}`);

  const leadsById = new Map<string, Lead>((leads.data as Lead[]).map((l) => [l.id, l]));
  const agendasConLead: Agenda[] = (agendas.data as Agenda[]).map((a) => ({ ...a, lead: leadsById.get(a.lead_id) }));

  const logs = log.data as RawBundle['log'];
  const ultimo = (src: string) => logs.find((l) => l.source === src || (src === 'ghl' && l.resumen.startsWith('cron')))?.fecha ?? null;
  const actualizaciones: UltimaActualizacion[] = [
    { fuente: 'GHL', fecha: ultimo('ghl'), ok: !logs.some((l) => l.resumen.includes('GHL error')) },
    { fuente: 'Meta Ads', fecha: ultimo('meta'), ok: !logs.some((l) => l.resumen.includes('Meta error')) },
    { fuente: 'Instagram', fecha: ultimo('ig'), ok: !logs.some((l) => l.resumen.includes('IG error')) },
    { fuente: 'Agente', fecha: ultimo('agente'), ok: true },
  ];

  return {
    demo: false,
    leads: leads.data as Lead[],
    agendas: agendasConLead,
    cobranzas: cobranzas.data as RawBundle['cobranzas'],
    setter: (setter.data ?? []).map((s) => ({
      ...s,
      tr_mediana_min: s.tr_mediana_min == null ? null : Number(s.tr_mediana_min),
      tr_promedio_min: s.tr_promedio_min == null ? null : Number(s.tr_promedio_min),
      pct_rapidas: s.pct_rapidas == null ? null : Number(s.pct_rapidas),
    })) as RawBundle['setter'],
    ads: ads.data as RawBundle['ads'],
    campanas: (campanas.data ?? []).map((c) => ({
      ...c,
      presupuesto_diario: c.presupuesto_diario === null ? null : Number(c.presupuesto_diario),
      presupuesto_total: c.presupuesto_total === null ? null : Number(c.presupuesto_total),
      inversion_7d: c.inversion_7d === null ? null : Number(c.inversion_7d),
      inversion_mes: c.inversion_mes === null ? null : Number(c.inversion_mes),
    })) as RawBundle['campanas'],
    organico: organico.data as RawBundle['organico'],
    piezas: piezas.data as RawBundle['piezas'],
    ajustes: (ajustes.data ?? []).map((a) => ({
      ...a,
      meta_revenue: a.meta_revenue == null ? null : Number(a.meta_revenue),
      meta_cash: a.meta_cash == null ? null : Number(a.meta_cash),
    })) as RawBundle['ajustes'],
    costos: (costos.data ?? []).map((c) => ({ ...c, monto: Number(c.monto) })) as RawBundle['costos'],
    comisiones: (comisiones.data ?? []).map((c) => ({ ...c, porcentaje: Number(c.porcentaje) })) as RawBundle['comisiones'],
    webinars: (webinars.data ?? []) as RawBundle['webinars'],
    respuestaSemanal: (semanal.error ? [] : semanal.data ?? []).map((r) => ({
      ...r,
      tr_promedio_min: r.tr_promedio_min == null ? null : Number(r.tr_promedio_min),
      tr_horario_min: r.tr_horario_min == null ? null : Number(r.tr_horario_min),
      pct_respuesta: r.pct_respuesta == null ? null : Number(r.pct_respuesta),
    })) as RawBundle['respuestaSemanal'],
    comisionesPlataformas: (comPlat.data ?? []).map((c) => ({ ...c, porcentaje: Number(c.porcentaje), fijo: Number(c.fijo) })) as RawBundle['comisionesPlataformas'],
    angulos: (angulos.error ? [] : angulos.data ?? []).map((a) => ({ ...a, palabras_clave: a.palabras_clave ?? [] })) as RawBundle['angulos'],
    log: logs,
    actualizaciones,
  };
}
