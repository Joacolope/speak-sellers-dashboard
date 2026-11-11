import { esVenta } from './metrics';
import { ETAPAS, type Angulo, type Etapa, type RawBundle } from './types';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export interface CruceAngulo {
  /** Reels cuyo título tiene alguna palabra clave del ángulo */
  reels: number;
  views: number;
  comentarios: number;
  seguidores: number;
  /** Llamadas de leads que tienen una etiqueta de ManyChat con alguna palabra clave */
  agendas: number;
  ventas: number;
  /** Cobrado que le toca al ángulo: cada venta se reparte en partes iguales entre los ángulos que tocó ese lead */
  cash: number;
  quienes: string[];
  /** En qué se basa: etiquetas de ManyChat que coincidieron, leads (con su conversación) y reels */
  etiquetas: string[];
  /** Datos de origen del lead que coincidieron (fuente, funnel, primer contacto, UTM): p. ej. "Webinar" */
  origenes: string[];
  /** cash = la parte que le toca a este ángulo; total = lo que pagó el lead; entre = cuántos ángulos se la reparten */
  leads: { nombre: string; chat: string | null; compro: boolean; cash: number; total: number; entre: number }[];
  listaReels: { titulo: string; url: string | null; views: number }[];
  /** Para sumar por etapa sin contar dos veces */
  idsReels: string[];
  idsAgendas: string[];
}

const VACIO = (): CruceAngulo => ({ reels: 0, views: 0, comentarios: 0, seguidores: 0, agendas: 0, ventas: 0, cash: 0, quienes: [], etiquetas: [], origenes: [], leads: [], listaReels: [], idsReels: [], idsAgendas: [] });

/**
 * Cruza cada ángulo con lo que ya hay en el dashboard, por sus palabras clave:
 * - reels de Instagram (título) → views, comentarios y seguidores;
 * - etiquetas de ManyChat y origen de los leads (fuente, funnel, primer contacto, UTM) → agendas, ventas y cobrado.
 * Lo cobrado de cada venta se reparte en partes iguales entre todos los ángulos que tocó ese lead,
 * así la suma de los ángulos da lo cobrado real y no se cuenta la misma plata dos veces.
 */
export function cruzarAngulos(b: RawBundle): Map<string, CruceAngulo> {
  const reels = b.piezas.filter((p) => p.tipo === 'reel');
  const out = new Map<string, CruceAngulo>();
  for (const a of b.angulos) {
    const claves = a.palabras_clave.map(norm).filter((k) => k.length >= 3);
    const c = VACIO();
    if (claves.length) {
      const toca = (t: string) => claves.some((k) => norm(t).includes(k));
      for (const r of reels) {
        if (!toca(r.titulo ?? '')) continue;
        c.reels++;
        c.views += r.views ?? 0;
        c.comentarios += r.comentarios ?? 0;
        c.seguidores += r.seguidores ?? 0;
        c.idsReels.push(r.ig_media_id);
        c.listaReels.push({ titulo: r.titulo ?? 'Reel', url: r.url ?? null, views: r.views ?? 0 });
      }
      c.listaReels.sort((x, y) => y.views - x.views);
      for (const ag of b.agendas) {
        const l = ag.lead;
        const coinciden = (l?.manychat_tags ?? []).filter(toca);
        // También por de dónde vino el lead: así "webinar" junta a todos los que entraron por un webinar
        const origen = [l?.fuente, l?.funnel, l?.primer_punto_contacto, l?.utm_campaign, l?.utm_content]
          .filter((v): v is NonNullable<typeof v> => Boolean(v)).map(String).filter(toca);
        if (!coinciden.length && !origen.length) continue;
        for (const o of origen) if (!c.origenes.includes(o)) c.origenes.push(o);
        c.agendas++;
        c.idsAgendas.push(ag.id);
        for (const t of coinciden) if (!c.etiquetas.includes(t)) c.etiquetas.push(t);
      }
    }
    out.set(a.id, c);
  }

  // Entre cuántos ángulos se reparte cada llamada
  const entre = new Map<string, number>();
  for (const c of out.values()) for (const id of c.idsAgendas) entre.set(id, (entre.get(id) ?? 0) + 1);
  const agendaPorId = new Map(b.agendas.map((ag) => [ag.id, ag]));
  for (const c of out.values()) {
    for (const id of c.idsAgendas) {
      const ag = agendaPorId.get(id);
      if (!ag) continue;
      const quien = ag.lead?.nombre ?? '—';
      const venta = esVenta(ag);
      const n = entre.get(id) ?? 1;
      const total = venta ? ag.cash_collected ?? 0 : 0;
      const parte = total / n;
      const previo = c.leads.find((l) => l.nombre === quien);
      if (previo) {
        previo.compro = previo.compro || venta;
        previo.cash += parte;
        previo.total += total;
        if (venta) previo.entre = n;
      } else c.leads.push({ nombre: quien, chat: ag.lead?.manychat_url ?? null, compro: venta, cash: parte, total, entre: n });
      if (!venta) continue;
      c.ventas++;
      c.cash += parte;
      if (!c.quienes.includes(quien)) c.quienes.push(quien);
    }
    c.leads.sort((x, y) => Number(y.compro) - Number(x.compro) || y.cash - x.cash || x.nombre.localeCompare(y.nombre));
  }
  return out;
}

