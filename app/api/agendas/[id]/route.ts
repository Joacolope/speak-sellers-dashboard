import { NextResponse, type NextRequest } from 'next/server';
import { supabase, supabaseConfigurado } from '@/lib/supabase';

const CAMPOS_MANUALES = new Set([
  'asistio', 'oferta_hecha', 'compro', 'producto', 'cash_collected', 'revenue', 'metodo_pago', 'notas',
]);

/** Edición inline desde la tabla de closers. Solo campos manuales, siempre source = manual. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ error: 'Modo demo: configurá Supabase para editar' }, { status: 400 });
  }
  const body = (await req.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!CAMPOS_MANUALES.has(k)) return NextResponse.json({ error: `Campo no editable: ${k}` }, { status: 400 });
    patch[k] = v;
  }
  if (patch.compro === 'Si' || patch.compro === 'Reserva') {
    patch.oferta_hecha = true;
    patch.asistio = 'Asistió';
  }
  patch.source = 'manual';
  patch.updated_at = new Date().toISOString();

  const { error } = await supabase().from('agendas').update(patch).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
