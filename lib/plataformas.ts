import type { Cobranza, ComisionPlataforma, PlataformaPago } from './types';
import { PLATAFORMAS } from './types';

function finDeMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  return `${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
}

export function tarifaVigente(config: ComisionPlataforma[], plataforma: PlataformaPago, mes: string): { porcentaje: number; fijo: number } | null {
  const fin = finDeMes(mes);
  const inicio = `${mes}-01`;
  const v = config
    .filter((c) => c.plataforma === plataforma && c.fecha_alta <= fin && (!c.fecha_baja || c.fecha_baja >= inicio))
    .sort((a, b) => b.fecha_alta.localeCompare(a.fecha_alta))[0];
  return v ? { porcentaje: Number(v.porcentaje), fijo: Number(v.fijo) } : null;
}

export interface FilaPlataforma {
  plataforma: PlataformaPago | 'Sin indicar';
  cobrado: number; // neto (incluye reembolsos)
  cantidad: number; // cobros positivos
  porcentaje: number | null;
  fijo: number | null;
  monto: number | null; // comisión; null si falta la tarifa
}

export interface PlataformasMes {
  total: number;
  filas: FilaPlataforma[];
  sinConfigurar: boolean;
  /** Plataformas con cobros pero sin tarifa cargada */
  faltan: string[];
}

/** Comisión = % × cobros positivos + fijo × cantidad de cobros. Los reembolsos no devuelven comisión. */
export function comisionesPlataformasDelMes(config: ComisionPlataforma[], cobranzasMes: Cobranza[], mes: string): PlataformasMes {
  const claves: (PlataformaPago | 'Sin indicar')[] = [...PLATAFORMAS, 'Sin indicar'];
  const filas = claves
    .map((p) => {
      const cobros = cobranzasMes.filter((c) => (c.plataforma ?? 'Sin indicar') === p);
      const positivos = cobros.filter((c) => Number(c.monto_cobrado) > 0);
      const bruto = positivos.reduce((s, c) => s + Number(c.monto_cobrado), 0);
      const tarifa = p === 'Sin indicar' ? null : tarifaVigente(config, p, mes);
      const monto = tarifa ? Math.round((bruto * tarifa.porcentaje / 100 + tarifa.fijo * positivos.length) * 100) / 100 : null;
      return {
        plataforma: p,
        cobrado: Math.round(cobros.reduce((s, c) => s + Number(c.monto_cobrado), 0) * 100) / 100,
        cantidad: positivos.length,
        porcentaje: tarifa?.porcentaje ?? null,
        fijo: tarifa?.fijo ?? null,
        monto,
      };
    })
    .filter((f) => f.cantidad > 0 || f.cobrado !== 0 || (f.plataforma !== 'Sin indicar' && f.porcentaje !== null));
  return {
    total: Math.round(filas.reduce((s, f) => s + (f.monto ?? 0), 0) * 100) / 100,
    filas,
    sinConfigurar: config.length === 0,
    faltan: filas.filter((f) => f.monto === null && f.cantidad > 0).map((f) => f.plataforma),
  };
}
