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

/** Todas las páginas de un pedido a la Graph API (sigue paging.next). */
async function todas<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const out: T[] = [];
  let r = await graph<{ data: T[]; paging?: { next?: string } }>(path, { ...params, limit: '500' });
  out.push(...(r.data ?? []));
  for (let i = 0; r.paging?.next && i < 20; i++) {
    const res = await fetch(r.paging.next, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Meta ${path} (página ${i + 2}) → ${res.status} ${await res.text()}`);
    r = await res.json();
    out.push(...(r.data ?? []));
  }
  return out;
}

const suma = (a: number | null, b: number | null) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0));

/**
 * ads_diario por día y funnel.
 * Follow Me: desde el 1 del mes anterior hasta ayer (rellena conversaciones, comentarios y seguidores
 * de días que se cargaron desde la planilla sin esos datos; Meta además corrige hasta 48 h después).
 * Webinar: solo ayer y anteayer, porque los webinars viejos quedaron cargados como un total por webinar
 * y traer sus días sueltos los contaría dos veces.
 * Si hay varias campañas del mismo funnel el mismo día, se suman en una sola fila.
 */
export async function syncMetaAds(sb: SupabaseClient, dry = false): Promise<string> {
  const cuenta = process.env.META_AD_ACCOUNT;
  if (!cuenta) throw new Error('Falta META_AD_ACCOUNT');
  const hoy = new Date();
  const d = (n: number) => new Date(hoy.getTime() - n * 86400000).toISOString().slice(0, 10);
  const ayer = d(1);
  const desdeWebinar = d(2);
  const [y, m] = ayer.split('-').map(Number);
  const desde = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10); // 1 del mes anterior
  const datos = await todas<Insight>(`${cuenta}/insights`, {
    level: 'campaign',
    time_increment: '1',
    time_range: JSON.stringify({ since: desde, until: ayer }),
    fields: 'campaign_name,spend,impressions,reach,frequency,cpm,ctr,actions',
  });

  type Fila = {
    fecha: string; campana: 'follow_me' | 'webinar'; inversion: number; impresiones: number; alcance: number; clics: number;
    visitas_perfil: number | null; seguidores: number | null; conversaciones: number | null; comentarios: number | null; registros: number | null;
  };
  const filas = new Map<string, Fila>();
  for (const ins of datos) {
    const c = campana(ins.campaign_name);
    if (!c) continue;
    if (c === 'webinar' && ins.date_start < desdeWebinar) continue;
    const k = `${ins.date_start}|${c}`;
    const imp = Number(ins.impressions) || 0;
    const nueva: Fila = {
      fecha: ins.date_start,
      campana: c,
      inversion: Number(ins.spend) || 0,
      impresiones: imp,
      alcance: Number(ins.reach) || 0,
      clics: (Number(ins.ctr) || 0) / 100 * imp,
      visitas_perfil: accion(ins, ['onsite_conversion.ig_profile_visit', 'link_click']),
      seguidores: accion(ins, ['onsite_conversion.follow', 'ig_follow']),
      // Webinar no busca conversaciones: mide registros
      conversaciones: c === 'webinar' ? null : accion(ins, ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.total_messaging_connection']),
      comentarios: c === 'follow_me' ? accion(ins, ['comment']) : null,
      registros: c === 'webinar' ? accion(ins, ['complete_registration', 'offsite_conversion.fb_pixel_complete_registration', 'lead', 'onsite_conversion.lead_grouped']) : null,
    };
    const prev = filas.get(k);
    filas.set(k, prev ? {
      ...prev,
      inversion: prev.inversion + nueva.inversion,
      impresiones: prev.impresiones + nueva.impresiones,
      alcance: prev.alcance + nueva.alcance, // aproximado: el alcance de dos campañas puede solaparse
      clics: prev.clics + nueva.clics,
      visitas_perfil: suma(prev.visitas_perfil, nueva.visitas_perfil),
      seguidores: suma(prev.seguidores, nueva.seguidores),
      conversaciones: suma(prev.conversaciones, nueva.conversaciones),
      comentarios: suma(prev.comentarios, nueva.comentarios),
      registros: suma(prev.registros, nueva.registros),
    } : nueva);
  }

  let n = 0;
  for (const f of Array.from(filas.values())) {
    const fila = {
      fecha: f.fecha,
      campana: f.campana,
      inversion: Math.round(f.inversion * 100) / 100,
      impresiones: f.impresiones,
      alcance: f.alcance,
      frecuencia: f.alcance ? Math.round((f.impresiones / f.alcance) * 100) / 100 : null,
      cpm: f.impresiones ? Math.round((f.inversion / f.impresiones) * 100000) / 100 : null,
      ctr: f.impresiones ? f.clics / f.impresiones : null,
      visitas_perfil: f.visitas_perfil,
      seguidores: f.seguidores,
      conversaciones: f.conversaciones,
      comentarios: f.comentarios,
      registros: f.registros,
      source: 'meta',
      updated_at: new Date().toISOString(),
    };
    if (!dry) {
      // Solo se mandan estas columnas: la bitácora manual no se pisa
      const { error } = await sb.from('ads_diario').upsert(fila, { onConflict: 'fecha,campana', ignoreDuplicates: false });
      if (error) throw new Error(`ads_diario: ${error.message}`);
    }
    n++;
  }
  const conv = Array.from(filas.values()).reduce((a, f) => a + (f.conversaciones ?? 0), 0);
  return `${n} días ads (desde ${desde}, ${conv} conversaciones)`;
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
