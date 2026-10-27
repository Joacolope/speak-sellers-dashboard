'use client';

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line,
  Pie, PieChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { DiaAgendas, PuntoMensual, SemanaAdsCash } from '@/lib/metrics';
import { num, usd } from '@/lib/format';

/* Curvas suaves, línea vertical punteada en el mes elegido, ejes mínimos y tooltip tipo píldora.
   Color semántico fijo: azul = volumen / revenue, verde = cash / bueno,
   rojo = costos / malo, amarillo = pendiente / atención. */
const B = 'var(--blue)';
const G = 'var(--green)';
const R = 'var(--red)';
const Y = 'var(--yellow)';
const BS = 'var(--blue-soft)';
const GS = 'var(--green-soft)';
const RS = 'var(--red-soft)';
const MUTED = 'var(--chart-muted)';
const H = 220;
const tick = { fontSize: 11, fill: 'var(--chart-axis)', fontFamily: 'var(--font-inter)' };
const valor = { fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-inter)' };
const leyenda = {
  verticalAlign: 'top' as const,
  align: 'left' as const,
  iconType: 'circle' as const,
  iconSize: 7,
  wrapperStyle: { fontSize: 12, paddingBottom: 8, fontFamily: 'var(--font-inter)' },
  formatter: (v: string) => <span style={{ color: 'var(--text-muted)' }}>{v}</span>,
};

export const usdCorto = (v: number) => {
  if (!v) return '$0';
  const abs = Math.abs(v);
  const s = abs >= 1000 ? `${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1).replace('.', ',')}k` : num(abs);
  return `${v < 0 ? '-' : ''}$${s}`;
};

type Fmt = (v: number) => string;
export type Color = 'blue' | 'green' | 'red' | 'yellow';
const COLOR: Record<Color, string> = { blue: B, green: G, red: R, yellow: Y };
interface PillProps {
  active?: boolean;
  label?: string | number;
  payload?: { name: string; value: number; color?: string; stroke?: string; fill?: string; dataKey?: string }[];
  fmt?: Fmt;
  prefijo?: string;
}

