import { leerTags } from './manychat';
import type { Angulo, Etapa, Lead, OrganicoPieza } from './types';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const DIA = 86400000;

export interface PiezaDelLead {
  /** Fecha de la pieza según la etiqueta de ManyChat (AAAA-MM-DD) */
  fecha: string;
  /** Nombre de la pieza según la etiqueta ("Precio al principio") */
  nombre: string;
  /** Link a la publicación de Instagram, si se pudo encontrar */
  url: string | null;
  /** Cómo se encontró el link: por la palabra clave del reel o solo por la fecha */
  encontradaPor: 'palabra' | 'fecha' | null;
  /** Ángulo de Marketing al que pertenece (por sus palabras clave) y su etapa del embudo */
  angulo: string | null;
  etapa: Etapa | null;
}

/** Palabra clave de un reel: lo que está entre «» en su título ("Reel «LLAMADA»" → "llamada"). */
const palabraDe = (titulo?: string | null) => {
  const m = (titulo ?? '').match(/«([^»]+)»/);
  return m ? norm(m[1]) : null;
};

/**
 * Las piezas a las que respondió un lead, de la más vieja a la más nueva, cada una con su publicación de Instagram
 * y su etapa del embudo. Sale sola de las etiquetas de ManyChat que empiezan con fecha ("05/11/26 Precio al principio"):
 * - el link se busca entre los reels publicados ese día o un día antes o después: primero por la palabra clave
 *   del reel (la que va entre «»); si ese día hubo un solo reel, se toma ese;
 * - la etapa es la del ángulo de Marketing cuyas palabras clave aparecen en el nombre de la pieza.
 */
export function piezasDelLead(lead: Lead | null | undefined, reels: OrganicoPieza[], angulos: Angulo[]): PiezaDelLead[] {
  return leerTags(lead?.manychat_tags).piezas.map((p) => {
    const t = Date.parse(`${p.fecha}T12:00:00Z`);
    const nombre = norm(p.nombre);
    const cerca = reels
      .filter((r) => r.tipo === 'reel' && Math.abs(Date.parse(`${r.fecha.slice(0, 10)}T12:00:00Z`) - t) <= DIA)
      .sort((x, y) => Math.abs(Date.parse(`${x.fecha.slice(0, 10)}T12:00:00Z`) - t) - Math.abs(Date.parse(`${y.fecha.slice(0, 10)}T12:00:00Z`) - t));
    const porPalabra = cerca.find((r) => {
      const k = palabraDe(r.titulo);
      return k !== null && k.length >= 3 && nombre.includes(k);
    });
    const mismoDia = cerca.filter((r) => r.fecha.slice(0, 10) === p.fecha);
    const reel = porPalabra ?? (mismoDia.length === 1 ? mismoDia[0] : null);
    const angulo = angulos.find((a) => a.palabras_clave.some((k) => norm(k).length >= 3 && nombre.includes(norm(k))));
    return {
      fecha: p.fecha,
      nombre: p.nombre,
      url: reel?.url ?? null,
      encontradaPor: reel ? (porPalabra ? 'palabra' : 'fecha') : null,
      angulo: angulo?.nombre ?? null,
      etapa: angulo?.etapa ?? null,
    };
  });
}

/**
 * Primera y última pieza del recorrido de una venta. Se toman las anteriores a la compra;
 * si todas son posteriores (el lead siguió comentando después de comprar), se avisa con `despues`.
 */
export function primeraYUltima(piezas: PiezaDelLead[], fechaCompra: string): { primera: PiezaDelLead | null; ultima: PiezaDelLead | null; total: number; despues: boolean } {
  const antes = piezas.filter((p) => p.fecha <= fechaCompra.slice(0, 10));
  const lista = antes.length ? antes : piezas;
  return {
    primera: lista[0] ?? null,
    ultima: lista.length > 1 ? lista[lista.length - 1] : null,
    total: lista.length,
    despues: !antes.length && piezas.length > 0,
  };
}
