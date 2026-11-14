import type { Closer, RawBundle } from './types';
import { sumarDias } from './format';

export interface CuotaPendiente {
  agenda_id: string;
  /** El cobro que guarda el saldo (el último de la venta): ahí se editan la fecha, el responsable y el seguimiento */
  cobranza_id: string;
  nombre: string;
  closer: Closer;
  monto: number;
  /** YYYY-MM-DD. Vacío si todavía no se acordó la fecha del próximo pago. */
  vence: string;
  cuotas_restantes: number | null;
  /** Días hasta el vencimiento (negativo = vencida hace N días). null si no tiene fecha. */
  dias: number | null;
  /** "Seña": dejó una reserva y falta completar la venta. "Cuota": compró en cuotas. */
  tipo: 'Seña' | 'Cuota';
  /** Quién le hace el seguimiento (si no se cargó, el closer de la venta) */
  responsable: string | null;
  ultimo_contacto: string | null;
  /** Días desde el último contacto (null = nunca se anotó uno) */
  dias_sin_contacto: number | null;
  /** Lo que ya pagó y el valor total de la venta */
  pagado: number;
  total: number | null;
  ultimo_pago: string;
  notas: string | null;
  chat: string | null;
  /** Cuándo y cuánto paga lo que falta. Si no se cargó un plan, es un solo pago por todo el saldo en `vence`. */
  plan: PagoPlan[];
  /** true si el plan cargado no suma lo que debe */
  planNoCierra: boolean;
}

export interface PagoPlan { fecha: string; monto: number }

/**
 * Lee un plan de pagos escrito a mano: "10/12 500, 10/1 1500" o "500 el 10/12 y 1.500 el 10/01/27".
 * Sin año, toma la próxima vez que cae esa fecha (hasta 60 días para atrás cuenta como este año).
 */
