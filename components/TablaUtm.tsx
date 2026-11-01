'use client';

import { useState } from 'react';
import type { FilaUtm } from '@/lib/metrics';
import { num, pct, usd } from '@/lib/format';
import { COLOR_ORIGEN } from '@/lib/origen';

const NIVELES = [
  { clave: 'utm_campaign', nombre: 'Campaña' },
  { clave: 'utm_source', nombre: 'Fuente' },
  { clave: 'utm_content', nombre: 'Contenido' },
  { clave: 'utm_medium', nombre: 'Medio' },
] as const;

const tag = (v: number | null, obj: number) => (v === null ? '' : v >= obj ? 'tag-green' : v >= obj * 0.85 ? 'tag-yellow' : 'tag-red');

/** Agendas y resultado por UTM, con botones para cambiar el nivel (campaña, fuente, contenido, medio). */
export default function TablaUtm({ datos, limite }: { datos: Record<string, FilaUtm[]>; limite?: number }) {
  const [nivel, setNivel] = useState<string>('utm_campaign');
  const filas = (datos[nivel] ?? []).slice(0, limite ?? 999);
  const max = Math.max(1, ...filas.map((f) => f.agendas));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Agrupar por">
        {NIVELES.map((n) => (
          <button key={n.clave} type="button" role="tab" aria-selected={nivel === n.clave} className="chip !px-3 !py-1 !text-[13px]" data-active={nivel === n.clave} onClick={() => setNivel(n.clave)}>
            {n.nombre}
          </button>
        ))}
      </div>
      {filas.length ? (
        <div className="-mx-3 overflow-x-auto">
          <table className="table [&_td]:!px-3 [&_th]:!px-3">
            <thead>
              <tr>
                <th>{NIVELES.find((n) => n.clave === nivel)?.nombre}</th>
                <th className="num">Agendas</th>
                <th className="num">Presentadas</th>
                <th className="num">% Show</th>
                <th className="num">Ventas</th>
                <th className="num" title="Ventas / (agendas − no-shows)">% Cierre s/ no-show</th>
                <th className="num" title="Ventas / llamadas presentadas">% Cierre / presentadas</th>
                <th className="num">Cash</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.clave}>
                  <td className="min-w-[200px]">
                    <div className="flex items-center gap-2" title={f.codigos.length ? `UTM: ${f.codigos.join(', ')}` : 'Sin UTM: origen según lo que sabemos del lead'}>
                      <span className="dot shrink-0" style={{ background: COLOR_ORIGEN[f.origen] }} />
                      <span className={f.sinUtm ? 'text-text-muted' : 'font-medium'}>{f.clave}</span>
                    </div>
                    {f.codigos.length > 0 && f.codigos.join(', ') !== f.clave && (
                      <div className="mt-0.5 pl-4 text-[11px] text-text-disabled">{f.codigos.join(', ')}</div>
                    )}
                    <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-2)]">
                      <div className="h-1.5 rounded-full" style={{ width: `${(f.agendas / max) * 100}%`, background: COLOR_ORIGEN[f.origen] }} />
                    </div>
                  </td>
                  <td className="num">{num(f.agendas)}</td>
                  <td className="num">{num(f.presentadas)}</td>
                  <td className="num"><span className={`tag ${tag(f.pctShow, 0.6)}`}>{pct(f.pctShow)}</span></td>
                  <td className="num">{num(f.ventas)}</td>
                  <td className="num"><span className={`tag ${tag(f.pctCierreSinNoShow, 0.3)}`}>{pct(f.pctCierreSinNoShow)}</span></td>
                  <td className="num"><span className={`tag ${tag(f.pctCierre, 0.3)}`}>{pct(f.pctCierre)}</span></td>
                  <td className="num ok">{usd(f.cash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl bg-[var(--surface-2)] p-6 text-center text-[14px] text-text-muted">Sin agendas en este período.</div>
      )}
      <div className="text-[12px] text-text-disabled">Los UTM salen del link con el que agendó cada lead (atribución de GoHighLevel). "Sin UTM" = agendó sin link con parámetros: el origen sale de lo que ya sabemos del lead (funnel, fuente, cómo llegó).</div>
    </div>
  );
}
