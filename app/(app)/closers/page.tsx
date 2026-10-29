import { Suspense } from 'react';
import Link from 'next/link';
import Filtros from '@/components/Filtros';
import EditableCell from '@/components/EditableCell';
import { DemoBanner, EstadoAsistio, EstadoCompro, Seccion, SiNo, claseSemaforo, SourceDot, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, queryDe, type SearchParams } from '@/lib/filtros';
import { agendasDelMes, mesesDisponibles, resumenCloser } from '@/lib/metrics';
import { fechaCorta, hoyAR, num, pct, usd } from '@/lib/format';
import { cuotasPorCobrar, totalCuotas } from '@/lib/cuotas';
import { CLOSERS, CLOSER_ACTIVO, NOMBRE_CLOSER } from '@/lib/types';
import { getSesion, puede } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const OPC_ASISTIO = ['Asistió', 'No show', 'Canceló', 'Pendiente'].map((v) => ({ value: v, label: v }));
const OPC_COMPRO = ['Si', 'No', 'Reserva'].map((v) => ({ value: v, label: v }));

function Dato({ valor, label, sub, clase = '' }: { valor: string; label: string; sub?: string; clase?: string }) {
  return (
    <div className="card flex flex-col gap-2">
      <div className={`metric ${clase}`}>{valor}</div>
      <div className="text-[14px] text-text-muted">{label}</div>
      {sub && <div className="text-[13px] text-text-disabled">{sub}</div>}
    </div>
  );
}

