import type { Agenda, Closer, Cobranza, Filtros, Funnel, RawBundle } from './types';
import { CLOSERS, CLOSER_POR_DEFECTO, FUNNELS, funnelDeLead } from './types';
import { comoAgendoPorUtm } from './origen';
import { periodoAnterior } from './filtros';
import { costosDelMes } from './costos';
import { comisionesDelMes } from './comisiones';
import { comisionesPlataformasDelMes } from './plataformas';
import { diasDelMes, mesAnterior, mesCorto, mesDe, ratio } from './format';

export interface MetricasMes {
  mes: string;
  // Setter
  conv_organicas: number | null;
  conv_pagadas: number | null;
  /** De dónde salió el número: planilla del setter, Meta Ads o estimado con la API de Instagram */
  conv_pagadas_origen: 'setter' | 'meta' | null;
  conv_organicas_origen: 'setter' | 'ig' | null;
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
  /** Ventas / (agendas − no-shows): cierre sin castigar por los que no se presentaron */
  pct_cierre_sin_noshow: number | null;
  /** Ventas / llamadas presentadas */
  pct_cierre_asistencia: number | null;
  pct_cierre_oferta: number | null;
  /** Facturación: lo que se cobró en el período (front end + back end − reembolsos). Lo pendiente no cuenta. */
  revenue: number;
  reembolsos: number;
  inversion_ads: number;
  costo_software: number | null;
  /** Comisiones de closers del mes; null si todavía no se cargó ningún % */
  comisiones: number | null;
  /** Comisiones de plataformas de pago (Stripe, Wise…); null si no hay tarifas cargadas */
  comisiones_plataformas: number | null;
  /** Comisiones de setters de los pagos del período */
  comisiones_setter: number;
  /** Lo que queda: Facturación − ads − software − comisiones de closers y setters − comisiones de plataformas */
  cash_collected: number;
  /** Front end: lo cobrado de ventas cerradas en el período */
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
  const d = fecha.slice(0, 10);
  if (f.dia) return d === f.dia;
  if (mesDe(d) !== f.mes) return false;
  // El rango solo aplica si es de este mes (las vistas mes a mes reusan el filtro con otro mes)
  if (f.desde && mesDe(f.desde) === f.mes && d < f.desde) return false;
  if (f.hasta && mesDe(f.hasta) === f.mes && d > f.hasta) return false;
  return true;
}

/** Renovación o upsell de un cliente que ya había comprado: es back end y no cuenta como llamada de venta. */
export function esRecompra(a: Agenda): boolean {
  return a.tipo_venta === 'Renovación' || a.tipo_venta === 'Upsell';
}

/**
 * Completa el tipo de venta de las que no lo tienen cargado a mano: es renovación si ese lead ya había comprado
 * más de 45 días antes (una seña que se completa a los pocos días sigue siendo la misma venta nueva).
 */
export function resolverTipoVenta(agendas: Agenda[]): Agenda[] {
  const compras = new Map<string, number[]>();
  for (const a of agendas) if (a.compro === 'Si') compras.set(a.lead_id, [...(compras.get(a.lead_id) ?? []), Date.parse(a.fecha_llamada)]);
  return agendas.map((a) => {
    if (a.tipo_venta || (a.compro !== 'Si' && a.compro !== 'Reserva')) return a;
    const t = Date.parse(a.fecha_llamada);
    const yaCompro = (compras.get(a.lead_id) ?? []).some((x) => t - x > 45 * 86400000);
    return { ...a, tipo_venta: yaCompro ? 'Renovación' as const : 'Nueva' as const };
  });
}

