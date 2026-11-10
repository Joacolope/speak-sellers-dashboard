import type { SupabaseClient } from '@supabase/supabase-js';

const API = 'https://api.manychat.com';

interface Suscriptor {
  id: string;
  name?: string | null;
  subscribed?: string | null;
  last_interaction?: string | null;
  ig_last_interaction?: string | null;
  ig_username?: string | null;
  tags?: { id: number; name: string }[];
}

export async function manychat<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.MANYCHAT_TOKEN;
  if (!token) throw new Error('Falta MANYCHAT_TOKEN');
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
  const cuerpo = (await res.json().catch(() => null)) as { status?: string; data?: T; message?: string } | null;
  if (!res.ok || cuerpo?.status !== 'success') throw new Error(`ManyChat ${path} → ${res.status} ${cuerpo?.message ?? ''}`.trim());
  return cuerpo.data as T;
}

const idDeLink = (url: string) => /\/chat\/(\d+)/.exec(url)?.[1] ?? null;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Por cada lead con link de ManyChat trae sus etiquetas, desde cuándo está en ManyChat, la última interacción
 * y su usuario de Instagram. Solo lee: no manda mensajes ni cambia nada en ManyChat.
 */
export async function syncManychat(sb: SupabaseClient, dry = false): Promise<string> {
  if (!process.env.MANYCHAT_TOKEN) return 'sin configurar (falta MANYCHAT_TOKEN)';
  const { data: leads, error } = await sb.from('leads').select('id, nombre, instagram, manychat_url').not('manychat_url', 'is', null);
  if (error) throw new Error(`leads: ${error.message}`);
  let ok = 0;
  const fallas: string[] = [];
  for (const l of leads ?? []) {
    const id = idDeLink(String(l.manychat_url));
    if (!id) continue;
    try {
      const s = await manychat<Suscriptor>('/fb/subscriber/getInfo', { subscriber_id: id });
      if (!dry) {
        const { error: e } = await sb.from('leads').update({
          manychat_tags: (s.tags ?? []).map((t) => t.name),
          manychat_desde: s.subscribed ?? null,
          manychat_ultima: s.ig_last_interaction ?? s.last_interaction ?? null,
          ...(!l.instagram && s.ig_username ? { instagram: `@${s.ig_username}` } : {}),
        }).eq('id', l.id);
        if (e) throw new Error(e.message);
      }
      ok++;
    } catch (e) {
      fallas.push(`${l.nombre}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 120));
    }
    await esperar(120); // ManyChat permite 10 pedidos por segundo
  }
  if (fallas.length && !ok) throw new Error(fallas[0]);
  return `${ok} contactos${fallas.length ? ` (${fallas.length} con error: ${fallas.slice(0, 2).join(' · ')})` : ''}`;
}
