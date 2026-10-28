import type { CuotaPendiente } from '@/lib/cuotas';
import { totalCuotas } from '@/lib/cuotas';
import { fechaCorta, usd } from '@/lib/format';
import { NOMBRE_CLOSER } from '@/lib/types';

function Grupo({ titulo, filas, color, vacio }: { titulo: string; filas: CuotaPendiente[]; color: 'red' | 'yellow' | 'blue'; vacio: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium" style={{ color: `var(--${color}-ink)` }}>{titulo}</span>
        {filas.length > 0 && <span className="text-[13px] tabular-nums text-text-muted">{usd(totalCuotas(filas))}</span>}
      </div>
      {filas.length ? (
        <ul className="flex flex-col">
          {filas.map((c) => (
            <li key={c.agenda_id} className="flex items-center justify-between gap-3 border-t border-border py-2 text-[14px]">
              <span className="min-w-0">
                <span className="block truncate text-text">{c.nombre}</span>
                <span className="block text-[12px] text-text-disabled">
                  {NOMBRE_CLOSER[c.closer]} · {c.dias < 0 ? `venció hace ${-c.dias} ${c.dias === -1 ? 'día' : 'días'}` : c.dias === 0 ? 'vence hoy' : `vence ${fechaCorta(c.vence)}`}
                  {c.cuotas_restantes ? ` · ${c.cuotas_restantes} ${c.cuotas_restantes === 1 ? 'cuota' : 'cuotas'}` : ''}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-text">{usd(c.monto)}</span>
            </li>
          ))}
        </ul>
      ) : <div className="text-[13px] text-text-disabled">{vacio}</div>}
    </div>
  );
}

export default function CuotasPorCobrar({ vencidas, semana, proximas, limite = 4 }: { vencidas: CuotaPendiente[]; semana: CuotaPendiente[]; proximas: CuotaPendiente[]; limite?: number }) {
  return (
    <div className="flex flex-col gap-5">
      <Grupo titulo="Vencidas" filas={vencidas} color="red" vacio="Ninguna vencida." />
      <Grupo titulo="Vencen esta semana" filas={semana} color="yellow" vacio="Nada esta semana." />
      <Grupo titulo="Más adelante" filas={proximas.slice(0, limite)} color="blue" vacio="Sin cuotas programadas." />
      {proximas.length > limite && <div className="text-[13px] text-text-disabled">y {proximas.length - limite} más en Cobranzas</div>}
    </div>
  );
}
