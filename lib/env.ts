/**
 * Variables de entorno. Acepta tanto los nombres propios como los que crea
 * la integración Supabase ↔ Vercel (SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_*).
 * Todo esto se lee SOLO en el servidor: ninguna clave llega al navegador.
 */
export const env = {
  supabaseUrl: () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnon: () => process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  supabaseService: () => process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  /** Token para cargas de máquina (Claude, scripts). Mínimo 32 caracteres. */
  cargaToken: () => process.env.CARGA_API_TOKEN || '',
  cronSecret: () => process.env.CRON_SECRET || '',
  enVercel: () => Boolean(process.env.VERCEL_ENV),
};

export function supabaseConfigurado(): boolean {
  return Boolean(env.supabaseUrl() && env.supabaseService() && env.supabaseAnon());
}

/** Comparación en tiempo constante para secretos (evita ataques de tiempo). */
export function igualSeguro(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length);
  for (let i = 0; i < n; i++) diff |= (ea[i % ea.length] ?? 0) ^ (eb[i % eb.length] ?? 0);
  return diff === 0;
}

/** Valida "Authorization: Bearer <secreto>" contra un secreto de al menos 32 caracteres. */
export function bearerValido(header: string | null, secreto: string): boolean {
  if (!header || secreto.length < 32) return false;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return Boolean(m && igualSeguro(m[1].trim(), secreto));
}
