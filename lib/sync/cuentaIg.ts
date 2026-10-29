/**
 * ID de la cuenta de Instagram del negocio para la Graph API (empieza con 1784…).
 * Se saca de la página de Facebook conectada (META_PAGE_ID), así no hay que buscarlo a mano.
 * IG_USER_ID queda como respaldo si no hay página configurada (tiene que ser el 1784…, no el ID de la página).
 */
let cache: string | null = null;

export async function cuentaInstagram(): Promise<string> {
  if (cache) return cache;
  const token = process.env.META_TOKEN;
  const page = process.env.META_PAGE_ID;
  if (token && page) {
    const url = new URL(`https://graph.facebook.com/v21.0/${page}`);
    url.searchParams.set('fields', 'instagram_business_account');
    url.searchParams.set('access_token', token);
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const id = ((await res.json()) as { instagram_business_account?: { id: string } }).instagram_business_account?.id;
      if (id) return (cache = id);
    }
  }
  const env = process.env.IG_USER_ID;
  if (env) return (cache = env);
  throw new Error('Falta META_PAGE_ID (página de Facebook conectada al Instagram)');
}
