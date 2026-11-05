'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { num, pct, usd } from '@/lib/format';
import { LOCALE } from '@/lib/cliente';

/** Formatos por nombre: se pueden pasar desde un componente del servidor (una función no). */
export type FormatoSpark = 'usd' | 'num' | 'pct' | 'min';
const FORMATOS: Record<FormatoSpark, (v: number) => string> = {
  usd: (v) => usd(v),
  num: (v) => num(v),
  pct: (v) => pct(v),
  min: (v) => (v < 60 ? `${Math.round(v)} min` : `${Math.floor(v / 60)} h ${Math.round(v % 60)} min`),
};

/**
 * Sparkline: tendencia compacta para tarjetas y tablas (estilo beui.dev/charts/sparkline, hecho a mano, sin dependencias).
 * Línea suave (monotone) o área con degradé, punto en el último valor, etiqueta de variación opcional y,
 * si es interactiva, lectura del valor al pasar el mouse, arrastrar o con las flechas del teclado.
 */
export interface SparklineProps {
  data: readonly (number | null)[];
  labels?: readonly string[];
  /** Nombre accesible, ej.: "Facturación, octubre" */
  label: string;
  variant?: 'area' | 'line';
  color?: string;
  height?: number;
  strokeWidth?: number;
  /** Etiqueta de variación del primer al último valor */
  showDelta?: boolean;
  /** Para métricas donde bajar es bueno (verde al bajar) */
  invertDelta?: boolean;
  /** Etiqueta propia en vez de la variación primero→último (ej.: contra el mes anterior) */
  badge?: { texto: string; bueno: boolean } | null;
  interactive?: boolean;
  formatValue?: (v: number) => string;
  /** Alternativa serializable a formatValue */
  formato?: FormatoSpark;
  className?: string;
}

const fmtDefecto = (v: number) => new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(v);

