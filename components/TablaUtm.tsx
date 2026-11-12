import { OBJETIVOS } from '@/lib/cliente';
import type { FilaUtm } from '@/lib/metrics';
import { num, pct, usd } from '@/lib/format';

const tag = (v: number | null, obj: number) => (v === null ? '' : v >= obj ? 'tag-green' : v >= obj * 0.85 ? 'tag-yellow' : 'tag-red');

/** Agendas y resultado según cómo agendaron: Setting (sin UTM) o por un link (con UTM; el de Instagram es el link en bio). */
export default function TablaUtm({ datos, limite }: { datos: FilaUtm[]; limite?: number }) {
  const filas = datos.slice(0, limite ?? 999);
  const max = Math.max(1, ...filas.map((f) => f.agendas));
  return (
    <div className="flex flex-col gap-4">
      {filas.length ? (
        <div className="-mx-3 overflow-x-auto">
          <table className="table [&_td]:!px-3 [&_th]:!px-3">
            <thead>
              <tr>
                <th>Cómo agendó</th>
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
                    <div className="flex items-center gap-2">
                      <span className="dot shrink-0" style={{ background: f.color }} />
                      <span className="font-medium">{f.clave}</span>
                    </div>
                    <div className="mt-0.5 pl-4 text-[11px] text-text-disabled">{f.sinUtm ? 'Sin UTM: el setter pasó el calendario por Instagram' : `UTM: ${f.codigos.join(', ')}`}</div>
                    <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-2)]">
                      <div className="h-1.5 rounded-full" style={{ width: `${(f.agendas / max) * 100}%`, background: f.color }} />
                    </div>
                  </td>
                  <td className="num">{num(f.agendas)}</td>
                  <td className="num">{num(f.presentadas)}</td>
                  <td className="num"><span className={`tag ${tag(f.pctShow, OBJETIVOS.asistencia)}`}>{pct(f.pctShow)}</span></td>
                  <td className="num">{num(f.ventas)}</td>
                  <td className="num"><span className={`tag ${tag(f.pctCierreSinNoShow, OBJETIVOS.cierre)}`}>{pct(f.pctCierreSinNoShow)}</span></td>
                  <td className="num"><span className={`tag ${tag(f.pctCierre, OBJETIVOS.cierre)}`}>{pct(f.pctCierre)}</span></td>
                  <td className="num ok">{usd(f.cash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl bg-[var(--surface-2)] p-6 text-center text-[14px] text-text-muted">Sin agendas en este período.</div>
      )}
      <div className="text-[12px] text-text-disabled">Sin UTM = Setting: agendó con el calendario que le pasó el setter por Instagram. Con UTM de Instagram = agendó solo, por el link en bio.</div>
    </div>
  );
}
