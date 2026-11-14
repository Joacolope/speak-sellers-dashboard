import { NextResponse, type NextRequest } from 'next/server';
import { refrescarDatos } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';
import { CLOSERS, PLATAFORMAS } from '@/lib/types';
import { leerPlan } from '@/lib/cuotas';
import { hoyAR } from '@/lib/format';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esFecha = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const esMonto = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e7;
const VALIDOS: Record<string, (v: unknown) => boolean> = {
  fecha_cobro: esFecha,
  monto_cobrado: esMonto,
  pendiente: (v) => v === null || (esMonto(v) && (v as number) >= 0),
  cuotas_restantes: (v) => v === null || (Number.isInteger(v) && (v as number) >= 0 && (v as number) < 100),
  proximo_vencimiento: (v) => v === null || esFecha(v),
  plataforma: (v) => v === null || (PLATAFORMAS as string[]).includes(v as string),
  closer: (v) => (CLOSERS as string[]).includes(v as string),
  notas: (v) => v === null || (typeof v === 'string' && v.length <= 2000),
  comision_setter: (v) => v === null || (esMonto(v) && (v as number) >= 0),
  responsable: (v) => v === null || (typeof v === 'string' && v.length <= 60),
  ultimo_contacto: (v) => v === null || esFecha(v),
};

/** Lo cobrado de la llamada es la suma de sus cobros: se recalcula cada vez que cambia uno. */
async function recalcularLlamada(agendaId: string, quien: string) {
  const sb = supabase();
  const { data: cobros } = await sb.from('cobranzas').select('monto_cobrado').eq('agenda_id', agendaId);
  const total = (cobros ?? []).reduce((s, c) => s + Number(c.monto_cobrado), 0);
  await sb.from('agendas').update({ cash_collected: total, source: 'manual', editado_por: quien, updated_at: new Date().toISOString() }).eq('id', agendaId);
}

/** Edición de un cobro desde Cobranzas (o por API con el token de carga). Solo editor o admin, y solo valores válidos. */
async function manejarPATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await exigir('editor', { permitirToken: true });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
  const patch: Record<string, unknown> = {};
  // Plan de pagos: texto ("10/12 500, 10/1 1500"), lista [{fecha, monto}] o null para borrarlo.
  // La fecha del próximo pago y las cuotas que faltan salen del plan.
  if ('plan_pagos' in body) {
    const crudo = body.plan_pagos;
    delete body.plan_pagos;
    if (crudo === null || crudo === '') patch.plan_pagos = null;
    else {
      const plan = typeof crudo === 'string' ? leerPlan(crudo, hoyAR())
        : Array.isArray(crudo) && crudo.length <= 36 && crudo.every((x) => x && esFecha(x.fecha) && esMonto(x.monto) && x.monto > 0)
          ? [...crudo].map((x) => ({ fecha: x.fecha as string, monto: x.monto as number })).sort((a, b) => a.fecha.localeCompare(b.fecha)) : null;
      if (!plan) return NextResponse.json({ error: 'Escribí el plan así: 10/12 500, 10/1 1500' }, { status: 400 });
      patch.plan_pagos = plan;
      patch.proximo_vencimiento = plan[0].fecha;
      patch.cuotas_restantes = plan.length;
    }
  }
  for (const [k, v] of Object.entries(body)) {
    if (!VALIDOS[k]) return NextResponse.json({ error: `Campo no editable: ${k}` }, { status: 400 });
    if (!VALIDOS[k](v)) return NextResponse.json({ error: `Valor inválido para ${k.replace(/_/g, ' ')}` }, { status: 400 });
    patch[k] = v;
  }
  if (typeof patch.monto_cobrado === 'number') patch.es_reembolso = patch.monto_cobrado < 0;
  patch.source = 'manual';
  patch.editado_por = auth.quien;
  patch.updated_at = new Date().toISOString();

  const sb = supabase();
  // Si se cambia a mano la fecha del próximo pago y hay un plan cargado, se mueve la primera cuota del plan
  // (o se borra el plan si se quita la fecha), así el plan y la fecha nunca dicen cosas distintas.
  if ('proximo_vencimiento' in patch && !('plan_pagos' in patch)) {
    const { data: actual } = await sb.from('cobranzas').select('plan_pagos').eq('id', params.id).maybeSingle();
    const plan = Array.isArray(actual?.plan_pagos) ? (actual.plan_pagos as { fecha: string; monto: number }[]) : null;
    if (plan?.length) {
      patch.plan_pagos = patch.proximo_vencimiento === null ? null
        : [{ ...plan[0], fecha: patch.proximo_vencimiento as string }, ...plan.slice(1)].sort((a, b) => a.fecha.localeCompare(b.fecha));
    }
  }
  const { data: cobro, error } = await sb.from('cobranzas').update(patch).eq('id', params.id).select('agenda_id').maybeSingle();
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
  if (!cobro) return NextResponse.json({ error: 'No existe ese cobro' }, { status: 404 });
  if ('monto_cobrado' in patch) await recalcularLlamada(cobro.agenda_id, auth.quien);
  return NextResponse.json({ ok: true });
}

/** Borra un cobro cargado por error o duplicado. Solo admin o el token de carga. */
async function manejarDELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await exigir('admin', { permitirToken: true });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const sb = supabase();
  const { data: cobro } = await sb.from('cobranzas').select('agenda_id').eq('id', params.id).maybeSingle();
  if (!cobro) return NextResponse.json({ error: 'No existe ese cobro' }, { status: 404 });
  const { error } = await sb.from('cobranzas').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: 'No se pudo borrar' }, { status: 500 });
  await recalcularLlamada(cobro.agenda_id, auth.quien);
  return NextResponse.json({ ok: true });
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
