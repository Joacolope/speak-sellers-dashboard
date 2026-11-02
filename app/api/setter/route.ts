import { NextResponse, type NextRequest } from 'next/server';
import { refrescarDatos } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';
import { aMinutos } from '@/lib/respuesta';

const CAMPOS = ['conv_organicas', 'conv_pagadas', 'bienvenidas', 'conv_frio', 'mensajes_seguimiento', 'respuestas', 'frio_wa', 'seguimiento_wa', 'respuestas_wa', 'seguimientos', 'links_enviados', 'agendas'] as const;

/**
 * Carga o corrige un día del setter. Form-data con sesión de editor, o JSON con
 * "Authorization: Bearer $CARGA_API_TOKEN". Solo pisa los campos que vienen completos.
 */
async function manejarPOST(req: NextRequest) {
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

  // Período de Meta Business Suite (Bandeja de entrada → Estadísticas): contactos, conversaciones, índice y tiempo de respuesta
  if (d.tipo === 'respuesta_semanal') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.semana ?? '')) return volver({ error: 'Falta la semana' });
    const semana = d.semana;
    if (d.hasta && !/^\d{4}-\d{2}-\d{2}$/.test(d.hasta)) return volver({ error: 'Fecha "hasta" inválida' });
    if (d.hasta && d.hasta < semana) return volver({ error: '"Hasta" no puede ser antes de "desde"' });
    const fila: Record<string, unknown> = { semana, source: 'manual', editado_por: auth.quien, updated_at: new Date().toISOString() };
    if (!d.hasta) fila.hasta = new Date(Date.parse(`${semana}T12:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10);
    else fila.hasta = d.hasta;
    const tr = aMinutos(d.tr_promedio);
    if (d.tr_promedio && tr === null) return volver({ error: 'No entendí el tiempo de respuesta (ej.: 2 h 11 min, 2:15, 45 min)' });
    if (tr !== null) fila.tr_promedio_min = tr;
    for (const k of ['contactos', 'contactos_nuevos', 'conv_organicas', 'conv_pagadas'] as const) {
      if (d[k] === undefined || String(d[k]) === '') continue;
      const c = Number(d[k]);
      if (!Number.isInteger(c) || c < 0 || c > 1000000) return volver({ error: `Valor inválido en ${k.replace('_', ' ')}` });
      fila[k] = c;
    }
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
    if (Object.keys(fila).length <= 5) return volver({ error: 'Completá al menos un número' });
    const { error } = await supabase().from('respuesta_semanal').upsert(fila, { onConflict: 'semana' });
    if (error) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
    return volver({ ok: `Business Suite ${semana.slice(8, 10)}/${semana.slice(5, 7)} – ${String(fila.hasta).slice(8, 10)}/${String(fila.hasta).slice(5, 7)} guardado` });
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

/** Después de escribir se descarta la caché de datos, así el dashboard muestra lo nuevo al instante. */
export async function POST(...args: Parameters<typeof manejarPOST>) {
  const res = await manejarPOST(...args);
  refrescarDatos();
  return res;
}
