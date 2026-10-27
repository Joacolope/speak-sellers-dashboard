import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';
import { CATEGORIAS_COSTO } from '@/lib/types';

const FRECUENCIAS = ['Mensual', 'Anual', 'Único'];

/**
 * Costos (software y herramientas). Form-data con sesión de editor, o JSON con
 * "Authorization: Bearer $CARGA_API_TOKEN".
 *  accion=alta    → nombre, categoria, frecuencia, monto, fecha_alta, notas
 *  accion=baja    → id, fecha (último día que se paga)
 *  accion=precio  → id, monto, fecha (desde cuándo rige). Cierra la fila vieja
 *                   el día anterior y abre una nueva: el historial no se pisa.
 */
export async function POST(req: NextRequest) {
  const esForm = req.headers.get('content-type')?.includes('form');
  const d: Record<string, string> = {};
  if (esForm) (await req.formData()).forEach((v, k) => (d[k] = String(v)));
  else Object.assign(d, await req.json());

  const volver = (q: Record<string, string>) => {
    if (!esForm) return NextResponse.json(q, { status: q.error ? 400 : 200 });
    const url = new URL('/costos', req.url);
    if (d.mes) url.searchParams.set('mes', d.mes);
    for (const [k, v] of Object.entries(q)) url.searchParams.set(k, v);
    return NextResponse.redirect(url, 303);
  };

  const auth = await exigir('editor', { permitirToken: true });
  if (!auth.ok) return esForm ? volver({ error: auth.error }) : NextResponse.json({ error: auth.error }, { status: auth.status });
  if (d.mes && !/^\d{4}-\d{2}$/.test(d.mes)) delete d.mes;
  for (const f of ['fecha', 'fecha_alta']) if (d[f] && !/^\d{4}-\d{2}-\d{2}$/.test(d[f])) return volver({ error: 'Fecha inválida' });
  if (d.id && !/^[0-9a-f-]{36}$/i.test(d.id)) return volver({ error: 'ID inválido' });

  const sb = supabase();
  const hoy = new Date().toISOString().slice(0, 10);
  const monto = d.monto === undefined || d.monto === '' ? null : Number(d.monto) < 1e7 ? Number(d.monto) : NaN;

  if (d.accion === 'alta') {
    if (!d.nombre?.trim()) return volver({ error: 'Falta el nombre' });
    if (monto === null || Number.isNaN(monto) || monto < 0) return volver({ error: 'Monto inválido' });
    if (!FRECUENCIAS.includes(d.frecuencia)) return volver({ error: 'Frecuencia inválida' });
    const categoria = (CATEGORIAS_COSTO as readonly string[]).includes(d.categoria) ? d.categoria : 'Otro';
    const { error } = await sb.from('costos').insert({
      nombre: d.nombre.trim().slice(0, 120), categoria, frecuencia: d.frecuencia, monto,
      fecha_alta: d.fecha_alta || hoy, notas: d.notas ? d.notas.slice(0, 500) : null, source: 'manual', editado_por: auth.quien,
    });
    if (error) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
    return volver({ ok: `${d.nombre.trim()} · ${monto} USD ${d.frecuencia.toLowerCase()}` });
  }

  if (!d.id) return volver({ error: 'Elegí una herramienta' });
  const { data: actual, error: e0 } = await sb.from('costos').select('*').eq('id', d.id).single();
  if (e0 || !actual) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });

  if (d.accion === 'baja') {
    const { error } = await sb.from('costos').update({ fecha_baja: d.fecha || hoy, source: 'manual', editado_por: auth.quien }).eq('id', d.id);
    if (error) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
    return volver({ ok: `${actual.nombre} dado de baja desde ${d.fecha || hoy}` });
  }

  if (d.accion === 'precio') {
    if (monto === null || Number.isNaN(monto) || monto < 0) return volver({ error: 'Monto inválido' });
    const desde = d.fecha || hoy;
    const dia = new Date(`${desde}T00:00:00Z`);
    dia.setUTCDate(dia.getUTCDate() - 1);
    const hasta = dia.toISOString().slice(0, 10);
    const { error: e1 } = await sb.from('costos').update({ fecha_baja: hasta, source: 'manual', editado_por: auth.quien }).eq('id', d.id);
    if (e1) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
    const { error: e2 } = await sb.from('costos').insert({
      nombre: actual.nombre, categoria: actual.categoria, frecuencia: actual.frecuencia, monto,
      fecha_alta: desde, notas: actual.notas, source: 'manual', editado_por: auth.quien,
    });
    if (e2) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
    return volver({ ok: `${actual.nombre}: ${actual.monto} → ${monto} USD desde ${desde}` });
  }

  return volver({ error: `Acción desconocida: ${d.accion}` });
}
