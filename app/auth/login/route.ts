import { NextResponse, type NextRequest } from 'next/server';
import { clienteAuth, rutaSegura } from '@/lib/auth';
import { supabaseConfigurado } from '@/lib/env';

/**
 * Inicia el login con Google (OAuth con PKCE).
 * La vuelta es siempre la URL exacta /auth/callback, sin parámetros: si llevara
 * "?next=…" Supabase no la reconoce en su lista de Redirect URLs y manda a la
 * Site URL (por defecto localhost). La página a la que volver va en una cookie corta.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigurado()) return NextResponse.redirect(new URL('/login?falta=1', req.url), 303);
  const form = await req.formData();
  const next = rutaSegura(String(form.get('next') ?? '/'));
  const { data, error } = await clienteAuth().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${req.nextUrl.origin}/auth/callback`,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data.url) return NextResponse.redirect(new URL('/login?error=google', req.url), 303);
  const res = NextResponse.redirect(data.url, 303);
  res.cookies.set('ss_next', next, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
