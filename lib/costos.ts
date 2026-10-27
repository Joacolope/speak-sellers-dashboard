import type { Costo } from './types';

function finDeMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${mes}-${String(d).padStart(2, '0')}`;
}

/** Lo que pesa un costo en un mes dado (USD). 0 si no estaba activo. */
export function montoEnMes(c: Costo, mes: string): number {
  const inicio = `${mes}-01`;
  const fin = finDeMes(mes);
  if (c.frecuencia === 'Único') return c.fecha_alta.slice(0, 7) === mes ? Number(c.monto) : 0;
  if (c.fecha_alta > fin) return 0;
  if (c.fecha_baja && c.fecha_baja < inicio) return 0;
  return c.frecuencia === 'Anual' ? Number(c.monto) / 12 : Number(c.monto);
}

/** Equivalente mensual (para mostrar en la tabla). */
export function equivalenteMensual(c: Costo): number {
  if (c.frecuencia === 'Anual') return Number(c.monto) / 12;
  return Number(c.monto);
}

export function activoEn(c: Costo, mes: string): boolean {
  return montoEnMes(c, mes) > 0 || (c.frecuencia !== 'Único' && Number(c.monto) === 0 && c.fecha_alta <= finDeMes(mes) && (!c.fecha_baja || c.fecha_baja >= `${mes}-01`));
}

export interface CostosMes {
  total: number;
  items: { costo: Costo; monto: number }[];
  porCategoria: { categoria: string; monto: number }[];
}

export function costosDelMes(costos: Costo[], mes: string): CostosMes {
  const items = costos.filter((c) => activoEn(c, mes)).map((c) => ({ costo: c, monto: montoEnMes(c, mes) })).sort((a, b) => b.monto - a.monto);
  const cat = new Map<string, number>();
  for (const it of items) cat.set(it.costo.categoria, (cat.get(it.costo.categoria) ?? 0) + it.monto);
  return {
    total: Math.round(items.reduce((s, it) => s + it.monto, 0) * 100) / 100,
    items,
    porCategoria: Array.from(cat.entries()).map(([categoria, monto]) => ({ categoria, monto: Math.round(monto * 100) / 100 })).sort((a, b) => b.monto - a.monto),
  };
}
