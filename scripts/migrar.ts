/**
 * Migración única desde el spreadsheet "Dashboard - Speak Sellers".
 *
 * Uso:
 *   1. Exportar cada pestaña como CSV a ./migracion/<pestaña>.csv
 *      (Marcos.csv, Andrea.csv, Gonzalo.csv, Cobranzas.csv, Setter 1.csv, Anuncios.csv, Orgánico.csv)
 *   2. SUPABASE_URL=... SUPABASE_SERVICE_ROLE=... npm run migrar -- --dry   (solo cuenta)
 *   3. npm run migrar                                                      (escribe con source = migracion)
 *
 * Se revisa contra los totales conocidos: agendas octubre = 58, revenue octubre ≈ 10.690.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const dry = process.argv.includes('--dry');
const dir = './migracion';

function csv(path: string): Record<string, string>[] {
  if (!existsSync(path)) {
    console.warn(`(falta ${path}, se salta)`);
    return [];
  }
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean);
  const head = parse(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [head[i]?.trim(), v.trim()])));
}

function parse(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const monto = (v?: string) => (v ? Number(v.replace(/[$.\s]/g, '').replace(',', '.')) || null : null);
const fecha = (v?: string) => {
  if (!v) return null;
  const m = v.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!m) return null;
  const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : '2026';
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!dry && (!url || !key)) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE');
  const sb = dry ? null : createClient(url!, key!, { auth: { persistSession: false } });

  let agendas = 0;
  let revenue = 0;
  for (const closer of ['Marcos', 'Andrea', 'Gonzalo'] as const) {
    for (const r of csv(`${dir}/${closer}.csv`)) {
      const f = fecha(r['Fecha']);
      const nombre = r['Nombre'];
      if (!f || !nombre) continue;
      const compro = r['Compró'] || r['Compro'] || null;
      const rev = monto(r['Revenue']);
      agendas++;
      if (compro === 'Si' || compro === 'Reserva') revenue += rev ?? 0;
      if (sb) {
        const { data: lead } = await sb.from('leads').insert({
          nombre, telefono: r['Teléfono'] || null, pais: r['País'] || null, fuente: r['Fuente'] || null,
          cualificacion_economica: Number(r['Cualificación']) || null, source: 'migracion',
        }).select('id').single();
        await sb.from('agendas').insert({
          lead_id: lead!.id, closer, fecha_llamada: `${f}T15:00:00-03:00`,
          asistio: r['¿Asistió?'] || r['Asistió'] || 'Pendiente',
          oferta_hecha: /s[ií]/i.test(r['Oferta hecha'] ?? ''),
          compro, producto: r['Producto'] || null,
          cash_collected: monto(r['Cash Collected']), revenue: rev, source: 'migracion',
        });
      }
    }
  }
  console.log(`agendas: ${agendas} · revenue: ${revenue}`);

  for (const r of csv(`${dir}/Setter 1.csv`)) {
    const f = fecha(r['Fecha']);
    if (!f) continue;
    if (sb) await sb.from('setter_diario').upsert({
      fecha: f, conv_organicas: Number(r['Nuevas conv. orgánicas']) || null, conv_pagadas: Number(r['Nuevas conv. pagadas']) || null,
      seguimientos: Number(r['Seguimientos']) || null, links_enviados: Number(r['Links enviados']) || null, source: 'migracion',
    }, { onConflict: 'fecha' });
  }

  for (const r of csv(`${dir}/Anuncios.csv`)) {
    const f = fecha(r['Fecha']);
    if (!f || !r['Inversión']) continue;
    if (sb) await sb.from('ads_diario').upsert({
      fecha: f, campana: 'follow_me', inversion: monto(r['Inversión']) ?? 0, impresiones: Number(r['Impresiones']) || null,
      alcance: Number(r['Alcance']) || null, cpm: monto(r['CPM']), ctr: Number(r['CTR']?.replace('%', '')) / 100 || null,
      frecuencia: Number(r['Frecuencia']) || null, visitas_perfil: Number(r['Visitas']) || null, seguidores: Number(r['Seguidores']) || null,
      bitacora: r['Bitácora'] || null, source: 'migracion',
    }, { onConflict: 'fecha,campana' });
  }

  for (const r of csv(`${dir}/Orgánico.csv`)) {
    const f = fecha(r['Fecha']);
    if (!f) continue;
    if (sb) await sb.from('organico_diario').upsert({
      fecha: f, tipo_historia: r['Tipo'] || null, views_primera: Number(r['Views primera']) || null, views_ultima: Number(r['Views última']) || null,
      cantidad_historias: Number(r['Cantidad']) || null, respuestas: Number(r['Respuestas']) || null,
      formato_reel: r['Formato'] || null, tipo_cta: r['Palabra clave'] || null, comentarios_48h: Number(r['Comentarios 48h']) || null,
      notas: f === '2026-10-08' ? 'A confirmar: dato de Meta anómalo (331 respuestas)' : null, source: 'migracion',
    }, { onConflict: 'fecha' });
  }

  console.log(dry ? 'dry run, nada escrito' : 'migración lista');
}

main().catch((e) => { console.error(e); process.exit(1); });
