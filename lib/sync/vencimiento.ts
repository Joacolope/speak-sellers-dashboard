/**
 * Fecha de vencimiento del META_TOKEN (null si no vence, como el de un usuario de sistema).
 * El token de usuario de 60 días hay que renovarlo a mano: el cron avisa 10 días antes.
 */
export async function vencimientoMeta(): Promise<Date | null> {
  const token = process.env.META_TOKEN;
  if (!token) return null;
  const url = new URL('https://graph.facebook.com/v21.0/debug_token');
  url.searchParams.set('input_token', token);
  url.searchParams.set('access_token', token);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const vence = ((await res.json()) as { data?: { expires_at?: number } }).data?.expires_at;
  return vence ? new Date(vence * 1000) : null;
}
