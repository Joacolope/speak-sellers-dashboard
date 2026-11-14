import type { CuotaPendiente } from '@/lib/cuotas';
import { planTexto } from '@/lib/cuotas';
import { fechaCorta, usd } from '@/lib/format';
import { NOMBRE_CLOSER } from '@/lib/types';
import EditableCell from '@/components/EditableCell';
import MarcarContacto from '@/components/MarcarContacto';

const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

function Estado({ c }: { c: CuotaPendiente }) {
  if (c.dias === null) return <span className="tag tag-gray">Sin fecha</span>;
  if (c.dias < 0) return <span className="tag tag-red">Venció hace {dias(-c.dias)}</span>;
  if (c.dias === 0) return <span className="tag tag-red">Vence hoy</span>;
  if (c.dias <= 7) return <span className="tag tag-yellow">Vence en {dias(c.dias)}</span>;
  return <span className="tag tag-blue">En {dias(c.dias)}</span>;
}

/** Hace falta moverlo: está vencido o vence esta semana (o no tiene fecha) y nadie lo contactó en los últimos 7 días. */
const hayQueContactar = (c: CuotaPendiente) => (c.dias === null || c.dias <= 7) && (c.dias_sin_contacto === null || c.dias_sin_contacto > 7);

/**
 * Lista de trabajo de cobranzas: todos los que deben plata, del más urgente al más lejano,
 * con quién lo sigue y cuándo se lo contactó por última vez.
 */
export default function ACobrar({ filas, hoy, editable, demo }: { filas: CuotaPendiente[]; hoy: string; editable: boolean; demo?: boolean }) {
  return (
    <div className="card overflow-x-auto !p-0">
      <table className="table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Qué falta</th>
            <th className="num">Debe</th>
            <th>Estado</th>
            <th title="Cuándo y cuánto paga lo que falta. Se escribe así: 10/12 500, 10/1 1500">Plan de pagos</th>
            <th title="Quién le hace el seguimiento. Si está vacío, es el closer de la venta.">Responsable</th>
            <th>Último contacto</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((c) => (
            <tr key={c.cobranza_id}>
              <td>
                <div className="font-medium">
                  {c.chat ? <a className="text-[var(--accent)] hover:underline" href={c.chat} target="_blank" rel="noopener noreferrer" title="Abrir la conversación en ManyChat">{c.nombre} ↗</a> : c.nombre}
                </div>
                <div className="text-[12px] text-text-disabled">
                  Pagó {usd(c.pagado)}{c.total && c.total > c.pagado ? ` de ${usd(c.total)}` : ''} · último pago {fechaCorta(c.ultimo_pago)}
                </div>
              </td>
              <td>{c.tipo === 'Seña' ? <span className="tag tag-yellow" title="Dejó una seña: falta completar la venta">Completar seña</span> : <span className="tag tag-gray">Cuota</span>}</td>
              <td className="num warn">{usd(c.monto)}</td>
              <td><Estado c={c} /></td>
              <td className="editable min-w-[190px]">
                <EditableCell ruta="/api/cobranzas" agendaId={c.cobranza_id} campo="plan_pagos" valor={c.plan.length ? planTexto(c.plan) : ''} tipo="text" demo={demo} editable={editable}
                  mostrar={c.plan.length ? (
                    <span className="flex flex-wrap gap-x-3 gap-y-1">
                      {c.plan.map((p) => <span key={p.fecha} className={p.fecha < hoy ? 'bad' : ''}>{fechaCorta(p.fecha)} · {usd(p.monto)}</span>)}
                      {c.planNoCierra && <span className="tag tag-yellow" title="El plan no suma lo que debe">no suma {usd(c.monto)}</span>}
                    </span>
                  ) : <span className="tag tag-yellow">falta acordar la fecha</span>} />
              </td>
              <td className="editable">
                <EditableCell ruta="/api/cobranzas" agendaId={c.cobranza_id} campo="responsable" valor={c.responsable} tipo="text" demo={demo} editable={editable}
                  mostrar={c.responsable ?? <span className="text-text-muted">{NOMBRE_CLOSER[c.closer]}</span>} />
              </td>
              <td className="editable whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <EditableCell ruta="/api/cobranzas" agendaId={c.cobranza_id} campo="ultimo_contacto" valor={c.ultimo_contacto} tipo="date" demo={demo} editable={editable}
                    mostrar={c.ultimo_contacto
                      ? <span className={hayQueContactar(c) ? 'warn' : ''}>{c.dias_sin_contacto === 0 ? 'hoy' : `hace ${dias(c.dias_sin_contacto ?? 0)}`}</span>
                      : <span className={hayQueContactar(c) ? 'bad' : 'text-text-disabled'}>{hayQueContactar(c) ? 'sin contactar' : '—'}</span>} />
                  {editable && c.dias_sin_contacto !== 0 && <MarcarContacto cobranzaId={c.cobranza_id} hoy={hoy} demo={demo} />}
                </div>
              </td>
              <td className="editable text-text-muted"><EditableCell ruta="/api/cobranzas" agendaId={c.cobranza_id} campo="notas" valor={c.notas} tipo="text" demo={demo} editable={editable} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { hayQueContactar };
