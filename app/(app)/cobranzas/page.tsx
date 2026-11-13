import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import { ChartCard, DemoBanner, Seccion, SourceDot, Vacio } from '@/components/ui';
import { BarrasCategoria } from '@/components/Charts';
import { Iconos } from '@/components/StatCard';
import { getBundle } from '@/lib/data';
import { leerFiltros, type SearchParams } from '@/lib/filtros';
import { cobranzasDelMes, mesesDisponibles, plataDelPeriodo } from '@/lib/metrics';
import { pct } from '@/lib/format';
import { fechaCorta, hoyAR, num, usd } from '@/lib/format';
import { cuotasPorCobrar, totalCuotas } from '@/lib/cuotas';
import CuotasPorCobrar from '@/components/CuotasPorCobrar';
import { NOMBRE_CLOSER, PLATAFORMAS } from '@/lib/types';
import EditableCell from '@/components/EditableCell';
import { getSesion, puede } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Cobranzas({ searchParams }: { searchParams: SearchParams }) {
  const bundle = await getBundle();
  const editor = puede(await getSesion(), 'editor');
  const OPC_PLATAFORMA = PLATAFORMAS.map((x) => ({ value: x, label: x }));
  const f = leerFiltros(searchParams);
  const meses = mesesDisponibles(bundle, f.mes);
  const filas = cobranzasDelMes(bundle, f).sort((a, b) => b.fecha_cobro.localeCompare(a.fecha_cobro));
  // Front end = lo que entró de ventas cerradas en el período; back end = cuotas de ventas anteriores
  const plata = plataDelPeriodo(bundle, f);
  const parte = (v: number) => (plata.frontEnd + plata.backEnd > 0 ? pct(v / (plata.frontEnd + plata.backEnd)) : '—');
  const reembolsos = filas.filter((c) => c.es_reembolso).reduce((s, c) => s + Math.abs(c.monto_cobrado), 0);
  // Pendiente total: última cobranza por agenda con pendiente > 0 (de cualquier mes)
  const ultimaPorAgenda = new Map<string, (typeof bundle.cobranzas)[number]>();
  for (const c of [...bundle.cobranzas].sort((a, b) => a.fecha_cobro.localeCompare(b.fecha_cobro))) ultimaPorAgenda.set(c.agenda_id, c);
  const pendienteTotal = Array.from(ultimaPorAgenda.values()).reduce((s, c) => s + (c.pendiente ?? 0), 0);
  const mapa = new Map<string, number>();
  for (const c of filas.filter((x) => !x.es_reembolso)) mapa.set(c.plataforma ?? 'Sin indicar', (mapa.get(c.plataforma ?? 'Sin indicar') ?? 0) + Number(c.monto_cobrado));
  const porPlataforma = Array.from(mapa.entries()).map(([categoria, monto]) => ({ categoria, monto: Math.round(monto) })).sort((a, b) => b.monto - a.monto);
  const cuotas = cuotasPorCobrar(bundle, hoyAR());
  const nombre = (agendaId: string) => bundle.agendas.find((a) => a.id === agendaId)?.lead?.nombre ?? '—';

  return (
    <>
      {bundle.demo && <DemoBanner />}
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow">Cobranzas</div>
          <h1 className="h1 mt-2">Cobrado y pendiente</h1>
        </div>
        <Suspense>
          <Filtros filtros={f} meses={meses} mostrarFuente={false} />
        </Suspense>
      </div>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="card flex flex-col gap-2">
          <div className="metric ok">{usd(plata.cash)}</div>
          <div className="text-[14px] text-text-muted">Cash Collected</div>
          <div className="text-[13px] text-text-disabled">Lo que entró en el período: front end + back end{plata.reembolsos ? ' − reembolsos' : ''}</div>
        </div>
        <div className="card flex flex-col gap-2">
          <div className="metric">{usd(plata.frontEnd)}</div>
          <div className="text-[14px] text-text-muted">Front End Cash Collected · {parte(plata.frontEnd)}</div>
          <div className="text-[13px] text-text-disabled">De ventas nuevas, cerradas en el período</div>
        </div>
        <div className="card flex flex-col gap-2">
          <div className="metric">{usd(plata.backEnd)}</div>
          <div className="text-[14px] text-text-muted">Back End Cash Collected · {parte(plata.backEnd)}</div>
          <div className="text-[13px] text-text-disabled">De cuotas de ventas anteriores</div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="card flex flex-col gap-2"><div className="metric warn">{usd(pendienteTotal)}</div><div className="text-[14px] text-text-muted">Pendiente de cobrar</div><div className="text-[13px] text-text-disabled">de todas las ventas en cuotas</div></div>
        <div className="card flex flex-col gap-2"><div className={`metric ${cuotas.vencidas.length ? 'bad' : ''}`}>{usd(totalCuotas(cuotas.vencidas))}</div><div className="text-[14px] text-text-muted">Vencido</div><div className="text-[13px] text-text-disabled">{num(cuotas.vencidas.length)} {cuotas.vencidas.length === 1 ? 'cuota' : 'cuotas'} sin pagar</div></div>
        <div className="card flex flex-col gap-2"><div className={`metric ${reembolsos ? 'bad' : ''}`}>{usd(reembolsos)}</div><div className="text-[14px] text-text-muted">Reembolsos</div><div className="text-[13px] text-text-disabled">en el período</div></div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <ChartCard titulo="Quién debe y cuándo" sub="Cuotas pendientes, de la más urgente a la más lejana" icono={Iconos.cash} color="yellow">
          <CuotasPorCobrar {...cuotas} limite={8} />
        </ChartCard>
        <ChartCard titulo="Cobrado por plataforma" sub="Por dónde entró la plata este período" icono={Iconos.cash} color="green">
          {porPlataforma.length ? <BarrasCategoria data={porPlataforma} color="green" /> : <Vacio texto="Sin cobros este período." />}
        </ChartCard>
      </section>

      <Seccion eyebrow="Movimientos" titulo={`${num(filas.length)} cobranzas`} aside={editor ? <span className="text-[13px] text-text-disabled">Las celdas con borde al pasar el mouse se editan con un click.</span> : undefined}>
        {filas.length ? (
          <div className="card overflow-x-auto !p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Fecha de cobro</th>
                  <th className="num">Monto cobrado</th>
                  <th>Tipo</th>
                  <th className="num">Pendiente</th>
                  <th>Closer</th>
                  <th>Plataforma</th>
                  <th className="num">Cuotas restantes</th>
                  <th>Próximo vencimiento</th>
                  <th>Notas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{nombre(c.agenda_id)}</td>
                    <td className="editable"><EditableCell ruta="/api/cobranzas" agendaId={c.id} campo="fecha_cobro" valor={c.fecha_cobro} tipo="date" mostrar={fechaCorta(c.fecha_cobro)} demo={bundle.demo} editable={editor} /></td>
                    <td className={`num editable ${c.es_reembolso ? 'bad' : 'ok'}`}><EditableCell ruta="/api/cobranzas" agendaId={c.id} campo="monto_cobrado" valor={c.monto_cobrado} tipo="number" mostrar={usd(c.monto_cobrado)} demo={bundle.demo} editable={editor} /></td>
                    <td>{c.es_reembolso ? <span className="tag tag-red">Reembolso</span> : plata.idsFrontEnd.has(c.agenda_id) ? <span className="tag tag-green">Front end</span> : <span className="tag tag-blue">Back end</span>}</td>
                    <td className="num editable"><EditableCell ruta="/api/cobranzas" agendaId={c.id} campo="pendiente" valor={c.pendiente} tipo="number" mostrar={c.pendiente ? <span className="warn">{usd(c.pendiente)}</span> : undefined} demo={bundle.demo} editable={editor} /></td>
                    <td>{NOMBRE_CLOSER[c.closer]}</td>
                    <td className="editable"><EditableCell ruta="/api/cobranzas" agendaId={c.id} campo="plataforma" valor={c.plataforma} tipo="select" opciones={OPC_PLATAFORMA} mostrar={c.plataforma ? <span className="tag tag-blue">{c.plataforma}</span> : <span className="tag tag-yellow">sin indicar</span>} demo={bundle.demo} editable={editor} /></td>
                    <td className="num editable"><EditableCell ruta="/api/cobranzas" agendaId={c.id} campo="cuotas_restantes" valor={c.cuotas_restantes} tipo="number" mostrar={c.cuotas_restantes ? num(c.cuotas_restantes) : undefined} demo={bundle.demo} editable={editor} /></td>
                    <td className="editable"><EditableCell ruta="/api/cobranzas" agendaId={c.id} campo="proximo_vencimiento" valor={c.proximo_vencimiento} tipo="date" mostrar={c.proximo_vencimiento ? <span className="tag tag-yellow">{fechaCorta(c.proximo_vencimiento)}</span> : undefined} demo={bundle.demo} editable={editor} /></td>
                    <td className="editable text-text-muted"><EditableCell ruta="/api/cobranzas" agendaId={c.id} campo="notas" valor={c.notas} tipo="text" demo={bundle.demo} editable={editor} /></td>
                    <td><SourceDot source={c.source} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Vacio texto="Sin cobranzas este mes." />}
      </Seccion>
    </>
  );
}
