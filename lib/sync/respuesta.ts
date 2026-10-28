import type { SupabaseClient } from '@supabase/supabase-js';

const GRAPH = 'https://graph.facebook.com/v21.0';
/** Una respuesta que sale antes de esto se toma como automática (ManyChat) y no cuenta. */
const AUTOMATICA_SEG = 15;
/** "Rápida" = respondida en menos de esto. */
export const RAPIDA_MIN = 5;

async function graph<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const url = path.startsWith('http') ? new URL(path) : new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', token);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Mensajes ${url.pathname} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

interface Mensaje { created_time: string; from?: { id: string; username?: string } }
interface Conversacion {
  id: string;
  updated_time: string;
  participants?: { data: { id: string; username?: string }[] };
  messages?: { data: Mensaje[] };
}

export interface RespuestaLenta { usuario: string; llego: string; espera_min: number | null }

const diaAR = (iso: string) => new Date(Date.parse(iso) - 3 * 3600000).toISOString().slice(0, 10);

export function mediana(v: number[]): number | null {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Tiempo de respuesta del setter en los DMs de Instagram (día anterior, hora Argentina).
 * Por cada mensaje que inicia un turno del lead, mide cuánto tardó la primera respuesta humana.
 * Necesita META_TOKEN con instagram_manage_messages y META_PAGE_ID (la página de Facebook conectada a Instagram).
 */
export function calcularRespuesta(conversaciones: Conversacion[], igUser: string, dia: string) {
  const esperas: number[] = [];
  const lentas: RespuestaLenta[] = [];
  let sinRespuesta = 0;
  let idaYVuelta = 0;
  for (const c of conversaciones) {
    const msgs = [...(c.messages?.data ?? [])].sort((a, b) => a.created_time.localeCompare(b.created_time));
    const usuario = c.participants?.data.find((p) => p.id !== igUser)?.username ?? 'sin usuario';
    const delDia = msgs.filter((m) => diaAR(m.created_time) === dia);
    if (delDia.some((m) => m.from?.id !== igUser) && delDia.some((m) => m.from?.id === igUser)) idaYVuelta++;
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      const delLead = m.from?.id !== igUser;
      const iniciaTurno = delLead && (i === 0 || msgs[i - 1].from?.id === igUser);
      if (!iniciaTurno || diaAR(m.created_time) !== dia) continue;
      const t0 = Date.parse(m.created_time);
      const resp = msgs.slice(i + 1).find((x) => x.from?.id === igUser && Date.parse(x.created_time) - t0 >= AUTOMATICA_SEG * 1000);
      if (resp) {
        const min = (Date.parse(resp.created_time) - t0) / 60000;
        esperas.push(min);
        lentas.push({ usuario, llego: m.created_time, espera_min: Math.round(min) });
      } else {
        sinRespuesta++;
        lentas.push({ usuario, llego: m.created_time, espera_min: null });
      }
    }
  }
  const med = mediana(esperas);
  return {
    tr_mediana_min: med === null ? null : Math.round(med * 10) / 10,
    tr_promedio_min: esperas.length ? Math.round((esperas.reduce((a, b) => a + b, 0) / esperas.length) * 10) / 10 : null,
    pct_rapidas: esperas.length + sinRespuesta ? esperas.filter((e) => e < RAPIDA_MIN).length / (esperas.length + sinRespuesta) : null,
    sin_respuesta: sinRespuesta,
    conv_api: idaYVuelta,
    // Sin responder primero; después las más lentas
    respuestas_lentas: lentas.sort((a, b) => (b.espera_min ?? Infinity) - (a.espera_min ?? Infinity)).slice(0, 10),
  };
}

export async function syncTiempoRespuesta(sb: SupabaseClient, dry = false): Promise<string> {
  const token = process.env.META_TOKEN;
  const page = process.env.META_PAGE_ID;
  const igUser = process.env.IG_USER_ID;
  if (!token) throw new Error('Falta META_TOKEN');
  if (!page) throw new Error('Falta META_PAGE_ID');
  if (!igUser) throw new Error('Falta IG_USER_ID');
  const ayer = diaAR(new Date(Date.now() - 86400000).toISOString());
  const desde = Date.now() - 3 * 86400000;

  // La API de mensajes pide el token de la página, que se obtiene con el del usuario de sistema
  const { access_token: pageToken } = await graph<{ access_token: string }>(page, { fields: 'access_token' }, token);
  const convs: Conversacion[] = [];
  let next: string | null = `${page}/conversations`;
  let params: Record<string, string> = { platform: 'instagram', fields: 'updated_time,participants,messages.limit(50){created_time,from}', limit: '50' };
  for (let paginas = 0; next && paginas < 20; paginas++) {
    const r: { data: Conversacion[]; paging?: { next?: string } } = await graph(next, params, pageToken);
    convs.push(...r.data);
    // Vienen ordenadas por última actividad: cortar cuando ya son viejas
    if (!r.data.length || Date.parse(r.data[r.data.length - 1].updated_time) < desde) break;
    next = r.paging?.next ?? null;
    params = {};
  }

  const res = calcularRespuesta(convs, igUser, ayer);
  if (!dry) {
    const { error } = await sb.from('setter_diario').upsert({ fecha: ayer, ...res, updated_at: new Date().toISOString() }, { onConflict: 'fecha' });
    if (error) throw new Error(`setter_diario: ${error.message}`);
  }
  return `respuesta mediana ${res.tr_mediana_min ?? '—'} min, ${res.sin_respuesta} sin responder`;
}
