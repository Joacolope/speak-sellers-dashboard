import { NextResponse, type NextRequest } from 'next/server';
import { clienteAuth, rutaSegura, usuarioPermitido } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/** Vuelta de Google: canjea el código por la sesión y verifica que el email esté permitido. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = rutaSegura(req.nextUrl.searchParams.get('next'));
  if (!code) return NextResponse.redirect(new URL('/login?error=google', req.url));

  const sb = clienteAuth();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) return NextResponse.redirect(new URL('/login?error=google', req.url));

  const usuario = await usuarioPermitido(data.user.email);
  if (!usuario) {
    await sb.auth.signOut();
    return NextResponse.redirect(new URL('/login?error=no_autorizado', req.url));
  }
  await supabase().from('usuarios').update({ ultimo_ingreso: new Date().toISOString() }).eq('email', usuario.email);
  return NextResponse.redirect(new URL(next, req.url));
}
