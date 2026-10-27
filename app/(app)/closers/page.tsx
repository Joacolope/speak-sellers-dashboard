import { Suspense } from 'react';
import Link from 'next/link';
import Filtros from '@/components/Filtros';
import EditableCell from '@/components/EditableCell';
import { DemoBanner, EstadoAsistio, EstadoCompro, Seccion, SiNo, claseSemaforo, SourceDot, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, queryDe, type SearchParams } from '@/lib/filtros';
import { agendasDelMes, mesesDisponibles, resumenCloser } from '@/lib/metrics';
import { fechaCorta, num, pct, usd } from '@/lib/format';
import { CLOSERS } from '@/lib/types';

export const dynamic = 'force-dynamic';

const OPC_ASISTIO = ['Asistió', 'No show', 'Canceló', 'Pendiente'].map((v) => ({ value: v, label: v }));
const OPC_COMPRO = ['Si', 'No', 'Reserva'].map((v) => ({ value: v, label: v }));
const OPC_BOOL = [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }];

export default async function Closers({ searchParams }: { searchParams: SearchParams }) {
  const bundle = await getBundle();
  const f = leerFiltros(searchParams);
  const meses = mesesDisponibles(bundle, f.mes);
  const agendas = agendasDelMes(bundle, f).sort((a, b) => b.fecha_llamada.localeCompare(a.fecha_llamada));
  const resumen = resumenCloser(bundle, f, f.closer);

  return (
    <>
      {bundle.demo && <DemoBanner />}
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow">Closers</div>
          <h1 className="h1 mt-2">{f.closer === 'todos' ? 'Todos' : f.closer}</h1>
        </div>
        <Suspense>
          <Filtros filtros={f} meses={meses} />
        </Suspense>
        <div className="flex gap-6 border-b border-border-strong">
          {(['todos', ...CLOSERS] as const).map((c) => (
            <Link
              key={c}
              href={`/closers${queryDe({ ...f, closer: c })}`}
              className={`-mb-px border-b pb-3 text-[14px] font-medium ${f.closer === c ? 'border-accent text-text' : 'border-transparent text-text-muted hover:text-text'}`}
            >
              {c === 'todos' ? 'Todos' : c}
            </Link>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card flex flex-col gap-2"><div className="metric">{num(resumen.agendas)}</div><div className="text-[14px] text-text-muted">Agendas</div></div>
        <div className="card flex flex-col gap-2"><div className={`metric ${claseSemaforo(resumen.pct_show, 0.6)}`}>{pct(resumen.pct_show)}</div><div className="text-[14px] text-text-muted">% Show</div></div>
        <div className="card flex flex-col gap-2"><div className={`metric ${claseSemaforo(resumen.pct_cierre, 0.3)}`}>{pct(resumen.pct_cierre)}</div><div className="text-[14px] text-text-muted">% Cierre sobre ofertas</div></div>
        <div className="card flex flex-col gap-2"><div className="metric ok">{usd(resumen.cash)}</div><div className="text-[14px] text-text-muted">Cash</div></div>
      </section>

      <Seccion eyebrow="Agendas" titulo={`${num(agendas.length)} llamadas`} aside={<span className="text-[14px] text-text-muted">Las celdas con borde al pasar el mouse se editan con un click.</span>}>
        {agendas.length ? (
          <div className="card overflow-x-auto !p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>País</th>
                  <th>Closer</th>
                  <th className="num">Cualif.</th>
                  <th>¿Asistió?</th>
                  <th>Oferta</th>
                  <th>Compró</th>
                  <th>Producto</th>
                  <th className="num">Cash Collected</th>
                  <th className="num">Revenue</th>
                  <th>Fuente</th>
                  <th>Conf. WhatsApp</th>
                  <th>Estado GHL</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {agendas.map((a) => (
                  <tr key={a.id}>
                    <td title={a.reprogramada_desde ? `Reprogramada desde ${fechaCorta(a.reprogramada_desde)}` : undefined}>
                      {fechaCorta(a.fecha_llamada)}{a.reprogramada_desde && <span className="mono ml-1 text-[12px] text-text-muted">↻</span>}
                    </td>
                    <td className="font-medium" title={a.notas ?? undefined}>{a.lead?.nombre ?? '—'}</td>
                    <td className="text-text-muted">{a.lead?.telefono ?? '—'}</td>
                    <td>{a.lead?.pais ?? '—'}</td>
                    <td>{a.closer}</td>
                    <td className="num">{num(a.lead?.cualificacion_economica)}</td>
                    <td className="editable">
                      <EditableCell agendaId={a.id} campo="asistio" valor={a.asistio} tipo="select" opciones={OPC_ASISTIO} demo={bundle.demo}
                        mostrar={<EstadoAsistio v={a.asistio} />} />
                    </td>
                    <td className="editable">
                      <EditableCell agendaId={a.id} campo="oferta_hecha" valor={a.oferta_hecha ? 'true' : a.oferta_hecha === false ? 'false' : null} tipo="select" opciones={OPC_BOOL} demo={bundle.demo}
                        mostrar={a.oferta_hecha ? 'Sí' : a.oferta_hecha === false ? 'No' : undefined} />
                    </td>
                    <td className="editable">
                      <EditableCell agendaId={a.id} campo="compro" valor={a.compro} tipo="select" opciones={OPC_COMPRO} demo={bundle.demo}
                        mostrar={a.compro ? <EstadoCompro v={a.compro} /> : undefined} />
                    </td>
                    <td className="editable"><EditableCell agendaId={a.id} campo="producto" valor={a.producto} tipo="text" demo={bundle.demo} /></td>
                    <td className="num editable"><EditableCell agendaId={a.id} campo="cash_collected" valor={a.cash_collected} tipo="number" demo={bundle.demo} mostrar={a.cash_collected !== null && a.cash_collected !== undefined ? usd(a.cash_collected) : undefined} /></td>
                    <td className="num editable"><EditableCell agendaId={a.id} campo="revenue" valor={a.revenue} tipo="number" demo={bundle.demo} mostrar={a.revenue !== null && a.revenue !== undefined ? usd(a.revenue) : undefined} /></td>
                    <td>{a.lead?.fuente ?? '—'}</td>
                    <td><SiNo v={a.confirmada_whatsapp} /></td>
                    <td>{a.estado_ghl ? <span className={`tag ${a.estado_ghl === 'showed' ? 'tag-green' : a.estado_ghl === 'noshow' ? 'tag-red' : a.estado_ghl === 'cancelled' ? 'tag-gray' : 'tag-blue'}`}>{a.estado_ghl}</span> : '—'}</td>
                    <td><SourceDot source={a.source} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Vacio texto="Sin agendas para este filtro." />}
      </Seccion>
    </>
  );
}
