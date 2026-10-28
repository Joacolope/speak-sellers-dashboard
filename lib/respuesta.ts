import type { SetterDiario } from './types';

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
