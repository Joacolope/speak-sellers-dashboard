import { NextResponse, type NextRequest } from 'next/server';
import { refrescarDatos } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';
import { ETAPAS } from '@/lib/types';

/**
 * Etapa del embudo de una publicación de Instagram (TOFU / MOFU / BOFU), cargada a mano desde Orgánico
 * o por API con el token de carga. null la borra y vuelve a deducirse del ángulo.
 * El id es el de Instagram (ig_media_id).
 */
async function manejarPATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await exigir('editor', { permitirToken: true });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!/^[\w-]{3,64}$/.test(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !('etapa' in body) || Object.keys(body).length !== 1) return NextResponse.json({ error: 'Mandá { "etapa": "TOFU" | "MOFU" | "BOFU" | null }' }, { status: 400 });
  const etapa = body.etapa === null || body.etapa === '' ? null : String(body.etapa).toUpperCase();
  if (etapa !== null && !(ETAPAS as readonly string[]).includes(etapa)) return NextResponse.json({ error: 'La etapa tiene que ser TOFU, MOFU o BOFU' }, { status: 400 });
  const { data, error } = await supabase().from('organico_piezas').update({ etapa, updated_at: new Date().toISOString() }).eq('ig_media_id', params.id).select('ig_media_id').maybeSingle();
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No existe esa publicación' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Después de escribir se descarta la caché de datos, así el dashboard muestra lo nuevo al instante. */
export async function PATCH(...args: Parameters<typeof manejarPATCH>) {
  const res = await manejarPATCH(...args);
  refrescarDatos();
  return res;
}
