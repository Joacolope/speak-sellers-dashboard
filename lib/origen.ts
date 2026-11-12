import type { Agenda } from './types';
import { funnelDeLead } from './types';

/** Color de cada origen: Instagram rosa, WhatsApp verde, YouTube rojo, Webinar el azul de siempre. */
export type Origen = 'Instagram' | 'WhatsApp' | 'YouTube' | 'Webinar' | 'Follow Me Ads' | 'Referido' | 'Outbound' | 'Otro';
export const COLOR_ORIGEN: Record<Origen, string> = {
  Instagram: 'var(--ig)',
  WhatsApp: 'var(--wa)',
  YouTube: 'var(--yt)',
  Webinar: 'var(--blue)',
  'Follow Me Ads': 'var(--ig)',
  Referido: 'var(--yellow)',
  Outbound: 'var(--text-disabled)',
  Otro: 'var(--text-disabled)',
};

/** Nombre legible de un valor de UTM ("organico_ig" → "Link en bio de Instagram", "webinar_4oct" → "Webinar 4/10"). */
const MESES: Record<string, string> = { ene: '1', feb: '2', mar: '3', abr: '4', may: '5', jun: '6', jul: '7', ago: '8', sep: '9', oct: '10', nov: '11', dic: '12' };
export function nombreUtm(valor: string): { nombre: string; origen: Origen } {
  const v = valor.toLowerCase().replace(/[-\s]+/g, '_');
  const web = v.match(/webinar_?(\d{1,2})_?([a-z]{3})/);
  if (web) return { nombre: `Webinar ${web[1]}/${MESES[web[2]] ?? web[2]}`, origen: 'Webinar' };
  if (v.includes('webinar')) return { nombre: 'Webinar', origen: 'Webinar' };
  if (/bio|linktree|organico_ig|ig_organico|organico/.test(v)) return { nombre: 'Link en bio', origen: 'Instagram' };
  if (/follow_?me/.test(v)) return { nombre: 'Follow Me Ads', origen: 'Follow Me Ads' };
  if (/youtube|^yt|_yt/.test(v)) return { nombre: 'YouTube', origen: 'YouTube' };
  if (/whats|wpp|wsp|^wa_|_wa$/.test(v)) return { nombre: 'WhatsApp', origen: 'WhatsApp' };
  if (/difusion|broadcast/.test(v)) return { nombre: 'Lista de difusión', origen: 'Instagram' };
  if (/historia|story|stories/.test(v)) return { nombre: 'Historias de Instagram', origen: 'Instagram' };
  if (/reel/.test(v)) return { nombre: 'Reels de Instagram', origen: 'Instagram' };
  if (/^ig$|instagram|_ig$|^ig_/.test(v)) return { nombre: 'Link en bio', origen: 'Instagram' };
  if (/fb|facebook|meta|ads?$/.test(v)) return { nombre: 'Anuncios de Meta', origen: 'Follow Me Ads' };
  return { nombre: valor, origen: 'Otro' };
}

/** GoHighLevel completa la fuente con estos valores genéricos cuando el link no traía UTM: no cuentan como UTM. */
const FUENTE_GENERICA = /^(social media|direct traffic|organic search|paid social|paid search|referral|email|display|other|unknown)$/i;

type UtmsDeLead = { utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null; utm_content?: string | null };

/**
 * Cómo agendó un lead, según el link:
 * - sin UTM → "Setting": el setter le pasó el calendario por Instagram;
 * - con UTM → el link que usó (el de Instagram, "ig", es el link en bio).
 */
export function comoAgendoPorUtm(l?: UtmsDeLead | null): { nombre: string; color: string; sinUtm: boolean; codigo: string | null } {
  const limpio = (v?: string | null) => (v ?? '').trim();
  const fuente = FUENTE_GENERICA.test(limpio(l?.utm_source)) ? '' : limpio(l?.utm_source);
  const valores = [fuente, limpio(l?.utm_medium), limpio(l?.utm_campaign), limpio(l?.utm_content)].filter(Boolean);
  if (!valores.length) return { nombre: 'Setting', color: 'var(--ig)', sinUtm: true, codigo: null };
  const { nombre, origen } = nombreUtm(limpio(l?.utm_campaign) || limpio(l?.utm_content) || fuente || limpio(l?.utm_medium));
  return { nombre, color: nombre === 'Link en bio' ? 'var(--blue)' : COLOR_ORIGEN[origen], sinUtm: false, codigo: valores.join(' · ') };
}

/** De dónde vino un lead sin UTM, con lo que ya sabemos: canal, funnel, fuente y primer punto de contacto. */
export function origenSinUtm(a: Agenda): Origen {
  const l = a.lead;
  if (!l) return 'Otro';
  if (l.canal === 'Outbound') return 'Outbound';
  const funnel = funnelDeLead(l.funnel, l.fuente);
  if (funnel === 'Webinar') return 'Webinar';
  const primero = (l.primer_punto_contacto ?? '').toLowerCase();
  if (funnel === 'YouTube' || primero.includes('youtube')) return 'YouTube';
  if (l.fuente === 'Referido' || /recomend|referid|mastermind|five st|syk/.test(primero)) return 'Referido';
  if (l.fuente === 'WhatsApp' || primero.includes('whatsapp')) return 'WhatsApp';
  if (primero.includes('outbound')) return 'Outbound';
  if (/follow ?me|anuncio|\bads\b/.test(primero)) return 'Follow Me Ads';
  return 'Instagram';
}
