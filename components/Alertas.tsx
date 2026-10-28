import Link from 'next/link';
import type { Alerta } from '@/lib/alertas';

const ESTILO: Record<Alerta['nivel'], { fondo: string; tinta: string }> = {
  red: { fondo: 'var(--red-soft)', tinta: 'var(--red-ink)' },
  yellow: { fondo: 'var(--yellow-soft)', tinta: 'var(--yellow-ink)' },
  blue: { fondo: 'var(--blue-soft)', tinta: 'var(--blue-ink)' },
};

/** Lo que hay que mirar hoy, ordenado de más a menos urgente. */
export default function Alertas({ alertas }: { alertas: Alerta[] }) {
  if (!alertas.length)
    return (
      <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-[14px]" style={{ background: 'var(--green-soft)', color: 'var(--green-ink)' }}>
        <span aria-hidden>●</span> Todo en orden: nada urgente para hoy.
      </div>
    );
  return (
    <ul className="flex flex-col gap-2">
      {alertas.map((a) => {
        const e = ESTILO[a.nivel];
        const cuerpo = (
          <>
            <span aria-hidden className="mt-[1px]">●</span>
            <span className="min-w-0 flex-1 text-text">{a.texto}</span>
            {a.href && <span className="shrink-0 text-[13px]">Ver →</span>}
          </>
        );
        const clase = 'flex items-start gap-3 rounded-xl px-4 py-3 text-[14px]';
        return (
          <li key={a.texto}>
            {a.href ? (
              <Link href={a.href} className={`${clase} transition-opacity hover:opacity-80`} style={{ background: e.fondo, color: e.tinta }}>{cuerpo}</Link>
            ) : (
              <div className={clase} style={{ background: e.fondo, color: e.tinta }}>{cuerpo}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
