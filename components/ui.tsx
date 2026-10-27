import type { ReactNode } from 'react';
import type { Source } from '@/lib/types';
import { pct } from '@/lib/format';

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

export function Seccion({ eyebrow, titulo, children, aside }: { eyebrow: string; titulo?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
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

export function Semaforo({ valor, objetivo, invertir = false }: { valor: number | null; objetivo: number; invertir?: boolean }) {
  if (valor === null) return <span className="text-text-disabled">—</span>;
  const ok = invertir ? valor <= objetivo : valor >= objetivo;
  return (
    <span className={ok ? 'ok' : 'bad'}>
      <span className="dot mr-2" style={{ background: 'currentColor' }} />
      {pct(valor)}
    </span>
  );
}

export function Variacion({ v, invertir = false }: { v: number | null; invertir?: boolean }) {
  if (v === null) return <span className="text-[13px] text-text-disabled">sin mes anterior</span>;
  const sign = v > 0 ? '+' : '';
  return (
    <span className="text-[13px]">
      <span className={(v >= 0) !== invertir ? 'ok' : 'bad'}>{v >= 0 ? '▲' : '▼'} {sign}{(v * 100).toFixed(1).replace('.', ',')}%</span>{' '}
      <span className="text-text-disabled">vs. mes anterior</span>
    </span>
  );
}

export function SiNo({ v }: { v: boolean | null | undefined }) {
  if (v === null || v === undefined) return <span className="text-text-disabled">—</span>;
  return <span className={v ? 'ok' : 'bad'}>{v ? '✓' : '✗'}</span>;
}

export function DemoBanner() {
  return (
    <div className="card-feature !py-4 text-[14px] text-text-muted">
      <span className="mr-2 text-accent [font-family:var(--font-polysans)]">Datos de ejemplo.</span>
      Supabase no está configurado. Los números salen de la sección 10 de la spec (octubre 2026) y solo sirven para ver el diseño. Cargá <code className="mono text-[12px]">SUPABASE_URL</code> y <code className="mono text-[12px]">SUPABASE_SERVICE_ROLE</code> en Vercel para ver datos reales.
    </div>
  );
}

export function Vacio({ texto }: { texto: string }) {
  return <div className="panel !p-6 text-center text-[14px] text-text-muted">{texto}</div>;
}

/** Tarjeta de datos estilo referencia: título en tinta ember, ícono en círculo,
    número grande opcional con su comparación, y el gráfico abajo. */
export function ChartCard({
  titulo, sub, icono, valor, comparacion, children, className = '',
}: {
  titulo: string;
  sub?: string;
  icono?: ReactNode;
  valor?: string;
  comparacion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card flex flex-col gap-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="card-title">{titulo}</h3>
          {sub && <div className="card-sub">{sub}</div>}
        </div>
        {icono && <span className="icon-badge" aria-hidden>{icono}</span>}
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
