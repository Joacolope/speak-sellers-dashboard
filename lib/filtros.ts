import type { Filtros } from './types';
import { CLOSERS, FUENTES } from './types';
import { mesActual } from './format';

export type SearchParams = Record<string, string | string[] | undefined>;

export function leerFiltros(sp: SearchParams): Filtros {
  const dia = typeof sp.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) && !Number.isNaN(Date.parse(sp.dia)) ? sp.dia : null;
  const mes = dia ? dia.slice(0, 7) : typeof sp.mes === 'string' && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesActual();
  const closer = typeof sp.closer === 'string' && (CLOSERS as string[]).includes(sp.closer) ? (sp.closer as Filtros['closer']) : 'todos';
  const fuente = typeof sp.fuente === 'string' && (FUENTES as string[]).includes(sp.fuente) ? (sp.fuente as Filtros['fuente']) : 'todas';
  return { mes, dia, closer, fuente };
}

export function queryDe(f: Filtros): string {
  const p = new URLSearchParams();
  p.set('mes', f.mes);
  if (f.dia) p.set('dia', f.dia);
  if (f.closer !== 'todos') p.set('closer', f.closer);
  if (f.fuente !== 'todas') p.set('fuente', f.fuente);
  return `?${p.toString()}`;
}
