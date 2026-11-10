import { NextResponse, type NextRequest } from 'next/server';
import { refrescarDatos } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const CAMPOS_LEAD = ['email', 'telefono', 'pais', 'instagram', 'fuente', 'funnel', 'canal', 'primer_punto_contacto', 'ultimo_punto_contacto', 'manychat_url'] as const;
const CAMPOS_VENTA = ['oferta_hecha', 'compro', 'producto', 'cash_collected', 'revenue', 'metodo_pago'] as const;
const DIAS3 = 3 * 86400000;

/**
 * Une dos leads que son la misma persona (p. ej. agendó con un nombre y compró con otro).
 * Solo admin o "Authorization: Bearer $CARGA_API_TOKEN". JSON: { "de": "nombre del repetido", "a": "nombre del que queda", "nota": "..." }
 * - Cada llamada del repetido se junta con la llamada del otro a ±3 días (pasan los cobros y el resultado de la venta);
 *   si no hay una cerca, la llamada entera pasa al lead que queda.
 * - Los datos del lead que queda no se pisan: solo se completan los vacíos. Las notas se suman.
 * - El lead repetido se borra.
 */
async function manejarPOST(req: NextRequest) {
  const auth = await exigir('admin', { permitirToken: true });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const de = typeof body?.de === 'string' ? body.de.trim() : '';
  const a = typeof body?.a === 'string' ? body.a.trim() : '';
  const nota = typeof body?.nota === 'string' ? body.nota.trim().slice(0, 1000) : '';
  if (!de || !a || norm(de) === norm(a)) return NextResponse.json({ error: 'Mandá { de, a } con dos nombres distintos' }, { status: 400 });

  const sb = supabase();
  const { data: todos, error } = await sb.from('leads').select('*');
  if (error) return NextResponse.json({ error: 'No se pudo leer los leads' }, { status: 500 });
  const buscar = (n: string) => ((todos ?? []) as Record<string, unknown>[]).filter((l) => norm(String(l.nombre ?? '')) === norm(n));
  const [origenes, destinos] = [buscar(de), buscar(a)];
  if (origenes.length !== 1) return NextResponse.json({ error: `"${de}": ${origenes.length ? 'hay más de un lead con ese nombre' : 'no existe'}` }, { status: 400 });
  if (destinos.length !== 1) return NextResponse.json({ error: `"${a}": ${destinos.length ? 'hay más de un lead con ese nombre' : 'no existe'}` }, { status: 400 });
  const [origen, destino] = [origenes[0], destinos[0]];
  const ahora = new Date().toISOString();
  const juntar = (...t: unknown[]) => Array.from(new Set(t.filter((x): x is string => typeof x === 'string' && x.trim() !== ''))).join(' · ') || null;

  const { data: agsOrigen } = await sb.from('agendas').select('*').eq('lead_id', origen.id);
  const { data: agsDestino } = await sb.from('agendas').select('*').eq('lead_id', destino.id);
  let juntadas = 0;
  let movidas = 0;
  for (const ag of agsOrigen ?? []) {
    const t = Date.parse(ag.fecha_llamada);
    const gemela = (agsDestino ?? [])
      .filter((d) => Math.abs(Date.parse(d.fecha_llamada) - t) <= DIAS3)
      .sort((x, y) => Math.abs(Date.parse(x.fecha_llamada) - t) - Math.abs(Date.parse(y.fecha_llamada) - t))[0];
    if (!gemela) {
      const { error: e } = await sb.from('agendas').update({ lead_id: destino.id, updated_at: ahora }).eq('id', ag.id);
      if (e) return NextResponse.json({ error: 'No se pudo mover una llamada' }, { status: 500 });
      movidas++;
      continue;
    }
    // Los cobros pasan a la llamada que queda (antes de borrar la repetida: el borrado arrastra sus cobros)
    const { error: eCob } = await sb.from('cobranzas').update({ agenda_id: gemela.id, closer: gemela.closer, updated_at: ahora }).eq('agenda_id', ag.id);
    if (eCob) return NextResponse.json({ error: 'No se pudieron mover los cobros' }, { status: 500 });
    const patch: Record<string, unknown> = { notas: juntar(gemela.notas, ag.notas), source: 'manual', editado_por: auth.quien, updated_at: ahora };
    for (const c of CAMPOS_VENTA) if (gemela[c] === null || gemela[c] === undefined) patch[c] = ag[c];
    if (gemela.asistio === 'Pendiente' && ag.asistio !== 'Pendiente') patch.asistio = ag.asistio;
    const { error: eAg } = await sb.from('agendas').update(patch).eq('id', gemela.id);
    if (eAg) return NextResponse.json({ error: 'No se pudo actualizar la llamada' }, { status: 500 });
    await sb.from('agendas').delete().eq('id', ag.id);
    juntadas++;
  }

  const patchLead: Record<string, unknown> = { notas: juntar(destino.notas, origen.notas, nota), updated_at: ahora };
  for (const c of CAMPOS_LEAD) if ((destino[c] === null || destino[c] === undefined || destino[c] === '') && origen[c]) patchLead[c] = origen[c];
  await sb.from('leads').update(patchLead).eq('id', destino.id);
  const { error: eDel } = await sb.from('leads').delete().eq('id', origen.id);
  if (eDel) return NextResponse.json({ error: 'Se unieron las llamadas pero no se pudo borrar el lead repetido' }, { status: 500 });
  return NextResponse.json({ ok: true, queda: destino.nombre, borrado: origen.nombre, llamadas_juntadas: juntadas, llamadas_movidas: movidas });
}

/** Después de escribir se descarta la caché de datos, así el dashboard muestra lo nuevo al instante. */
export async function POST(...args: Parameters<typeof manejarPOST>) {
  const res = await manejarPOST(...args);
  refrescarDatos();
  return res;
}
