import type { Agenda, Closer, Cobranza, Filtros, Funnel, RawBundle } from './types';
import { CLOSERS, FUNNELS, funnelDeLead } from './types';
import { costosDelMes } from './costos';
import { comisionesDelMes } from './comisiones';
import { comisionesPlataformasDelMes } from './plataformas';
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
  /** Comisiones de closers del mes; null si todavía no se cargó ningún % */
  comisiones: number | null;
  /** Comisiones de plataformas de pago (Stripe, Wise…); null si no hay tarifas cargadas */
  comisiones_plataformas: number | null;
  cash_collected: number;
  new_cash: number;
  old_cash: number;
  // Conversión
  pct_agenda_conversacion: number | null;
  /** Agendas de leads inbound / conversaciones inbound (orgánicas + pagadas) */
  agendas_inbound: number;
  conv_inbound: number | null;
  pct_agenda_inbound: number | null;
  /** Agendas de leads outbound / conversaciones outbound (respuestas a mensajes en frío) */
  agendas_outbound: number;
  pct_agenda_outbound: number | null;
  pct_agenda_link: number | null;
}

/** ¿La fecha cae en el período del filtro? (día puntual o mes) */
export function enPeriodo(f: Filtros, fecha: string | null | undefined): boolean {
  if (!fecha) return false;
  return f.dia ? fecha.slice(0, 10) === f.dia : mesDe(fecha) === f.mes;
}

export function agendasDelMes(b: RawBundle, f: Filtros): Agenda[] {
  return b.agendas.filter((a) => {
    if (!enPeriodo(f, a.fecha_llamada)) return false;
    if (f.closer !== 'todos' && a.closer !== f.closer) return false;
    if (f.fuente !== 'todas' && (a.lead?.fuente ?? 'Otro') !== f.fuente) return false;
    return true;
  });
}

