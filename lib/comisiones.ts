import type { Closer, Cobranza, Comision } from './types';
import { CLOSERS } from './types';

function finDeMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  return `${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
}

/** % vigente para un closer en un mes (el último que empezó antes de fin de mes). null = sin cargar. */
export function porcentajeVigente(comisiones: Comision[], closer: Closer, mes: string): number | null {
  const fin = finDeMes(mes);
  const inicio = `${mes}-01`;
  const vigentes = comisiones
    .filter((c) => c.closer === closer && c.fecha_alta <= fin && (!c.fecha_baja || c.fecha_baja >= inicio))
    .sort((a, b) => b.fecha_alta.localeCompare(a.fecha_alta));
  return vigentes.length ? Number(vigentes[0].porcentaje) : null;
}

export interface ComisionCloser {
  closer: Closer;
  porcentaje: number | null;
  base: number; // cobrado neto del mes
  monto: number | null; // null si falta el %
}

export interface ComisionesMes {
  total: number;
  porCloser: ComisionCloser[];
  /** Closers que cobraron algo este mes y no tienen % cargado */
  faltan: Closer[];
  /** true si todavía no se cargó ningún % (para mostrar "falta cargar") */
  sinConfigurar: boolean;
}

/** Comisión = % vigente × lo cobrado en el mes por ese closer (neto de reembolsos). */
export function comisionesDelMes(comisiones: Comision[], cobranzasMes: Cobranza[], mes: string, soloCloser?: Closer): ComisionesMes {
  const closers = soloCloser ? [soloCloser] : CLOSERS;
  const porCloser = closers.map((closer) => {
    const base = Math.round(cobranzasMes.filter((c) => c.closer === closer).reduce((s, c) => s + Number(c.monto_cobrado), 0) * 100) / 100;
    const porcentaje = porcentajeVigente(comisiones, closer, mes);
    const monto = porcentaje === null ? null : Math.round(base * porcentaje) / 100;
    return { closer, porcentaje, base, monto };
  });
  return {
    total: Math.round(porCloser.reduce((s, c) => s + (c.monto ?? 0), 0) * 100) / 100,
    porCloser,
    faltan: porCloser.filter((c) => c.porcentaje === null && c.base !== 0).map((c) => c.closer),
    sinConfigurar: comisiones.length === 0,
  };
}
