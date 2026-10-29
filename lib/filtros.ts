import type { Filtros } from './types';
import { CLOSERS, FUENTES } from './types';
import { MESES, diasDelMes, fechaLarga, hoyAR, mesAnterior, mesDe, nombreMes } from './format';

export type SearchParams = Record<string, string | string[] | undefined>;

const esFecha = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/**
 * Período: un día (dia), un rango dentro del mes (desde/hasta) o el mes entero (todo=1).
 * Sin nada en la URL, el mes en curso va del 1 hasta hoy y se corre solo cada día.
 */
export function leerFiltros(sp: SearchParams): Filtros {
  const hoy = hoyAR();
  let dia = esFecha(sp.dia) ? sp.dia : null;
  let desde = !dia && esFecha(sp.desde) ? sp.desde : null;
  let hasta = !dia && esFecha(sp.hasta) ? sp.hasta : null;
  const mes = dia ? dia.slice(0, 7) : desde ? desde.slice(0, 7) : hasta ? hasta.slice(0, 7) : typeof sp.mes === 'string' && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesDe(hoy);
  // El rango vale solo dentro del mes elegido
  if (desde && mesDe(desde) !== mes) desde = null;
  if (hasta && mesDe(hasta) !== mes) hasta = null;
  if (desde && hasta && desde > hasta) [desde, hasta] = [hasta, desde];
  if (desde && hasta && desde === hasta) { dia = desde; desde = hasta = null; }
  let rangoAuto = false;
  if (!dia && !desde && !hasta && sp.todo !== '1' && mes === mesDe(hoy)) {
    desde = `${mes}-01`;
    hasta = hoy;
    rangoAuto = true;
  }
  const closer = typeof sp.closer === 'string' && (CLOSERS as string[]).includes(sp.closer) ? (sp.closer as Filtros['closer']) : 'todos';
  const fuente = typeof sp.fuente === 'string' && (FUENTES as string[]).includes(sp.fuente) ? (sp.fuente as Filtros['fuente']) : 'todas';
  return { mes, dia, desde, hasta, rangoAuto, closer, fuente };
}

export function queryDe(f: Filtros): string {
  const p = new URLSearchParams();
  p.set('mes', f.mes);
  if (f.dia) p.set('dia', f.dia);
  else if (!f.rangoAuto && (f.desde || f.hasta)) {
    if (f.desde) p.set('desde', f.desde);
    if (f.hasta) p.set('hasta', f.hasta);
  } else if (!f.rangoAuto && f.mes === mesDe(hoyAR())) p.set('todo', '1');
  if (f.closer !== 'todos') p.set('closer', f.closer);
  if (f.fuente !== 'todas') p.set('fuente', f.fuente);
  return `?${p.toString()}`;
}

/** "Jueves 29 de octubre", "1 al 29 de octubre" u "Octubre 2026". */
export function etiquetaPeriodo(f: Filtros): string {
  if (f.dia) return fechaLarga(f.dia);
  if (f.desde || f.hasta) {
    const d = Number((f.desde ?? `${f.mes}-01`).slice(8, 10));
    const h = Number((f.hasta ?? diasDelMes(f.mes).slice(-1)[0]).slice(8, 10));
    return `${d} al ${h} de ${MESES[Number(f.mes.slice(5, 7)) - 1].toLowerCase()}`;
  }
  return nombreMes(f.mes);
}

/** Texto corto de contra qué se compara: "día anterior", "1–29 sep" o "mes anterior". */
export function etiquetaComparacion(f: Filtros): string {
  if (f.dia) return 'día anterior';
  const p = periodoAnterior(f);
  if (p.desde || p.hasta) {
    const d = Number((p.desde ?? `${p.mes}-01`).slice(8, 10));
    const h = Number((p.hasta ?? diasDelMes(p.mes).slice(-1)[0]).slice(8, 10));
    return `${d}–${h} ${MESES[Number(p.mes.slice(5, 7)) - 1].slice(0, 3).toLowerCase()}`;
  }
  return 'mes anterior';
}

/** El mismo período, un mes antes (para comparar parejo: 1 al 29 vs. 1 al 29). */
export function periodoAnterior(f: Filtros): Filtros {
  const prev = mesAnterior(f.mes);
  const ultimo = diasDelMes(prev).length;
  const mover = (fecha: string | null | undefined) => (fecha ? `${prev}-${String(Math.min(Number(fecha.slice(8, 10)), ultimo)).padStart(2, '0')}` : null);
  if (f.dia) {
    const d = new Date(`${f.dia}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    const ayer = d.toISOString().slice(0, 10);
    return { ...f, dia: ayer, mes: ayer.slice(0, 7), desde: null, hasta: null, rangoAuto: false };
  }
  return { ...f, mes: prev, desde: mover(f.desde), hasta: mover(f.hasta), rangoAuto: false };
}