/** Tooltip tipo píldora, como el globo "User" de la referencia. */
function Pill({ active, label, payload, fmt = (v) => num(v), prefijo = '' }: PillProps) {
  if (!active || !payload?.length) return null;
  const filas = payload.filter((p) => p.value !== null && p.value !== undefined && p.dataKey !== 'parcial');
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-[12px]">
      <div className="mb-1 text-text-disabled">{prefijo}{label}</div>
      {filas.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-text-muted">
            <span className="dot !h-1.5 !w-1.5" style={{ background: p.stroke && p.stroke !== 'none' ? p.stroke : p.fill }} />
            {p.name}
          </span>
          <span className="tabular-nums text-text">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const grid = <CartesianGrid stroke="var(--chart-grid)" vertical={false} />;

/** Marcador del mes elegido: línea punteada vertical + punto. */
function marcador(x: string | undefined, y: number | undefined, color = B) {
  if (!x) return null;
  return [
    <ReferenceLine key="rl" x={x} stroke={color} strokeDasharray="3 3" strokeOpacity={0.7} />,
    y !== undefined ? <ReferenceDot key="rd" x={x} y={y} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} /> : null,
  ];
}

/** "Finance": Revenue como área durazno y Cash como línea gris, mes a mes. */
export function CashRevenueMes({ data }: { data: PuntoMensual[] }) {
  const ult = data[data.length - 1];
  return (
    <ResponsiveContainer width="100%" height={H}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={usdCorto} width={48} />
        <Tooltip content={<Pill fmt={(v) => usd(v)} />} cursor={{ stroke: 'var(--chart-grid)' }} />
        <Legend {...leyenda} />
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke={B} strokeWidth={1.5} fill={BS} fillOpacity={1} />
        <Line type="monotone" dataKey="cash" name="Cash Collected" stroke={G} strokeWidth={2} dot={false} />
        {marcador(ult?.label, ult?.revenue, B)}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** "Revenues": área con la tendencia; si el mes está en curso, el último tramo va punteado. */
export function TendenciaMes({ data, campo, enCurso, nombre }: { data: PuntoMensual[]; campo: 'revenue' | 'cash'; enCurso: boolean; nombre: string }) {
  const n = data.length;
  const C = campo === 'cash' ? G : B;
  const CS = campo === 'cash' ? GS : BS;
  const filas = data.map((p, i) => ({
    label: p.label,
    cerrado: enCurso && i === n - 1 ? null : p[campo],
    parcial: enCurso && i >= n - 2 ? p[campo] : null,
  }));
  const ult = data[n - 1];
  return (
    <ResponsiveContainer width="100%" height={150}>
      <AreaChart data={filas} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={usdCorto} width={44} />
        <Tooltip content={<Pill fmt={(v) => usd(v)} />} cursor={{ stroke: 'var(--chart-grid)' }} />
        <Area type="monotone" dataKey="cerrado" name={nombre} stroke={C} strokeWidth={1.5} fill={CS} fillOpacity={1} connectNulls={false} />
        <Area type="monotone" dataKey="parcial" name={`${nombre} (mes en curso)`} stroke={C} strokeWidth={1.5} strokeDasharray="4 4" fill={CS} fillOpacity={0.5} connectNulls={false} />
        {marcador(ult?.label, ult?.[campo], C)}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Rentabilidad: anillo con el margen (Cash Collected / Revenue) y la leyenda al costado. */
export function AnilloRentabilidad({ revenue, ads, software, cash }: { revenue: number; ads: number; software: number | null; cash: number }) {
  const margen = revenue > 0 ? Math.max(0, Math.min(1, cash / revenue)) : null;
  const datos = margen === null ? [{ v: 1 }] : [{ v: margen }, { v: 1 - margen }];
  // Semáforo del margen: ≥ 50 % verde, 20–50 % amarillo, < 20 % rojo
  const colorMargen = margen === null ? MUTED : margen >= 0.5 ? G : margen >= 0.2 ? Y : R;
  const items = [
    { nombre: 'Revenue', valor: usd(revenue), color: B, clase: '' },
    { nombre: 'Ads', valor: `-${usd(ads)}`, color: R, clase: 'bad' },
    { nombre: 'Software', valor: software === null ? '—' : `-${usd(software)}`, color: 'color-mix(in srgb, var(--red) 50%, var(--surface))', clase: 'bad' },
    { nombre: 'Cash', valor: usd(cash), color: G, clase: 'ok' },
  ];
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative h-[156px] w-[156px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={[{ v: 1 }]} dataKey="v" innerRadius={60} outerRadius={72} startAngle={90} endAngle={-270} fill="var(--surface-2)" stroke="none" isAnimationActive={false} />
            <Pie data={datos} dataKey="v" innerRadius={60} outerRadius={72} startAngle={90} endAngle={-270} cornerRadius={8} stroke="none">
              {datos.map((_, i) => <Cell key={i} fill={i === 0 && margen !== null ? colorMargen : 'transparent'} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="metric !text-[32px]" style={{ color: margen === null ? undefined : colorMargen === Y ? 'var(--yellow-ink)' : colorMargen === G ? 'var(--green-ink)' : 'var(--red-ink)' }}>{margen === null ? '—' : `${Math.round(margen * 100)}%`}</div>
          <div className="text-[12px] text-text-disabled">Margen</div>
        </div>
      </div>
      <ul className="flex w-full min-w-0 flex-col gap-2.5 whitespace-nowrap text-[13px]">
        {items.map((it) => (
          <li key={it.nombre} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-text-muted">
              <span className="inline-block h-2 w-3 rounded-[2px]" style={{ background: it.color }} />
              {it.nombre}
            </span>
            <span className={`tabular-nums ${it.clase || 'text-text'}`}>{it.valor}</span>
          </li>
        ))}
        {software === null && <li className="whitespace-normal text-[12px] text-text-disabled">Software sin cargar: el margen real es un poco menor.</li>}
      </ul>
    </div>
  );
}

/** Barras de a pares (ROAS, New/Old Cash): naranja + gris, valor arriba. */
export function BarrasMes({
  data, a, b, formato,
}: {
  data: PuntoMensual[];
  a: { key: keyof PuntoMensual; nombre: string; color?: Color };
  b: { key: keyof PuntoMensual; nombre: string; color?: Color };
  formato: 'usd' | 'x';
}) {
  const f = (v: number) => (formato === 'usd' ? usd(v) : `${String(v).replace('.', ',')}x`);
  const etiqueta = (v: number | null) => (v === null || v === undefined || v === 0 ? '' : formato === 'usd' ? usdCorto(v) : `${String(v).replace('.', ',')}x`);
  return (
    <ResponsiveContainer width="100%" height={H}>
      <BarChart data={data} margin={{ top: 18, right: 4, left: 0, bottom: 0 }} barGap={3}>
        {grid}
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} width={formato === 'usd' ? 48 : 30} tickFormatter={(v) => (formato === 'usd' ? usdCorto(v) : `${v}x`)} />
        <ReferenceLine y={0} stroke="var(--chart-axis)" strokeOpacity={0.3} />
        <Tooltip content={<Pill fmt={f} />} cursor={{ fill: 'var(--surface-2)' }} />
        <Legend {...leyenda} />
        <Bar dataKey={a.key as string} name={a.nombre} fill={COLOR[a.color ?? 'green']} radius={[4, 4, 0, 0]} maxBarSize={22}>
          <LabelList dataKey={a.key as string} position="top" formatter={etiqueta} style={valor} />
        </Bar>
        <Bar dataKey={b.key as string} name={b.nombre} fill={COLOR[b.color ?? 'blue']} radius={[4, 4, 0, 0]} maxBarSize={22}>
          <LabelList dataKey={b.key as string} position="top" formatter={etiqueta} style={valor} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Inversión en anuncios: barras durazno, el mes elegido en naranja. */
export function InversionMes({ data }: { data: PuntoMensual[] }) {
  const n = data.length;
  return (
    <ResponsiveContainer width="100%" height={H}>
      <BarChart data={data} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={usdCorto} width={48} />
        <Tooltip content={<Pill fmt={(v) => usd(v, 2)} />} cursor={{ fill: 'var(--surface-2)' }} />
        <Bar dataKey="inversion" name="Inversión" radius={[6, 6, 0, 0]} maxBarSize={40}>
          {data.map((_, i) => <Cell key={i} fill={i === n - 1 ? R : RS} />)}
          <LabelList dataKey="inversion" position="top" formatter={(v: number) => (v ? usdCorto(v) : '')} style={valor} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Agendas (área) vs. Ventas (línea gris). */
export function AgendasVentasMes({ data }: { data: PuntoMensual[] }) {
  const ult = data[data.length - 1];
  return (
    <ResponsiveContainer width="100%" height={H}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
        <Tooltip content={<Pill />} cursor={{ stroke: 'var(--chart-grid)' }} />
        <Legend {...leyenda} />
        <Area type="monotone" dataKey="agendas" name="Agendas" stroke={B} strokeWidth={1.5} fill={BS} fillOpacity={1} />
        <Line type="monotone" dataKey="ventas" name="Ventas" stroke={G} strokeWidth={2} dot={{ r: 3, fill: G, strokeWidth: 0 }} />
        {marcador(ult?.label, ult?.agendas, B)}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Ventas por país: barra con riel durazno de fondo y el número al final. */
export function VentasPorPais({ data }: { data: { pais: string; ventas: number }[] }) {
  const alto = Math.max(150, data.length * 34 + 10);
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="pais" tick={{ ...tick, fill: 'var(--text)', fontSize: 13 }} axisLine={false} tickLine={false} width={84} />
        <Tooltip content={<Pill />} cursor={false} />
        <Bar dataKey="ventas" name="Ventas" fill={G} radius={6} barSize={12} background={{ fill: 'var(--surface-2)', radius: 6 }}>
          <LabelList dataKey="ventas" position="right" style={{ ...valor, fill: 'var(--text)' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Inversión (barras grises) vs. Cash cobrado (línea naranja), por semana. */
export function AdsVsCash({ data }: { data: SemanaAdsCash[] }) {
  return (
    <ResponsiveContainer width="100%" height={H}>
      <ComposedChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="semana" tick={tick} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={usdCorto} width={48} />
        <ReferenceLine y={0} stroke="var(--chart-axis)" strokeOpacity={0.3} />
        <Tooltip content={<Pill fmt={(v) => usd(v)} prefijo="Días " />} cursor={{ fill: 'var(--surface-2)' }} />
        <Legend {...leyenda} />
        <Bar dataKey="inversion" name="Inversión en ads" fill={R} fillOpacity={0.75} radius={[6, 6, 0, 0]} maxBarSize={40} />
        <Line type="monotone" dataKey="cash" name="Cash cobrado" stroke={G} strokeWidth={2} dot={{ r: 3, fill: G, strokeWidth: 0 }}>
          <LabelList dataKey="cash" position="top" offset={8} formatter={(v: number) => (v ? usdCorto(v) : '')} style={valor} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Agendas por día (barras durazno) con asistencias (línea). */
export function AgendasPorDia({ data }: { data: DiaAgendas[] }) {
  return (
    <ResponsiveContainer width="100%" height={H}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="dia" tick={tick} axisLine={false} tickLine={false} interval={4} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} width={26} />
        <Tooltip content={<Pill prefijo="Día " />} cursor={{ fill: 'var(--surface-2)' }} />
        <Legend {...leyenda} />
        <Bar dataKey="agendas" name="Agendas" fill={B} fillOpacity={0.35} radius={[3, 3, 0, 0]} maxBarSize={12} />
        <Line type="monotone" dataKey="asistencias" name="Asistencias" stroke={G} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Barras apiladas por día (setter: orgánicas, pagadas, outbound). */
export function BarrasSimples({ data, series }: { data: Record<string, string | number | null>[]; series: { key: string; nombre: string; color: 'main' | 'accent' | 'soft' }[] }) {
  const color = { main: B, accent: Y, soft: G };
  return (
    <ResponsiveContainer width="100%" height={H}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="x" tick={tick} axisLine={false} tickLine={false} interval={3} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} width={30} />
        <Tooltip content={<Pill prefijo="Día " />} cursor={{ fill: 'var(--surface-2)' }} />
        <Legend {...leyenda} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.nombre} stackId="a" fill={color[s.color]} maxBarSize={14} radius={i === series.length - 1 ? [3, 3, 0, 0] : 0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Costos del mes a mes: Ads + Software apilados, Cash Collected como línea. */
export function CostosMes({ data }: { data: PuntoMensual[] }) {
  return (
    <ResponsiveContainer width="100%" height={H}>
      <ComposedChart data={data} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={usdCorto} width={48} />
        <ReferenceLine y={0} stroke="var(--chart-axis)" strokeOpacity={0.3} />
        <Tooltip content={<Pill fmt={(v) => usd(v, 2)} />} cursor={{ fill: 'var(--surface-2)' }} />
        <Legend {...leyenda} />
        <Bar dataKey="inversion" name="Ads" stackId="c" fill={R} maxBarSize={36} />
        <Bar dataKey="software" name="Software" stackId="c" fill={Y} radius={[6, 6, 0, 0]} maxBarSize={36} />
        <Line type="monotone" dataKey="cash" name="Cash Collected" stroke={G} strokeWidth={2} dot={{ r: 3, fill: G, strokeWidth: 0 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Barras horizontales con riel de fondo (categorías de costo, etc.). */
export function BarrasCategoria({ data }: { data: { categoria: string; monto: number }[] }) {
  const alto = Math.max(120, data.length * 34 + 10);
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="categoria" tick={{ ...tick, fill: 'var(--text)', fontSize: 13 }} axisLine={false} tickLine={false} width={112} />
        <Tooltip content={<Pill fmt={(v) => usd(v, 2)} />} cursor={false} />
        <Bar dataKey="monto" name="Por mes" fill={R} radius={6} barSize={12} background={{ fill: 'var(--surface-2)', radius: 6 }}>
          <LabelList dataKey="monto" position="right" formatter={(v: number) => usd(v, v % 1 ? 2 : 0)} style={{ ...valor, fill: 'var(--text)' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
