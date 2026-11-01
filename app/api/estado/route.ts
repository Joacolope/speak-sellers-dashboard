import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Estado de las fuentes automáticas (solo lectura): últimas corridas del cron y hasta qué día hay datos.
 * GET con "Authorization: Bearer $CARGA_API_TOKEN" o sesión de editor. No devuelve datos de clientes.
 */
export async function GET() {
  const auth = await exigir('editor', { permitirToken: true });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const sb = supabase();
  const hace40 = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
  const [log, ads, campanas, setter, ig] = await Promise.all([
    sb.from('log_agente').select('fecha, resumen, pendientes').order('fecha', { ascending: false }).limit(5),
    sb.from('ads_diario').select('fecha, campana, inversion, conversaciones, comentarios, seguidores, registros, source').gte('fecha', hace40).order('fecha', { ascending: false }),
    sb.from('campanas_meta').select('nombre, estado, tipo, inversion_7d, resultados_7d, updated_at').order('updated_at', { ascending: false }).limit(10),
    sb.from('setter_diario').select('fecha, conv_api, tr_mediana_min, source').gte('fecha', hace40).order('fecha', { ascending: false }).limit(10),
    sb.from('organico_diario').select('fecha').order('fecha', { ascending: false }).limit(1),
  ]);
  // Leads repetidos por nombre (para detectar duplicados entre GHL y lo cargado a mano)
  const { data: leads } = await sb.from('leads').select('nombre, source, ghl_contact_id');
  const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const cuenta = new Map<string, { nombre: string; fuentes: string[] }>();
  for (const l of leads ?? []) {
    const k = norm(l.nombre ?? '');
    const g = cuenta.get(k) ?? { nombre: String(l.nombre), fuentes: [] as string[] };
    g.fuentes.push(`${l.source}${l.ghl_contact_id ? '+ghl' : ''}`);
    cuenta.set(k, g);
  }
  const repetidos = Array.from(cuenta.values()).filter((g) => g.fuentes.length > 1);
  return NextResponse.json({
    cron: log.data ?? [],
    ads: ads.data ?? [],
    campanas: campanas.error ? { error: campanas.error.message } : campanas.data,
    setter: setter.data ?? [],
    organico_ultimo: ig.data?.[0]?.fecha ?? null,
    leads_repetidos: repetidos,
  });
}
