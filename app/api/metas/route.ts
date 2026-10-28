import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';

const CAMPOS = { meta_revenue: 10_000_000, meta_cash: 10_000_000, meta_ventas: 10_000, meta_agendas: 100_000 } as const;

/**
 * Guarda las metas de un mes. Form-data con sesión de editor, o JSON con
 * "Authorization: Bearer $CARGA_API_TOKEN". Un campo vacío borra esa meta.
 */
export async function POST(req: NextRequest) {
  const esForm = req.headers.get('content-type')?.includes('form');
  const d: Record<string, string> = {};
  if (esForm) (await req.formData()).forEach((v, k) => (d[k] = String(v)));
  else Object.assign(d, await req.json().catch(() => ({})));

  const volver = (q: Record<string, string>) => {
    if (!esForm) return NextResponse.json(q, { status: q.error ? 400 : 200 });
    const url = new URL('/', req.url);
    if (/^\d{4}-\d{2}$/.test(d.mes ?? '')) url.searchParams.set('mes', d.mes);
    for (const [k, v] of Object.entries(q)) url.searchParams.set(k, v);
    url.hash = 'metas';
    return NextResponse.redirect(url, 303);
  };

  const auth = await exigir('editor', { permitirToken: true });
  if (!auth.ok) return esForm ? volver({ error: auth.error }) : NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!/^\d{4}-\d{2}$/.test(d.mes ?? '')) return volver({ error: 'Falta el mes' });
  const fila: Record<string, unknown> = { mes: `${d.mes}-01`, editado_por: auth.quien, updated_at: new Date().toISOString() };
  for (const [c, max] of Object.entries(CAMPOS)) {
    if (!(c in d)) continue;
    const v = String(d[c]).trim().replace(/[$\s.]/g, '').replace(',', '.');
    if (v === '') { fila[c] = null; continue; }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > max) return volver({ error: 'Las metas tienen que ser números positivos' });
    fila[c] = c === 'meta_ventas' || c === 'meta_agendas' ? Math.round(n) : n;
  }

  const { error } = await supabase().from('ajustes_mensuales').upsert(fila, { onConflict: 'mes' });
  if (error) return volver({ error: 'No se pudieron guardar las metas. Probá de nuevo.' });
  return volver({ ok: 'Metas guardadas' });
}
