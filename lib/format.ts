/** Miles con punto (1.200), USD con $ adelante, porcentajes con un decimal. */
const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const DASH = '—';

export function num(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return DASH;
  return decimals ? new Intl.NumberFormat('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v) : nf.format(v);
}

export function usd(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return DASH;
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  return `${sign}$${decimals === 2 ? nf2.format(abs) : nf.format(Math.round(abs))}`;
}

export function pct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return `${(v * 100).toFixed(1).replace('.', ',')}%`;
}

export function ratio(a: number, b: number): number | null {
  if (!b) return null;
  return a / b;
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  return d.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function nombreMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}

export function mesCorto(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  return `${MESES[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
}

export function mesActual(): string {
  const now = new Date();
  // Hora Argentina (UTC-3)
  const ar = new Date(now.getTime() - 3 * 3600 * 1000);
  return `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function mesAnterior(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

export function diasDelMes(mes: string): string[] {
  const [y, m] = mes.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
}

export function variacion(actual: number | null, anterior: number | null): number | null {
  if (actual === null || anterior === null || !anterior) return null;
  return (actual - anterior) / Math.abs(anterior);
}
