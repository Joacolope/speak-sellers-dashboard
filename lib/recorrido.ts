import { leerTags, tagsDeLaVenta } from './manychat';
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
/**
 * Reels que ya tienen dueño: los que alguna etiqueta de ManyChat (de cualquier lead) nombra por su palabra clave.
 * Sirve para desempatar los días con más de un reel: si una pieza no nombra su reel, se descartan los que ya
 * son de otra pieza y, si queda uno solo, es ese.
 */
export function reelsConDueño(leads: (Lead | null | undefined)[], reels: OrganicoPieza[]): Map<string, string> {
  const dueño = new Map<string, string>(); // url del reel → nombre de la pieza que lo nombra
  const conPalabra = reels.filter((r) => r.tipo === 'reel' && r.url && palabraDe(r.titulo));
  for (const l of leads) {
    for (const p of leerTags(tagsDeLaVenta(l)).piezas) {
      const t = Date.parse(`${p.fecha}T12:00:00Z`);
      const nombre = norm(p.nombre);
      const r = conPalabra.find((x) => Math.abs(Date.parse(`${x.fecha.slice(0, 10)}T12:00:00Z`) - t) <= DIA && (palabraDe(x.titulo) ?? '').length >= 3 && nombre.includes(palabraDe(x.titulo)!));
      if (r?.url && !dueño.has(r.url)) dueño.set(r.url, nombre);
    }
  }
  return dueño;
}

export function piezasDelLead(lead: Lead | null | undefined, reels: OrganicoPieza[], angulos: Angulo[], dueños?: Map<string, string>): PiezaDelLead[] {
  return leerTags(tagsDeLaVenta(lead)).piezas.map((p) => {
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
    // Varios reels ese día: se descartan los que ya nombra otra pieza
    const libres = mismoDia.length > 1 && dueños ? mismoDia.filter((r) => !r.url || !dueños.has(r.url) || dueños.get(r.url) === nombre) : mismoDia;
    const reel = porPalabra ?? (mismoDia.length === 1 ? mismoDia[0] : libres.length === 1 ? libres[0] : null);
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
