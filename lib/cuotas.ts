import type { Closer, RawBundle } from './types';
import { sumarDias } from './format';

export interface CuotaPendiente {
  agenda_id: string;
  nombre: string;
  closer: Closer;
  monto: number;
  vence: string; // YYYY-MM-DD
  cuotas_restantes: number | null;
  /** Días hasta el vencimiento (negativo = vencida hace N días). */
  dias: number;
}

/**
 * Lo que falta cobrar, venta por venta. Cada cobro guarda cuánto quedaba pendiente
 * en ese momento, así que manda el último cobro de cada venta.
 */
export function cuotasPorCobrar(b: RawBundle, hoy: string): { vencidas: CuotaPendiente[]; semana: CuotaPendiente[]; proximas: CuotaPendiente[] } {
  const ultimo = new Map<string, RawBundle['cobranzas'][number]>();
  for (const c of b.cobranzas) {
    if (c.es_reembolso) continue;
    const prev = ultimo.get(c.agenda_id);
    if (!prev || c.fecha_cobro >= prev.fecha_cobro) ultimo.set(c.agenda_id, c);
  }
  const reembolsadas = new Set(b.cobranzas.filter((c) => c.es_reembolso).map((c) => c.agenda_id));
  const enSiete = sumarDias(hoy, 7);
  const out = { vencidas: [] as CuotaPendiente[], semana: [] as CuotaPendiente[], proximas: [] as CuotaPendiente[] };
  for (const c of ultimo.values()) {
    if (!c.pendiente || c.pendiente <= 0 || !c.proximo_vencimiento || reembolsadas.has(c.agenda_id)) continue;
    const ag = b.agendas.find((a) => a.id === c.agenda_id);
    const fila: CuotaPendiente = {
      agenda_id: c.agenda_id,
      nombre: ag?.lead?.nombre ?? 'Sin nombre',
      closer: c.closer,
      monto: c.pendiente,
      vence: c.proximo_vencimiento,
      cuotas_restantes: c.cuotas_restantes ?? null,
      dias: Math.round((Date.parse(c.proximo_vencimiento) - Date.parse(hoy)) / 86400000),
    };
    if (fila.vence < hoy) out.vencidas.push(fila);
    else if (fila.vence <= enSiete) out.semana.push(fila);
    else out.proximas.push(fila);
  }
  const porFecha = (x: CuotaPendiente, y: CuotaPendiente) => x.vence.localeCompare(y.vence);
  out.vencidas.sort(porFecha);
  out.semana.sort(porFecha);
  out.proximas.sort(porFecha);
  return out;
}

export const totalCuotas = (filas: CuotaPendiente[]) => filas.reduce((s, c) => s + c.monto, 0);
