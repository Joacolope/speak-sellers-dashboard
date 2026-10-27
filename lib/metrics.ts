import type { Agenda, Closer, Cobranza, Filtros, RawBundle } from './types';
import { CLOSERS } from './types';
import { diasDelMes, mesAnterior, mesCorto, mesDe, ratio } from './format';

export interface MetricasMes {
  mes: string;
  // Setter
  conv_organicas: number | null;
  conv_pagadas: number | null;
  /** Outbound con ida y vuelta: mensajes en frío/seguimiento que tuvieron respuesta. */
  conv_outbound: number | null;
  /** Conversaciones con ida y vuelta = inbound (orgánicas + pagadas) + outbound con respuesta. */
  conversaciones: number | null;
  seguimientos: number | null;
  links_enviados: number | null;
  agendas: number;
  // Closer
  asistencias: number;
  pct_asistencia: number | null;
  no_show: number;
  pct_no_show: number | null;
  reservas: number;
  ventas: number;
  ofertas: number;
  pct_cierre_total: number | null;
  pct_cierre_asistencia: number | null;
  pct_cierre_oferta: number | null;
  revenue: number;
  reembolsos: number;
  inversion_ads: number;
  costo_software: number | null;
  cash_collected: number;
  new_cash: number;
  old_cash: number;
  // Conversión
  pct_agenda_conversacion: number | null;
  pct_agenda_link: number | null;
}

export function agendasDelMes(b: RawBundle, f: Filtros): Agenda[] {
  return b.agendas.filter((a) => {
    if (mesDe(a.fecha_llamada) !== f.mes) return false;
    if (f.closer !== 'todos' && a.closer !== f.closer) return false;
    if (f.fuente !== 'todas' && (a.lead?.fuente ?? 'Otro') !== f.fuente) return false;
    return true;
  });
}

export function cobranzasDelMes(b: RawBundle, f: Filtros): Cobranza[] {
  return b.cobranzas.filter((c) => {
    if (mesDe(c.fecha_cobro) !== f.mes) return false;
    if (f.closer !== 'todos' && c.closer !== f.closer) return false;
    if (f.fuente !== 'todas') {
      const ag = b.agendas.find((a) => a.id === c.agenda_id);
      if ((ag?.lead?.fuente ?? 'Otro') !== f.fuente) return false;
    }
    return true;
  });
}

function sum<T>(arr: T[], fn: (t: T) => number | null | undefined): number {
  return arr.reduce((acc, t) => acc + (fn(t) ?? 0), 0);
}

function sumNullable<T>(arr: T[], fn: (t: T) => number | null | undefined): number | null {
  const vals = arr.map(fn).filter((v): v is number => v !== null && v !== undefined);
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
}

export function esVenta(a: Agenda): boolean {
  return a.compro === 'Si' || a.compro === 'Reserva';
}

