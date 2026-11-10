/**
 * Lectura de las etiquetas de ManyChat de un lead, para la trazabilidad inversa de las ventas.
 * Convenciones que se reconocen (el resto se muestra tal cual):
 * - "DD/MM/AA Nombre"      → pieza de contenido o recurso al que respondió (con su fecha)
 * - "Nuevo Seguidor <mes>" → mes en que empezó a seguir la cuenta
 * - "apertura/..."         → apertura que usó el setter
 * - "Ranteo ..."           → material que se le mandó para calentarlo
 */
export interface PiezaTocada { fecha: string; nombre: string }
export interface LecturaTags {
  /** Piezas o recursos a los que respondió, de la más vieja a la más nueva */
  piezas: PiezaTocada[];
  /** Mes en que empezó a seguir (AAAA-MM), según la etiqueta "Nuevo Seguidor" */
  seguidorDesde: string | null;
  aperturas: string[];
  ranteos: string[];
  /** Etiquetas que no entran en ningún grupo (perfil, etapa, origen) */
  otras: string[];
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Etiquetas de calendario ("Lead Octubre 26", "Nueva conversación | Octubre 26"): solo ordenan el CRM, no dicen nada del recorrido. */
const ES_DE_CALENDARIO = /^(leads?|nueva conversacion|conversacion)\b.*\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/;

/** Mes (AAAA-MM) de un texto como "Nuevo Seguidor | Noviembre 26". Sin año, se asume el más reciente que no quede en el futuro. */
function mesDeTexto(texto: string, hoy: Date): string | null {
  const t = sinTildes(texto);
  const i = MESES.findIndex((m) => t.includes(m));
  if (i < 0) return null;
  const a = t.match(/\b(20\d{2}|\d{2})\b/);
  let anio = a ? (a[1].length === 2 ? 2000 + Number(a[1]) : Number(a[1])) : hoy.getUTCFullYear();
  if (!a && (anio > hoy.getUTCFullYear() || i > hoy.getUTCMonth())) anio--;
  return `${anio}-${String(i + 1).padStart(2, '0')}`;
}

export function leerTags(tags: string[] | null | undefined, hoy: Date = new Date()): LecturaTags {
  const out: LecturaTags = { piezas: [], seguidorDesde: null, aperturas: [], ranteos: [], otras: [] };
  for (const crudo of tags ?? []) {
    const tag = crudo.trim();
    const t = sinTildes(tag);
    const pieza = tag.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(.+)$/);
    if (pieza) {
      const anio = pieza[3].length === 2 ? `20${pieza[3]}` : pieza[3];
      out.piezas.push({ fecha: `${anio}-${pieza[2].padStart(2, '0')}-${pieza[1].padStart(2, '0')}`, nombre: pieza[4].trim() });
    } else if (t.startsWith('nuevo seguidor')) {
      const mes = mesDeTexto(tag, hoy);
      if (mes && (!out.seguidorDesde || mes < out.seguidorDesde)) out.seguidorDesde = mes;
    } else if (t.startsWith('apertura')) out.aperturas.push(tag.replace(/^apertura\s*\/?\s*/i, ''));
    else if (t.startsWith('ranteo')) out.ranteos.push(tag.replace(/^ranteo\s*/i, ''));
    else if (!ES_DE_CALENDARIO.test(t)) out.otras.push(tag);
  }
  out.piezas.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return out;
}

/** Nombre de una pieza para agrupar: sin mayúsculas ni tildes, así "Pitch Espejo" y "Pitch espejo" cuentan juntas. */
export const clavePieza = (nombre: string) => sinTildes(nombre).replace(/[^a-z0-9]+/g, ' ').trim();

/** Tiempo entre dos fechas, en palabras cortas: "5 días", "2 meses", "1 año". */
export function tiempoEntre(desde: string, hasta: string): string | null {
  const dias = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000);
  if (!Number.isFinite(dias) || dias < 0) return null;
  if (dias === 0) return 'el mismo día';
  if (dias < 45) return `${dias} día${dias === 1 ? '' : 's'}`;
  const meses = Math.round(dias / 30.4);
  if (meses < 12) return `${meses} meses`;
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  return `${anios} año${anios === 1 ? '' : 's'}${resto ? ` y ${resto} mes${resto === 1 ? '' : 'es'}` : ''}`;
}
