import type { ProgresoMeta } from '@/lib/metas';
import { num, pct, usd } from '@/lib/format';

const COLOR = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)' } as const;

/** Barra de avance por meta + proyección a fin de mes + formulario para cambiarlas. */
export default function MetasMes({
  items, transcurridos, dias, mes, editable,
}: { items: ProgresoMeta[]; transcurridos: number; dias: number; mes: string; editable: boolean }) {
  const conMeta = items.filter((i) => i.meta);
  return (
    <div className="flex flex-col gap-5">
      {conMeta.length ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {conMeta.map((i) => {
            const v = (x: number | null) => (i.esUsd ? usd(x) : num(x));
            const real = Math.min(1, i.actual / (i.meta ?? 1));
            const proy = Math.min(1, (i.proyeccion ?? 0) / (i.meta ?? 1));
            const color = i.estado ? COLOR[i.estado] : 'var(--blue)';
            return (
              <div key={i.clave} className="flex min-w-0 flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] text-text-muted">{i.label}</span>
                  <span className="text-[13px] text-text-disabled">meta {v(i.meta)}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="metric !text-[28px]">{v(i.actual)}</span>
                  <span className="text-[13px] text-text-muted">{pct(i.actual / (i.meta ?? 1))}</span>
                </div>
                {/* Relleno fuerte = lo logrado; claro = lo que falta si se mantiene el ritmo */}
                <div className="relative h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]" role="img" aria-label={`${pct(real)} logrado`}>
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${proy * 100}%`, background: `color-mix(in srgb, ${color} 30%, transparent)` }} />
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${real * 100}%`, background: color }} />
                </div>
                {i.proyeccion !== null && transcurridos < dias && (
                  <div className="text-[13px]" style={{ color: i.estado ? `var(--${i.estado}-ink)` : undefined }}>
                    A este ritmo: {v(i.proyeccion)} ({pct(i.avance)} de la meta)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[14px] text-text-muted">Todavía no hay metas para este mes.{editable ? ' Cargalas abajo.' : ''}</div>
      )}
      {transcurridos > 0 && transcurridos < dias && conMeta.length > 0 && (
        <div className="text-[13px] text-text-disabled">Día {transcurridos} de {dias}. La proyección supone que el resto del mes sigue al mismo ritmo.</div>
      )}
      {editable && (
        <details className="group border-t border-border pt-4" open={!conMeta.length}>
          <summary className="cursor-pointer text-[14px] text-text-muted">{conMeta.length ? 'Cambiar metas' : 'Cargar metas'}</summary>
          <form method="POST" action="/api/metas" className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="mes" value={mes} />
            <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((i) => (
                <label key={i.clave} className="flex flex-col gap-1.5 text-[13px] text-text-muted">
                  <span className="truncate">{i.label}</span>
                  <input className="input" name={`meta_${i.clave}`} type="number" min="0" step="1" inputMode="numeric" placeholder={i.esUsd ? 'USD, ej. 25000' : 'ej. 20'} defaultValue={i.meta ?? ''} />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[13px] text-text-disabled">Dejá vacío lo que no quieras medir.</span>
              <button className="btn-primary" type="submit">Guardar metas</button>
            </div>
          </form>
        </details>
      )}
    </div>
  );
}
