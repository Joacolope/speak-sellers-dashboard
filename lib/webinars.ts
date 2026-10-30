import { enPeriodo, esPago, esVenta } from './metrics';
import { funnelDeLead, type Filtros, type RawBundle } from './types';

export interface FilaWebinar {
  fecha: string;
  nombre: string;
  inversion: number;
  registrados: number | null;
  calificados: number | null;
  asistentes: number | null;
  agendas: number;
  presentadas: number;
  ventas: number;
  cash: number;
}

const masDias = (fecha: string, n: number) => new Date(new Date(`${fecha}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

/**
 * Un renglón por webinar. Como un webinar no se mide por conversaciones, se atribuye:
 * - inversión: anuncios de campaña webinar desde el webinar anterior (máx. 30 días antes) hasta el día del vivo;
 * - agendas/ventas: llamadas de leads del funnel Webinar desde el vivo hasta el webinar siguiente (máx. 30 días).
 * Si no se cargaron registrados a mano, se usan los registros que reporta Meta.
 */
export function resumenWebinars(b: RawBundle, f: Filtros): FilaWebinar[] {
  const webs = [...b.webinars].sort((x, y) => x.fecha.localeCompare(y.fecha));
  const adsWeb = b.ads.filter((a) => a.campana === 'webinar');
  const agWeb = b.agendas.filter((a) => funnelDeLead(a.lead?.funnel, a.lead?.fuente) === 'Webinar');
  return webs
    .map((w, i) => {
      const prev = webs[i - 1]?.fecha;
      const desde = prev && prev > masDias(w.fecha, -30) ? prev : masDias(w.fecha, -30);
      const ads = adsWeb.filter((a) => a.fecha > desde && a.fecha <= w.fecha);
      const hasta = webs[i + 1]?.fecha ?? masDias(w.fecha, 30);
      const ag = agWeb.filter((a) => {
        const d = a.fecha_llamada.slice(0, 10);
        return d >= w.fecha && d < hasta;
      });
      const regMeta = ads.some((a) => a.registros != null) ? ads.reduce((s, a) => s + (a.registros ?? 0), 0) : null;
      const ventas = ag.filter(esVenta);
      return {
        fecha: w.fecha,
        nombre: w.nombre ?? `Webinar ${w.fecha}`,
        inversion: ads.reduce((s, a) => s + a.inversion, 0),
        registrados: w.registrados ?? regMeta,
        calificados: w.registrados_calificados ?? null,
        asistentes: w.asistentes ?? null,
        agendas: ag.length,
        presentadas: ag.filter((a) => a.asistio === 'Asistió').length,
        ventas: ventas.length,
        cash: ag.filter(esPago).reduce((s, a) => s + (a.cash_collected ?? 0), 0),
      };
    })
    .filter((w) => enPeriodo(f, w.fecha));
}

/** Suma de los webinars del período (null si ningún webinar tiene el dato). */
export function totalWebinars(filas: FilaWebinar[]) {
  const sumN = (k: 'registrados' | 'calificados' | 'asistentes') =>
    filas.some((w) => w[k] !== null) ? filas.reduce((s, w) => s + (w[k] ?? 0), 0) : null;
  const sum = (k: 'inversion' | 'agendas' | 'presentadas' | 'ventas' | 'cash') => filas.reduce((s, w) => s + w[k], 0);
  return {
    inversion: sum('inversion'),
    registrados: sumN('registrados'),
    calificados: sumN('calificados'),
    asistentes: sumN('asistentes'),
    agendas: sum('agendas'),
    presentadas: sum('presentadas'),
    ventas: sum('ventas'),
    cash: sum('cash'),
  };
}
