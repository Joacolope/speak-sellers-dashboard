import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';
import { aMinutos, lunesDe } from '@/lib/respuesta';

const CAMPOS = ['conv_organicas', 'conv_pagadas', 'bienvenidas', 'conv_frio', 'mensajes_seguimiento', 'respuestas', 'frio_wa', 'seguimiento_wa', 'respuestas_wa', 'seguimientos', 'links_enviados', 'agendas'] as const;

/**
 * Carga o corrige un día del setter. Form-data con sesión de editor, o JSON con
 * "Authorization: Bearer $CARGA_API_TOKEN". Solo pisa los campos que vienen completos.
 */
export async function POST(req: NextRequest) {
  const esForm = req.headers.get('content-type')?.includes('form');
  const d: Record<string, string> = {};
  if (esForm) (await req.formData()).forEach((v, k) => (d[k] = String(v)));
  else Object.assign(d, await req.json().catch(() => ({})));

  const volver = (q: Record<string, string>) => {
    if (!esForm) return NextResponse.json(q, { status: q.error ? 400 : 200 });
    const url = new URL('/setter', req.url);
    if (d.mes && /^\d{4}-\d{2}$/.test(d.mes)) url.searchParams.set('mes', d.mes);
    for (const [k, v] of Object.entries(q)) url.searchParams.set(k, v);
    return NextResponse.redirect(url, 303);
  };

  const auth = await exigir('editor', { permitirToken: true });
  if (!auth.ok) return esForm ? volver({ error: auth.error }) : NextResponse.json({ error: auth.error }, { status: auth.status });

  // Semana de Meta Business Suite: tiempo de respuesta promedio, % de respuesta y conversaciones nuevas
  if (d.tipo === 'respuesta_semanal') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.semana ?? '')) return volver({ error: 'Falta la semana' });
    const semana = lunesDe(d.semana);
    const fila: Record<string, unknown> = { semana, source: 'manual', editado_por: auth.quien, updated_at: new Date().toISOString() };
    const tr = aMinutos(d.tr_promedio);
    const trH = aMinutos(d.tr_horario);
    if (d.tr_promedio && tr === null) return volver({ error: 'No entendí el tiempo de respuesta (ej.: 2 h, 2:15, 45 min)' });
    if (d.tr_horario && trH === null) return volver({ error: 'No entendí el tiempo en horario de atención' });
    if (tr !== null) fila.tr_promedio_min = tr;
    if (trH !== null) fila.tr_horario_min = trH;
    if (d.pct_respuesta !== undefined && String(d.pct_respuesta) !== '') {
      const p = Number(String(d.pct_respuesta).replace('%', '').replace(',', '.'));
      if (!Number.isFinite(p) || p < 0 || p > 100) return volver({ error: '% de respuesta inválido' });
      fila.pct_respuesta = p > 1 ? p / 100 : p;
    }
    if (d.conversaciones !== undefined && String(d.conversaciones) !== '') {
      const c = Number(d.conversaciones);
      if (!Number.isInteger(c) || c < 0 || c > 100000) return volver({ error: 'Conversaciones inválidas' });
      fila.conversaciones = c;
    }
    if (d.notas) fila.notas = String(d.notas).slice(0, 2000);
    if (Object.keys(fila).length <= 4) return volver({ error: 'Completá al menos el tiempo de respuesta' });
    const { error } = await supabase().from('respuesta_semanal').upsert(fila, { onConflict: 'semana' });
    if (error) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
    return volver({ ok: `Semana del ${semana.slice(8, 10)}/${semana.slice(5, 7)} guardada` });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha ?? '')) return volver({ error: 'Falta la fecha' });
  const fila: Record<string, unknown> = { fecha: d.fecha, source: 'manual', editado_por: auth.quien, updated_at: new Date().toISOString() };
  let alguno = false;
  for (const c of CAMPOS) {
    const v = d[c];
    if (v === undefined || v === '') continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 100000) return volver({ error: `Valor inválido en ${c.replace('_', ' ')}` });
    fila[c] = n;
    alguno = true;
  }
  if (!alguno) return volver({ error: 'Completá al menos un número' });
  if (d.notas) fila.notas = String(d.notas).slice(0, 2000);

  const { error } = await supabase().from('setter_diario').upsert(fila, { onConflict: 'fecha' });
  if (error) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
  return volver({ ok: `Día ${d.fecha} guardado` });
}
