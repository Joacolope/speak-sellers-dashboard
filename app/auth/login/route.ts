import { NextResponse, type NextRequest } from 'next/server';
import { clienteAuth, rutaSegura } from '@/lib/auth';
import { supabaseConfigurado } from '@/lib/env';

/** Inicia el login con Google (OAuth con PKCE: el código solo sirve con el verificador guardado en cookie). */
export async function POST(req: NextRequest) {
  if (!supabaseConfigurado()) return NextResponse.redirect(new URL('/login?falta=1', req.url), 303);
  const form = await req.formData();
  const next = rutaSegura(String(form.get('next') ?? '/'));
  const origen = req.nextUrl.origin;
  const { data, error } = await clienteAuth().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origen}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data.url) return NextResponse.redirect(new URL('/login?error=google', req.url), 303);
  return NextResponse.redirect(data.url, 303);
}
