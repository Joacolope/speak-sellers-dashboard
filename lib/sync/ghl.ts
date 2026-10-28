import type { SupabaseClient } from '@supabase/supabase-js';
import type { Closer } from '../types';

const BASE = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';

export const CALENDARIOS = ['tAl7IAvVZiFBju2gkkMG', 'f6KLn8x47VVmqcTAdICC'];
export const PIPELINE_ID = '8tPjeFZ5cZYG40hQRQCM';
const CLOSER_POR_USER: Record<string, Closer> = {
  i8DcrP6UD17xI5U5mHCx: 'Marcos',
  FfGvrQ15X7p3f52WBFSu: 'Andrea',
};
const CLOSER_POR_CALENDARIO: Record<string, Closer> = { f6KLn8x47VVmqcTAdICC: 'Gonzalo' };

async function ghl<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.GHL_TOKEN;
  if (!token) throw new Error('Falta GHL_TOKEN');
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Version: VERSION, Accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`GHL ${path} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

interface GhlEvent {
  id: string;
  calendarId: string;
  contactId: string;
  title?: string;
  startTime: string;
  appointmentStatus: string;
  assignedUserId?: string;
  dateAdded?: string;
  rescheduledAt?: string;
}

interface GhlContact {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  tags?: string[];
  customFields?: { id: string; value: unknown }[];
  /** Primera atribución (por dónde llegó) y última (por dónde convirtió) */
  attributionSource?: Atribucion;
  lastAttributionSource?: Atribucion;
}

interface Atribucion {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  sessionSource?: string;
}

/** UTMs de la última atribución (la del link con que agendó); si no hay, de la primera. */
function utms(c: GhlContact | null) {
  const a = c?.lastAttributionSource?.utmSource || c?.lastAttributionSource?.utmCampaign ? c?.lastAttributionSource : c?.attributionSource;
  const limpio = (v?: string) => (v ? String(v).trim().slice(0, 200) || null : null);
  return {
    utm_source: limpio(a?.utmSource) ?? limpio(a?.sessionSource),
    utm_medium: limpio(a?.utmMedium),
    utm_campaign: limpio(a?.utmCampaign),
    utm_content: limpio(a?.utmContent),
    utm_term: limpio(a?.utmTerm),
  };
}

function paisPorPrefijo(tel?: string): string | null {
  if (!tel) return null;
  const t = tel.replace(/\s|-/g, '');
  if (t.startsWith('+54')) return 'Argentina';
  if (t.startsWith('+52')) return 'México';
  if (t.startsWith('+56')) return 'Chile';
  if (t.startsWith('+57')) return 'Colombia';
  if (t.startsWith('+34')) return 'España';
  if (t.startsWith('+598')) return 'Uruguay';
  if (t.startsWith('+51')) return 'Perú';
  if (t.startsWith('+1')) return 'EE. UU.';
  return null;
}

function estadoAAsistio(estado: string): 'Asistió' | 'No show' | 'Canceló' | 'Pendiente' {
  switch (estado) {
    case 'showed': return 'Asistió';
    case 'noshow': return 'No show';
    case 'cancelled': return 'Canceló';
    default: return 'Pendiente';
  }
}

/**
 * Trae agendas de los últimos 45 días + próximos 30 y las upserta por ghl_event_id.
 * Nunca pisa asistio / compro / cash_collected si la fila ya es manual o del agente.
 */
export async function syncGhl(sb: SupabaseClient, dry = false): Promise<string> {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) throw new Error('Falta GHL_LOCATION_ID');
  const ahora = Date.now();
  const desde = ahora - 45 * 86400000;
  const hasta = ahora + 30 * 86400000;

  const eventos: GhlEvent[] = [];
  for (const calendarId of CALENDARIOS) {
    const r = await ghl<{ events: GhlEvent[] }>('/calendars/events', { locationId, calendarId, startTime: String(desde), endTime: String(hasta) });
    eventos.push(...(r.events ?? []));
  }

  // Etapas del pipeline por contacto
  const etapas = new Map<string, string>();
  try {
    const opp = await ghl<{ opportunities: { contact?: { id: string }; pipelineStageId?: string; stageName?: string; status?: string }[] }>(
      '/opportunities/search', { location_id: locationId, pipeline_id: PIPELINE_ID, limit: '100' },
    );
    for (const o of opp.opportunities ?? []) if (o.contact?.id) etapas.set(o.contact.id, o.stageName ?? o.pipelineStageId ?? '');
  } catch (e) {
    console.warn('GHL opportunities:', e);
  }

  let n = 0;
  for (const ev of eventos) {
    const contacto = await ghl<{ contact: GhlContact }>(`/contacts/${ev.contactId}`).then((r) => r.contact).catch(() => null);
    const nombre = contacto?.name ?? [contacto?.firstName, contacto?.lastName].filter(Boolean).join(' ') ?? ev.title ?? 'Sin nombre';
    const closer: Closer = CLOSER_POR_CALENDARIO[ev.calendarId] ?? (ev.assignedUserId ? CLOSER_POR_USER[ev.assignedUserId] : undefined) ?? 'Marcos';

    if (dry) { n++; continue; }

    const { data: lead, error: eLead } = await sb
      .from('leads')
      .upsert(
        {
          ghl_contact_id: ev.contactId,
          nombre,
          email: contacto?.email ?? null,
          telefono: contacto?.phone ?? null,
          pais: paisPorPrefijo(contacto?.phone),
          tags: contacto?.tags ?? [],
          etapa_pipeline: etapas.get(ev.contactId) ?? null,
          ...utms(contacto),
          source: 'ghl',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'ghl_contact_id' },
      )
      .select('id')
      .single();
    if (eLead || !lead) throw new Error(`leads upsert: ${eLead?.message}`);

    const { data: existente } = await sb.from('agendas').select('id, source, asistio').eq('ghl_event_id', ev.id).maybeSingle();
    const campos: Record<string, unknown> = {
      ghl_event_id: ev.id,
      lead_id: lead.id,
      closer,
      fecha_llamada: ev.startTime,
      fecha_agendada: ev.dateAdded ?? null,
      estado_ghl: ev.appointmentStatus,
      reprogramada_desde: ev.rescheduledAt ?? null,
      updated_at: new Date().toISOString(),
    };
    if (!existente) {
      campos.asistio = estadoAAsistio(ev.appointmentStatus);
      campos.source = 'ghl';
      const { error } = await sb.from('agendas').insert(campos);
      if (error) throw new Error(`agendas insert: ${error.message}`);
    } else {
      // Solo GHL puede actualizar asistio si nadie lo tocó a mano
      if (existente.source === 'ghl' && existente.asistio === 'Pendiente') campos.asistio = estadoAAsistio(ev.appointmentStatus);
      const { error } = await sb.from('agendas').update(campos).eq('id', existente.id);
      if (error) throw new Error(`agendas update: ${error.message}`);
    }
    n++;
  }
  return `${n} agendas`;
}
