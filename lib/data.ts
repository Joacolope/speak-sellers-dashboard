import { cache } from 'react';
import { cookies } from 'next/headers';
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
  // Vista de ejemplo: la activa el usuario desde la barra (cookie). Nunca mezcla datos reales.
  if (!supabaseConfigurado() || cookies().get('ss_demo')?.value === '1') return sampleBundle();

  const sb = supabase();
  const desde = new Date();
  desde.setUTCMonth(desde.getUTCMonth() - 14);
  const desdeIso = desde.toISOString().slice(0, 10);

  const [leads, agendas, cobranzas, setter, ads, organico, piezas, ajustes, costos, comisiones, log] = await Promise.all([
    sb.from('leads').select('*'),
    sb.from('agendas').select('*').gte('fecha_llamada', desdeIso),
    sb.from('cobranzas').select('*').gte('fecha_cobro', desdeIso),
    sb.from('setter_diario').select('*').gte('fecha', desdeIso),
    sb.from('ads_diario').select('*').gte('fecha', desdeIso),
    sb.from('organico_diario').select('*').gte('fecha', desdeIso),
    sb.from('organico_piezas').select('*').gte('fecha', desdeIso),
    sb.from('ajustes_mensuales').select('*'),
    sb.from('costos').select('*').order('fecha_alta'),
    sb.from('comisiones').select('*').order('fecha_alta'),
    sb.from('log_agente').select('*').order('fecha', { ascending: false }).limit(30),
  ]);

  const errores = [leads, agendas, cobranzas, setter, ads, organico, piezas, ajustes, costos, comisiones, log].map((r) => r.error).filter(Boolean);
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
    setter: setter.data as RawBundle['setter'],
    ads: ads.data as RawBundle['ads'],
    organico: organico.data as RawBundle['organico'],
    piezas: piezas.data as RawBundle['piezas'],
    ajustes: ajustes.data as RawBundle['ajustes'],
    costos: (costos.data ?? []).map((c) => ({ ...c, monto: Number(c.monto) })) as RawBundle['costos'],
    comisiones: (comisiones.data ?? []).map((c) => ({ ...c, porcentaje: Number(c.porcentaje) })) as RawBundle['comisiones'],
    log: logs,
    actualizaciones,
  };
});
