import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';
import { CLOSERS } from '@/lib/types';

/**
 * % de comisión por closer. Form-data con sesión de editor, o JSON con
 * "Authorization: Bearer $CARGA_API_TOKEN". Body: closer, porcentaje (0–100), desde (YYYY-MM-DD).
 * Cierra el % vigente el día anterior y abre uno nuevo: los meses pasados no cambian.
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

  if (!(CLOSERS as string[]).includes(d.closer)) return volver({ error: 'Closer inválido' });
  const porcentaje = Number(d.porcentaje);
  if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) return volver({ error: 'El % tiene que estar entre 0 y 100' });
  const desde = d.desde && /^\d{4}-\d{2}-\d{2}$/.test(d.desde) ? d.desde : new Date().toISOString().slice(0, 10);

  const sb = supabase();
  const dia = new Date(`${desde}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() - 1);
  const hasta = dia.toISOString().slice(0, 10);

  // Cerrar el vigente (si empezó antes) y borrar uno que empiece el mismo día (corrección)
  const { error: e1 } = await sb.from('comisiones').update({ fecha_baja: hasta, editado_por: auth.quien })
    .eq('closer', d.closer).is('fecha_baja', null).lt('fecha_alta', desde);
  const { error: e2 } = await sb.from('comisiones').delete().eq('closer', d.closer).eq('fecha_alta', desde);
  const { error: e3 } = await sb.from('comisiones').insert({ closer: d.closer, porcentaje, fecha_alta: desde, source: 'manual', editado_por: auth.quien });
  if (e1 || e2 || e3) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
  return volver({ ok: `Comisión de ${d.closer}: ${porcentaje}% desde ${desde}` });
}
