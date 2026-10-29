import type { SupabaseClient } from '@supabase/supabase-js';
import { cuentaInstagram } from './cuentaIg';

const GRAPH = 'https://graph.facebook.com/v21.0';

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = process.env.META_TOKEN;
  if (!token) throw new Error('Falta META_TOKEN');
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', token);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`IG ${path} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

interface Media {
  id: string;
  media_product_type: string;
  media_type: string;
  timestamp: string;
  caption?: string;
  comments_count?: number;
  like_count?: number;
  permalink?: string;
}

interface Insights { data: { name: string; values: { value: number }[] }[] }

function metrica(ins: Insights | null, nombre: string): number | null {
  const m = ins?.data.find((d) => d.name === nombre);
  return m ? m.values[0]?.value ?? null : null;
}

/** Palabra clave del reel: "Comentá X" o la primera palabra en mayúsculas del caption. */
export function palabraClave(caption?: string): string | null {
  if (!caption) return null;
  const m = caption.match(/coment[aá]\s+[«"“']?([A-ZÁÉÍÓÚÑ]{3,})/i);
  if (m) return m[1].toUpperCase();
  const may = caption.match(/\b([A-ZÁÉÍÓÚÑ]{3,})\b/);
  return may ? may[1] : null;
}

/** Historias de las últimas 24 h, reels de los últimos 7 días y mensajería de ayer. */
export async function syncIgOrganico(sb: SupabaseClient, dry = false): Promise<string> {
  const igUser = await cuentaInstagram();
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const hace7 = new Date(Date.now() - 7 * 86400000).toISOString();

  // Historias (solo viven 24 h)
  const historias = await graph<{ data: Media[] }>(`${igUser}/stories`, { fields: 'id,media_type,timestamp,caption' }).catch(() => ({ data: [] as Media[] }));
  let views1: number | null = null;
  let viewsUlt: number | null = null;
  let respuestas = 0;
  let nHist = 0;
  for (const h of historias.data ?? []) {
    const ins = await graph<Insights>(`${h.id}/insights`, { metric: 'views,replies,exits,taps_forward,taps_back' }).catch(() => null);
    const v = metrica(ins, 'views') ?? metrica(ins, 'impressions');
    if (views1 === null) views1 = v;
    viewsUlt = v;
    respuestas += metrica(ins, 'replies') ?? 0;
    nHist++;
    if (!dry) {
      await sb.from('organico_piezas').upsert({
        ig_media_id: h.id, fecha: h.timestamp.slice(0, 10), tipo: 'historia', titulo: `Historia ${h.timestamp.slice(11, 16)}`,
        views: v, respuestas: metrica(ins, 'replies'), promocionado: false, updated_at: new Date().toISOString(),
      }, { onConflict: 'ig_media_id' });
    }
  }

  // Reels de los últimos 7 días (para capturar comentarios a 48 h)
  const media = await graph<{ data: Media[] }>(`${igUser}/media`, {
    fields: 'id,media_product_type,media_type,timestamp,caption,comments_count,like_count,permalink',
    since: String(Math.floor(new Date(hace7).getTime() / 1000)),
    limit: '50',
  });
  let nReels = 0;
  let formatoAyer: 'Reel' | 'Carrusel' | 'Imagen' | null = null;
  let ctaAyer: string | null = null;
  let comentariosAyer: number | null = null;
  for (const m of media.data ?? []) {
    const esReel = m.media_product_type === 'REELS' || m.media_type === 'VIDEO';
    const ins = await graph<Insights>(`${m.id}/insights`, { metric: esReel ? 'plays,reach,saved,shares' : 'reach,saved' }).catch(() => null);
    const views = metrica(ins, 'plays') ?? metrica(ins, 'views') ?? metrica(ins, 'reach');
    const promocionado = false; // TODO: cruzar con effective_object_story_id de los ads activos
    if (!dry) {
      await sb.from('organico_piezas').upsert({
        ig_media_id: m.id, fecha: m.timestamp.slice(0, 10), tipo: 'reel',
        titulo: `${esReel ? 'Reel' : m.media_type === 'CAROUSEL_ALBUM' ? 'Carrusel' : 'Imagen'}${palabraClave(m.caption) ? ` «${palabraClave(m.caption)}»` : ''}`,
        views, alcance: metrica(ins, 'reach'), comentarios: m.comments_count ?? null,
        guardados: metrica(ins, 'saved'), compartidos: metrica(ins, 'shares'), promocionado, url: m.permalink ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'ig_media_id' });
    }
    if (m.timestamp.slice(0, 10) === ayer) {
      formatoAyer = esReel ? 'Reel' : m.media_type === 'CAROUSEL_ALBUM' ? 'Carrusel' : 'Imagen';
      ctaAyer = palabraClave(m.caption);
      comentariosAyer = m.comments_count ?? null;
    }
    nReels++;
  }

  // Mensajería de ayer → setter_diario (conversaciones orgánicas)
  let convOrg: number | null = null;
  try {
    const msg = await graph<Insights>(`${igUser}/insights`, { metric: 'total_interactions', period: 'day', metric_type: 'total_value', since: ayer, until: ayer });
    convOrg = metrica(msg, 'total_interactions');
  } catch {
    convOrg = null;
  }

  if (!dry) {
    await sb.from('organico_diario').upsert({
      fecha: ayer, views_primera: views1, views_ultima: viewsUlt, cantidad_historias: nHist || null, respuestas: nHist ? respuestas : null,
      formato_reel: formatoAyer, tipo_cta: ctaAyer, comentarios_48h: comentariosAyer, source: 'ig', updated_at: new Date().toISOString(),
    }, { onConflict: 'fecha' });
    if (convOrg !== null) {
      await sb.from('setter_diario').upsert({ fecha: ayer, conv_organicas: convOrg, source: 'ig', updated_at: new Date().toISOString() }, { onConflict: 'fecha' });
    }
  }
  return `${nHist} historias, ${nReels} reels`;
}
