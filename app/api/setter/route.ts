import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';

const CAMPOS = ['conv_organicas', 'conv_pagadas', 'bienvenidas', 'conv_frio', 'mensajes_seguimiento', 'respuestas', 'seguimientos', 'links_enviados'] as const;

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

  const { error } = await supabase().from('setter_diario').upsert(fila, { onConflict: 'fecha' });
  if (error) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
  return volver({ ok: `Día ${d.fecha} guardado` });
}
