import { esVenta } from './metrics';
import type { Angulo, RawBundle } from './types';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export interface CruceAngulo {
  /** Ventas (últimos 14 meses) cuyo lead tiene una etiqueta de ManyChat con alguna palabra clave del ángulo */
  ventas: number;
  cash: number;
  quienes: string[];
  /** Reels cuyo título tiene alguna palabra clave */
  reels: number;
  views: number;
  comentarios: number;
  seguidores: number;
}

/** Cruza cada ángulo con las etiquetas de ManyChat de los compradores y con los títulos de los reels. */
export function cruzarAngulos(b: RawBundle): Map<string, CruceAngulo> {
  const ventas = b.agendas.filter(esVenta);
  const reels = b.piezas.filter((p) => p.tipo === 'reel');
  const out = new Map<string, CruceAngulo>();
  for (const a of b.angulos) {
    const claves = a.palabras_clave.map(norm).filter((k) => k.length >= 3);
    const c: CruceAngulo = { ventas: 0, cash: 0, quienes: [], reels: 0, views: 0, comentarios: 0, seguidores: 0 };
    if (claves.length) {
      const toca = (t: string) => claves.some((k) => norm(t).includes(k));
      const vistos = new Set<string>();
      for (const v of ventas) {
        if (!(v.lead?.manychat_tags ?? []).some(toca)) continue;
        c.cash += v.cash_collected ?? 0;
        const quien = v.lead?.nombre ?? '—';
        if (!vistos.has(quien)) {
          vistos.add(quien);
          c.ventas++;
          c.quienes.push(quien);
        }
      }
      for (const r of reels) {
        if (!toca(r.titulo ?? '')) continue;
        c.reels++;
        c.views += r.views ?? 0;
        c.comentarios += r.comentarios ?? 0;
        c.seguidores += r.seguidores ?? 0;
      }
    }
    out.set(a.id, c);
  }
  return out;
}

/** Orden dentro de cada etapa: lo que funciona primero, después lo que se prueba, lo descartado al final. */
export function ordenarAngulos(lista: Angulo[], cruce: Map<string, CruceAngulo>): Angulo[] {
  const peso = { Funcionando: 0, Probando: 1, Descartado: 2 } as const;
  return [...lista].sort((x, y) => peso[x.estado] - peso[y.estado] || (cruce.get(y.id)?.cash ?? 0) - (cruce.get(x.id)?.cash ?? 0) || x.nombre.localeCompare(y.nombre));
}
