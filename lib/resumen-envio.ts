import 'server-only';
import { supabase, supabaseConfigurado } from './supabase';
import { enviarMail } from './email';
import { asuntoResumen, datosResumen, htmlResumen } from './resumen';
import { hoyAR } from './format';
import type { RawBundle } from './types';

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export const appUrl = () => process.env.APP_URL || 'https://speak-sellers-dashboard.vercel.app';

/** RESUMEN_EMAILS si está; si no, los admin activos de la tabla usuarios. */
export async function destinatarios(): Promise<string[]> {
  const env = (process.env.RESUMEN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter((e) => EMAIL.test(e));
  if (env.length) return env;
  if (!supabaseConfigurado()) return [];
  const { data } = await supabase().from('usuarios').select('email').eq('rol', 'admin').eq('activo', true);
  return (data ?? []).map((u) => u.email as string).filter((e) => EMAIL.test(e));
}

export async function enviarResumen(b: RawBundle, para: string[]): Promise<{ id: string; asunto: string }> {
  const d = datosResumen(b, hoyAR());
  const asunto = asuntoResumen(d);
  const id = await enviarMail({ para, asunto, html: htmlResumen(d, appUrl()) });
  return { id, asunto };
}
