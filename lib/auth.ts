import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { env, supabaseConfigurado, bearerValido } from './env';
import { supabase } from './supabase';

export type Rol = 'admin' | 'editor' | 'lector';
export interface Sesion {
  email: string;
  nombre: string | null;
  rol: Rol;
  demo?: boolean;
}

const NIVEL: Record<Rol, number> = { lector: 1, editor: 2, admin: 3 };
export const puede = (s: Sesion | null, minimo: Rol) => Boolean(s && NIVEL[s.rol] >= NIVEL[minimo]);

/** Opciones de cookie endurecidas: no accesibles desde JavaScript, solo HTTPS, mismo sitio. */
export const COOKIE_SEGURA: Partial<CookieOptions> = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

/** Cliente de Supabase Auth atado a las cookies del request (route handlers y server components). */
export function clienteAuth() {
  const store = cookies();
  return createServerClient(env.supabaseUrl(), env.supabaseAnon(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) store.set(name, value, { ...options, ...COOKIE_SEGURA });
        } catch {
          // En server components no se pueden escribir cookies; el middleware las refresca.
        }
      },
    },
  });
}

/** Busca el email en la lista de usuarios permitidos. Devuelve null si no está o está inactivo. */
export async function usuarioPermitido(email: string | undefined | null): Promise<Sesion | null> {
  if (!email) return null;
  const { data, error } = await supabase()
    .from('usuarios')
    .select('email, nombre, rol, activo')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (error || !data || !data.activo) return null;
  return { email: data.email, nombre: data.nombre, rol: data.rol as Rol };
}

/**
 * Sesión actual, verificada contra Supabase (getUser valida el JWT en el servidor,
 * no solo lo decodifica) y contra la lista de usuarios. Una vez por request.
 * Sin Supabase y fuera de Vercel (desarrollo local): sesión demo de solo lectura de ejemplo.
 */
export const getSesion = cache(async (): Promise<Sesion | null> => {
  if (!supabaseConfigurado()) {
    return env.enVercel() ? null : { email: 'demo@local', nombre: 'Demo', rol: 'admin', demo: true };
  }
  const { data, error } = await clienteAuth().auth.getUser();
  if (error || !data.user) return null;
  return usuarioPermitido(data.user.email);
});

/** Para route handlers que escriben: exige rol mínimo, o un token de máquina válido. */
export async function exigir(minimo: Rol, opciones: { permitirToken?: boolean } = {}): Promise<{ ok: true; quien: string } | { ok: false; status: number; error: string }> {
  if (opciones.permitirToken && bearerValido(headers().get('authorization'), env.cargaToken())) {
    return { ok: true, quien: 'token:claude' };
  }
  const s = await getSesion();
  if (!s) return { ok: false, status: 401, error: 'Iniciá sesión' };
  if (s.demo) return { ok: false, status: 400, error: 'Modo demo: Supabase no está configurado' };
  if (!puede(s, minimo)) return { ok: false, status: 403, error: 'Tu usuario no tiene permiso para cargar datos' };
  return { ok: true, quien: s.email };
}

/** Evita redirecciones abiertas: solo rutas internas. */
export function rutaSegura(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}
