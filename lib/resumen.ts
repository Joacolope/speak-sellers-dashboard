import type { Closer, RawBundle } from './types';
import { CLOSERS, NOMBRE_CLOSER } from './types';
import { esVenta } from './metrics';
import { progresoMetas, type ProgresoMeta } from './metas';
import { cuotasPorCobrar, totalCuotas, type CuotaPendiente } from './cuotas';
import { alertas, type Alerta } from './alertas';
import { MESES, mesDe, num, pct, sumarDias, usd, variacion } from './format';

export interface Semana {
  facturacion: number;
  cobrado: number;
  ventas: number;
  agendas: number;
  presentadas: number;
  pctShow: number | null;
  pctCierre: number | null;
  inversion: number;
  conversaciones: number;
}

function semana(b: RawBundle, desde: string, hasta: string): Semana & { listaVentas: { nombre: string; closer: Closer; monto: number }[]; porCloser: { closer: Closer; ventas: number; cobrado: number }[] } {
  const enRango = (f: string | null | undefined) => Boolean(f) && f!.slice(0, 10) >= desde && f!.slice(0, 10) <= hasta;
  const ag = b.agendas.filter((a) => enRango(a.fecha_llamada));
  const ventas = ag.filter(esVenta);
  const presentadas = ag.filter((a) => a.asistio === 'Asistió').length;
  const resueltas = ag.filter((a) => a.asistio !== 'Pendiente').length;
  const cob = b.cobranzas.filter((c) => enRango(c.fecha_cobro));
  const setter = b.setter.filter((s) => enRango(s.fecha));
  return {
    facturacion: ventas.reduce((s, a) => s + (a.cash_collected ?? 0), 0),
    cobrado: cob.reduce((s, c) => s + c.monto_cobrado, 0),
    ventas: ventas.length,
    agendas: ag.length,
    presentadas,
    pctShow: resueltas ? presentadas / resueltas : null,
    pctCierre: presentadas ? ventas.length / presentadas : null,
    inversion: b.ads.filter((a) => enRango(a.fecha)).reduce((s, a) => s + a.inversion, 0),
    conversaciones: setter.reduce((s, x) => s + (x.conv_organicas ?? 0) + (x.conv_pagadas ?? 0) + (x.respuestas ?? 0) + (x.respuestas_wa ?? 0), 0),
    listaVentas: ventas.map((a) => ({ nombre: a.lead?.nombre ?? 'Sin nombre', closer: a.closer, monto: a.cash_collected ?? 0 })).sort((x, y) => y.monto - x.monto),
    porCloser: CLOSERS.map((c) => ({
      closer: c,
      ventas: ventas.filter((a) => a.closer === c).length,
      cobrado: cob.filter((x) => x.closer === c).reduce((s, x) => s + x.monto_cobrado, 0),
    })).sort((x, y) => y.cobrado - x.cobrado),
  };
}

export interface DatosResumen {
  desde: string;
  hasta: string;
  actual: ReturnType<typeof semana>;
  anterior: Semana;
  metas: ProgresoMeta[];
  dia: number;
  dias: number;
  vencidas: CuotaPendiente[];
  proxSemana: CuotaPendiente[];
  alertas: Alerta[];
}