export function metricasMes(b: RawBundle, f: Filtros): MetricasMes {
  const ag = agendasDelMes(b, f);
  const cob = cobranzasDelMes(b, f);
  const setter = b.setter.filter((s) => mesDe(s.fecha) === f.mes);
  const ads = b.ads.filter((a) => mesDe(a.fecha) === f.mes);
  const ajuste = b.ajustes.find((a) => mesDe(a.mes) === f.mes);

  const asistencias = ag.filter((a) => a.asistio === 'Asistió').length;
  const noShow = ag.filter((a) => a.asistio === 'No show').length;
  const ofertas = ag.filter((a) => a.oferta_hecha).length;
  const ventasAg = ag.filter(esVenta);
  const reservas = ag.filter((a) => a.compro === 'Reserva').length;
  const revenueBruto = sum(ventasAg, (a) => a.revenue);
  // Reembolsos del mes (informativo). Para no restarlos dos veces, al revenue solo
  // se le descuentan los de ventas que siguen contando como venta (reembolso parcial);
  // una venta devuelta por completo ya salió del conteo con compro = No.
  const idsVentas = new Set(ventasAg.map((a) => a.id));
  const reembolsos = Math.abs(sum(cob.filter((c) => c.es_reembolso), (c) => c.monto_cobrado));
  const reembolsosDeVentas = Math.abs(sum(cob.filter((c) => c.es_reembolso && idsVentas.has(c.agenda_id)), (c) => c.monto_cobrado));
  const revenue = revenueBruto - reembolsosDeVentas;
  const inversion = sum(ads, (a) => a.inversion);
  const software = ajuste?.costo_software ?? null;
  const cash = revenue - inversion - (software ?? 0);

  const idsVentasMes = idsVentas;
  const newCash = sum(cob.filter((c) => !c.es_reembolso && idsVentasMes.has(c.agenda_id)), (c) => c.monto_cobrado);
  const oldCash = sum(cob.filter((c) => !c.es_reembolso && !idsVentasMes.has(c.agenda_id)), (c) => c.monto_cobrado);

  const convOrg = sumNullable(setter, (s) => s.conv_organicas);
  const convPag = sumNullable(setter, (s) => s.conv_pagadas);
  const convOut = sumNullable(setter, (s) => s.respuestas);
  const conversaciones = convOrg === null && convPag === null && convOut === null ? null : (convOrg ?? 0) + (convPag ?? 0) + (convOut ?? 0);
  const links = sumNullable(setter, (s) => s.links_enviados);

  return {
    mes: f.mes,
    conv_organicas: convOrg,
    conv_pagadas: convPag,
    conv_outbound: convOut,
    conversaciones,
    seguimientos: sumNullable(setter, (s) => s.seguimientos),
    links_enviados: links,
    agendas: ag.length,
    asistencias,
    pct_asistencia: ratio(asistencias, ag.length),
    no_show: noShow,
    pct_no_show: ratio(noShow, ag.length),
    reservas,
    ventas: ventasAg.length,
    ofertas,
    pct_cierre_total: ratio(ventasAg.length, ag.length),
    pct_cierre_asistencia: ratio(ventasAg.length, asistencias),
    pct_cierre_oferta: ratio(ventasAg.length, ofertas),
    revenue,
    reembolsos,
    inversion_ads: inversion,
    costo_software: software,
    cash_collected: cash,
    new_cash: newCash,
    old_cash: oldCash,
    pct_agenda_conversacion: conversaciones ? ratio(ag.length, conversaciones) : null,
    pct_agenda_link: links ? ratio(ag.length, links) : null,
  };
}

export interface NivelFunnel {
  nombre: string;
  valor: number | null;
  esUsd?: boolean;
  porCloser?: Partial<Record<Closer, number>>;
}

export function funnelMes(b: RawBundle, f: Filtros): NivelFunnel[] {
  const m = metricasMes(b, f);
  const ag = agendasDelMes(b, f);
  const porCloser = (fn: (a: Agenda) => boolean | number): Partial<Record<Closer, number>> => {
    const out: Partial<Record<Closer, number>> = {};
    for (const c of CLOSERS) {
      const sub = ag.filter((a) => a.closer === c);
      out[c] = sub.reduce((acc, a) => {
        const r = fn(a);
        return acc + (typeof r === 'number' ? r : r ? 1 : 0);
      }, 0);
    }
    return out;
  };
  return [
    { nombre: 'Conversaciones', valor: m.conversaciones },
    { nombre: 'Agendas', valor: m.agendas, porCloser: porCloser(() => true) },
    { nombre: 'Asistencias', valor: m.asistencias, porCloser: porCloser((a) => a.asistio === 'Asistió') },
    { nombre: 'Ofertas hechas', valor: m.ofertas, porCloser: porCloser((a) => !!a.oferta_hecha) },
    { nombre: 'Cierres', valor: m.ventas, porCloser: porCloser(esVenta) },
    { nombre: 'Ventas USD', valor: m.revenue, esUsd: true, porCloser: porCloser((a) => (esVenta(a) ? a.revenue ?? 0 : 0)) },
  ];
}