/** Llamadas de venta del período. Las renovaciones y upsells no entran: no son llamadas de venta nuevas. */
export function agendasDelMes(b: RawBundle, f: Filtros): Agenda[] {
  return b.agendas.filter((a) => {
    if (esRecompra(a)) return false;
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

/** Venta = compró (venta nueva). Una reserva (seña) no cuenta como cierre; su plata sí cuenta como cobrada. Una renovación tampoco: es back end. */
export function esVenta(a: Agenda): boolean {
  return a.compro === 'Si' && !esRecompra(a);
}

/** Dejó plata en la llamada: venta o seña. Se usa para lo cobrado, no para contar cierres. */
export function esPago(a: Agenda): boolean {
  return (a.compro === 'Si' || a.compro === 'Reserva') && !esRecompra(a);
}

export interface Plata {
  /** Facturación: lo que se cobró en el período = front end + back end − reembolsos. Lo que falta cobrar NO cuenta. */
  facturacion: number;
  /** Front end: lo cobrado en el período de ventas cerradas en el período */
  frontEnd: number;
  /** Back end: lo cobrado en el período de clientes que ya estaban = cuotas de ventas anteriores + renovaciones */
  backEnd: number;
  /** Parte del back end que son cuotas de ventas anteriores */
  cuotas: number;
  /** Parte del back end que son renovaciones y upsells */
  renovaciones: number;
  /** Llamadas que son renovación o upsell (sus cobros son back end) */
  idsRecompra: Set<string>;
  reembolsos: number;
  /** Llamadas del período que dejaron plata: sus cobros son front end */
  idsFrontEnd: Set<string>;
}

/**
 * La plata de un período, igual en todas las páginas (Inicio, Closers, Cobranzas, Métricas).
 * Solo cuenta la plata que ya entró, por fecha de cobro: lo que falta cobrar de una venta en cuotas no es
 * facturación hasta que se cobra (se ve en Cobranzas). Una cuota que entra en noviembre de una venta de octubre
 * es back end de noviembre.
 */
export function plataDelPeriodo(b: RawBundle, f: Filtros): Plata {
  const ag = agendasDelMes(b, f);
  const cob = cobranzasDelMes(b, f);
  // La plata se atribuye a quien pagó en el período (ventas y señas); los cierres solo cuentan ventas
  const pagaron = ag.filter(esPago);
  const idsFrontEnd = new Set(pagaron.map((a) => a.id));
  const reembolsos = Math.abs(sum(cob.filter((c) => c.es_reembolso), (c) => c.monto_cobrado));
  // Si una venta tiene cash_collected pero ningún cobro registrado (se editó a mano), cuenta igual.
  const conCobro = new Set(b.cobranzas.map((c) => c.agenda_id));
  const frontEnd =
    sum(cob.filter((c) => !c.es_reembolso && idsFrontEnd.has(c.agenda_id)), (c) => c.monto_cobrado) +
    sum(pagaron.filter((a) => !conCobro.has(a.id)), (a) => a.cash_collected);
  const backEnd = sum(cob.filter((c) => !c.es_reembolso && !idsFrontEnd.has(c.agenda_id)), (c) => c.monto_cobrado);
  const idsRecompra = new Set(b.agendas.filter(esRecompra).map((a) => a.id));
  const renovaciones = sum(cob.filter((c) => !c.es_reembolso && idsRecompra.has(c.agenda_id)), (c) => c.monto_cobrado);
  return { facturacion: frontEnd + backEnd - reembolsos, frontEnd, backEnd, cuotas: backEnd - renovaciones, renovaciones, reembolsos, idsFrontEnd, idsRecompra };
}

export interface PlataPeriodo {
  /** "2026-11" o "2026-T4" */
  clave: string;
  label: string;
  frontEnd: number;
  cuotas: number;
  renovaciones: number;
  reembolsos: number;
  facturacion: number;
  /** Parte de lo cobrado que es plata nueva (front end) */
  pctNuevo: number | null;
}

/**
 * De dónde entró la plata, mes a mes y por trimestre: ventas nuevas (front end), cuotas de ventas anteriores
 * y renovaciones (las dos últimas son back end). Sirve para ver en qué época del año conviene empujar marketing.
 */
export function plataPorPeriodo(b: RawBundle, f: Filtros, n = 12): { meses: PlataPeriodo[]; trimestres: PlataPeriodo[] } {
  const lista: string[] = [f.mes];
  while (lista.length < n) lista.unshift(mesAnterior(lista[0]));
  const armar = (clave: string, label: string, p: { frontEnd: number; cuotas: number; renovaciones: number; reembolsos: number }): PlataPeriodo => {
    const bruto = p.frontEnd + p.cuotas + p.renovaciones;
    return { clave, label, ...p, facturacion: bruto - p.reembolsos, pctNuevo: bruto > 0 ? p.frontEnd / bruto : null };
  };
  const porMes = lista.map((mes) => ({ mes, p: plataDelPeriodo(b, { ...f, mes, dia: null, desde: null, hasta: null }) }));
  while (porMes.length > 1 && !porMes[0].p.frontEnd && !porMes[0].p.backEnd) porMes.shift();
  const meses = porMes.map(({ mes, p }) => armar(mes, mesCorto(mes), p));
  const grupos = new Map<string, { frontEnd: number; cuotas: number; renovaciones: number; reembolsos: number }>();
  for (const { mes, p } of porMes) {
    const clave = `${mes.slice(0, 4)}-T${Math.ceil(Number(mes.slice(5, 7)) / 3)}`;
    const g = grupos.get(clave) ?? { frontEnd: 0, cuotas: 0, renovaciones: 0, reembolsos: 0 };
    g.frontEnd += p.frontEnd; g.cuotas += p.cuotas; g.renovaciones += p.renovaciones; g.reembolsos += p.reembolsos;
    grupos.set(clave, g);
  }
  const trimestres = Array.from(grupos.entries()).map(([clave, g]) => armar(clave, `${clave.slice(5)} ${clave.slice(0, 4)}`, g));
  return { meses, trimestres };
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
  // Facturación (lo cobrado), front end y back end: la misma cuenta que usan Closers y Cobranzas
  const plata = plataDelPeriodo(b, f);
  const { reembolsos } = plata;
  const newCash = plata.frontEnd;
  const oldCash = plata.backEnd;
  const revenue = plata.facturacion;
  const inversion = sum(ads, (a) => a.inversion);
  // Software: sale de la tabla de costos; si todavía no se cargó ninguno, del ajuste mensual.
  const softwareMes = b.costos.length ? costosDelMes(b.costos, f.mes).total : ajuste?.costo_software ?? null;
  // Con filtro de día, el software (costo mensual) se prorratea por los días del mes
  const software = softwareMes === null ? null : f.dia ? Math.round((softwareMes / diasDelMes(f.mes).length) * 100) / 100 : softwareMes;
  const com = comisionesDelMes(b.comisiones, cob, f.mes, f.closer === 'todos' ? undefined : f.closer);
  const comisiones = com.sinConfigurar ? null : com.total;
  const plat = comisionesPlataformasDelMes(b.comisionesPlataformas, cob, f.mes);
  const comisionesPlataformas = plat.sinConfigurar ? null : plat.total;
  const comisionesSetter = Math.round(sum(cob, (c) => c.comision_setter) * 100) / 100;
  // Cash Collected (lo que queda) = Facturación − ads − software − comisiones de closers y setters − comisiones de plataformas
  const cash = revenue - inversion - (software ?? 0) - (comisiones ?? 0) - comisionesSetter - (comisionesPlataformas ?? 0);


  const convOrgSetter = sumNullable(setter, (s) => s.conv_organicas);
  const convPagSetter = sumNullable(setter, (s) => s.conv_pagadas);
  // Si el setter no cargó las pagadas, se toman las conversaciones iniciadas desde Meta Ads (llegan solas)
  const convPagMeta = sumNullable(b.ads.filter((a) => enPeriodo(f, a.fecha)), (a) => a.conversaciones);
  const convPag = convPagSetter ?? convPagMeta;
  // Si no cargó las orgánicas, se estiman con las conversaciones con ida y vuelta de Instagram (API) menos las pagadas
  const convApi = sumNullable(setter, (s) => s.conv_api);
  const convOrg = convOrgSetter ?? (convApi === null ? null : Math.max(0, convApi - (convPag ?? 0)));
  // Outbound con respuesta: Instagram + WhatsApp
  const convOut = sumNullable(setter, (s) => (s.respuestas == null && s.respuestas_wa == null ? null : (s.respuestas ?? 0) + (s.respuestas_wa ?? 0)));
  const conversaciones = convOrg === null && convPag === null && convOut === null ? null : (convOrg ?? 0) + (convPag ?? 0) + (convOut ?? 0);
  const convIn = convOrg === null && convPag === null ? null : (convOrg ?? 0) + (convPag ?? 0);
  // Agendas outbound: leads marcados como Outbound; si no hay ninguno marcado, las que reportó el setter en su planilla.
  // El resto cuenta como inbound.
  const agOutMarcadas = ag.filter((a) => a.lead?.canal === 'Outbound').length;
  const agOutbound = agOutMarcadas || Math.min(ag.length, sumNullable(setter, (s) => s.agendas) ?? 0);
  const agInbound = ag.length - agOutbound;
  const links = sumNullable(setter, (s) => s.links_enviados);

  return {
    mes: f.mes,
    conv_organicas: convOrg,
    conv_pagadas: convPag,
    conv_pagadas_origen: convPagSetter !== null ? 'setter' : convPagMeta !== null ? 'meta' : null,
    conv_organicas_origen: convOrgSetter !== null ? 'setter' : convOrg !== null ? 'ig' : null,
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
    pct_cierre_sin_noshow: ratio(ventasAg.length, ag.length - noShow),
    pct_cierre_asistencia: ratio(ventasAg.length, asistencias),
    pct_cierre_oferta: ratio(ventasAg.length, ofertas),
    revenue,
    reembolsos,
    inversion_ads: inversion,
    costo_software: software,
    comisiones,
    comisiones_plataformas: comisionesPlataformas,
    comisiones_setter: comisionesSetter,
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
  const usdVentas = funnel ? ag.filter(esPago).reduce((acc, a) => acc + (a.cash_collected ?? 0), 0) : m.new_cash;
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
      { nombre: 'Cobrado USD', valor: usdVentas, esUsd: true, porCloser: porCloser((a) => (esPago(a) ? a.cash_collected ?? 0 : 0)) },
    ];
  }

  // Orgánico / YouTube: Conversaciones → Agendas → Llamadas → Cierres. General: arranca en Agendas.
  const setter = b.setter.filter((x) => enPeriodo(f, x.fecha));
  const sumN = (vals: (number | null | undefined)[]) => (vals.some((v) => v !== null && v !== undefined) ? vals.reduce<number>((acc, v) => acc + (v ?? 0), 0) : null);
  const conversaciones =
    !funnel ? m.conversaciones
    // Orgánico = orgánicas + pagadas (Follow Me Ads lleva al perfil) + outbound con respuesta
    : funnel === 'Orgánico' ? sumN(setter.map((x) => (x.conv_organicas ?? 0) + (x.conv_pagadas ?? 0) + (x.respuestas ?? 0) + (x.respuestas_wa ?? 0)))
    : null; // YouTube: todavía sin fuente de conversaciones
  return [
    // En el embudo general no va: mezcla orgánico, pago y outbound, y la tasa no dice nada
    ...(funnel ? [{ nombre: 'Conversaciones', valor: conversaciones }] : []),
    ...nivelesFinales,
    { nombre: 'Llamadas presentadas', valor: ag.filter((a) => a.asistio === 'Asistió').length, porCloser: porCloser((a) => a.asistio === 'Asistió') },
    { nombre: 'Cierres', valor: ventas.length, porCloser: porCloser(esVenta) },
    { nombre: 'Cobrado USD', valor: usdVentas, esUsd: true, porCloser: porCloser((a) => (esPago(a) ? a.cash_collected ?? 0 : 0)) },
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
  const ads = b.ads.filter((a) => enPeriodo(f, a.fecha));
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
  /** cierres / llamadas presentadas */
  pct_cierre: number | null;
  /** cierres / (agendas − no-shows) */
  pct_cierre_sin_noshow: number | null;
  /** Lo que cobró en el período: front end + back end − reembolsos (igual a `revenue`) */
  cash: number;
  /** Facturación del closer: lo que se cobró de sus ventas en el período */
  revenue: number;
  /** Lo que entró de ventas cerradas en el período */
  front_end: number;
  /** Lo que entró de cuotas de ventas anteriores */
  back_end: number;
}

export function resumenCloser(b: RawBundle, f: Filtros, closer: Closer | 'todos'): ResumenCloser {
  const ag = agendasDelMes(b, { ...f, closer });
  const asistencias = ag.filter((a) => a.asistio === 'Asistió').length;
  const ofertas = ag.filter((a) => a.oferta_hecha).length;
  const cierres = ag.filter(esVenta).length;
  const noShow = ag.filter((a) => a.asistio === 'No show').length;
  const plata = plataDelPeriodo(b, { ...f, closer });
  return {
    closer: closer === 'todos' ? CLOSER_POR_DEFECTO : closer,
    agendas: ag.length,
    asistencias,
    no_show: noShow,
    canceladas: ag.filter((a) => a.asistio === 'Canceló').length,
    pendientes: ag.filter((a) => a.asistio === 'Pendiente').length,
    pct_show: ratio(asistencias, ag.length),
    ofertas,
    cierres,
    senas: ag.filter((a) => a.compro === 'Reserva').length,
    pct_cierre: ratio(cierres, asistencias), // cierres sobre llamadas presentadas
    pct_cierre_sin_noshow: ratio(cierres, ag.length - noShow),
    cash: plata.facturacion,
    revenue: plata.facturacion,
    front_end: plata.frontEnd,
    back_end: plata.backEnd,
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
  // Mismo tramo del mes anterior (1 al 29 contra 1 al 29), o el día anterior si es un día
  return { actual: metricasMes(b, f), anterior: metricasMes(b, periodoAnterior(f)) };
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
  // Avisos del último cron que no son errores de una fuente (ej.: token por vencer)
  const ultimoCron = b.log.filter((l) => l.resumen.startsWith('cron')).sort((a, b2) => b2.fecha.localeCompare(a.fecha))[0];
  for (const p of ultimoCron?.pendientes ?? []) if (p.includes('vence') || p.startsWith('Planilla') || p.startsWith('ManyChat')) out.push({ tipo: 'agente', texto: p });
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
    comisiones: (m.comisiones ?? 0) + m.comisiones_setter,
    plataformas: m.comisiones_plataformas ?? 0,
    costos: Math.round((m.inversion_ads + (m.costo_software ?? 0) + (m.comisiones ?? 0) + m.comisiones_setter + (m.comisiones_plataformas ?? 0)) * 100) / 100,
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

export interface FilaUtm {
  clave: string;
  color: string;
  /** true = agendó sin UTM: el setter le pasó el calendario */
  sinUtm: boolean;
  /** Valores crudos del UTM que se agruparon en esta fila */
  codigos: string[];
  agendas: number;
  presentadas: number;
  ventas: number;
  cash: number;
  pctShow: number | null;
  pctCierre: number | null; // ventas / presentadas
  pctCierreSinNoShow: number | null; // ventas / (agendas − no-shows)
}

/**
 * Agendas según cómo agendaron: sin UTM = Setting (el setter pasó el calendario por Instagram);
 * con UTM = el link que usaron (el de Instagram es el link en bio).
 */
export function agendasPorUtm(b: RawBundle, f: Filtros): FilaUtm[] {
  const mapa = new Map<string, { color: string; sinUtm: boolean; codigos: Set<string>; ag: Agenda[] }>();
  for (const a of agendasDelMes(b, f)) {
    const c = comoAgendoPorUtm(a.lead);
    const g = mapa.get(c.nombre) ?? { color: c.color, sinUtm: c.sinUtm, codigos: new Set<string>(), ag: [] };
    if (c.codigo) g.codigos.add(c.codigo);
    g.ag.push(a);
    mapa.set(c.nombre, g);
  }
  return Array.from(mapa.entries())
    .map(([clave, g]) => {
      const ag = g.ag;
      const presentadas = ag.filter((a) => a.asistio === 'Asistió').length;
      const noShow = ag.filter((a) => a.asistio === 'No show').length;
      const ventas = ag.filter(esVenta);
      return {
        clave,
        color: g.color,
        sinUtm: g.sinUtm,
        codigos: Array.from(g.codigos),
        agendas: ag.length,
        presentadas,
        ventas: ventas.length,
        cash: ag.filter(esPago).reduce((s, a) => s + (a.cash_collected ?? 0), 0),
        pctShow: ratio(presentadas, ag.length),
        pctCierre: ratio(ventas.length, presentadas),
        pctCierreSinNoShow: ratio(ventas.length, ag.length - noShow),
      };
    })
    .sort((x, y) => y.agendas - x.agendas);
}

export interface SerieKpi {
  labels: string[];
  revenue: number[];
  cash: number[];
  ventas: number[];
  agendas: number[];
  asistencia: (number | null)[];
  cierreSinNoShow: (number | null)[];
  cierrePresentadas: (number | null)[];
}

/**
 * Evolución acumulada día a día de los números grandes dentro del período (del primer día hasta cada día),
 * para las sparklines de las tarjetas. No pasa de hoy. Con un solo día devuelve una serie de un punto.
 */
export function serieKpi(b: RawBundle, f: Filtros, hoy: string): SerieKpi {
  const dias = diasDelMes(f.mes);
  const inicio = f.dia ? f.dia : f.desde && mesDe(f.desde) === f.mes ? f.desde : dias[0];
  let fin = f.dia ? f.dia : f.hasta && mesDe(f.hasta) === f.mes ? f.hasta : dias[dias.length - 1];
  if (fin > hoy && inicio <= hoy) fin = hoy;
  const out: SerieKpi = { labels: [], revenue: [], cash: [], ventas: [], agendas: [], asistencia: [], cierreSinNoShow: [], cierrePresentadas: [] };
  for (const d of dias) {
    if (d < inicio || d > fin) continue;
    const m = metricasMes(b, { ...f, dia: null, desde: inicio, hasta: d, rangoAuto: false });
    out.labels.push(`${Number(d.slice(8))}/${Number(d.slice(5, 7))}`);
    out.revenue.push(m.revenue);
    out.cash.push(m.cash_collected);
    out.ventas.push(m.ventas);
    out.agendas.push(m.agendas);
    out.asistencia.push(m.pct_asistencia);
    out.cierreSinNoShow.push(m.pct_cierre_sin_noshow);
    out.cierrePresentadas.push(m.pct_cierre_asistencia);
  }
  return out;
}