/** Curva monotone (Fritsch–Carlson): suave sin pasarse de los puntos. */
function caminoMonotone(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  const dx = pts.slice(1).map((p, i) => p.x - pts[i].x);
  const m = pts.slice(1).map((p, i) => (p.y - pts[i].y) / (dx[i] || 1));
  const t = pts.map((_, i) => {
    if (i === 0) return m[0];
    if (i === n - 1) return m[n - 2];
    return m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i].x + h},${pts[i].y + t[i] * h} ${pts[i + 1].x - h},${pts[i + 1].y - t[i + 1] * h} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

export default function Sparkline({
  data, labels, label, variant = 'line', color = 'currentColor', height = 32, strokeWidth = 1.5,
  showDelta = false, invertDelta = false, badge, interactive = false, formatValue: fmtProp, formato, className = '',
}: SparklineProps) {
  const formatValue = fmtProp ?? (formato ? FORMATOS[formato] : fmtDefecto);
  const id = useId().replace(/:/g, '');
  const caja = useRef<HTMLDivElement>(null);
  const [activo, setActivo] = useState<number | null>(null);
  const W = 100; // el SVG se estira al ancho del contenedor; el trazo no se deforma (non-scaling-stroke)
  const PAD = 3;

  const { tramos, puntos, min, max } = useMemo(() => {
    const vals = data.map((v) => (v === null || !Number.isFinite(v) ? null : v));
    const nums = vals.filter((v): v is number => v !== null);
    const lo = nums.length ? Math.min(...nums) : 0;
    const hi = nums.length ? Math.max(...nums) : 1;
    const rango = hi - lo || Math.abs(hi) || 1;
    const x = (i: number) => (vals.length <= 1 ? W / 2 : (i / (vals.length - 1)) * W);
    const y = (v: number) => PAD + (1 - (v - lo) / rango) * (height - PAD * 2);
    const pts = vals.map((v, i) => (v === null ? null : { x: x(i), y: y(v), v, i }));
    // Los valores faltantes cortan la línea en tramos
    const tr: { x: number; y: number }[][] = [];
    let actual: { x: number; y: number }[] = [];
    for (const p of pts) {
      if (p) actual.push(p);
      else if (actual.length) { tr.push(actual); actual = []; }
    }
    if (actual.length) tr.push(actual);
    return { tramos: tr, puntos: pts, min: lo, max: hi };
  }, [data, height]);

  const validos = puntos.filter((p): p is NonNullable<typeof p> => p !== null);
  const primero = validos[0];
  const ultimo = validos[validos.length - 1];
  const cambio = showDelta && primero && ultimo && primero.v !== 0 ? (ultimo.v - primero.v) / Math.abs(primero.v) : null;
  const etiqueta = badge ?? (cambio === null ? null : {
    texto: `${cambio >= 0 ? '+' : ''}${(cambio * 100).toFixed(1).replace('.', ',')}%`,
    bueno: invertDelta ? cambio <= 0 : cambio >= 0,
  });
  const resumen = primero && ultimo
    ? `${label}: de ${formatValue(primero.v)} a ${formatValue(ultimo.v)}${cambio !== null ? ` (${etiqueta?.texto})` : ''}`
    : `${label}: sin datos`;

  const marcado = activo !== null ? puntos[activo] : null;
  const punto = marcado ?? ultimo;

  const indiceDesde = (clientX: number) => {
    const r = caja.current?.getBoundingClientRect();
    if (!r || data.length < 2) return null;
    const i = Math.round(((clientX - r.left) / r.width) * (data.length - 1));
    const c = Math.max(0, Math.min(data.length - 1, i));
    // Saltar al dato válido más cercano
    let mejor: number | null = null;
    for (const p of validos) if (mejor === null || Math.abs(p.i - c) < Math.abs(mejor - c)) mejor = p.i;
    return mejor;
  };
  const mover = (e: PointerEvent<HTMLDivElement>) => { if (interactive) setActivo(indiceDesde(e.clientX)); };
  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !validos.length) return;
    const pos = validos.findIndex((p) => p.i === (activo ?? ultimo?.i));
    const ir = (k: number) => { e.preventDefault(); setActivo(validos[Math.max(0, Math.min(validos.length - 1, k))].i); };
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') ir(pos + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') ir(pos - 1);
    else if (e.key === 'Home') ir(0);
    else if (e.key === 'End') ir(validos.length - 1);
    else if (e.key === 'Escape') setActivo(null);
  };

  const lectura = interactive && punto ? (
    <div className="shrink-0 text-right leading-tight">
      <div className="font-mono text-[13px] font-medium tabular-nums text-text">{formatValue(punto.v)}</div>
      {labels?.[punto.i] && <div className="text-[11px] text-text-disabled">{labels[punto.i]}</div>}
    </div>
  ) : null;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        ref={caja}
        className={`relative min-w-0 flex-1 ${interactive ? 'cursor-crosshair touch-none rounded' : ''}`}
        style={{ height, color }}
        role={interactive ? 'slider' : 'img'}
        aria-label={interactive ? label : resumen}
        aria-valuemin={interactive ? min : undefined}
        aria-valuemax={interactive ? max : undefined}
        aria-valuenow={interactive && punto ? punto.v : undefined}
        aria-valuetext={interactive && punto ? `${formatValue(punto.v)}${labels?.[punto.i] ? `, ${labels[punto.i]}` : ''}` : undefined}
        tabIndex={interactive ? 0 : undefined}
        onPointerMove={mover}
        onPointerDown={(e) => { if (interactive) { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); mover(e); } }}
        onPointerLeave={() => interactive && setActivo(null)}
        onKeyDown={teclas}
        onBlur={() => setActivo(null)}
      >
        <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" aria-hidden className="block overflow-visible">
          {variant === 'area' && (
            <defs>
              <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            </defs>
          )}
          {tramos.map((t, k) => {
            const d = caminoMonotone(t);
            return (
              <g key={k}>
                {variant === 'area' && t.length > 1 && (
                  <path d={`${d} L${t[t.length - 1].x},${height} L${t[0].x},${height} Z`} fill={`url(#g${id})`} stroke="none" />
                )}
                <path d={d} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
          {marcado && (
            <line x1={marcado.x} x2={marcado.x} y1={0} y2={height} stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {punto && (
          <span
            aria-hidden
            className="pointer-events-none absolute h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left,top] duration-150"
            style={{ left: `${(punto.x / W) * 100}%`, top: punto.y, background: 'currentColor', border: '2px solid var(--surface)' }}
          />
        )}
      </div>
      {lectura}
      {etiqueta && !interactive && (
        <span
          aria-hidden
          className="shrink-0 rounded-md px-2 py-0.5 font-mono text-[12px] tabular-nums"
          style={{ background: etiqueta.bueno ? 'var(--green-soft)' : 'var(--red-soft)', color: etiqueta.bueno ? 'var(--green-ink)' : 'var(--red-ink)' }}
        >
          {etiqueta.texto}
        </span>
      )}
    </div>
  );
}
