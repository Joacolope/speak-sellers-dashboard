import type { SupabaseClient } from '@supabase/supabase-js';
import { nombreMes } from '../format';

/**
 * Control contra la planilla de finanzas del cliente ("Ingresos reales por cliente", una pestaña por mes:
 * "Ventas Noviembre"). Solo lee: compara pago por pago lo que dice la planilla con lo cargado en el dashboard
 * y avisa las diferencias. La planilla tiene que estar compartida como "cualquier persona con el enlace: lector".
 */

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** CSV con comillas y comas adentro de los campos. */
export function leerCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (enComillas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') enComillas = false;
      else campo += ch;
    } else if (ch === '"') enComillas = true;
    else if (ch === ',') { fila.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      filas.push(fila); fila = [];
    } else campo += ch;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

/** "USD11,379.90", "$1,547.77", "912,000.00" → número. Vacío o "-" → null. */
const monto = (v: string | undefined): number | null => {
  const limpio = (v ?? '').replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (!limpio || limpio === '-') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
};

/** "2/11/26" o "9/11(26" (con un error de tipeo) → "2026-11-02". Sin fecha legible → null. */
const fecha = (v: string | undefined): string | null => {
  const iso = (v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = (v ?? '').match(/(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})/);
  if (!m) return null;
  const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};

export interface PagoPlanilla {
  cliente: string;
  fecha: string | null;
  /** Monto en USD (los pagos en pesos se pasan con el tipo de cambio de la planilla) */
  usd: number;
  /** Como figura en la planilla: "ARS 912.000" */
  original: string;
  closer: string;
  /** Marcado como renovación en la planilla */
  renovacion: boolean;
}

export interface Planilla {
  pagos: PagoPlanilla[];
  tipoCambio: number | null;
  /** "TOTAL EN USD" de la planilla, si lo trae */
  totalUsd: number | null;
}

/** Lee la pestaña de un mes. Ubica las columnas por su título, así no se rompe si agregan o mueven columnas. */
export function leerPlanilla(csv: string): Planilla {
  const filas = leerCsv(csv);
  const cab = (filas[0] ?? []).map((c) => norm(c));
  const col = (nombre: string, porDefecto: number) => { const i = cab.findIndex((c) => c.startsWith(nombre)); return i >= 0 ? i : porDefecto; };
  const cCliente = col('cliente', 0);
  const cFecha = col('fecha de pago', 2);
  const cMoneda = col('moneda', 5);
  const cPago = col('pago realizado', 6);
  const cCloser = col('closer', -1);
  const cRenov = col('renovacion', -1);
  if (!cab.some((c) => c.startsWith('pago realizado')) || !cab.some((c) => c.startsWith('moneda'))) throw new Error('la pestaña no tiene las columnas "PAGO REALIZADO" y "MONEDA": no es una pestaña de ventas con el formato actual');

  const fila = (titulo: string) => filas.find((f) => norm(f[cCliente] ?? '').startsWith(titulo));
  const tipoCambio = monto(fila('tipo de cambio')?.[cPago]);
  const totalUsd = monto(fila('total en usd')?.[cPago]);

  const pagos: PagoPlanilla[] = [];
  let anterior = '';
  for (const f of filas.slice(1)) {
    let cliente = (f[cCliente] ?? '').trim();
    if (/^total/i.test(cliente)) break; // debajo de "TOTALES" ya no hay pagos
    const m = monto(f[cPago]);
    if (m === null || m === 0) continue;
    // Un segundo pago del mismo cliente a veces va en la fila de abajo sin repetir el nombre
    if (!cliente) cliente = anterior;
    if (!cliente) continue;
    anterior = cliente;
    const moneda = norm(f[cMoneda] ?? '') || 'usd';
    const enPesos = moneda !== 'usd';
    if (enPesos && !tipoCambio) continue;
    pagos.push({
      cliente,
      fecha: fecha(f[cFecha]),
      usd: Math.round((enPesos ? m / tipoCambio! : m) * 100) / 100,
      original: `${enPesos ? 'ARS' : 'USD'} ${m.toLocaleString('es-AR')}`,
      closer: cCloser >= 0 ? (f[cCloser] ?? '').trim() : '',
      renovacion: cRenov >= 0 && /^s[ií]/i.test((f[cRenov] ?? '').trim()),
    });
  }
  return { pagos, tipoCambio, totalUsd };
}

export interface CobroDashboard { nombre: string; fecha: string; usd: number }

export interface Comparacion {
  totalPlanilla: number;
  totalDashboard: number;
  /** Están en la planilla y no en el dashboard */
  faltanEnDashboard: PagoPlanilla[];
  /** Están en el dashboard y no en la planilla */
  sobranEnDashboard: CobroDashboard[];
  coinciden: number;
}

/**
 * Empareja cada pago de la planilla con un cobro del dashboard: mismo monto (± USD 1) y, entre los candidatos,
 * el que comparte más palabras del nombre y está más cerca en fecha. Los nombres no siempre coinciden
 * ("Cristina Pérez" en la planilla es "Alejandra Cuadrado y Cristina Martino Pérez" en el dashboard).
 */
