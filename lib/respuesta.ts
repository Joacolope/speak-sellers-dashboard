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

/** Días de la semana (lunes a domingo) que caen dentro del período del filtro. */
function diasEnPeriodo(semana: string, f: Filtros): number {
  const desde = f.dia ?? f.desde ?? `${f.mes}-01`;
  const [y, mm] = f.mes.split('-').map(Number);
  const fin = new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10);
  const hasta = f.dia ?? f.hasta ?? fin;
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.parse(`${semana}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
    if (d >= desde && d <= hasta) n++;
  }
  return n;
}

/**
 * Resumen de las semanas cargadas desde Business Suite que tocan el período.
 * Fórmula: promedio del período = Σ(tiempo × conversaciones × días de la semana dentro del período) / Σ(conversaciones × días),
 * así una semana con más mensajes pesa más y una semana que cae mitad en otro mes pesa la mitad.
 */
export function resumenSemanal(semanas: RespuestaSemanal[], f: Filtros) {
  const dentro = semanas
    .map((s) => ({ ...s, dias: diasEnPeriodo(s.semana, f) }))
    .filter((s) => s.dias > 0)
    .sort((a, b) => a.semana.localeCompare(b.semana));
  const pond = (k: 'tr_promedio_min' | 'tr_horario_min' | 'pct_respuesta') => {
    const con = dentro.filter((s) => s[k] != null);
    const peso = (s: (typeof con)[number]) => (s.conversaciones ?? 1) * s.dias;
    const total = con.reduce((a, s) => a + peso(s), 0);
    return total ? con.reduce((a, s) => a + (s[k] as number) * peso(s), 0) / total : null;
  };
  const ultima = dentro[dentro.length - 1] ?? null;
  const anterior = dentro.length > 1 ? dentro[dentro.length - 2] : null;
  return {
    semanas: dentro,
    promedio: pond('tr_promedio_min'),
    horario: pond('tr_horario_min'),
    pctRespuesta: pond('pct_respuesta'),
    conversaciones: dentro.reduce((a, s) => a + Math.round(((s.conversaciones ?? 0) * s.dias) / 7), 0),
    ultima,
    /** Cambio de la última semana contra la anterior (negativo = respondió más rápido) */
    cambio: ultima?.tr_promedio_min != null && anterior?.tr_promedio_min ? ultima.tr_promedio_min / anterior.tr_promedio_min - 1 : null,
  };
}
