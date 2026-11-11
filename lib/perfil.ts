import { esVenta } from './metrics';
import type { Agenda } from './types';

const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export const RANGOS = ['Menos de 1.000', '1.000 a 3.000', '3.000 a 5.000', '5.000 a 10.000', 'Más de 10.000'] as const;

/** Lleva lo que escribieron en "rango de comisiones" a un rango fijo ("1800", "2-3k" y "1.000 a 2.000" → "1.000 a 3.000"). */
export function rangoComisiones(v: string | null | undefined): string | null {
  if (!v?.trim()) return null;
  const t = sinTildes(v);
  if (t.includes('menos de')) return RANGOS[0];
  if (t.includes('mas de 10')) return RANGOS[4];
  const m = t.replace(/(\d)\.(\d{3})\b/g, '$1$2').match(/(\d+(?:[.,]\d+)?)\s*(k)?/);
  if (!m) return null;
  let n = Number(m[1].replace(',', '.'));
  // "2-3k" o "2.5 k": la k puede venir después del segundo número
  if (m[2] || (n < 100 && /\dk|\d\s+k\b/.test(t))) n *= 1000;
  if (!Number.isFinite(n)) return null;
  return n < 1000 ? RANGOS[0] : n < 3000 ? RANGOS[1] : n < 5000 ? RANGOS[2] : n < 10000 ? RANGOS[3] : RANGOS[4];
}

/** "Sí · Empresa X" → Closer en actividad; "No", "Nunca lo hice…" → Todavía no es closer. */
export function esCloser(v: string | null | undefined): string | null {
  if (!v?.trim()) return null;
  const t = sinTildes(v);
  if (/^si\b/.test(t)) return 'Closer en actividad';
  if (/^no\b|nunca|que no\b|busca|volviendo/.test(t)) return 'Todavía no es closer';
  return 'Otro (dueño, marca personal…)';
}

export interface FilaPerfil {
  segmento: string;
  agendas: number;
  presentadas: number;
  ventas: number;
  pctCierre: number | null;
  cash: number;
  ticket: number | null;
}

/** Agendas agrupadas por un rasgo del lead, con su tasa de cierre. "Sin dato" queda al final. */
export function tablaPerfil(agendas: Agenda[], rasgo: (a: Agenda) => string | null | undefined, orden?: readonly string[]): FilaPerfil[] {
  const grupos = new Map<string, Agenda[]>();
  for (const a of agendas) {
    const k = rasgo(a) || 'Sin dato';
    grupos.set(k, [...(grupos.get(k) ?? []), a]);
  }
  const filas = Array.from(grupos.entries()).map(([segmento, ag]) => {
    const presentadas = ag.filter((a) => a.asistio === 'Asistió').length;
    const ventas = ag.filter(esVenta);
    const cash = ventas.reduce((s, a) => s + (a.cash_collected ?? 0), 0);
    return { segmento, agendas: ag.length, presentadas, ventas: ventas.length, pctCierre: presentadas ? ventas.length / presentadas : null, cash, ticket: ventas.length ? cash / ventas.length : null };
  });
  const pos = (s: string) => (s === 'Sin dato' ? 999 : orden ? (orden.indexOf(s) < 0 ? 998 : orden.indexOf(s)) : 0);
  return filas.sort((x, y) => pos(x.segmento) - pos(y.segmento) || y.presentadas - x.presentadas || x.segmento.localeCompare(y.segmento));
}
