import { NextResponse, type NextRequest } from 'next/server';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { CATEGORIAS_COSTO } from '@/lib/types';

const FRECUENCIAS = ['Mensual', 'Anual', 'Único'];

/**
 * Costos (software y herramientas). Form-data o JSON, protegido con PIN_CARGA.
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

  if (!process.env.PIN_CARGA || d.pin !== process.env.PIN_CARGA) return volver({ error: 'PIN incorrecto' });
  if (!supabaseConfigurado()) return volver({ error: 'Modo demo: Supabase no está configurado' });

  const sb = supabase();
  const hoy = new Date().toISOString().slice(0, 10);
  const monto = d.monto === undefined || d.monto === '' ? null : Number(d.monto);

  if (d.accion === 'alta') {
    if (!d.nombre?.trim()) return volver({ error: 'Falta el nombre' });
    if (monto === null || Number.isNaN(monto) || monto < 0) return volver({ error: 'Monto inválido' });
    if (!FRECUENCIAS.includes(d.frecuencia)) return volver({ error: 'Frecuencia inválida' });
    const categoria = (CATEGORIAS_COSTO as readonly string[]).includes(d.categoria) ? d.categoria : 'Otro';
    const { error } = await sb.from('costos').insert({
      nombre: d.nombre.trim(), categoria, frecuencia: d.frecuencia, monto,
      fecha_alta: d.fecha_alta || hoy, notas: d.notas || null, source: 'manual',
    });
    if (error) return volver({ error: error.message });
    return volver({ ok: `${d.nombre.trim()} · ${monto} USD ${d.frecuencia.toLowerCase()}` });
  }

  if (!d.id) return volver({ error: 'Elegí una herramienta' });
  const { data: actual, error: e0 } = await sb.from('costos').select('*').eq('id', d.id).single();
  if (e0 || !actual) return volver({ error: e0?.message ?? 'No encontré esa herramienta' });

  if (d.accion === 'baja') {
    const { error } = await sb.from('costos').update({ fecha_baja: d.fecha || hoy, source: 'manual' }).eq('id', d.id);
    if (error) return volver({ error: error.message });
    return volver({ ok: `${actual.nombre} dado de baja desde ${d.fecha || hoy}` });
  }

  if (d.accion === 'precio') {
    if (monto === null || Number.isNaN(monto) || monto < 0) return volver({ error: 'Monto inválido' });
    const desde = d.fecha || hoy;
    const dia = new Date(`${desde}T00:00:00Z`);
    dia.setUTCDate(dia.getUTCDate() - 1);
    const hasta = dia.toISOString().slice(0, 10);
    const { error: e1 } = await sb.from('costos').update({ fecha_baja: hasta, source: 'manual' }).eq('id', d.id);
    if (e1) return volver({ error: e1.message });
    const { error: e2 } = await sb.from('costos').insert({
      nombre: actual.nombre, categoria: actual.categoria, frecuencia: actual.frecuencia, monto,
      fecha_alta: desde, notas: actual.notas, source: 'manual',
    });
    if (e2) return volver({ error: e2.message });
    return volver({ ok: `${actual.nombre}: ${actual.monto} → ${monto} USD desde ${desde}` });
  }

  return volver({ error: `Acción desconocida: ${d.accion}` });
}
