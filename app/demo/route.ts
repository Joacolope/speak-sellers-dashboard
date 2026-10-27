import { NextResponse, type NextRequest } from 'next/server';
import { getSesion } from '@/lib/auth';

/** Activa o desactiva la vista con datos de ejemplo (solo usuarios logueados). */
export async function POST(req: NextRequest) {
  const sesion = await getSesion();
  if (!sesion) return NextResponse.redirect(new URL('/login', req.url), 303);
  const form = await req.formData();
  const activar = form.get('activar') === '1';
  const res = NextResponse.redirect(new URL('/', req.url), 303);
  if (activar) {
    res.cookies.set('ss_demo', '1', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12 });
  } else {
    res.cookies.delete('ss_demo');
  }
  return res;
}
