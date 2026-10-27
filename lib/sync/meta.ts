import type { SupabaseClient } from '@supabase/supabase-js';

const GRAPH = 'https://graph.facebook.com/v21.0';

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = process.env.META_TOKEN;
  if (!token) throw new Error('Falta META_TOKEN');
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', token);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Meta ${path} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

interface Insight {
  campaign_name: string;
  date_start: string;
  spend: string;
  impressions: string;
  reach: string;
  frequency: string;
  cpm: string;
  ctr: string;
  actions?: { action_type: string; value: string }[];
}

function accion(ins: Insight, tipos: string[]): number | null {
  const a = ins.actions?.find((x) => tipos.includes(x.action_type));
  return a ? Number(a.value) : null;
}

function campana(nombre: string): 'follow_me' | 'webinar' | null {
  const n = nombre.toLowerCase();
  if (n.includes('follow me')) return 'follow_me';
  if (n.includes('webinar')) return 'webinar';
  return null; // Lookalike, Tráfico al perfil, etc. se excluyen
}

/** ads_diario de ayer y anteayer (Meta corrige datos hasta 48 h después). */
export async function syncMetaAds(sb: SupabaseClient, dry = false): Promise<string> {
  const cuenta = process.env.META_AD_ACCOUNT;
  if (!cuenta) throw new Error('Falta META_AD_ACCOUNT');
  const hoy = new Date();
  const d = (n: number) => new Date(hoy.getTime() - n * 86400000).toISOString().slice(0, 10);
  const r = await graph<{ data: Insight[] }>(`${cuenta}/insights`, {
    level: 'campaign',
    time_increment: '1',
    time_range: JSON.stringify({ since: d(2), until: d(1) }),
    fields: 'campaign_name,spend,impressions,reach,frequency,cpm,ctr,actions',
  });
  let n = 0;
  for (const ins of r.data ?? []) {
    const c = campana(ins.campaign_name);
    if (!c) continue;
    const fila = {
      fecha: ins.date_start,
      campana: c,
      inversion: Number(ins.spend),
      impresiones: Number(ins.impressions),
      alcance: Number(ins.reach),
      frecuencia: Number(ins.frequency),
      cpm: Number(ins.cpm),
      ctr: Number(ins.ctr) / 100,
      visitas_perfil: accion(ins, ['onsite_conversion.ig_profile_visit', 'link_click']),
      seguidores: accion(ins, ['onsite_conversion.follow', 'ig_follow']),
      conversaciones: accion(ins, ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.total_messaging_connection']),
      source: 'meta',
      updated_at: new Date().toISOString(),
    };
    if (!dry) {
      // No pisar la bitácora manual
      const { error } = await sb.from('ads_diario').upsert(fila, { onConflict: 'fecha,campana', ignoreDuplicates: false });
      if (error) throw new Error(`ads_diario: ${error.message}`);
    }
    n++;
  }
  return `${n} días ads`;
}