export interface SemanaAdsCash {
  semana: string;
  inversion: number;
  cash: number;
}

export function adsVsCashSemanal(b: RawBundle, f: Filtros): SemanaAdsCash[] {
  const dias = diasDelMes(f.mes);
  const ads = b.ads.filter((a) => mesDe(a.fecha) === f.mes);
  const cob = cobranzasDelMes(b, f);
  const semanas: SemanaAdsCash[] = [];
  for (let i = 0; i < dias.length; i += 7) {
    const grupo = dias.slice(i, i + 7);
    const desde = grupo[0];
    const hasta = grupo[grupo.length - 1];
    semanas.push({
      semana: `${desde.slice(8)}–${hasta.slice(8)}`,
      inversion: Math.round(sum(ads.filter((a) => a.fecha >= desde && a.fecha <= hasta), (a) => a.inversion)),
      cash: Math.round(sum(cob.filter((c) => c.fecha_cobro >= desde && c.fecha_cobro <= hasta), (c) => c.monto_cobrado)),
    });
  }
  return semanas;
}

export interface DiaAgendas {
  dia: string;
  agendas: number;
  asistencias: number;
}

export function agendasPorDia(b: RawBundle, f: Filtros): DiaAgendas[] {
  const ag = agendasDelMes(b, f);
  return diasDelMes(f.mes).map((fecha) => {
    const del = ag.filter((a) => a.fecha_llamada.slice(0, 10) === fecha);
    return {
      dia: fecha.slice(8),
      agendas: del.length,
      asistencias: del.filter((a) => a.asistio === 'Asistió').length,
    };
  });
}

export interface ResumenCloser {
  closer: Closer;
  agendas: number;
  asistencias: number;
  pct_show: number | null;
  ofertas: number;
  cierres: number;
  pct_cierre: number | null;
  cash: number;
  revenue: number;
}

export function resumenCloser(b: RawBundle, f: Filtros, closer: Closer | 'todos'): ResumenCloser {
  const ag = agendasDelMes(b, { ...f, closer });
  const asistencias = ag.filter((a) => a.asistio === 'Asistió').length;
  const ofertas = ag.filter((a) => a.oferta_hecha).length;
  const cierres = ag.filter(esVenta).length;
  return {
    closer: closer === 'todos' ? 'Marcos' : closer,
    agendas: ag.length,
    asistencias,
    pct_show: ratio(asistencias, ag.length),
    ofertas,
    cierres,
    pct_cierre: ratio(cierres, ofertas),
    cash: sum(ag.filter(esVenta), (a) => a.cash_collected),
    revenue: sum(ag.filter(esVenta), (a) => a.revenue),
  };
}

export function mesesDisponibles(b: RawBundle, mesActual: string): string[] {
  const set = new Set<string>([mesActual]);
  for (const a of b.agendas) set.add(mesDe(a.fecha_llamada));
  for (const a of b.ads) set.add(mesDe(a.fecha));
  for (const s of b.setter) set.add(mesDe(s.fecha));
  return Array.from(set).sort();
}

export function metricasConAnterior(b: RawBundle, f: Filtros) {
  return { actual: metricasMes(b, f), anterior: metricasMes(b, { ...f, mes: mesAnterior(f.mes) }) };
}

export interface Pendiente {
  tipo: 'cobranza' | 'agente' | 'fuente';
  texto: string;
}