export function compararPlanilla(planilla: Planilla, cobros: CobroDashboard[]): Comparacion {
  const libres = [...cobros];
  const faltan: PagoPlanilla[] = [];
  let coinciden = 0;
  const palabras = (s: string) => new Set(norm(s).split(' ').filter((p) => p.length >= 3));
  const candidatos = (p: PagoPlanilla) => {
    const mias = palabras(p.cliente);
    return libres
      .filter((c) => Math.abs(c.usd - p.usd) <= 1)
      .map((c) => ({
        c,
        comunes: Array.from(palabras(c.nombre)).filter((w) => mias.has(w)).length,
        dias: p.fecha ? Math.abs(Date.parse(c.fecha) - Date.parse(p.fecha)) / 86400000 : 0,
      }))
      .sort((x, y) => y.comunes - x.comunes || x.dias - y.dias);
  };
  // Dos pasadas: primero los que coinciden por nombre (así un pago de otra persona con el mismo monto no se queda
  // con el cobro), después los que solo coinciden por monto y fecha (± 3 días).
  let pendientes = [...planilla.pagos];
  for (const porNombre of [true, false]) {
    const sinPareja: PagoPlanilla[] = [];
    for (const p of pendientes) {
      const c = candidatos(p).find((x) => (porNombre ? x.comunes > 0 : x.dias <= 3));
      if (c) { libres.splice(libres.indexOf(c.c), 1); coinciden++; }
      else sinPareja.push(p);
    }
    pendientes = sinPareja;
  }
  faltan.push(...pendientes);
  const suma = (xs: { usd: number }[]) => Math.round(xs.reduce((s, x) => s + x.usd, 0) * 100) / 100;
  return { totalPlanilla: planilla.totalUsd ?? suma(planilla.pagos), totalDashboard: suma(cobros), faltanEnDashboard: faltan, sobranEnDashboard: libres, coinciden };
}

const usd = (n: number) => `USD ${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

/** Texto corto para los avisos del Inicio. null = todo coincide. */
export function avisoPlanilla(mes: string, c: Comparacion): string | null {
  if (!c.faltanEnDashboard.length && !c.sobranEnDashboard.length && Math.abs(c.totalPlanilla - c.totalDashboard) <= 2) return null;
  const partes: string[] = [`Planilla de finanzas de ${nombreMes(mes).toLowerCase()}: la planilla suma ${usd(c.totalPlanilla)} y el dashboard ${usd(c.totalDashboard)}`];
  const lista = (xs: string[]) => (xs.length > 4 ? `${xs.slice(0, 4).join(', ')} y ${xs.length - 4} más` : xs.join(', '));
  if (c.faltanEnDashboard.length) partes.push(`faltan cargar: ${lista(c.faltanEnDashboard.map((p) => `${p.cliente} ${usd(p.usd)}${p.renovacion ? ' (renovación)' : ''}`))}`);
  if (c.sobranEnDashboard.length) partes.push(`no están en la planilla: ${lista(c.sobranEnDashboard.map((p) => `${p.nombre} ${usd(p.usd)}`))}`);
  return partes.join(' · ');
}

const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Baja la pestaña del mes ("Ventas Noviembre") como CSV. La busca por nombre, así sirve para los meses que vienen. */
export async function bajarPlanilla(id: string, mes: string): Promise<string> {
  const pestana = `Ventas ${NOMBRES_MES[Number(mes.slice(5, 7)) - 1]}`;
  // Si la pestaña no existe con ese nombre exacto, Google devuelve la primera de la planilla sin avisar:
  // se prueba también con espacios de más (hay pestañas llamadas " Ventas Octubre ") y se verifica que sea de ventas.
  for (const nombre of [pestana, ` ${pestana} `, `${pestana} `, ` ${pestana}`]) {
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(nombre)}`;
    const res = await fetch(url, { cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(20000) });
    const texto = res.status === 200 ? await res.text() : '';
    // Sin permiso, Google manda al login (302) o devuelve una página HTML
    if (res.status !== 200 || /^\s*</.test(texto)) throw new Error(`no se pudo leer la planilla (${res.status}). Compartila como "cualquier persona con el enlace: lector"`);
    if (/pago realizado/i.test(texto.split('\n')[0] ?? '')) return texto;
  }
  throw new Error(`no encontré la pestaña "${pestana}" en la planilla`);
}

/** Compara el mes contra la planilla. Devuelve el resumen para el log y, si hay diferencias, el aviso. */
export async function controlPlanilla(sb: SupabaseClient, mes: string): Promise<{ resumen: string; aviso: string | null; detalle: Comparacion }> {
  const id = process.env.PLANILLA_FINANZAS_ID;
  if (!id) throw new Error('falta PLANILLA_FINANZAS_ID');
  const planilla = leerPlanilla(await bajarPlanilla(id, mes));
  const [y, m] = mes.split('-').map(Number);
  const fin = `${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
  const { data: cobs, error } = await sb.from('cobranzas').select('fecha_cobro, monto_cobrado, es_reembolso, agendas(leads(nombre))').gte('fecha_cobro', `${mes}-01`).lte('fecha_cobro', fin);
  if (error) throw new Error(`cobranzas: ${error.message}`);
  type Fila = { fecha_cobro: string; monto_cobrado: number; es_reembolso: boolean; agendas: { leads: { nombre: string } | null } | null };
  const cobros = ((cobs ?? []) as unknown as Fila[]).filter((c) => !c.es_reembolso).map((c) => ({ nombre: c.agendas?.leads?.nombre ?? 'Sin nombre', fecha: c.fecha_cobro, usd: Number(c.monto_cobrado) }));
  const detalle = compararPlanilla(planilla, cobros);
  const aviso = avisoPlanilla(mes, detalle);
  return { resumen: aviso ? `${detalle.faltanEnDashboard.length} sin cargar, ${detalle.sobranEnDashboard.length} de más` : `coincide (${detalle.coinciden} pagos, ${usd(detalle.totalDashboard)})`, aviso, detalle };
}
