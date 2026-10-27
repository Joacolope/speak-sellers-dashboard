import { NextResponse, type NextRequest } from 'next/server';

export const COOKIE_NAME = 'ss_auth';

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  const { pathname } = req.nextUrl;

  // Rutas que no requieren la contraseña del dashboard.
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/cargar')
  ) {
    return NextResponse.next();
  }

  // Sin contraseña: en local todo pasa; en Vercel se bloquea hasta configurarla.
  if (!password) {
    if (process.env.VERCEL_ENV) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('falta', '1');
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const expected = await sha256(`${password}:ss-dashboard`);
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