export default async function Closers({ searchParams }: { searchParams: SearchParams }) {
  const bundle = await getBundle();
  const editor = puede(await getSesion(), 'editor');
  const f = leerFiltros(searchParams);
  const meses = mesesDisponibles(bundle, f.mes);
  const agendas = agendasDelMes(bundle, f).sort((a, b) => b.fecha_llamada.localeCompare(a.fecha_llamada));
  const resumen = resumenCloser(bundle, f, f.closer);
  // Los closers que ya no están se muestran solo si tienen llamadas en el período (historial)
  const closersVisibles = CLOSERS.filter((c) => CLOSER_ACTIVO[c] || f.closer === c || resumenCloser(bundle, f, c).agendas > 0);
  const porCloser = closersVisibles.map((c) => resumenCloser(bundle, f, c));
  const cuotas = cuotasPorCobrar(bundle, hoyAR());
  const pendiente = totalCuotas([...cuotas.vencidas, ...cuotas.semana, ...cuotas.proximas].filter((c) => f.closer === 'todos' || c.closer === f.closer));

  return (
    <>
      {bundle.demo && <DemoBanner />}
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow">Closers</div>
          <h1 className="h1 mt-2">{f.closer === 'todos' ? 'Todos los closers' : NOMBRE_CLOSER[f.closer]}</h1>
        </div>
        <Suspense>
          <Filtros filtros={f} meses={meses} />
        </Suspense>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(['todos', ...closersVisibles] as const).map((c) => {
            const r = resumenCloser(bundle, f, c);
            const activo = f.closer === c;
            return (
              <Link
                key={c}
                href={`/closers${queryDe({ ...f, closer: c })}`}
                className={`card flex flex-col gap-2 !p-4 ${activo ? '!border-[var(--blue)] outline outline-1 outline-[var(--blue)]' : 'hover:!border-[var(--border-outline)]'}`}
                aria-current={activo ? 'page' : undefined}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--blue-soft)] text-[12px] font-medium text-[var(--blue-ink)]">
                    {c === 'todos' ? '∑' : NOMBRE_CLOSER[c].split(' ').map((p) => p[0]).join('')}
                  </span>
                  <span className="text-[14px] font-medium">{c === 'todos' ? 'Todos' : NOMBRE_CLOSER[c]}</span>
                  {c !== 'todos' && !CLOSER_ACTIVO[c] && <span className="tag tag-gray">Ya no closea</span>}
                </div>
                <div className="flex gap-4 text-[12px] text-text-muted">
                  <span>{num(r.agendas)} agendas</span>
                  <span className={claseSemaforo(r.pct_show, 0.6)}>{pct(r.pct_show)} show</span>
                  <span className="ok">{usd(r.cash)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Dato valor={num(resumen.agendas)} label="Agendas" sub={resumen.pendientes ? `${num(resumen.pendientes)} por venir` : undefined} />
        <Dato valor={num(resumen.asistencias)} label="Llamadas presentadas" sub={`${num(resumen.no_show)} no show · ${num(resumen.canceladas)} canceladas`} />
        <Dato valor={pct(resumen.pct_show)} clase={claseSemaforo(resumen.pct_show, 0.6)} label="% Show" sub={`Objetivo ${pct(0.6)}`} />
        <Dato valor={num(resumen.cierres)} label="Ventas" sub={resumen.senas ? `${num(resumen.senas)} con seña` : undefined} />
        <Dato valor={pct(resumen.pct_cierre)} clase={claseSemaforo(resumen.pct_cierre, 0.3)} label="% Cierre / llamadas" sub={`Objetivo ${pct(0.3)}`} />
        <Dato valor={usd(resumen.cash)} clase="ok" label="Cobrado en las llamadas" />
        <Dato valor={usd(pendiente)} clase={pendiente ? 'warn' : ''} label="Pendiente de cobrar" sub="Cuotas que faltan de sus ventas" />
        <Dato valor={resumen.asistencias ? usd(resumen.cash / resumen.asistencias) : '—'} label="Cash por llamada" sub="Cobrado / presentadas" />
      </section>

      {f.closer === 'todos' && (
        <Seccion eyebrow="Comparativa" titulo="Closer por closer">
          <div className="card overflow-x-auto !p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Closer</th>
                  <th className="num">Agendas</th>
                  <th className="num">Presentadas</th>
                  <th className="num">No show</th>
                  <th className="num">Canceladas</th>
                  <th className="num">% Show</th>
                  <th className="num">Ventas</th>
                  <th className="num">Con seña</th>
                  <th className="num">% Cierre</th>
                  <th className="num">Cobrado</th>
                  <th className="num">Cash por llamada</th>
                </tr>
              </thead>
              <tbody>
                {porCloser.map((r) => (
                  <tr key={r.closer}>
                    <td className="font-medium"><Link href={`/closers${queryDe({ ...f, closer: r.closer })}`} className="hover:underline">{NOMBRE_CLOSER[r.closer]}</Link></td>
                    <td className="num">{num(r.agendas)}</td>
                    <td className="num">{num(r.asistencias)}</td>
                    <td className="num">{num(r.no_show)}</td>
                    <td className="num">{num(r.canceladas)}</td>
                    <td className={`num ${claseSemaforo(r.pct_show, 0.6)}`}>{pct(r.pct_show)}</td>
                    <td className="num">{num(r.cierres)}</td>
                    <td className="num">{num(r.senas)}</td>
                    <td className={`num ${claseSemaforo(r.pct_cierre, 0.3)}`}>{pct(r.pct_cierre)}</td>
                    <td className="num ok">{usd(r.cash)}</td>
                    <td className="num">{r.asistencias ? usd(r.cash / r.asistencias) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      )}

      <Seccion eyebrow="Agendas" titulo={`${num(agendas.length)} llamadas`} aside={editor ? <span className="text-[14px] text-text-muted">Las celdas con borde al pasar el mouse se editan con un click.</span> : undefined}>
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
                  <th>¿Asistió?</th>
                  <th>Compró</th>
                  <th>Producto</th>
                  <th className="num" title="Lo que pagó en la llamada">Cobrado</th>
                  <th className="num" title="Valor total de la venta, aunque se pague en cuotas">Valor de la venta</th>
                  <th>Fuente</th>
                  <th>UTM</th>
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
                    <td>{NOMBRE_CLOSER[a.closer]}</td>
                    <td className="editable">
                      <EditableCell agendaId={a.id} campo="asistio" valor={a.asistio} tipo="select" opciones={OPC_ASISTIO} demo={bundle.demo} editable={editor}
                        mostrar={<EstadoAsistio v={a.asistio} />} />
                    </td>
                    <td className="editable">
                      <EditableCell agendaId={a.id} campo="compro" valor={a.compro} tipo="select" opciones={OPC_COMPRO} demo={bundle.demo} editable={editor}
                        mostrar={a.compro ? <EstadoCompro v={a.compro} /> : undefined} />
                    </td>
                    <td className="editable"><EditableCell agendaId={a.id} campo="producto" valor={a.producto} tipo="text" demo={bundle.demo} editable={editor} /></td>
                    <td className="num editable"><EditableCell agendaId={a.id} campo="cash_collected" valor={a.cash_collected} tipo="number" demo={bundle.demo} editable={editor} mostrar={a.cash_collected !== null && a.cash_collected !== undefined ? usd(a.cash_collected) : undefined} /></td>
                    <td className="num editable"><EditableCell agendaId={a.id} campo="revenue" valor={a.revenue} tipo="number" demo={bundle.demo} editable={editor} mostrar={a.revenue !== null && a.revenue !== undefined ? usd(a.revenue) : undefined} /></td>
                    <td>{a.lead?.fuente ?? '—'}</td>
                    <td className="max-w-[200px] truncate text-[13px] text-text-muted" title={[a.lead?.utm_source, a.lead?.utm_medium, a.lead?.utm_campaign, a.lead?.utm_content, a.lead?.utm_term].filter(Boolean).join(' / ')}>
                      {[a.lead?.utm_campaign, a.lead?.utm_content].filter(Boolean).join(' · ') || '—'}
                    </td>
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
