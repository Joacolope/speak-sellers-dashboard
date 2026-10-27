import { NextResponse, type NextRequest } from 'next/server';
import { clienteAuth } from '@/lib/auth';
import { supabaseConfigurado } from '@/lib/env';

export async function POST(req: NextRequest) {
  if (supabaseConfigurado()) await clienteAuth().auth.signOut();
  return NextResponse.redirect(new URL('/login?salio=1', req.url), 303);
}