export function leerPlan(texto: string, hoy: string): PagoPlan[] | null {
  const partes = texto.split(/;|\n|,\s+|\sy\s/i).map((s) => s.trim()).filter(Boolean);
  const out: PagoPlan[] = [];
  for (const parte of partes) {
    const f = parte.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
    if (!f) return null;
    const resto = parte.replace(f[0], ' ').replace(/usd|u\$s|\$/gi, ' ');
    const n = resto.match(/\d[\d.,]*/);
    if (!n) return null;
    // "1.500" y "1,500" son miles; "589,24" y "589.24" son decimales
    const monto = Number(n[0].replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.'));
    if (!Number.isFinite(monto) || monto <= 0 || monto >= 1e7) return null;
    const dia = Number(f[1]);
    const mes = Number(f[2]);
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
    let anio = f[3] ? Number(f[3].length === 2 ? `20${f[3]}` : f[3]) : Number(hoy.slice(0, 4));
    const iso = () => `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    if (!f[3] && iso() < sumarDias(hoy, -60)) anio++;
    out.push({ fecha: iso(), monto });
  }
  return out.length ? out.sort((a, b) => a.fecha.localeCompare(b.fecha)) : null;
}

/** El plan como se escribe: "10/12 500, 10/1 1500" */
export const planTexto = (plan: PagoPlan[]) => plan.map((p) => `${Number(p.fecha.slice(8, 10))}/${Number(p.fecha.slice(5, 7))} ${p.monto}`).join(', ');

export interface Cuotas {
  vencidas: CuotaPendiente[];
  semana: CuotaPendiente[];
  proximas: CuotaPendiente[];
  /** Deben plata pero no tienen fecha del próximo pago: hay que acordarla */
  sinFecha: CuotaPendiente[];
}

/**
 * Lo que falta cobrar, venta por venta. Cada cobro guarda cuánto quedaba pendiente
 * en ese momento, así que manda el último cobro de cada venta.
 */
export function cuotasPorCobrar(b: RawBundle, hoy: string): Cuotas {
  const ultimo = new Map<string, RawBundle['cobranzas'][number]>();
  const pagado = new Map<string, number>();
  for (const c of b.cobranzas) {
    if (c.es_reembolso) continue;
    pagado.set(c.agenda_id, (pagado.get(c.agenda_id) ?? 0) + Number(c.monto_cobrado));
    const prev = ultimo.get(c.agenda_id);
    if (!prev || c.fecha_cobro >= prev.fecha_cobro) ultimo.set(c.agenda_id, c);
  }
  const reembolsadas = new Set(b.cobranzas.filter((c) => c.es_reembolso).map((c) => c.agenda_id));
  const agendaPorId = new Map(b.agendas.map((a) => [a.id, a]));
  const enSiete = sumarDias(hoy, 7);
  const dias = (fecha: string) => Math.round((Date.parse(fecha) - Date.parse(hoy)) / 86400000);
  const out: Cuotas = { vencidas: [], semana: [], proximas: [], sinFecha: [] };
  for (const c of ultimo.values()) {
    if (!c.pendiente || c.pendiente <= 0 || reembolsadas.has(c.agenda_id)) continue;
    const ag = agendaPorId.get(c.agenda_id);
    const planCargado = (Array.isArray(c.plan_pagos) ? c.plan_pagos : []).filter((x) => x && x.fecha && Number(x.monto) > 0).map((x) => ({ fecha: x.fecha, monto: Number(x.monto) })).sort((x, y) => x.fecha.localeCompare(y.fecha));
    const fila: CuotaPendiente = {
      agenda_id: c.agenda_id,
      cobranza_id: c.id,
      nombre: ag?.lead?.nombre ?? 'Sin nombre',
      closer: c.closer,
      monto: c.pendiente,
      vence: c.proximo_vencimiento ?? '',
      cuotas_restantes: c.cuotas_restantes ?? null,
      dias: c.proximo_vencimiento ? dias(c.proximo_vencimiento) : null,
      tipo: ag?.compro === 'Reserva' ? 'Seña' : 'Cuota',
      responsable: c.responsable ?? null,
      ultimo_contacto: c.ultimo_contacto ?? null,
      dias_sin_contacto: c.ultimo_contacto ? -dias(c.ultimo_contacto) : null,
      pagado: Math.round((pagado.get(c.agenda_id) ?? 0) * 100) / 100,
      total: ag?.revenue ?? null,
      ultimo_pago: c.fecha_cobro,
      notas: c.notas ?? null,
      chat: ag?.lead?.manychat_url ?? null,
      plan: planCargado.length ? planCargado : c.proximo_vencimiento ? [{ fecha: c.proximo_vencimiento, monto: c.pendiente }] : [],
      planNoCierra: planCargado.length > 0 && Math.abs(planCargado.reduce((s, x) => s + x.monto, 0) - c.pendiente) > 1,
    };
    if (!fila.vence) out.sinFecha.push(fila);
    else if (fila.vence < hoy) out.vencidas.push(fila);
    else if (fila.vence <= enSiete) out.semana.push(fila);
    else out.proximas.push(fila);
  }
  const porFecha = (x: CuotaPendiente, y: CuotaPendiente) => x.vence.localeCompare(y.vence);
  out.vencidas.sort(porFecha);
  out.semana.sort(porFecha);
  out.proximas.sort(porFecha);
  out.sinFecha.sort((x, y) => x.ultimo_pago.localeCompare(y.ultimo_pago));
  return out;
}

/** Todo lo que falta cobrar, en el orden en que hay que moverlo: vencido, esta semana, sin fecha y más adelante. */
export const todasLasCuotas = (c: Cuotas): CuotaPendiente[] => [...c.vencidas, ...c.semana, ...c.sinFecha, ...c.proximas];

export interface MesPorCobrar { mes: string; monto: number; pagos: number }

/**
 * Cuánta plata tendría que entrar cada mes según los planes de pago. Lo vencido se suma aparte
 * (ya tendría que haber entrado) y lo que no tiene fecha también.
 */
export function porCobrarPorMes(c: Cuotas, hoy: string): { vencido: number; sinFecha: number; meses: MesPorCobrar[] } {
  const meses = new Map<string, MesPorCobrar>();
  let vencido = 0;
  for (const fila of [...c.vencidas, ...c.semana, ...c.proximas]) {
    for (const p of fila.plan) {
      if (p.fecha < hoy) { vencido += p.monto; continue; }
      const mes = p.fecha.slice(0, 7);
      const m = meses.get(mes) ?? { mes, monto: 0, pagos: 0 };
      m.monto += p.monto;
      m.pagos++;
      meses.set(mes, m);
    }
  }
  return { vencido, sinFecha: totalCuotas(c.sinFecha), meses: Array.from(meses.values()).sort((a, b) => a.mes.localeCompare(b.mes)) };
}

export const totalCuotas = (filas: CuotaPendiente[]) => filas.reduce((s, c) => s + c.monto, 0);
