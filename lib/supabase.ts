import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, supabaseConfigurado } from './env';

export { supabaseConfigurado };

let client: SupabaseClient | null = null;

/** Cliente con service role. SOLO servidor, y solo después de verificar sesión y rol. */
export function supabase(): SupabaseClient {
  if (!client) {
    const url = env.supabaseUrl();
    const key = env.supabaseService();
    if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE');
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
