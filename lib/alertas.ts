import type { RawBundle } from './types';
import { cuotasPorCobrar, totalCuotas } from './cuotas';
import type { ProgresoMeta } from './metas';
import { num, pct, sumarDias, usd } from './format';

export interface Alerta {
  nivel: 'red' | 'yellow' | 'blue';
  texto: string;
  href?: string;
}

const nombres = (arr: string[], max = 3) => (arr.length > max ? `${arr.slice(0, max).join(', ')} y ${arr.length - max} más` : arr.join(', '));

/** Lo que conviene mirar hoy. Rojo = plata en riesgo, amarillo = revisar, azul = falta un dato. */
export function alertas(b: RawBundle, hoy: string, metas: ProgresoMeta[] = []): Alerta[] {
  const out: Alerta[] = [];
  const ayer = sumarDias(hoy, -1);
  const dia = (iso: string) => iso.slice(0, 10);

  // Cuotas vencidas
  const { vencidas } = cuotasPorCobrar(b, hoy);
  if (vencidas.length)
    out.push({ nivel: 'red', texto: `${vencidas.length === 1 ? '1 cuota vencida' : `${vencidas.length} cuotas vencidas`} por ${usd(totalCuotas(vencidas))}: ${nombres(vencidas.map((c) => c.nombre))}`, href: '/cobranzas' });

  // Metas que a este ritmo no llegan
  const lejos = metas.filter((m) => m.estado === 'red' && m.meta !== null && m.proyeccion !== null);
  if (lejos.length) {
    const v = (m: ProgresoMeta, x: number) => (m.esUsd ? usd(x) : num(x));
    out.push({
      nivel: 'red',
      texto: `A este ritmo no se llega a la meta: ${lejos.map((m) => `${m.label} ${v(m, m.proyeccion!)} de ${v(m, m.meta!)} (${pct(m.avance)})`).join(' · ')}`,
      href: '/#metas',
    });
  }

  // No-shows de ayer
  const noShows = b.agendas.filter((a) => dia(a.fecha_llamada) === ayer && a.asistio === 'No show');
  if (noShows.length)
    out.push({ nivel: 'yellow', texto: `${noShows.length === 1 ? '1 no-show' : `${noShows.length} no-shows`} ayer: ${nombres(noShows.map((a) => a.lead?.nombre ?? 'Sin nombre'))}. Reagendar.`, href: '/closers' });

  // Llamadas de hoy sin confirmar por WhatsApp
  const sinConfirmar = b.agendas.filter((a) => dia(a.fecha_llamada) === hoy && a.asistio === 'Pendiente' && !a.confirmada_whatsapp);
  if (sinConfirmar.length)
    out.push({ nivel: 'yellow', texto: `${sinConfirmar.length === 1 ? '1 llamada' : `${sinConfirmar.length} llamadas`} de hoy sin confirmar por WhatsApp: ${nombres(sinConfirmar.map((a) => a.lead?.nombre ?? 'Sin nombre'))}`, href: '/closers' });

  // Llamadas pasadas sin resultado cargado (últimos 14 días)
  const sinMarcar = b.agendas.filter((a) => dia(a.fecha_llamada) < hoy && dia(a.fecha_llamada) >= sumarDias(hoy, -14) && a.asistio === 'Pendiente');
  if (sinMarcar.length)
    out.push({ nivel: 'yellow', texto: `${sinMarcar.length === 1 ? '1 llamada pasada' : `${sinMarcar.length} llamadas pasadas`} sin marcar si asistió`, href: '/closers' });

  // Costo por resultado de anuncios: últimos 7 días vs. los 7 anteriores
  const ventanas = [
    { campana: 'follow_me' as const, nombre: 'Follow Me Ads', resultado: 'seguidor', de: (a: RawBundle['ads'][number]) => a.seguidores },
    { campana: 'webinar' as const, nombre: 'Webinar', resultado: 'registro', de: (a: RawBundle['ads'][number]) => a.registros },
  ];
  for (const w of ventanas) {
    const costo = (desde: string, hasta: string) => {
      const ads = b.ads.filter((a) => a.campana === w.campana && a.fecha >= desde && a.fecha <= hasta);
      const res = ads.reduce((s, a) => s + (w.de(a) ?? 0), 0);
      const inv = ads.reduce((s, a) => s + a.inversion, 0);
      return res > 0 && ads.length >= 3 ? inv / res : null;
    };
    const ahora = costo(sumarDias(hoy, -7), ayer);
    const antes = costo(sumarDias(hoy, -14), sumarDias(hoy, -8));
    if (ahora !== null && antes !== null && ahora >= antes * 1.3)
      out.push({ nivel: 'yellow', texto: `Costo por ${w.resultado} de ${w.nombre} subió ${pct(ahora / antes - 1)} esta semana (${usd(ahora, 2)} vs. ${usd(antes, 2)})`, href: '/anuncios' });
  }

  // Datos que faltan
  if (b.setter.length && !b.setter.some((s) => s.fecha === ayer))
    out.push({ nivel: 'blue', texto: 'Falta cargar el setter de ayer', href: '/setter' });

  return out;
}
