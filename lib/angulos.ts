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
  cash: number;
  quienes: string[];
  /** Para sumar por etapa sin contar dos veces */
  idsReels: string[];
  idsAgendas: string[];
}

const VACIO = (): CruceAngulo => ({ reels: 0, views: 0, comentarios: 0, seguidores: 0, agendas: 0, ventas: 0, cash: 0, quienes: [], idsReels: [], idsAgendas: [] });

/**
 * Cruza cada ángulo con lo que ya hay en el dashboard, por sus palabras clave:
 * - reels de Instagram (título) → views, comentarios y seguidores;
 * - etiquetas de ManyChat de los leads → agendas, ventas y cobrado.
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
      }
      for (const ag of b.agendas) {
        if (!(ag.lead?.manychat_tags ?? []).some(toca)) continue;
        c.agendas++;
        c.idsAgendas.push(ag.id);
        if (!esVenta(ag)) continue;
        c.ventas++;
        c.cash += ag.cash_collected ?? 0;
        const quien = ag.lead?.nombre ?? '—';
        if (!c.quienes.includes(quien)) c.quienes.push(quien);
      }
    }
    out.set(a.id, c);
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

/** Totales por etapa del embudo. Un reel o una llamada que toca dos ángulos de la misma etapa cuenta una sola vez. */
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
      cash: ventas.reduce((s, a) => s + (a.cash_collected ?? 0), 0),
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
