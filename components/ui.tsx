import type { ReactNode } from 'react';
import type { Source } from '@/lib/types';
import { pct } from '@/lib/format';

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

export function Seccion({ eyebrow, titulo, children, aside }: { eyebrow: string; titulo?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          {titulo && <h2 className="h2 mt-2">{titulo}</h2>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Bloque de la página: título chico a la izquierda, una línea de contexto, y el contenido con aire. */
export function Bloque({ titulo, sub, children, aside }: { titulo: string; sub?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <h2 className="h3">{titulo}</h2>
          {sub && <div className="mt-0.5 text-[13px] text-text-disabled">{sub}</div>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** ● automático / ◐ agente / ○ manual */
export function SourceDot({ source }: { source: Source | null | undefined }) {
  const map: Record<Source, { glyph: string; label: string }> = {
    ghl: { glyph: '●', label: 'Automático (GHL)' },
    meta: { glyph: '●', label: 'Automático (Meta)' },
    ig: { glyph: '●', label: 'Automático (Instagram)' },
    agente: { glyph: '◐', label: 'Agente' },
    manual: { glyph: '○', label: 'Manual' },
    migracion: { glyph: '○', label: 'Migración del spreadsheet' },
  };
  if (!source) return <span className="text-text-disabled">—</span>;
  const s = map[source];
  return (
    <span className="text-[12px] text-text-disabled" title={s.label} aria-label={s.label}>{s.glyph}</span>
  );
}

/** Semáforo de 3 niveles: verde cumple, amarillo cerca (a menos del 15 % del objetivo), rojo lejos. */
export function Semaforo({ valor, objetivo, invertir = false }: { valor: number | null; objetivo: number; invertir?: boolean }) {
  if (valor === null) return <span className="text-text-disabled">—</span>;
  const ok = invertir ? valor <= objetivo : valor >= objetivo;
  const cerca = invertir ? valor <= objetivo * 1.15 : valor >= objetivo * 0.85;
  return <span className={`tag ${ok ? 'tag-green' : cerca ? 'tag-yellow' : 'tag-red'}`}>{pct(valor)}</span>;
}

/** Clase de texto según semáforo, para números grandes. */
export function claseSemaforo(valor: number | null, objetivo: number): string {
  if (valor === null) return '';
  return valor >= objetivo ? 'ok' : valor >= objetivo * 0.85 ? 'warn' : 'bad';
}

export type ColorTag = 'green' | 'red' | 'yellow' | 'blue' | 'gray';

export function Tag({ color, children, title }: { color: ColorTag; children: ReactNode; title?: string }) {
  return <span className={`tag tag-${color}`} title={title}>{children}</span>;
}

const COLOR_ASISTIO: Record<string, ColorTag> = { 'Asistió': 'green', 'No show': 'red', 'Canceló': 'gray', Pendiente: 'yellow' };
const COLOR_COMPRO: Record<string, ColorTag> = { Si: 'green', Reserva: 'yellow', No: 'red' };

export function EstadoAsistio({ v }: { v: string | null | undefined }) {
  if (!v) return <span className="text-text-disabled">—</span>;
  return <Tag color={COLOR_ASISTIO[v] ?? 'gray'}>{v}</Tag>;
}

export function EstadoCompro({ v }: { v: string | null | undefined }) {
  if (!v) return <span className="text-text-disabled">—</span>;
  return <Tag color={COLOR_COMPRO[v] ?? 'gray'}>{v === 'Si' ? 'Sí' : v}</Tag>;
}

export function Variacion({ v, invertir = false, contra = 'mes anterior' }: { v: number | null; invertir?: boolean; contra?: string }) {
  if (v === null) return <span className="text-[13px] text-text-disabled">sin datos de {contra}</span>;
  const sign = v > 0 ? '+' : '';
  return (
    <span className="text-[13px]">
      <span className={(v >= 0) !== invertir ? 'ok' : 'bad'}>{v >= 0 ? '▲' : '▼'} {sign}{(v * 100).toFixed(1).replace('.', ',')}%</span>{' '}
      <span className="text-text-disabled">vs. {contra}</span>
    </span>
  );
}

export function SiNo({ v }: { v: boolean | null | undefined }) {
  if (v === null || v === undefined) return <span className="text-text-disabled">—</span>;
  return <Tag color={v ? 'green' : 'red'}>{v ? 'Sí' : 'No'}</Tag>;
}

export function DemoBanner() {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--yellow-soft)] px-5 py-3 text-[14px] text-text-muted">
      <Tag color="yellow">Datos de ejemplo</Tag>
      <span>Estás viendo números inventados porque Supabase no está configurado en este entorno. Nada de esto es real.</span>
    </div>
  );
}

export function Vacio({ texto }: { texto: string }) {
  return <div className="panel !p-6 text-center text-[14px] text-text-muted">{texto}</div>;
}

/** Tarjeta de datos estilo referencia: título en tinta ember, ícono en círculo,
    número grande opcional con su comparación, y el gráfico abajo. */
export function ChartCard({
  titulo, sub, icono, color = 'blue', valor, comparacion, children, className = '',
}: {
  titulo: string;
  sub?: string;
  icono?: ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow';
  valor?: string;
  comparacion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card flex flex-col gap-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="card-title">{titulo}</h3>
          {sub && <div className="card-sub">{sub}</div>}
        </div>
        {icono && <span className={`icon-badge icon-${color}`} aria-hidden>{icono}</span>}
      </div>
      {valor && (
        <div className="-mt-1">
          <div className="metric !text-[32px]">{valor}</div>
          {comparacion && <div className="mt-1 text-[13px] text-text-disabled">{comparacion}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
