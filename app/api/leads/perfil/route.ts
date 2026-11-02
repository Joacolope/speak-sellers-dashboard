import { NextResponse, type NextRequest } from 'next/server';
import { refrescarDatos } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';

const CAMPOS = ['pais', 'closer_en_actividad', 'rango_comisiones', 'dato_previo', 'primer_punto_contacto'] as const;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Completa el perfil de varios leads de una vez (formulario de onboarding, país, etc.).
 * JSON con "Authorization: Bearer $CARGA_API_TOKEN" o sesión de editor:
 *   { "leads": [{ "nombre": "...", "pais": "...", "closer_en_actividad": "...", ..., "nota": "..." }] }
 * El nombre tiene que coincidir completo (sin importar tildes ni mayúsculas).
 * Solo completa campos vacíos: nunca pisa lo cargado. La nota se agrega una sola vez.
 */
async function manejarPOST(req: NextRequest) {
  const auth = await exigir('editor', { permitirToken: true });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => null);
  const lista: Record<string, unknown>[] = Array.isArray(body?.leads) ? body.leads.slice(0, 500) : [];
  if (!lista.length) return NextResponse.json({ error: 'Mandá { leads: [...] }' }, { status: 400 });

  const sb = supabase();
  const { data: todos, error } = await sb.from('leads').select('id, nombre, notas, ' + CAMPOS.join(', '));
  if (error) return NextResponse.json({ error: 'No se pudo leer los leads' }, { status: 500 });
  const porNombre = new Map<string, Record<string, unknown>[]>();
  for (const l of (todos ?? []) as unknown as Record<string, unknown>[]) {
    const k = norm(String(l.nombre ?? ''));
    porNombre.set(k, [...(porNombre.get(k) ?? []), l]);
  }

  const actualizados: string[] = [];
  const sinCambios: string[] = [];
  const noEncontrados: string[] = [];
  const repetidos: string[] = [];
  for (const item of lista) {
    const nombre = String(item.nombre ?? '').slice(0, 120);
    const encontrados = porNombre.get(norm(nombre)) ?? [];
    if (!encontrados.length) { noEncontrados.push(nombre); continue; }
    if (encontrados.length > 1) { repetidos.push(nombre); continue; }
    const lead = encontrados[0];
    const patch: Record<string, unknown> = {};
    for (const c of CAMPOS) {
      const v = typeof item[c] === 'string' ? (item[c] as string).trim().slice(0, 300) : '';
      if (v && !(typeof lead[c] === 'string' && (lead[c] as string).trim())) patch[c] = v;
    }
    const nota = typeof item.nota === 'string' ? item.nota.trim().slice(0, 2000) : '';
    const previas = typeof lead.notas === 'string' ? lead.notas : '';
    const marca = nota.split(':')[0];
    if (nota && !previas.includes(marca)) patch.notas = [previas, nota].filter(Boolean).join(' · ');
    if (!Object.keys(patch).length) { sinCambios.push(nombre); continue; }
    const { error: e } = await sb.from('leads').update({ ...patch, editado_por: auth.quien, updated_at: new Date().toISOString() }).eq('id', lead.id);
    if (e) return NextResponse.json({ error: `No se pudo guardar ${nombre}` }, { status: 500 });
    actualizados.push(nombre);
  }
  return NextResponse.json({ ok: true, actualizados, sinCambios, noEncontrados, repetidos });
}

/** Después de escribir se descarta la caché de datos, así el dashboard muestra lo nuevo al instante. */
export async function POST(...args: Parameters<typeof manejarPOST>) {
  const res = await manejarPOST(...args);
  refrescarDatos();
  return res;
}
