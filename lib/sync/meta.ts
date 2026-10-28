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
      // Webinar no busca conversaciones: mide registros
      conversaciones: c === 'webinar' ? null : accion(ins, ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.total_messaging_connection']),
      registros: c === 'webinar' ? accion(ins, ['complete_registration', 'offsite_conversion.fb_pixel_complete_registration', 'lead', 'onsite_conversion.lead_grouped']) : null,
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

interface CampanaApi {
  id: string;
  name: string;
  effective_status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

interface InsightCampana {
  campaign_id: string;
  spend: string;
  actions?: { action_type: string; value: string }[];
}

/** Qué cuenta como resultado según el tipo de campaña: webinar mide registros, no conversaciones. */
function resultadoDe(tipo: 'follow_me' | 'webinar' | 'otra', objetivo?: string): { nombre: string; acciones: string[] } {
  if (tipo === 'webinar' || objetivo === 'OUTCOME_LEADS')
    return { nombre: 'registros', acciones: ['complete_registration', 'offsite_conversion.fb_pixel_complete_registration', 'lead', 'onsite_conversion.lead_grouped'] };
  if (tipo === 'follow_me') return { nombre: 'seguidores', acciones: ['onsite_conversion.follow', 'ig_follow'] };
  if (objetivo === 'OUTCOME_TRAFFIC') return { nombre: 'visitas', acciones: ['onsite_conversion.ig_profile_visit', 'link_click'] };
  return { nombre: 'conversaciones', acciones: ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.total_messaging_connection'] };
}

/** Foto de las campañas activas y pausadas: estado, presupuesto y rendimiento de 7 días y del mes. */
export async function syncMetaCampanas(sb: SupabaseClient, dry = false): Promise<string> {
  const cuenta = process.env.META_AD_ACCOUNT;
  if (!cuenta) throw new Error('Falta META_AD_ACCOUNT');
  const camps = await graph<{ data: CampanaApi[] }>(`${cuenta}/campaigns`, {
    fields: 'id,name,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time',
    effective_status: JSON.stringify(['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED', 'IN_PROCESS', 'WITH_ISSUES']),
    limit: '200',
  });
  const insights = async (preset: string) => {
    const r = await graph<{ data: InsightCampana[] }>(`${cuenta}/insights`, { level: 'campaign', date_preset: preset, fields: 'campaign_id,spend,actions', limit: '500' });
    return new Map((r.data ?? []).map((i) => [i.campaign_id, i]));
  };
  const [sem, mes] = await Promise.all([insights('last_7d'), insights('this_month')]);
  const suma = (i: InsightCampana | undefined, tipos: string[]) => {
    const a = i?.actions?.find((x) => tipos.includes(x.action_type));
    return a ? Number(a.value) : i ? 0 : null;
  };
  // Los presupuestos de Meta vienen en centavos
  const plata = (v?: string) => (v ? Number(v) / 100 : null);
  const filas = (camps.data ?? []).map((c) => {
    const tipo = campana(c.name) ?? 'otra';
    const res = resultadoDe(tipo, c.objective);
    const s7 = sem.get(c.id);
    const sm = mes.get(c.id);
    return {
      id: c.id,
      nombre: c.name,
      estado: c.effective_status,
      objetivo: c.objective ?? null,
      tipo,
      presupuesto_diario: plata(c.daily_budget),
      presupuesto_total: plata(c.lifetime_budget),
      inicio: c.start_time ?? null,
      fin: c.stop_time ?? null,
      inversion_7d: s7 ? Number(s7.spend) : 0,
      resultados_7d: suma(s7, res.acciones),
      inversion_mes: sm ? Number(sm.spend) : 0,
      resultados_mes: suma(sm, res.acciones),
      resultado: res.nombre,
      source: 'meta',
      updated_at: new Date().toISOString(),
    };
  });
  if (!dry && filas.length) {
    const { error } = await sb.from('campanas_meta').upsert(filas, { onConflict: 'id' });
    if (error) throw new Error(`campanas_meta: ${error.message}`);
    // Las que ya no vienen (archivadas o borradas) dejan de figurar como activas
    const ids = filas.map((f) => f.id);
    await sb.from('campanas_meta').update({ estado: 'ARCHIVED', updated_at: new Date().toISOString() }).not('id', 'in', `(${ids.join(',')})`);
  }
  return `${filas.filter((f) => f.estado === 'ACTIVE').length} campañas activas`;
}
