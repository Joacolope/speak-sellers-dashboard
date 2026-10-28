import { NextResponse, type NextRequest } from 'next/server';
import { getSesion, puede } from '@/lib/auth';
import { getBundle } from '@/lib/data';
import { enviarResumen } from '@/lib/resumen-envio';

/** "Mandarme una prueba": solo admin, y solo a su propio mail. */
export async function POST(req: NextRequest) {
  const volver = (q: Record<string, string>) => {
    const url = new URL('/resumen', req.url);
    for (const [k, v] of Object.entries(q)) url.searchParams.set(k, v);
    return NextResponse.redirect(url, 303);
  };
  const sesion = await getSesion();
  if (!puede(sesion, 'admin') || !sesion) return volver({ error: 'Solo un admin puede mandar la prueba' });
  if (sesion.demo) return volver({ error: 'En modo local sin Supabase no se mandan mails' });
  try {
    await enviarResumen(await getBundle(), [sesion.email]);
    return volver({ ok: `Prueba enviada a ${sesion.email}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    return volver({ error: msg.includes('RESEND_API_KEY') ? 'Falta configurar RESEND_API_KEY en Vercel' : 'No se pudo mandar. Revisá la configuración de Resend.' });
  }
}
