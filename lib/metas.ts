import { metricasMes } from './metrics';
import { diasDelMes, mesDe } from './format';
import type { Filtros, RawBundle } from './types';

export interface ProgresoMeta {
  clave: 'revenue' | 'cash' | 'ventas' | 'agendas';
  label: string;
  esUsd: boolean;
  meta: number | null;
  actual: number;
  /** A este ritmo, cómo cierra el mes (null si el mes todavía no empezó). */
  proyeccion: number | null;
  /** proyeccion / meta */
  avance: number | null;
  estado: 'green' | 'yellow' | 'red' | null;
}

/**
 * Avance contra la meta del mes y proyección lineal a fin de mes.
 * El software es un costo fijo: no se proyecta, se descuenta una sola vez.
 */
export function progresoMetas(b: RawBundle, f: Filtros, hoy: string): { items: ProgresoMeta[]; transcurridos: number; dias: number; hayMetas: boolean } {
  const m = metricasMes(b, { mes: f.mes, dia: null, closer: 'todos', fuente: 'todas' });
  const ajuste = b.ajustes.find((a) => mesDe(a.mes) === f.mes);
  const dias = diasDelMes(f.mes).length;
  const mesHoy = mesDe(hoy);
  const transcurridos = f.mes < mesHoy ? dias : f.mes > mesHoy ? 0 : Number(hoy.slice(8, 10));
  const factor = transcurridos ? dias / transcurridos : null;
  const fijo = m.costo_software ?? 0;
  const proy = (v: number, conFijo = false) => (factor === null ? null : conFijo ? (v + fijo) * factor - fijo : v * factor);

  const base: Omit<ProgresoMeta, 'avance' | 'estado'>[] = [
    { clave: 'revenue', label: 'Facturación', esUsd: true, meta: ajuste?.meta_revenue ?? null, actual: m.revenue, proyeccion: proy(m.revenue) },
    { clave: 'cash', label: 'Cash Collected', esUsd: true, meta: ajuste?.meta_cash ?? null, actual: m.cash_collected, proyeccion: proy(m.cash_collected, true) },
    { clave: 'ventas', label: 'Ventas', esUsd: false, meta: ajuste?.meta_ventas ?? null, actual: m.ventas, proyeccion: proy(m.ventas) },
    { clave: 'agendas', label: 'Agendas', esUsd: false, meta: ajuste?.meta_agendas ?? null, actual: m.agendas, proyeccion: proy(m.agendas) },
  ];
  const items = base.map((x) => {
    const avance = x.meta && x.proyeccion !== null ? x.proyeccion / x.meta : null;
    const estado = avance === null ? null : avance >= 1 ? 'green' : avance >= 0.85 ? 'yellow' : 'red';
    return { ...x, avance, estado } as ProgresoMeta;
  });
  return { items, transcurridos, dias, hayMetas: items.some((i) => i.meta) };
}
