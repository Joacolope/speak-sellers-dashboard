import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALIDOS: Record<string, (v: unknown) => boolean> = {
  asistio: (v) => v === null || ['Asistió', 'No show', 'Canceló', 'Pendiente'].includes(v as string),
  oferta_hecha: (v) => v === null || v === 'true' || v === 'false' || typeof v === 'boolean',
  compro: (v) => v === null || ['Si', 'No', 'Reserva'].includes(v as string),
  producto: (v) => v === null || (typeof v === 'string' && v.length <= 120),
  cash_collected: (v) => v === null || (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e7),
  revenue: (v) => v === null || (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e7),
  metodo_pago: (v) => v === null || ['PIF', 'Cuotas', 'Reserva'].includes(v as string),
  notas: (v) => v === null || (typeof v === 'string' && v.length <= 2000),
};

/** Edición inline desde Closers. Solo editor o admin, solo campos manuales y valores válidos. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await exigir('editor');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!VALIDOS[k]) return NextResponse.json({ error: `Campo no editable: ${k}` }, { status: 400 });
    if (!VALIDOS[k](v)) return NextResponse.json({ error: `Valor inválido para ${k}` }, { status: 400 });
    patch[k] = k === 'oferta_hecha' && typeof v === 'string' ? v === 'true' : v;
  }
  if (patch.compro === 'Si' || patch.compro === 'Reserva') {
    patch.oferta_hecha = true;
    patch.asistio = 'Asistió';
  }
  patch.source = 'manual';
  patch.editado_por = auth.quien;

  const { error } = await supabase().from('agendas').update(patch).eq('id', params.id);
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
