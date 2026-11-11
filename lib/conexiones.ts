import 'server-only';
import { CLIENTE, ids } from './cliente';
import { env, supabaseConfigurado } from './env';
import { supabase } from './supabase';
import { ghl } from './sync/ghl';
import { manychat as apiManychat } from './sync/manychat';
import { cuentaAds } from './sync/meta';
import { cuentaInstagram } from './sync/cuentaIg';
import { vencimientoMeta } from './sync/vencimiento';
import { fechaHora } from './format';

/**
 * Estado de cada conexión del dashboard, en vivo. Es lo que ve un admin en /conexiones para saber
 * qué está andando y qué falta. Nunca devuelve tokens ni claves: solo si están y si funcionan.
 */
export type Estado = 'ok' | 'aviso' | 'falta' | 'error';
export interface Conexion {
  clave: string;
  nombre: string;
  estado: Estado;
  /** Qué se encontró, en una línea */
  detalle: string;
  /** Qué hacer si no está en verde */
  arreglo?: string;
  /** Es opcional: si falta, el dashboard anda igual */
  opcional?: boolean;
}

const TIMEOUT = 8000;
const conTiempo = <T,>(p: Promise<T>): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('No respondió en 8 segundos')), TIMEOUT))]);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/access_token=[^&\s"]+/g, 'access_token=…').slice(0, 220);

async function graph<T>(path: string, fields: string): Promise<T> {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('access_token', process.env.META_TOKEN ?? '');
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT) });
  const cuerpo = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!res.ok) throw new Error(cuerpo.error?.message ?? `HTTP ${res.status}`);
  return cuerpo;
}

const hace = (iso: string | null | undefined) => (iso ? (Date.now() - Date.parse(iso)) / 3600000 : null);

