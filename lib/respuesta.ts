import type { Filtros, RespuestaSemanal, SetterDiario } from './types';

/** Objetivo de velocidad de respuesta (minutos, mediana del día). Meta marca "muy responsivo" debajo de 15. */
export const OBJETIVO_RESPUESTA_MIN = 15;

/** Verde si cumple el objetivo, amarillo hasta el doble, rojo más arriba. */
export const colorRespuesta = (min: number | null) => (min === null ? '' : min <= OBJETIVO_RESPUESTA_MIN ? 'ok' : min <= OBJETIVO_RESPUESTA_MIN * 2 ? 'warn' : 'bad');

export function formatoEspera(min: number | null | undefined): string {
  if (min === null || min === undefined) return '—';
  if (min < 1) return '< 1 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Resumen de un conjunto de días: el último día medido y el promedio del período. */
export function resumenRespuesta(dias: SetterDiario[]) {
  const medidos = dias.filter((d) => d.tr_mediana_min != null).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultimo = medidos[medidos.length - 1] ?? null;
  const prom = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  return {
    ultimo,
    medianaPeriodo: prom(medidos.map((d) => d.tr_mediana_min!)),
    pctRapidasPeriodo: prom(medidos.filter((d) => d.pct_rapidas != null).map((d) => d.pct_rapidas!)),
    sinRespuestaPeriodo: medidos.reduce((s, d) => s + (d.sin_respuesta ?? 0), 0),
    dias: medidos.length,
  };
}

/** Lunes de la semana de una fecha (YYYY-MM-DD). */
export function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // lunes = 0
  return new Date(d.getTime() - dow * 86400000).toISOString().slice(0, 10);
}

/** "2 h", "2h 15", "2:15", "1,5 h", "45 min" o "135" (minutos) → minutos. null si no se entiende. */
export function aMinutos(txt: string | null | undefined): number | null {
  const t = (txt ?? '').toLowerCase().replace(',', '.').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d+):(\d{1,2})$/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = t.match(/^(\d+(?:\.\d+)?) ?(?:h|hs|hora|horas)(?: ?(\d+) ?(?:m|min|minutos)?)?$/))) return Math.round(Number(m[1]) * 60 + Number(m[2] ?? 0));
  if ((m = t.match(/^(\d+(?:\.\d+)?) ?(?:m|min|mins|minutos)?$/))) return Math.round(Number(m[1]));
  if ((m = t.match(/^(\d+(?:\.\d+)?) ?(?:d|dia|dias|día|días)$/))) return Math.round(Number(m[1]) * 1440);
  return null;
}

const finDe = (s: RespuestaSemanal) => s.hasta ?? new Date(Date.parse(`${s.semana}T12:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10);
const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000) + 1;

/** Días del período cargado que caen dentro del filtro, y su largo total. */
function solape(s: RespuestaSemanal, f: Filtros): { dias: number; largo: number } {
  const [y, mm] = f.mes.split('-').map(Number);
  const desde = f.dia ?? f.desde ?? `${f.mes}-01`;
  const hasta = f.dia ?? f.hasta ?? new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10);
  const ini = s.semana > desde ? s.semana : desde;
  const fin = finDe(s) < hasta ? finDe(s) : hasta;
  return { dias: fin >= ini ? diasEntre(ini, fin) : 0, largo: diasEntre(s.semana, finDe(s)) };
}

/**
 * Resumen de los períodos cargados desde Business Suite que tocan el filtro.
 * Promedios ponderados por conversaciones × parte del período que cae en el filtro;
 * los totales (conversaciones, contactos) se prorratean por días.
 */
export function resumenSemanal(semanas: RespuestaSemanal[], f: Filtros) {
  const dentro = semanas
    .map((s) => ({ ...s, hasta: finDe(s), ...solape(s, f) }))
    .filter((s) => s.dias > 0)
    .sort((a, b) => a.semana.localeCompare(b.semana));
  const frac = (s: (typeof dentro)[number]) => s.dias / s.largo;
  const pond = (k: 'tr_promedio_min' | 'pct_respuesta') => {
    const con = dentro.filter((s) => s[k] != null);
    const peso = (s: (typeof con)[number]) => (s.conversaciones ?? 1) * frac(s);
    const total = con.reduce((a, s) => a + peso(s), 0);
    return total ? con.reduce((a, s) => a + (s[k] as number) * peso(s), 0) / total : null;
  };
  const suma = (k: 'conversaciones' | 'contactos' | 'contactos_nuevos' | 'conv_organicas' | 'conv_pagadas') =>
    dentro.some((s) => s[k] != null) ? Math.round(dentro.reduce((a, s) => a + (s[k] ?? 0) * frac(s), 0)) : null;
  const ultima = dentro[dentro.length - 1] ?? null;
  const anterior = dentro.length > 1 ? dentro[dentro.length - 2] : null;
  return {
    semanas: dentro,
    promedio: pond('tr_promedio_min'),
    pctRespuesta: pond('pct_respuesta'),
    conversaciones: suma('conversaciones') ?? 0,
    contactos: suma('contactos'),
    contactosNuevos: suma('contactos_nuevos'),
    convOrganicas: suma('conv_organicas'),
    convPagadas: suma('conv_pagadas'),
    ultima,
    /** Cambio del último período contra el anterior (negativo = respondió más rápido) */
    cambio: ultima?.tr_promedio_min != null && anterior?.tr_promedio_min ? ultima.tr_promedio_min / anterior.tr_promedio_min - 1 : null,
  };
}
