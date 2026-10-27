import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';
import { PLATAFORMAS } from '@/lib/types';

/**
 * Comisión de una plataforma de pago: % sobre cada cobro + fijo por cobro (USD).
 * Form-data con sesión de editor, o JSON con "Authorization: Bearer $CARGA_API_TOKEN".
 * Body: plataforma, porcentaje (0–100), fijo (USD, opcional), desde (YYYY-MM-DD).
 */
export async function POST(req: NextRequest) {
  const esForm = req.headers.get('content-type')?.includes('form');
  const d: Record<string, string> = {};
  if (esForm) (await req.formData()).forEach((v, k) => (d[k] = String(v)));
  else Object.assign(d, await req.json().catch(() => ({})));

  const volver = (q: Record<string, string>) => {
    if (!esForm) return NextResponse.json(q, { status: q.error ? 400 : 200 });
    const url = new URL('/costos', req.url);
    if (d.mes && /^\d{4}-\d{2}$/.test(d.mes)) url.searchParams.set('mes', d.mes);
    for (const [k, v] of Object.entries(q)) url.searchParams.set(k, v);
    return NextResponse.redirect(url, 303);
  };

  const auth = await exigir('editor', { permitirToken: true });
  if (!auth.ok) return esForm ? volver({ error: auth.error }) : NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!(PLATAFORMAS as string[]).includes(d.plataforma)) return volver({ error: 'Plataforma inválida' });
  const porcentaje = Number(d.porcentaje);
  const fijo = d.fijo === undefined || d.fijo === '' ? 0 : Number(d.fijo);
  if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) return volver({ error: 'El % tiene que estar entre 0 y 100' });
  if (!Number.isFinite(fijo) || fijo < 0 || fijo > 1000) return volver({ error: 'Fijo por cobro inválido' });
  const desde = d.desde && /^\d{4}-\d{2}-\d{2}$/.test(d.desde) ? d.desde : new Date().toISOString().slice(0, 10);

  const sb = supabase();
  const dia = new Date(`${desde}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() - 1);
  const hasta = dia.toISOString().slice(0, 10);
  const { error: e1 } = await sb.from('comisiones_plataformas').update({ fecha_baja: hasta, editado_por: auth.quien })
    .eq('plataforma', d.plataforma).is('fecha_baja', null).lt('fecha_alta', desde);
  const { error: e2 } = await sb.from('comisiones_plataformas').delete().eq('plataforma', d.plataforma).eq('fecha_alta', desde);
  const { error: e3 } = await sb.from('comisiones_plataformas').insert({ plataforma: d.plataforma, porcentaje, fijo, fecha_alta: desde, source: 'manual', editado_por: auth.quien });
  if (e1 || e2 || e3) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
  return volver({ ok: `${d.plataforma}: ${porcentaje}% + $${fijo} por cobro desde ${desde}` });
}