export async function estadoConexiones(): Promise<Conexion[]> {
  const sb = supabaseConfigurado() ? supabase() : null;
  const activos = CLIENTE.closers.filter((c) => c.activo !== false).length;

  const config: Conexion = {
    clave: 'config', nombre: 'Configuración del cliente', estado: 'ok',
    detalle: `${CLIENTE.nombre} · ${CLIENTE.closers.length} closer${CLIENTE.closers.length === 1 ? '' : 's'} (${activos} en actividad) · ${CLIENTE.zonaHoraria} · objetivos ${Math.round(CLIENTE.objetivos.asistencia * 100)} % show y ${Math.round(CLIENTE.objetivos.cierre * 100)} % cierre`,
    arreglo: 'Se edita en cliente.json del repositorio (ver docs/cliente.schema.json) y se redeploya.',
  };

  const base: Promise<Conexion> = (async () => {
    if (!sb) return { clave: 'supabase', nombre: 'Base de datos (Supabase)', estado: 'falta', detalle: 'No hay credenciales de Supabase.', arreglo: 'En Vercel: Storage → Create Database → Supabase → Connect Project. Carga las variables sola. Después, Redeploy.' };
    try {
      const [{ count: leads }, { data: ultima }] = await conTiempo(Promise.all([
        sb.from('leads').select('id', { count: 'exact', head: true }),
        sb.from('agendas').select('fecha_llamada').order('fecha_llamada', { ascending: false }).limit(1).maybeSingle(),
      ]));
      return { clave: 'supabase', nombre: 'Base de datos (Supabase)', estado: 'ok', detalle: `Conectada · ${leads ?? 0} leads · última agenda ${ultima?.fecha_llamada ? fechaHora(ultima.fecha_llamada) : 'ninguna todavía'}` };
    } catch (e) {
      return { clave: 'supabase', nombre: 'Base de datos (Supabase)', estado: 'error', detalle: `No se pudo leer: ${msg(e)}`, arreglo: 'Revisá que el último deploy haya terminado bien (el log tiene que decir "[db-setup] Schema aplicado").' };
    }
  })();

  const usuarios: Promise<Conexion> = (async () => {
    if (!sb) return { clave: 'usuarios', nombre: 'Usuarios con acceso', estado: 'falta', detalle: 'Sin base no hay lista de usuarios.' };
    try {
      const { data } = await conTiempo(Promise.resolve(sb.from('usuarios').select('rol').eq('activo', true)));
      const n = (rol: string) => ((data ?? []) as { rol: string }[]).filter((u) => u.rol === rol).length;
      const admins = n('admin');
      return {
        clave: 'usuarios', nombre: 'Usuarios con acceso', estado: admins ? 'ok' : 'aviso',
        detalle: `${admins} admin · ${n('editor')} editor · ${n('lector')} lector`,
        arreglo: 'Se agregan en Vercel con ADMIN_EMAILS / EDITOR_EMAILS / LECTOR_EMAILS (separados por coma) y Redeploy. Entran con su cuenta de Google.',
      };
    } catch (e) {
      return { clave: 'usuarios', nombre: 'Usuarios con acceso', estado: 'error', detalle: msg(e) };
    }
  })();

  const gohighlevel: Promise<Conexion> = (async () => {
    const arreglo = 'En GHL: Settings → Private Integrations → Create (permisos de solo lectura: calendars, calendars/events, contacts, opportunities, locations). El token (pit-…) va en GHL_TOKEN en Vercel. El ID de la sub-cuenta va en cliente.json → ghl.locationId.';
    if (!process.env.GHL_TOKEN) return { clave: 'ghl', nombre: 'GoHighLevel (agendas y leads)', estado: 'falta', detalle: 'Falta GHL_TOKEN.', arreglo };
    const loc = ids.ghlLocation();
    if (!loc) return { clave: 'ghl', nombre: 'GoHighLevel (agendas y leads)', estado: 'falta', detalle: 'Falta el ID de la sub-cuenta (ghl.locationId).', arreglo };
    try {
      const [l, cal, pipes] = await conTiempo(Promise.all([
        ghl<{ location?: { name?: string } }>(`/locations/${encodeURIComponent(loc)}`),
        ghl<{ calendars?: { id: string; name?: string; isActive?: boolean }[] }>('/calendars/', { locationId: loc }).catch(() => ({ calendars: [] })),
        ghl<{ pipelines?: { id: string; name?: string }[] }>('/opportunities/pipelines', { locationId: loc }).catch(() => ({ pipelines: [] })),
      ]));
      const fijos = CLIENTE.ghl.calendarios?.filter(Boolean) ?? [];
      const usados = fijos.length ? (cal.calendars ?? []).filter((c) => fijos.includes(c.id)) : (cal.calendars ?? []).filter((c) => c.isActive !== false);
      const pipe = CLIENTE.ghl.pipelineId ? (pipes.pipelines ?? []).find((p) => p.id === CLIENTE.ghl.pipelineId) : pipes.pipelines?.[0];
      const faltan = fijos.filter((id) => !(cal.calendars ?? []).some((c) => c.id === id));
      return {
        clave: 'ghl', nombre: 'GoHighLevel (agendas y leads)', estado: faltan.length ? 'aviso' : 'ok',
        detalle: `Sub-cuenta "${l.location?.name ?? loc}" · calendarios: ${usados.map((c) => c.name ?? c.id).join(', ') || 'ninguno'} · pipeline: ${pipe?.name ?? pipe?.id ?? 'ninguno'}${faltan.length ? ` · no existen: ${faltan.join(', ')}` : ''}`,
        arreglo,
      };
    } catch (e) {
      return { clave: 'ghl', nombre: 'GoHighLevel (agendas y leads)', estado: 'error', detalle: `El token no sirve o no tiene permisos: ${msg(e)}`, arreglo };
    }
  })();

  const webhook: Promise<Conexion> = (async () => {
    const secreto = process.env.GHL_WEBHOOK_SECRET || '';
    const url = `${ids.appUrl() || 'https://<tu-dominio>'}/api/webhooks/ghl?token=<GHL_WEBHOOK_SECRET>`;
    const arreglo = `1) En Vercel: GHL_WEBHOOK_SECRET = un texto largo al azar, Redeploy. 2) En GHL: Automatizaciones → workflow con disparador "Cita" (cualquier estado) → acción Webhook POST a ${url}. Sin esto, las agendas entran igual con el sync de la mañana.`;
    if (secreto.length < 16) return { clave: 'webhook', nombre: 'Citas al instante (webhook de GHL)', estado: 'falta', detalle: 'Falta GHL_WEBHOOK_SECRET (16+ caracteres).', arreglo, opcional: true };
    let ultimo: string | null = null;
    if (sb) {
      const { data } = await sb.from('log_agente').select('fecha').ilike('resumen', 'webhook GHL%').order('fecha', { ascending: false }).limit(1).maybeSingle();
      ultimo = data?.fecha ?? null;
    }
    return {
      clave: 'webhook', nombre: 'Citas al instante (webhook de GHL)', estado: ultimo ? 'ok' : 'aviso',
      detalle: ultimo ? `Última cita recibida ${fechaHora(ultimo)}` : 'Secreto configurado, pero todavía no llegó ninguna cita: falta el workflow en GHL o no hubo citas nuevas.',
      arreglo, opcional: true,
    };
  })();

  const meta: Promise<Conexion> = (async () => {
    const arreglo = 'Token de usuario del sistema en business.facebook.com/settings/system-users (sin vencimiento) con ads_read, instagram_basic, instagram_manage_insights, pages_read_engagement, pages_show_list y business_management, y la cuenta publicitaria, la página y el Instagram asignados como activos. Va en META_TOKEN. La cuenta (act_…) en cliente.json → meta.cuentaPublicitaria.';
    if (!process.env.META_TOKEN) return { clave: 'meta', nombre: 'Meta Ads (inversión y campañas)', estado: 'falta', detalle: 'Falta META_TOKEN.', arreglo };
    let cuenta: string;
    try { cuenta = cuentaAds(); } catch (e) { return { clave: 'meta', nombre: 'Meta Ads (inversión y campañas)', estado: 'falta', detalle: msg(e), arreglo }; }
    try {
      const [c, vence] = await conTiempo(Promise.all([
        graph<{ name?: string; account_status?: number; currency?: string }>(cuenta, 'name,account_status,currency'),
        vencimientoMeta().catch(() => null),
      ]));
      const dias = vence ? Math.ceil((vence.getTime() - Date.now()) / 86400000) : null;
      const venc = dias === null ? 'token sin vencimiento' : dias <= 10 ? `el token vence en ${dias} día${dias === 1 ? '' : 's'}` : `token vence el ${vence!.toISOString().slice(0, 10)}`;
      return {
        clave: 'meta', nombre: 'Meta Ads (inversión y campañas)', estado: dias !== null && dias <= 10 ? 'aviso' : 'ok',
        detalle: `Cuenta "${c.name ?? cuenta}" (${c.currency ?? '?'}) · ${venc}`,
        arreglo: dias !== null && dias <= 10 ? 'Renovar el token: mejor pasar a uno de usuario del sistema, que no vence. ' + arreglo : arreglo,
      };
    } catch (e) {
      return { clave: 'meta', nombre: 'Meta Ads (inversión y campañas)', estado: 'error', detalle: `Meta rechazó el token o la cuenta: ${msg(e)}`, arreglo };
    }
  })();

  const instagram: Promise<Conexion> = (async () => {
    const arreglo = 'La cuenta de Instagram se saca de la página de Facebook conectada: cliente.json → meta.paginaId (o META_PAGE_ID). El token de Meta necesita instagram_basic e instagram_manage_insights con esa página y ese Instagram asignados.';
    if (!process.env.META_TOKEN) return { clave: 'ig', nombre: 'Instagram (reels, historias, seguidores)', estado: 'falta', detalle: 'Falta META_TOKEN.', arreglo };
    try {
      const id = await conTiempo(cuentaInstagram());
      const ig = await graph<{ username?: string; followers_count?: number }>(id, 'username,followers_count');
      return { clave: 'ig', nombre: 'Instagram (reels, historias, seguidores)', estado: 'ok', detalle: `@${ig.username ?? id} · ${ig.followers_count?.toLocaleString('es-AR') ?? '?'} seguidores` };
    } catch (e) {
      return { clave: 'ig', nombre: 'Instagram (reels, historias, seguidores)', estado: 'error', detalle: msg(e), arreglo };
    }
  })();

  const cron: Promise<Conexion> = (async () => {
    const arreglo = 'CRON_SECRET (40+ caracteres) en Vercel y Redeploy. Vercel lo manda solo cada mañana a /api/cron/diario (horario en vercel.json, en UTC). Se puede correr a mano con Authorization: Bearer $CARGA_API_TOKEN.';
    const secreto = env.cronSecret().length >= 32;
    let ultimo: { fecha: string; resumen: string; pendientes?: string[] | null } | null = null;
    if (sb) {
      const { data } = await sb.from('log_agente').select('fecha, resumen, pendientes').ilike('resumen', 'cron %').order('fecha', { ascending: false }).limit(1).maybeSingle();
      ultimo = data ?? null;
    }
    if (!secreto) return { clave: 'cron', nombre: 'Actualización automática diaria', estado: 'falta', detalle: 'Falta CRON_SECRET: Vercel no puede disparar el sync de la mañana.', arreglo };
    if (!ultimo) return { clave: 'cron', nombre: 'Actualización automática diaria', estado: 'aviso', detalle: 'Configurado, pero todavía no corrió ninguna vez (corre cada mañana).', arreglo };
    const h = hace(ultimo.fecha) ?? 999;
    const errores = ultimo.pendientes?.length ?? 0;
    return {
      clave: 'cron', nombre: 'Actualización automática diaria', estado: h > 36 ? 'error' : errores ? 'aviso' : 'ok',
      detalle: `Última corrida ${fechaHora(ultimo.fecha)}${h > 36 ? ' (hace más de un día y medio)' : ''}${errores ? ` · ${errores} aviso${errores === 1 ? '' : 's'}: ${ultimo.pendientes!.join(' · ').slice(0, 200)}` : ' · sin errores'}`,
      arreglo: h > 36 ? 'Revisá en Vercel → Settings → Cron Jobs que esté activo y en Logs si falló. ' + arreglo : arreglo,
    };
  })();

  const carga: Conexion = env.cargaToken().length >= 32
    ? { clave: 'carga', nombre: 'Carga por API (Claude y scripts)', estado: 'ok', detalle: 'CARGA_API_TOKEN configurado: se pueden cargar ventas, cobros y asistencias por API.' }
    : { clave: 'carga', nombre: 'Carga por API (Claude y scripts)', estado: 'falta', detalle: 'Falta CARGA_API_TOKEN (32+ caracteres).', arreglo: 'openssl rand -hex 32 → CARGA_API_TOKEN en Vercel → Redeploy.', opcional: true };

  const manychat: Promise<Conexion> = (async () => {
    const arreglo = 'En ManyChat: Settings → API → Generate your API Key (hace falta plan Pro). La clave va en MANYCHAT_TOKEN en Vercel → Redeploy. Solo se usa para leer etiquetas y fechas de los contactos.';
    if (!process.env.MANYCHAT_TOKEN) return { clave: 'manychat', nombre: 'ManyChat (etiquetas y recorrido de cada lead)', estado: 'falta', detalle: 'Falta MANYCHAT_TOKEN.', arreglo, opcional: true };
    try {
      const pagina = await conTiempo(apiManychat<{ name?: string }>('/fb/page/getInfo'));
      const { count } = sb ? await sb.from('leads').select('id', { count: 'exact', head: true }).not('manychat_tags', 'is', null) : { count: 0 };
      return { clave: 'manychat', nombre: 'ManyChat (etiquetas y recorrido de cada lead)', estado: 'ok', detalle: `${pagina.name ?? 'Cuenta conectada'} · ${count ?? 0} leads con etiquetas`, opcional: true };
    } catch (e) {
      return { clave: 'manychat', nombre: 'ManyChat (etiquetas y recorrido de cada lead)', estado: 'error', detalle: msg(e), arreglo, opcional: true };
    }
  })();

  const google: Conexion = { clave: 'google', nombre: 'Ingreso con Google', estado: 'ok', detalle: 'Funciona: entraste con tu cuenta de Google para ver esta página.' };

  const lista = await Promise.all([base, usuarios, gohighlevel, webhook, meta, instagram, cron, manychat]);
  const [b, u, g, w, m, i, c, mc] = lista;
  return [config, b, google, u, g, w, m, i, mc, c, carga];
}