export interface EtapaEmbudo {
  etapa: Etapa;
  angulos: number;
  funcionando: number;
  reels: number;
  views: number;
  seguidores: number;
  agendas: number;
  ventas: number;
  cash: number;
}

/** Totales por etapa del embudo. Un reel o una llamada que toca dos ángulos de la misma etapa cuenta una sola vez; lo cobrado es la suma de las partes de sus ángulos. */
export function embudoPorEtapa(b: RawBundle, cruce: Map<string, CruceAngulo>): EtapaEmbudo[] {
  const reelPorId = new Map(b.piezas.map((p) => [p.ig_media_id, p]));
  const agendaPorId = new Map(b.agendas.map((a) => [a.id, a]));
  return ETAPAS.map((etapa) => {
    const lista = b.angulos.filter((a) => a.etapa === etapa && a.estado !== 'Descartado');
    const idsReels = new Set(lista.flatMap((a) => cruce.get(a.id)?.idsReels ?? []));
    const idsAgendas = new Set(lista.flatMap((a) => cruce.get(a.id)?.idsAgendas ?? []));
    const reels = Array.from(idsReels).map((id) => reelPorId.get(id)!).filter(Boolean);
    const agendas = Array.from(idsAgendas).map((id) => agendaPorId.get(id)!).filter(Boolean);
    const ventas = agendas.filter(esVenta);
    return {
      etapa,
      angulos: lista.length,
      funcionando: lista.filter((a) => a.estado === 'Funcionando').length,
      reels: reels.length,
      views: reels.reduce((s, r) => s + (r.views ?? 0), 0),
      seguidores: reels.reduce((s, r) => s + (r.seguidores ?? 0), 0),
      agendas: agendas.length,
      ventas: ventas.length,
      cash: lista.reduce((s, a) => s + (cruce.get(a.id)?.cash ?? 0), 0),
    };
  });
}

/** Ranking: primero lo que más plata trajo, después ventas, agendas y views. Lo descartado va al final. */
export function rankingAngulos(lista: Angulo[], cruce: Map<string, CruceAngulo>): Angulo[] {
  const c = (a: Angulo) => cruce.get(a.id) ?? VACIO();
  return [...lista].sort((x, y) =>
    Number(x.estado === 'Descartado') - Number(y.estado === 'Descartado')
    || c(y).cash - c(x).cash || c(y).ventas - c(x).ventas || c(y).agendas - c(x).agendas || c(y).views - c(x).views
    || Number(y.estado === 'Funcionando') - Number(x.estado === 'Funcionando') || x.nombre.localeCompare(y.nombre));
}