/** Semana que termina hoy (viernes a la tarde: de sábado a viernes) contra la anterior. */
export function datosResumen(b: RawBundle, hoy: string): DatosResumen {
  const desde = sumarDias(hoy, -6);
  const m = progresoMetas(b, { mes: mesDe(hoy), dia: null, closer: 'todos', fuente: 'todas' }, hoy);
  const cuotas = cuotasPorCobrar(b, hoy);
  return {
    desde,
    hasta: hoy,
    actual: semana(b, desde, hoy),
    anterior: semana(b, sumarDias(hoy, -13), sumarDias(hoy, -7)),
    metas: m.items.filter((i) => i.meta),
    dia: m.transcurridos,
    dias: m.dias,
    vencidas: cuotas.vencidas,
    proxSemana: cuotas.semana,
    alertas: alertas(b, hoy, m.items),
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fechaTxt = (f: string) => `${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1].toLowerCase()}`;

export function asuntoResumen(d: DatosResumen): string {
  return `Resumen semanal · ${fechaTxt(d.desde)} al ${fechaTxt(d.hasta)} · ${usd(d.actual.cobrado)} cobrados`;
}

/** Mail en HTML con estilos en línea (los clientes de mail no leen CSS externo). */
export function htmlResumen(d: DatosResumen, appUrl: string): string {
  const C = { tinta: '#171717', gris: '#6b6b6b', claro: '#a3a3a3', borde: '#e7e5e4', fondo: '#f5f3ef', verde: '#15803d', rojo: '#b91c1c', amarillo: '#a16207', azul: '#1d4ed8' };
  const delta = (a: number | null, b: number | null, invertir = false) => {
    const v = variacion(a, b);
    if (v === null || !Number.isFinite(v)) return `<span style="color:${C.claro}">sin semana anterior</span>`;
    const bueno = invertir ? v <= 0 : v >= 0;
    return `<span style="color:${bueno ? C.verde : C.rojo}">${v >= 0 ? '▲' : '▼'} ${pct(Math.abs(v))}</span> <span style="color:${C.claro}">vs. semana anterior</span>`;
  };
  const kpi = (label: string, valor: string, cmp: string) => `
    <td width="50%" style="padding:6px" valign="top">
      <div style="background:#ffffff;border:1px solid ${C.borde};border-radius:12px;padding:16px">
        <div style="font-size:13px;color:${C.gris}">${label}</div>
        <div style="font-size:26px;color:${C.tinta};margin:4px 0">${valor}</div>
        <div style="font-size:12px">${cmp}</div>
      </div>
    </td>`;
  const a = d.actual, p = d.anterior;
  const filas = [
    [kpi('Cash cobrado', usd(a.cobrado), delta(a.cobrado, p.cobrado)), kpi('Ventas nuevas (cobrado)', usd(a.facturacion), delta(a.facturacion, p.facturacion))],
    [kpi('Ventas', num(a.ventas), delta(a.ventas, p.ventas)), kpi('Agendas', num(a.agendas), delta(a.agendas, p.agendas))],
    [kpi('Llamadas presentadas', `${num(a.presentadas)} <span style="font-size:14px;color:${C.gris}">· ${pct(a.pctShow)} show</span>`, delta(a.presentadas, p.presentadas)), kpi('% cierre / llamadas', pct(a.pctCierre), delta(a.pctCierre, p.pctCierre))],
    [kpi('Inversión en ads', usd(a.inversion, 2), delta(a.inversion, p.inversion, true)), kpi('Conversaciones', num(a.conversaciones), delta(a.conversaciones, p.conversaciones))],
  ].map((f) => `<tr>${f.join('')}</tr>`).join('');

  const titulo = (t: string) => `<div style="font-size:13px;color:${C.gris};text-transform:uppercase;letter-spacing:.04em;margin:28px 0 10px">${t}</div>`;
  const colorEstado = (e: ProgresoMeta['estado']) => (e === 'green' ? C.verde : e === 'yellow' ? C.amarillo : e === 'red' ? C.rojo : C.azul);

  const metas = d.metas.length
    ? titulo(`Meta del mes · día ${d.dia} de ${d.dias}`) +
      d.metas.map((m) => {
        const v = (x: number | null) => (m.esUsd ? usd(x) : num(x));
        const real = Math.min(100, Math.round((m.actual / (m.meta ?? 1)) * 100));
        return `
        <div style="margin-bottom:14px">
          <div style="font-size:14px;color:${C.tinta}">${m.label}: <strong>${v(m.actual)}</strong> <span style="color:${C.gris}">de ${v(m.meta)}</span></div>
          <div style="background:${C.borde};border-radius:99px;height:8px;margin:6px 0;overflow:hidden"><div style="background:${colorEstado(m.estado)};width:${real}%;height:8px;border-radius:99px"></div></div>
          ${m.proyeccion !== null && d.dia < d.dias ? `<div style="font-size:12px;color:${colorEstado(m.estado)}">A este ritmo: ${v(m.proyeccion)} (${pct(m.avance)} de la meta)</div>` : ''}
        </div>`;
      }).join('')
    : '';

  const lista = (items: string[]) => `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${C.tinta}">${items.join('')}</table>`;
  const fila = (izq: string, der: string, sub = '') => `<tr><td style="padding:8px 0;border-top:1px solid ${C.borde}">${izq}${sub ? `<div style="font-size:12px;color:${C.claro}">${sub}</div>` : ''}</td><td align="right" style="padding:8px 0;border-top:1px solid ${C.borde}">${der}</td></tr>`;

  const ventas = titulo(`Ventas de la semana (${a.listaVentas.length})`) +
    (a.listaVentas.length ? lista(a.listaVentas.map((v) => fila(esc(v.nombre), usd(v.monto), NOMBRE_CLOSER[v.closer]))) : `<div style="font-size:14px;color:${C.gris}">No hubo ventas esta semana.</div>`);

  const closers = titulo('Closers') + lista(a.porCloser.map((c) => fila(NOMBRE_CLOSER[c.closer], usd(c.cobrado), `${c.ventas} ${c.ventas === 1 ? 'venta' : 'ventas'}`)));

  const cuota = (c: CuotaPendiente) => fila(esc(c.nombre), usd(c.monto), `${NOMBRE_CLOSER[c.closer]} · ${c.dias < 0 ? `venció hace ${-c.dias} días` : `vence el ${fechaTxt(c.vence)}`}`);
  const cobrar = d.vencidas.length || d.proxSemana.length
    ? titulo('Cuotas por cobrar') +
      (d.vencidas.length ? `<div style="font-size:13px;color:${C.rojo};margin-bottom:4px">Vencidas · ${usd(totalCuotas(d.vencidas))}</div>${lista(d.vencidas.map(cuota))}` : '') +
      (d.proxSemana.length ? `<div style="font-size:13px;color:${C.amarillo};margin:12px 0 4px">Vencen la semana que viene · ${usd(totalCuotas(d.proxSemana))}</div>${lista(d.proxSemana.map(cuota))}` : '')
    : '';

  const colorAlerta = { red: C.rojo, yellow: C.amarillo, blue: C.azul };
  const alertasHtml = d.alertas.length
    ? titulo('Para mirar') + d.alertas.map((x) => `<div style="font-size:14px;color:${C.tinta};padding:6px 0"><span style="color:${colorAlerta[x.nivel]}">●</span> ${esc(x.texto)}</div>`).join('')
    : '';

  return `<!doctype html><html><body style="margin:0;background:${C.fondo};font-family:Inter,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.fondo}"><tr><td align="center" style="padding:32px 12px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%"><tr><td>
      <div style="font-size:13px;color:${C.gris}">Speak Sellers · Resumen semanal</div>
      <div style="font-size:28px;color:${C.tinta};margin:6px 0 4px">Semana del ${fechaTxt(d.desde)} al ${fechaTxt(d.hasta)}</div>
      <div style="font-size:14px;color:${C.gris};margin-bottom:16px">Cobraste <strong style="color:${C.verde}">${usd(a.cobrado)}</strong> con ${num(a.ventas)} ${a.ventas === 1 ? 'venta nueva' : 'ventas nuevas'} y ${num(a.agendas)} agendas.</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 -6px">${filas}</table>
      ${metas}${alertasHtml}${ventas}${closers}${cobrar}
      <div style="margin:32px 0 8px"><a href="${esc(appUrl)}" style="background:${C.tinta};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;display:inline-block">Abrir el dashboard</a></div>
      <div style="font-size:12px;color:${C.claro};margin-top:24px">Se manda solo todos los viernes a las 18:00 (Argentina). Cash cobrado = cobros de la semana menos reembolsos.</div>
    </td></tr></table>
  </td></tr></table></body></html>`;
}