export function avisos(b: RawBundle, f: Filtros, hoy: string): Pendiente[] {
  const out: Pendiente[] = [];
  const en7 = new Date(hoy);
  en7.setUTCDate(en7.getUTCDate() + 7);
  const limite = en7.toISOString().slice(0, 10);
  for (const c of b.cobranzas) {
    if (c.pendiente && c.pendiente > 0 && c.proximo_vencimiento && c.proximo_vencimiento <= limite) {
      const ag = b.agendas.find((a) => a.id === c.agenda_id);
      out.push({ tipo: 'cobranza', texto: `${ag?.lead?.nombre ?? 'Lead'} · $${c.pendiente} vence ${c.proximo_vencimiento.slice(8)}/${c.proximo_vencimiento.slice(5, 7)}` });
    }
  }
  const ultimoLog = b.log.filter((l) => l.source === 'agente').sort((a, b2) => b2.fecha.localeCompare(a.fecha))[0];
  for (const p of ultimoLog?.pendientes ?? []) out.push({ tipo: 'agente', texto: p });
  for (const u of b.actualizaciones) {
    if (!u.ok) out.push({ tipo: 'fuente', texto: `${u.fuente} no actualizó hoy${u.detalle ? `: ${u.detalle}` : ''}` });
  }
  return out;
}

export interface PuntoMensual {
  mes: string;
  label: string;
  revenue: number;
  cash: number;
  inversion: number;
  agendas: number;
  ventas: number;
  new_cash: number;
  old_cash: number;
  roas_cash: number | null;
  roas_revenue: number | null;
}

function punto(b: RawBundle, f: Filtros, mes: string): PuntoMensual {
  const m = metricasMes(b, { ...f, mes });
  return {
    mes,
    label: mesCorto(mes).slice(0, 3),
    revenue: m.revenue,
    cash: m.cash_collected,
    inversion: m.inversion_ads,
    agendas: m.agendas,
    ventas: m.ventas,
    new_cash: m.new_cash,
    old_cash: m.old_cash,
    roas_cash: m.inversion_ads ? Math.round((m.cash_collected / m.inversion_ads) * 100) / 100 : null,
    roas_revenue: m.inversion_ads ? Math.round((m.revenue / m.inversion_ads) * 100) / 100 : null,
  };
}

/** Últimos n meses hasta el mes del filtro, para los gráficos "mes a mes". */
export function serieMeses(b: RawBundle, f: Filtros, n = 6): PuntoMensual[] {
  const meses: string[] = [f.mes];
  while (meses.length < n) meses.unshift(mesAnterior(meses[0]));
  const puntos = meses.map((mes) => punto(b, f, mes));
  // Recortar meses vacíos al principio (antes de que existieran datos), dejando al menos 3.
  const vacio = (p: PuntoMensual) => !p.revenue && !p.inversion && !p.agendas && !p.new_cash && !p.old_cash;
  while (puntos.length > 3 && vacio(puntos[0])) puntos.shift();
  return puntos;
}

/** Acumulado del año del filtro, de enero hasta el mes seleccionado. */
export function acumuladoAnual(b: RawBundle, f: Filtros) {
  const year = f.mes.slice(0, 4);
  const hasta = Number(f.mes.slice(5, 7));
  const puntos = Array.from({ length: hasta }, (_, i) => punto(b, f, `${year}-${String(i + 1).padStart(2, '0')}`));
  return {
    year,
    revenue: puntos.reduce((s, p) => s + p.revenue, 0),
    cash: puntos.reduce((s, p) => s + p.cash, 0),
    inversion: puntos.reduce((s, p) => s + p.inversion, 0),
    ventas: puntos.reduce((s, p) => s + p.ventas, 0),
  };
}

export function ventasPorPais(b: RawBundle, f: Filtros): { pais: string; ventas: number; cash: number }[] {
  const map = new Map<string, { ventas: number; cash: number }>();
  for (const a of agendasDelMes(b, f).filter(esVenta)) {
    const k = a.lead?.pais ?? 'Sin país';
    const cur = map.get(k) ?? { ventas: 0, cash: 0 };
    cur.ventas++;
    cur.cash += a.cash_collected ?? 0;
    map.set(k, cur);
  }
  return Array.from(map.entries()).map(([pais, v]) => ({ pais, ...v })).sort((x, y) => y.ventas - x.ventas);
}
