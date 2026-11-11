import { NextResponse, type NextRequest } from 'next/server';
import { refrescarDatos } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';
import { ESTADOS_ANGULO, ETAPAS } from '@/lib/types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
/** "precio al principio, CTA INFO" → ["precio al principio", "cta info"] */
const palabras = (v: unknown): string[] =>
  (Array.isArray(v) ? v : String(v ?? '').split(','))
    .map((p) => String(p).trim().toLowerCase().slice(0, 60))
    .filter(Boolean)
    .slice(0, 15);

/**
 * Ángulos de comunicación (sección de Contacto). Form-data con sesión de editor, o JSON con
 * "Authorization: Bearer $CARGA_API_TOKEN".
 *  accion=alta    → nombre, etapa (TOFU/MOFU/BOFU), estado, tipo, formato, hook, resultado, url, palabras_clave, notas
 *  accion=editar  → id + los mismos campos (los que vienen vacíos se borran)
 *  accion=estado  → id, estado
 *  accion=borrar  → id
 */
async function manejarPOST(req: NextRequest) {
  const esForm = req.headers.get('content-type')?.includes('form');
  const d: Record<string, unknown> = {};
  if (esForm) (await req.formData()).forEach((v, k) => (d[k] = String(v)));
  else Object.assign(d, await req.json().catch(() => ({})));

  const volver = (q: Record<string, string>) => {
    if (!esForm) return NextResponse.json(q, { status: q.error ? 400 : 200 });
    const url = new URL('/puntos-de-contacto', req.url);
    for (const [k, v] of Object.entries(q)) url.searchParams.set(k, v);
    url.hash = 'angulos';
    return NextResponse.redirect(url, 303);
  };

  const auth = await exigir('editor', { permitirToken: true });
  if (!auth.ok) return esForm ? volver({ error: auth.error }) : NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = supabase();
  const accion = String(d.accion ?? 'alta');
  const id = typeof d.id === 'string' ? d.id : '';
  if (accion !== 'alta' && !UUID.test(id)) return volver({ error: 'Falta el ángulo' });

  if (accion === 'borrar') {
    const { error } = await sb.from('angulos').delete().eq('id', id);
    if (error) return volver({ error: 'No se pudo borrar. Probá de nuevo.' });
    return volver({ ok: 'Ángulo borrado' });
  }

  const estado = String(d.estado ?? 'Probando');
  if (!(ESTADOS_ANGULO as readonly string[]).includes(estado)) return volver({ error: 'Estado inválido' });

  if (accion === 'estado') {
    const { error } = await sb.from('angulos').update({ estado, editado_por: auth.quien, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return volver({ error: 'No se pudo guardar. Probá de nuevo.' });
    return volver({ ok: `Ángulo marcado como ${estado.toLowerCase()}` });
  }

  const nombre = texto(d.nombre, 160);
  if (!nombre) return volver({ error: 'Falta el nombre del ángulo' });
  const etapa = String(d.etapa ?? '').toUpperCase();
  if (!(ETAPAS as readonly string[]).includes(etapa)) return volver({ error: 'La etapa tiene que ser TOFU, MOFU o BOFU' });
  const url = texto(d.url, 500);
  if (url && !/^https?:\/\//i.test(url)) return volver({ error: 'El link tiene que empezar con https://' });

  const fila = {
    nombre, etapa, estado,
    tipo: texto(d.tipo, 60), formato: texto(d.formato, 60), hook: texto(d.hook, 500), resultado: texto(d.resultado, 1000),
    url, palabras_clave: palabras(d.palabras_clave), notas: texto(d.notas, 2000),
    source: 'manual', editado_por: auth.quien, updated_at: new Date().toISOString(),
  };
  const { error } = accion === 'editar'
    ? await sb.from('angulos').update(fila).eq('id', id)
    : accion === 'alta' ? await sb.from('angulos').insert(fila) : { error: { message: 'accion' } };
  if (error) return volver({ error: accion === 'alta' || accion === 'editar' ? 'No se pudo guardar. Probá de nuevo.' : `Acción desconocida: ${accion}` });
  return volver({ ok: `${nombre} · ${etapa} · ${estado.toLowerCase()}` });
}

/** Después de escribir se descarta la caché de datos, así el dashboard muestra lo nuevo al instante. */
export async function POST(...args: Parameters<typeof manejarPOST>) {
  const res = await manejarPOST(...args);
  refrescarDatos();
  return res;
}
