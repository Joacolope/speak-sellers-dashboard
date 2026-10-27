import { NextResponse, type NextRequest } from 'next/server';

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get('password') ?? '');
  const next = String(form.get('next') ?? '/');
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected || password !== expected) {
    const url = new URL('/login', req.url);
    url.searchParams.set('error', '1');
    if (next) url.searchParams.set('next', next);
    return NextResponse.redirect(url, 303);
  }

  const res = NextResponse.redirect(new URL(next.startsWith('/') ? next : '/', req.url), 303);
  res.cookies.set('ss_auth', await sha256(`${expected}:ss-dashboard`), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return res;
}
