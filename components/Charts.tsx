'use client';

import {
  Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { DiaAgendas, PuntoMensual, SemanaAdsCash } from '@/lib/metrics';
import { num, usd } from '@/lib/format';

/* Estilo común: grilla horizontal tenue, sin líneas de eje, valores escritos
   sobre la serie para no tener que leer el eje. Ember = principal, Brass = secundaria. */
const tick = { fontSize: 12, fill: 'var(--chart-axis)', fontFamily: 'var(--font-inter)' };
const label = { fontSize: 12, fill: 'var(--text)', fontFamily: 'var(--font-inter)' };
const leyenda = {
  verticalAlign: 'top' as const,
  align: 'left' as const,
  iconType: 'circle' as const,
  iconSize: 8,
  wrapperStyle: { fontSize: 13, color: 'var(--text-muted)', paddingBottom: 12, fontFamily: 'var(--font-inter)' },
};
const tooltip = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13, color: 'var(--text)' },
  labelStyle: { color: 'var(--text-disabled)', marginBottom: 4 },
  itemStyle: { color: 'var(--text)', padding: 0 },
  cursor: { fill: 'var(--surface-2)', stroke: 'var(--chart-grid)' },
};
const C1 = 'var(--accent)';
const C2 = 'var(--accent-2)';
const H = 240;

const usdCorto = (v: number) => {
  if (v === 0) return '$0';
  const abs = Math.abs(v);
  const s = abs >= 1000 ? `${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1).replace('.', ',')}k` : num(abs);
  return `${v < 0 ? '-' : ''}$${s}`;
};


