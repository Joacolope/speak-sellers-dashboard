import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/*
 * Primera barrera de seguridad (la segunda está en cada página y endpoint):
 *  1. Bloquea pedidos que cambian datos si vienen de otro sitio (CSRF).
 *  2. Exige sesión de Google válida (verificada contra Supabase, no solo leída de la cookie).
 *  3. Exige que el email esté en la tabla `usuarios` y activo.
 */

const PUBLICAS = ['/login', '/auth/'];
const MAQUINA = ['/api/cron/', '/api/cargar', '/api/costos']; // validan su propio token Bearer

const url = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = () => process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const service = () => process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function mismoOrigen(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (origin) return origin === req.nextUrl.origin;
  const referer = req.headers.get('referer');
  if (referer) {
    try { return new URL(referer).origin === req.nextUrl.origin; } catch { return false; }
  }
  return false;
}

async function permitido(email: string): Promise<boolean> {
  const res = await fetch(`${url()}/rest/v1/usuarios?select=email&activo=eq.true&email=eq.${encodeURIComponent(email.toLowerCase())}`, {
    headers: { apikey: service(), Authorization: `Bearer ${service()}` },
    cache: 'no-store',
  });
  if (!res.ok) return false;
  const filas = (await res.json()) as unknown[];
  return filas.length === 1;
}

function aLogin(req: NextRequest, params: Record<string, string> = {}) {
  const destino = req.nextUrl.clone();
  destino.pathname = '/login';
  destino.search = '';
  for (const [k, v] of Object.entries(params)) destino.searchParams.set(k, v);
  return NextResponse.redirect(destino);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const metodo = req.method.toUpperCase();
  const tieneBearer = /^Bearer\s+/i.test(req.headers.get('authorization') ?? '');
  const esMaquina = MAQUINA.some((p) => pathname.startsWith(p)) && tieneBearer;

  // 1. CSRF: todo lo que no es lectura tiene que venir de este mismo sitio (o traer token de máquina)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(metodo) && !esMaquina && !mismoOrigen(req)) {
    return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 });
  }

  if (PUBLICAS.some((p) => pathname.startsWith(p)) || esMaquina || pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }

  // Sin Supabase: en local se ve el demo; publicado, nada se abre hasta configurarlo.
  if (!url() || !anon() || !service()) {
    return process.env.VERCEL_ENV ? aLogin(req, { falta: '1' }) : NextResponse.next();
  }

  // 2. Sesión: refresca cookies y valida el usuario contra Supabase
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(url(), anon(), {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of lista) {
          res.cookies.set(name, value, { ...options, httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
        }
      },
    },
  });
  const { data } = await sb.auth.getUser();
  const email = data.user?.email;

  if (!email) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Iniciá sesión' }, { status: 401 });
    return aLogin(req, pathname === '/' ? {} : { next: pathname + req.nextUrl.search });
  }

  // 3. Lista de usuarios permitidos
  if (!(await permitido(email))) {
    await sb.auth.signOut();
    const r = pathname.startsWith('/api/') ? NextResponse.json({ error: 'No autorizado' }, { status: 403 }) : aLogin(req, { error: 'no_autorizado' });
    for (const c of req.cookies.getAll()) if (c.name.startsWith('sb-')) r.cookies.delete(c.name);
    return r;
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