export function cobranzasDelMes(b: RawBundle, f: Filtros): Cobranza[] {
  return b.cobranzas.filter((c) => {
    if (!enPeriodo(f, c.fecha_cobro)) return false;
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
  const setter = b.setter.filter((s) => enPeriodo(f, s.fecha));
  const ads = b.ads.filter((a) => enPeriodo(f, a.fecha));
  const ajuste = b.ajustes.find((a) => mesDe(a.mes) === f.mes);

  const asistencias = ag.filter((a) => a.asistio === 'Asistió').length;
  const noShow = ag.filter((a) => a.asistio === 'No show').length;
  const ofertas = ag.filter((a) => a.oferta_hecha).length;
  const ventasAg = ag.filter(esVenta);
  const reservas = ag.filter((a) => a.compro === 'Reserva').length;
  const idsVentas = new Set(ventasAg.map((a) => a.id));
  const reembolsos = Math.abs(sum(cob.filter((c) => c.es_reembolso), (c) => c.monto_cobrado));
  // Ventas nuevas = cobrado este período de ventas cerradas en el período; cuotas = cobrado de ventas anteriores.
  // Si una venta tiene cash_collected pero ningún cobro registrado (se editó a mano), cuenta igual.
  const conCobro = new Set(b.cobranzas.map((c) => c.agenda_id));
  const newCash =
    sum(cob.filter((c) => !c.es_reembolso && idsVentas.has(c.agenda_id)), (c) => c.monto_cobrado) +
    sum(ventasAg.filter((a) => !conCobro.has(a.id)), (a) => a.cash_collected);
  const oldCash = sum(cob.filter((c) => !c.es_reembolso && !idsVentas.has(c.agenda_id)), (c) => c.monto_cobrado);
  // Facturación = lo que entró de verdad (las cuotas pendientes no cuentan hasta cobrarse) − reembolsos
  const revenue = newCash + oldCash - reembolsos;
  const inversion = sum(ads, (a) => a.inversion);
  // Software: sale de la tabla de costos; si todavía no se cargó ninguno, del ajuste mensual.
  const softwareMes = b.costos.length ? costosDelMes(b.costos, f.mes).total : ajuste?.costo_software ?? null;
  // Con filtro de día, el software (costo mensual) se prorratea por los días del mes
  const software = softwareMes === null ? null : f.dia ? Math.round((softwareMes / diasDelMes(f.mes).length) * 100) / 100 : softwareMes;
  const com = comisionesDelMes(b.comisiones, cob, f.mes, f.closer === 'todos' ? undefined : f.closer);
  const comisiones = com.sinConfigurar ? null : com.total;
  const plat = comisionesPlataformasDelMes(b.comisionesPlataformas, cob, f.mes);
  const comisionesPlataformas = plat.sinConfigurar ? null : plat.total;
  // Cash Collected (lo que queda) = Facturación − ads − software − comisiones de closers − comisiones de plataformas
  const cash = revenue - inversion - (software ?? 0) - (comisiones ?? 0) - (comisionesPlataformas ?? 0);


  const convOrg = sumNullable(setter, (s) => s.conv_organicas);
  const convPag = sumNullable(setter, (s) => s.conv_pagadas);
  // Outbound con respuesta: Instagram + WhatsApp
  const convOut = sumNullable(setter, (s) => (s.respuestas == null && s.respuestas_wa == null ? null : (s.respuestas ?? 0) + (s.respuestas_wa ?? 0)));
  const conversaciones = convOrg === null && convPag === null && convOut === null ? null : (convOrg ?? 0) + (convPag ?? 0) + (convOut ?? 0);
  const convIn = convOrg === null && convPag === null ? null : (convOrg ?? 0) + (convPag ?? 0);
  // Sin clasificar cuenta como inbound (es lo que casi siempre pasa hoy)
  const agOutbound = ag.filter((a) => a.lead?.canal === 'Outbound').length;
  const agInbound = ag.length - agOutbound;
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
    comisiones,
    comisiones_plataformas: comisionesPlataformas,
    cash_collected: cash,
    new_cash: newCash,
    old_cash: oldCash,
    pct_agenda_conversacion: conversaciones ? ratio(ag.length, conversaciones) : null,
    agendas_inbound: agInbound,
    conv_inbound: convIn,
    pct_agenda_inbound: convIn ? ratio(agInbound, convIn) : null,
    agendas_outbound: agOutbound,
    pct_agenda_outbound: convOut ? ratio(agOutbound, convOut) : null,
    pct_agenda_link: links ? ratio(ag.length, links) : null,
  };
}

export interface NivelFunnel {
  nombre: string;
  valor: number | null;
  esUsd?: boolean;
  porCloser?: Partial<Record<Closer, number>>;
}

export function funnelMes(b: RawBundle, f: Filtros, funnel?: Funnel): NivelFunnel[] {
  const m = metricasMes(b, f);
  const ag = agendasDelMes(b, f).filter((a) => !funnel || funnelDeLead(a.lead?.funnel, a.lead?.fuente) === funnel);
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
  const ventas = ag.filter(esVenta);
  // Lo cobrado de las ventas del período (sin cuotas pendientes)
  const usdVentas = funnel ? ventas.reduce((acc, a) => acc + (a.cash_collected ?? 0), 0) : m.new_cash;
  const nivelesFinales: NivelFunnel[] = [
    { nombre: 'Agendas', valor: ag.length, porCloser: porCloser(() => true) },
  ];

  // Webinar: Registrados → Calificados → Asistentes → Agendas → Presentadas → Ventas
  if (funnel === 'Webinar') {
    const webs = b.webinars.filter((w) => enPeriodo(f, w.fecha));
    const sumW = (k: 'registrados' | 'registrados_calificados' | 'asistentes') => (webs.some((w) => w[k] !== null && w[k] !== undefined) ? webs.reduce((acc, w) => acc + (w[k] ?? 0), 0) : null);
    return [
      { nombre: 'Registrados', valor: sumW('registrados') },
      { nombre: 'Calificados', valor: sumW('registrados_calificados') },
      { nombre: 'Asistentes', valor: sumW('asistentes') },
      ...nivelesFinales,
      { nombre: 'Llamadas presentadas', valor: ag.filter((a) => a.asistio === 'Asistió').length, porCloser: porCloser((a) => a.asistio === 'Asistió') },
      { nombre: 'Ventas', valor: ventas.length, porCloser: porCloser(esVenta) },
      { nombre: 'Cobrado USD', valor: usdVentas, esUsd: true, porCloser: porCloser((a) => (esVenta(a) ? a.cash_collected ?? 0 : 0)) },
    ];
  }

  // General / Orgánico / YouTube: Conversaciones → Agendas → Llamadas → Cierres
  const setter = b.setter.filter((x) => enPeriodo(f, x.fecha));
  const sumN = (vals: (number | null | undefined)[]) => (vals.some((v) => v !== null && v !== undefined) ? vals.reduce<number>((acc, v) => acc + (v ?? 0), 0) : null);
  const conversaciones =
    !funnel ? m.conversaciones
    // Orgánico = orgánicas + pagadas (Follow Me Ads lleva al perfil) + outbound con respuesta
    : funnel === 'Orgánico' ? sumN(setter.map((x) => (x.conv_organicas ?? 0) + (x.conv_pagadas ?? 0) + (x.respuestas ?? 0) + (x.respuestas_wa ?? 0)))
    : null; // YouTube: todavía sin fuente de conversaciones
  return [
    { nombre: 'Conversaciones', valor: conversaciones },
    ...nivelesFinales,
    { nombre: 'Llamadas presentadas', valor: ag.filter((a) => a.asistio === 'Asistió').length, porCloser: porCloser((a) => a.asistio === 'Asistió') },
    { nombre: 'Cierres', valor: ventas.length, porCloser: porCloser(esVenta) },
    { nombre: 'Cobrado USD', valor: usdVentas, esUsd: true, porCloser: porCloser((a) => (esVenta(a) ? a.cash_collected ?? 0 : 0)) },
  ];
}

/** Un embudo por cada funnel de origen, más el general. */
export function embudosPorFuente(b: RawBundle, f: Filtros): { clave: string; nombre: string; niveles: NivelFunnel[] }[] {
  return [
    { clave: 'general', nombre: 'General', niveles: funnelMes(b, f) },
    ...FUNNELS.map((fu) => ({ clave: fu, nombre: fu, niveles: funnelMes(b, f, fu) })),
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
  no_show: number;
  canceladas: number;
  pendientes: number;
  pct_show: number | null;
  ofertas: number;
  cierres: number;
  /** Ventas con seña (compro = Reserva) */
  senas: number;
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
    no_show: ag.filter((a) => a.asistio === 'No show').length,
    canceladas: ag.filter((a) => a.asistio === 'Canceló').length,
    pendientes: ag.filter((a) => a.asistio === 'Pendiente').length,
    pct_show: ratio(asistencias, ag.length),
    ofertas,
    cierres,
    senas: ag.filter((a) => a.compro === 'Reserva').length,
    pct_cierre: ratio(cierres, asistencias), // cierres sobre llamadas presentadas
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
  if (f.dia) {
    const d = new Date(`${f.dia}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    const ayer = d.toISOString().slice(0, 10);
    return { actual: metricasMes(b, f), anterior: metricasMes(b, { ...f, dia: ayer, mes: ayer.slice(0, 7) }) };
  }
  return { actual: metricasMes(b, f), anterior: metricasMes(b, { ...f, dia: null, mes: mesAnterior(f.mes) }) };
}

export interface Pendiente {
  tipo: 'cobranza' | 'agente' | 'fuente';
  texto: string;
}

export function avisos(b: RawBundle, f: Filtros, hoy: string): Pendiente[] {
  const out: Pendiente[] = [];
  const faltan = comisionesDelMes(b.comisiones, cobranzasDelMes(b, f), f.mes).faltan;
  if (b.comisiones.length || faltan.length) for (const c of faltan) out.push({ tipo: 'agente', texto: `Falta el % de comisión de ${c} (sección Costos)` });
  const platFaltan = comisionesPlataformasDelMes(b.comisionesPlataformas, cobranzasDelMes(b, f), f.mes);
  if (!platFaltan.sinConfigurar) for (const p of platFaltan.faltan) out.push({ tipo: 'agente', texto: p === 'Sin indicar' ? 'Hay cobros sin plataforma de pago indicada' : `Falta la comisión de ${p} (sección Costos)` });
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
  software: number;
  comisiones: number;
  plataformas: number;
  costos: number;
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
    software: m.costo_software ?? 0,
    comisiones: m.comisiones ?? 0,
    plataformas: m.comisiones_plataformas ?? 0,
    costos: Math.round((m.inversion_ads + (m.costo_software ?? 0) + (m.comisiones ?? 0) + (m.comisiones_plataformas ?? 0)) * 100) / 100,
  };
}

/** Últimos n meses hasta el mes del filtro, para los gráficos "mes a mes". */
export function serieMeses(b: RawBundle, f: Filtros, n = 6): PuntoMensual[] {
  const meses: string[] = [f.mes];
  while (meses.length < n) meses.unshift(mesAnterior(meses[0]));
  const puntos = meses.map((mes) => punto(b, f, mes));
  // Recortar meses vacíos al principio (antes de que existieran datos), dejando al menos 3.
  const vacio = (p: PuntoMensual) => !p.revenue && !p.inversion && !p.agendas && !p.new_cash && !p.old_cash && !p.software;
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

export type NivelUtm = 'utm_source' | 'utm_campaign' | 'utm_content' | 'utm_medium';

export interface FilaUtm {
  clave: string;
  agendas: number;
  presentadas: number;
  ventas: number;
  cash: number;
  pctShow: number | null;
  pctCierre: number | null; // ventas / presentadas
}

/** Agendas agrupadas por un parámetro UTM, con su resultado. "(sin UTM)" agrupa las que no traen. */
export function agendasPorUtm(b: RawBundle, f: Filtros, nivel: NivelUtm): FilaUtm[] {
  const mapa = new Map<string, Agenda[]>();
  for (const a of agendasDelMes(b, f)) {
    const k = (a.lead?.[nivel] ?? '').trim() || '(sin UTM)';
    mapa.set(k, [...(mapa.get(k) ?? []), a]);
  }
  return Array.from(mapa.entries())
    .map(([clave, ag]) => {
      const presentadas = ag.filter((a) => a.asistio === 'Asistió').length;
      const ventas = ag.filter(esVenta);
      return {
        clave,
        agendas: ag.length,
        presentadas,
        ventas: ventas.length,
        cash: ventas.reduce((s, a) => s + (a.cash_collected ?? 0), 0),
        pctShow: ratio(presentadas, ag.length),
        pctCierre: ratio(ventas.length, presentadas),
      };
    })
    .sort((x, y) => (x.clave === '(sin UTM)' ? 1 : y.clave === '(sin UTM)' ? -1 : y.agendas - x.agendas));
}
