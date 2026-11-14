import { NextResponse, type NextRequest } from 'next/server';
import { refrescarDatos } from '@/lib/data';
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
  tipo_venta: (v) => v === null || ['Nueva', 'Renovación', 'Upsell'].includes(v as string),
};

/** Edición inline desde Closers. Solo editor o admin, solo campos manuales y valores válidos. */
async function manejarPATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await exigir('editor', { permitirToken: true });
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

/**
 * Saca una agenda que no tiene que contar (no era una llamada de venta, carga duplicada).
 * Solo admin o "Authorization: Bearer $CARGA_API_TOKEN". No la saca si tiene cobros.
 * Si vino de GoHighLevel no se borra (el sync la volvería a traer): queda marcada como ignorada y el dashboard no la cuenta.
 * Si se cargó a mano, se borra; y si el lead se queda sin agendas, se borra también.
 */
async function manejarDELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await exigir('admin', { permitirToken: true });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const sb = supabase();
  const { data: agenda } = await sb.from('agendas').select('id, lead_id, ghl_event_id').eq('id', params.id).maybeSingle();
  if (!agenda) return NextResponse.json({ error: 'No existe esa agenda' }, { status: 404 });
  const { count: cobros } = await sb.from('cobranzas').select('id', { count: 'exact', head: true }).eq('agenda_id', agenda.id);
  if (cobros) return NextResponse.json({ error: 'Tiene cobros cargados: no se borra' }, { status: 409 });

  if (agenda.ghl_event_id) {
    const { error: eIg } = await sb.from('agendas').update({ ignorada: true, updated_at: new Date().toISOString() }).eq('id', agenda.id);
    if (eIg) return NextResponse.json({ error: 'No se pudo sacar' }, { status: 500 });
    return NextResponse.json({ ok: true, ignorada: true });
  }

  const { error } = await sb.from('agendas').delete().eq('id', agenda.id);
  if (error) return NextResponse.json({ error: 'No se pudo borrar' }, { status: 500 });
  const { count: otras } = await sb.from('agendas').select('id', { count: 'exact', head: true }).eq('lead_id', agenda.lead_id);
  if (!otras) await sb.from('leads').delete().eq('id', agenda.lead_id);
  return NextResponse.json({ ok: true, lead_borrado: !otras });
}

/** Después de escribir se descarta la caché de datos, así el dashboard muestra lo nuevo al instante. */
export async function PATCH(...args: Parameters<typeof manejarPATCH>) {
  const res = await manejarPATCH(...args);
  refrescarDatos();
  return res;
}

export async function DELETE(...args: Parameters<typeof manejarDELETE>) {
  const res = await manejarDELETE(...args);
  refrescarDatos();
  return res;
}