/** Dos líneas en USD mes a mes (Cash vs Revenue). */
export function CashRevenueMes({ data }: { data: PuntoMensual[] }) {
  return (
    <ResponsiveContainer width="100%" height={H}>
      <LineChart data={data} margin={{ top: 20, right: 24, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={0} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={usdCorto} width={52} />
        <ReferenceLine y={0} stroke="var(--chart-axis)" strokeOpacity={0.4} />
        <Tooltip {...tooltip} formatter={(v: number, n: string) => [usd(v), n]} />
        <Legend {...leyenda} />
        <Line type="linear" dataKey="revenue" name="Revenue" stroke={C2} strokeWidth={2} dot={{ r: 3, fill: C2, strokeWidth: 0 }} />
        <Line type="linear" dataKey="cash" name="Cash Collected" stroke={C1} strokeWidth={2} dot={{ r: 3, fill: C1, strokeWidth: 0 }}>
          <LabelList dataKey="cash" position="top" offset={10} formatter={(v: number) => (v ? usdCorto(v) : '')} style={label} />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Barras agrupadas con el valor escrito arriba. */
export function BarrasMes({
  data, a, b, formato,
}: {
  data: PuntoMensual[];
  a: { key: keyof PuntoMensual; nombre: string };
  b: { key: keyof PuntoMensual; nombre: string };
  formato: 'usd' | 'x';
}) {
  const fmt = (v: number | null) => (v === null || v === undefined || v === 0 ? '' : formato === 'usd' ? usdCorto(v) : `${String(v).replace('.', ',')}x`);
  return (
    <ResponsiveContainer width="100%" height={H}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: 4, bottom: 0 }} barGap={4}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={0} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} width={formato === 'usd' ? 52 : 32} tickFormatter={(v) => (formato === 'usd' ? usdCorto(v) : `${v}x`)} />
        <ReferenceLine y={0} stroke="var(--chart-axis)" strokeOpacity={0.4} />
        <Tooltip {...tooltip} formatter={(v: number, n: string) => [formato === 'usd' ? usd(v) : `${String(v).replace('.', ',')}x`, n]} />
        <Legend {...leyenda} />
        <Bar dataKey={a.key as string} name={a.nombre} fill={C1} radius={[4, 4, 0, 0]} maxBarSize={28}>
          <LabelList dataKey={a.key as string} position="top" formatter={fmt} style={label} />
        </Bar>
        <Bar dataKey={b.key as string} name={b.nombre} fill={C2} radius={[4, 4, 0, 0]} maxBarSize={28}>
          <LabelList dataKey={b.key as string} position="top" formatter={fmt} style={label} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Una sola serie en USD mes a mes (inversión en anuncios). */
export function InversionMes({ data }: { data: PuntoMensual[] }) {
  return (
    <ResponsiveContainer width="100%" height={H}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={0} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={usdCorto} width={52} />
        <Tooltip {...tooltip} formatter={(v: number) => [usd(v, 2), 'Inversión']} />
        <Bar dataKey="inversion" name="Inversión" fill={C1} radius={[4, 4, 0, 0]} maxBarSize={36}>
          <LabelList dataKey="inversion" position="top" formatter={(v: number) => (v ? usdCorto(v) : '')} style={label} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Agendas vs. Ventas mes a mes. */
export function AgendasVentasMes({ data }: { data: PuntoMensual[] }) {
  return (
    <ResponsiveContainer width="100%" height={H}>
      <LineChart data={data} margin={{ top: 20, right: 24, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={0} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
        <Tooltip {...tooltip} />
        <Legend {...leyenda} />
        <Line type="linear" dataKey="agendas" name="Agendas" stroke={C1} strokeWidth={2} dot={{ r: 3, fill: C1, strokeWidth: 0 }}>
          <LabelList dataKey="agendas" position="top" offset={10} formatter={(v: number) => (v ? v : '')} style={label} />
        </Line>
        <Line type="linear" dataKey="ventas" name="Ventas" stroke={C2} strokeWidth={2} dot={{ r: 3, fill: C2, strokeWidth: 0 }}>
          <LabelList dataKey="ventas" position="bottom" offset={10} formatter={(v: number) => (v ? v : '')} style={label} />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Ventas por país: barras horizontales, ordenadas, con el número al final. */
export function VentasPorPais({ data }: { data: { pais: string; ventas: number }[] }) {
  const alto = Math.max(160, data.length * 36 + 16);
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="pais" tick={{ ...tick, fill: 'var(--text)', fontSize: 13 }} axisLine={false} tickLine={false} width={88} />
        <Tooltip {...tooltip} formatter={(v: number) => [v, 'Ventas']} />
        <Bar dataKey="ventas" fill={C1} radius={[0, 4, 4, 0]} barSize={18}>
          <LabelList dataKey="ventas" position="right" style={label} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Inversión en ads (barras) vs. Cash cobrado (línea), por semana del mes. */
export function AdsVsCash({ data }: { data: SemanaAdsCash[] }) {
  return (
    <ResponsiveContainer width="100%" height={H}>
      <ComposedChart data={data} margin={{ top: 20, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="semana" tick={tick} axisLine={false} tickLine={false} interval={0} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={usdCorto} width={52} />
        <Tooltip {...tooltip} formatter={(v: number, n: string) => [usd(v), n]} labelFormatter={(l) => `Días ${l}`} />
        <Legend {...leyenda} />
        <Bar dataKey="inversion" name="Inversión en ads" fill={C2} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Line type="linear" dataKey="cash" name="Cash cobrado" stroke={C1} strokeWidth={2} dot={{ r: 3, fill: C1, strokeWidth: 0 }}>
          <LabelList dataKey="cash" position="top" offset={10} formatter={(v: number) => (v ? usdCorto(v) : '')} style={label} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Agendas por día (barras) con asistencias (línea). */
export function AgendasPorDia({ data }: { data: DiaAgendas[] }) {
  return (
    <ResponsiveContainer width="100%" height={H}>
      <ComposedChart data={data} margin={{ top: 20, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="dia" tick={tick} axisLine={false} tickLine={false} interval={4} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip {...tooltip} labelFormatter={(l) => `Día ${l}`} />
        <Legend {...leyenda} />
        <Bar dataKey="agendas" name="Agendas" fill={C2} fillOpacity={0.55} radius={[3, 3, 0, 0]} maxBarSize={14} />
        <Line type="monotone" dataKey="asistencias" name="Asistencias" stroke={C1} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Barras apiladas por día (setter: orgánicas vs. pagadas). */
export function BarrasSimples({ data, series }: { data: Record<string, string | number | null>[]; series: { key: string; nombre: string; color: 'main' | 'accent' | 'soft' }[] }) {
  return (
    <ResponsiveContainer width="100%" height={H}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="x" tick={tick} axisLine={false} tickLine={false} interval={3} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} width={32} />
        <Tooltip {...tooltip} labelFormatter={(l) => `Día ${l}`} />
        <Legend {...leyenda} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.nombre} stackId="a" fill={s.color === 'main' ? C2 : s.color === 'accent' ? C1 : 'color-mix(in srgb, var(--accent) 35%, var(--surface))'} maxBarSize={16} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
