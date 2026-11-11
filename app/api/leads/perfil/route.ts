import { NextResponse, type NextRequest } from 'next/server';
import { refrescarDatos } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { exigir } from '@/lib/auth';

const CAMPOS = ['pais', 'closer_en_actividad', 'rango_comisiones', 'dato_previo', 'primer_punto_contacto', 'manychat_url', 'fuente', 'seguidor_desde', 'como_agendo', 'recorrido'] as const;
const FUENTES = ['Instagram', 'WhatsApp', 'Webinar', 'YouTube', 'Referido', 'Otro'];
const COMO_AGENDO = ['Setting', 'Link en bio', 'Directo con el closer', 'Webinar', 'Otro'];
/** Solo links a una conversación de ManyChat (sin parámetros de búsqueda) */
const limpiarManychat = (v: string) => (/^https:\/\/app\.manychat\.com\/fb\d+\/chat\/\d+/.exec(v)?.[0] ?? '');
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Completa el perfil de varios leads de una vez (formulario de onboarding, país, etc.).
 * JSON con "Authorization: Bearer $CARGA_API_TOKEN" o sesión de editor:
 *   { "leads": [{ "nombre": "...", "pais": "...", "closer_en_actividad": "...", ..., "manychat_url": "https://app.manychat.com/fb.../chat/...", "nota": "..." }] }
 * El nombre tiene que coincidir completo (sin importar tildes ni mayúsculas).
 * Solo completa campos vacíos, salvo que el lead venga con "pisar": true. La nota se agrega una sola vez.
 * Trazabilidad de la venta: fuente, seguidor_desde (AAAA-MM-DD), como_agendo, intervino_setter (true/false), recorrido.
 */
async function manejarPOST(req: NextRequest) {
  const auth = await exigir('editor', { permitirToken: true });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => null);
  const lista: Record<string, unknown>[] = Array.isArray(body?.leads) ? body.leads.slice(0, 500) : [];
  if (!lista.length) return NextResponse.json({ error: 'Mandá { leads: [...] }' }, { status: 400 });

  const sb = supabase();
  const { data: todos, error } = await sb.from('leads').select('id, nombre, notas, intervino_setter, instagram, ' + CAMPOS.join(', '));
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
      const crudo = typeof item[c] === 'string' ? (item[c] as string).trim().slice(0, 300) : '';
      const v = c === 'manychat_url' ? limpiarManychat(crudo)
        : c === 'fuente' ? (FUENTES.includes(crudo) ? crudo : '')
        : c === 'como_agendo' ? (COMO_AGENDO.includes(crudo) ? crudo : '')
        : c === 'seguidor_desde' ? (/^\d{4}-\d{2}-\d{2}$/.test(crudo) ? crudo : '')
        : crudo;
      // "pisar": true corrige lo que ya estaba (p. ej. el "Social media" genérico que manda GoHighLevel)
      if (v && (item.pisar === true || !(typeof lead[c] === 'string' && (lead[c] as string).trim()))) patch[c] = v;
    }
    // Datos de ManyChat (los manda el sync o una carga a mano): siempre reemplazan a los anteriores
    if (Array.isArray(item.manychat_tags)) patch.manychat_tags = item.manychat_tags.filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, 120)).slice(0, 200);
    for (const c of ['manychat_desde', 'manychat_ultima'] as const) {
      if (typeof item[c] === 'string' && Number.isFinite(Date.parse(item[c] as string))) patch[c] = new Date(item[c] as string).toISOString();
    }
    const ig = typeof item.instagram === 'string' ? item.instagram.trim().slice(0, 60) : '';
    if (ig && (item.pisar === true || !lead.instagram)) patch.instagram = ig.startsWith('@') ? ig : `@${ig}`;
    if (typeof item.intervino_setter === 'boolean' && (item.pisar === true || lead.intervino_setter === null || lead.intervino_setter === undefined)) patch.intervino_setter = item.intervino_setter;
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
