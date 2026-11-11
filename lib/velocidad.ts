import { esVenta } from './metrics';
import { origenSinUtm, type Origen } from './origen';
import type { Agenda } from './types';

const DIA = 86400000;
const dias = (desde: string | null | undefined, hasta: string | null | undefined): number | null => {
  if (!desde || !hasta) return null;
  const d = (Date.parse(hasta) - Date.parse(desde)) / DIA;
  return Number.isFinite(d) && d >= 0 ? d : null;
};
export const mediana = (v: number[]): number | null => {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  return o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2;
};

export interface Tramo { mediana: number | null; n: number }
export interface Velocidad {
  /** Del primer DM (alta en ManyChat) a que agenda */
  dmAAgenda: Tramo;
  /** De que agenda a la llamada */
  agendaALlamada: Tramo;
  /** Del primer DM a la llamada donde compró (solo ventas) */
  dmACompra: Tramo;
}

const tramo = (v: (number | null)[]): Tramo => {
  const ok = v.filter((x): x is number => x !== null);
  return { mediana: mediana(ok), n: ok.length };
};

export function velocidad(agendas: Agenda[]): Velocidad {
  return {
    dmAAgenda: tramo(agendas.map((a) => dias(a.lead?.manychat_desde, a.fecha_agendada))),
    agendaALlamada: tramo(agendas.map((a) => dias(a.fecha_agendada, a.fecha_llamada))),
    dmACompra: tramo(agendas.filter(esVenta).map((a) => dias(a.lead?.manychat_desde, a.fecha_llamada))),
  };
}

export function velocidadPorOrigen(agendas: Agenda[]): { origen: Origen; agendas: number; ventas: number; v: Velocidad }[] {
  const grupos = new Map<Origen, Agenda[]>();
  for (const a of agendas) {
    const o = origenSinUtm(a);
    grupos.set(o, [...(grupos.get(o) ?? []), a]);
  }
  return Array.from(grupos.entries())
    .map(([origen, ag]) => ({ origen, agendas: ag.length, ventas: ag.filter(esVenta).length, v: velocidad(ag) }))
    .sort((x, y) => y.ventas - x.ventas || y.agendas - x.agendas);
}

/** Cuánto tardaron en comprar desde el primer DM, en tramos. */
export function tramosDeCompra(agendas: Agenda[]): { label: string; n: number }[] {
  const d = agendas.filter(esVenta).map((a) => dias(a.lead?.manychat_desde, a.fecha_llamada)).filter((x): x is number => x !== null);
  return [
    { label: 'Hasta 1 semana', n: d.filter((x) => x <= 7).length },
    { label: '1 semana a 1 mes', n: d.filter((x) => x > 7 && x <= 30).length },
    { label: '1 a 3 meses', n: d.filter((x) => x > 30 && x <= 90).length },
    { label: 'Más de 3 meses', n: d.filter((x) => x > 90).length },
  ];
}

/** "3 días", "2 meses": para mostrar una mediana. */
export function enPalabras(d: number | null): string {
  if (d === null) return '—';
  if (d < 1) return 'el mismo día';
  if (d < 45) return `${Math.round(d)} día${Math.round(d) === 1 ? '' : 's'}`;
  const m = Math.round(d / 30.4);
  return m < 12 ? `${m} meses` : `${(d / 365).toFixed(1).replace('.', ',')} años`;
}
