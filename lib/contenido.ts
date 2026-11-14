import { piezasDelLead, reelsConDueño } from './recorrido';
import { sumarDias } from './format';
import type { Etapa, OrganicoPieza, RawBundle } from './types';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export interface EtapaPieza {
  etapa: Etapa;
  angulo: string | null;
  /** De dónde sale: cargada a mano, por las palabras clave del ángulo en la descripción, o por las etiquetas de ManyChat */
  como: 'a mano' | 'descripción' | 'etiqueta';
}

/**
 * Etapa del embudo de cada publicación (TOFU / MOFU / BOFU):
 * 1. la cargada a mano;
 * 2. el ángulo de Marketing cuyas palabras clave aparecen en la descripción o el título (gana la palabra más larga);
 * 3. el ángulo de la pieza de ManyChat que apunta a esa publicación ("05/11/26 Precio al principio").
 * Lo que no entra en ninguna queda sin clasificar.
 */
export function etapasDePiezas(b: RawBundle): Map<string, EtapaPieza> {
  const angulos = b.angulos.filter((a) => a.estado !== 'Descartado' && !/webinar/.test(norm(a.nombre)));
  const mejor = (texto: string) => {
    const t = norm(texto);
    let hallado: { etapa: Etapa; angulo: string; largo: number } | null = null;
    for (const a of angulos) for (const k of a.palabras_clave.map(norm)) {
      if (k.length >= 4 && t.includes(k) && (!hallado || k.length > hallado.largo)) hallado = { etapa: a.etapa, angulo: a.nombre, largo: k.length };
    }
    return hallado;
  };
  // Publicación → nombre de la pieza según las etiquetas de ManyChat de los leads
  const dueños = reelsConDueño(b.leads, b.piezas);
  const nombrePorUrl = new Map<string, string>();
  for (const l of b.leads) for (const p of piezasDelLead(l, b.piezas, [], dueños)) if (p.url && !nombrePorUrl.has(p.url)) nombrePorUrl.set(p.url, p.nombre);

  const out = new Map<string, EtapaPieza>();
  for (const p of b.piezas) {
    if (p.tipo !== 'reel') continue;
    if (p.etapa) { out.set(p.ig_media_id, { etapa: p.etapa, angulo: null, como: 'a mano' }); continue; }
    const porTexto = mejor(`${p.titulo ?? ''} ${p.caption ?? ''}`);
    if (porTexto) { out.set(p.ig_media_id, { etapa: porTexto.etapa, angulo: porTexto.angulo, como: 'descripción' }); continue; }
    const nombre = p.url ? nombrePorUrl.get(p.url) : null;
    const porEtiqueta = nombre ? mejor(nombre) : null;
    if (porEtiqueta) out.set(p.ig_media_id, { etapa: porEtiqueta.etapa, angulo: porEtiqueta.angulo, como: 'etiqueta' });
  }
  return out;
}

export interface SemanaContenido {
  /** Lunes de la semana (AAAA-MM-DD) */
  desde: string;
  hasta: string;
  enCurso: boolean;
  /** Días de la semana que ya pasaron (7, salvo la semana en curso) */
  dias: number;
  piezas: OrganicoPieza[];
  porDia: number;
  tofu: number;
  mofu: number;
  bofu: number;
  sinClasificar: number;
}

/** Publicaciones del feed (reels, carruseles, imágenes; sin historias ni promocionadas) por semana, de lunes a domingo. */
export function ritmoDeContenido(b: RawBundle, hoy: string, etapas: Map<string, EtapaPieza>, semanas = 4): SemanaContenido[] {
  const diaSemana = (new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0
  const lunes = sumarDias(hoy, -diaSemana);
  const out: SemanaContenido[] = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const desde = sumarDias(lunes, -7 * i);
    const hasta = sumarDias(desde, 6);
    const piezas = b.piezas.filter((p) => p.tipo === 'reel' && !p.promocionado && p.fecha >= desde && p.fecha <= hasta).sort((x, y) => x.fecha.localeCompare(y.fecha));
    const de = (e: Etapa) => piezas.filter((p) => etapas.get(p.ig_media_id)?.etapa === e).length;
    const dias = i === 0 ? diaSemana + 1 : 7;
    out.push({
      desde, hasta, enCurso: i === 0, dias, piezas,
      porDia: Math.round((piezas.length / dias) * 10) / 10,
      tofu: de('TOFU'), mofu: de('MOFU'), bofu: de('BOFU'),
      sinClasificar: piezas.filter((p) => !etapas.has(p.ig_media_id)).length,
    });
  }
  return out;
}
