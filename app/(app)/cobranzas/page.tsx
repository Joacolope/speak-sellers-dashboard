import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import { ChartCard, DemoBanner, Seccion, SourceDot, Vacio } from '@/components/ui';
import { BarrasCategoria } from '@/components/Charts';
import { Iconos } from '@/components/StatCard';
import { getBundle } from '@/lib/data';
import { leerFiltros, type SearchParams } from '@/lib/filtros';
import { cobranzasDelMes, mesesDisponibles, plataDelPeriodo, plataPorPeriodo, type PlataPeriodo } from '@/lib/metrics';
import { pct } from '@/lib/format';
import { fechaCorta, hoyAR, nombreMes, num, usd } from '@/lib/format';
import { cuotasPorCobrar, porCobrarPorMes, todasLasCuotas, totalCuotas } from '@/lib/cuotas';
import ACobrar, { hayQueContactar } from '@/components/ACobrar';
import { NOMBRE_CLOSER, PLATAFORMAS, TIPOS_VENTA } from '@/lib/types';
import EditableCell from '@/components/EditableCell';
import { getSesion, puede } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Tabla de plata nueva vs. back end por período (mes o trimestre), del más viejo al más nuevo. */
function TablaOrigen({ titulo, filas, corta }: { titulo: string; filas: PlataPeriodo[]; corta?: boolean }) {
  return (
    <div className="card overflow-x-auto !p-0">
      <table className="table">
        <thead>
          <tr>
            <th>{titulo}</th>
            <th className="num" title="Cobrado de ventas nuevas cerradas en el período">Front end</th>
            {!corta && <th className="num" title="Cuotas de ventas cerradas antes">Cuotas</th>}
            {!corta && <th className="num" title="Renovaciones y upsells de clientes que ya habían comprado">Renovaciones</th>}
            {corta && <th className="num" title="Cuotas de ventas anteriores + renovaciones">Back end</th>}
            <th className="num">Facturación</th>
            <th className="num" title="Parte de lo cobrado que viene de ventas nuevas">% plata nueva</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((p) => (
            <tr key={p.clave}>
              <td className="font-medium capitalize">{p.label}</td>
              <td className="num">{usd(p.frontEnd)}</td>
              {!corta && <td className="num">{usd(p.cuotas)}</td>}
              {!corta && <td className="num">{usd(p.renovaciones)}</td>}
              {corta && <td className="num">{usd(p.cuotas + p.renovaciones)}</td>}
              <td className="num ok" title={p.reembolsos ? `Ya descontados ${usd(p.reembolsos)} de reembolsos` : undefined}>{usd(p.facturacion)}{p.reembolsos ? <span className="ml-1 text-[11px] text-text-disabled">−reemb.</span> : null}</td>
              <td className="num">{pct(p.pctNuevo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  const mapa = new Map<string, number>();
  for (const c of filas.filter((x) => !x.es_reembolso)) mapa.set(c.plataforma ?? 'Sin indicar', (mapa.get(c.plataforma ?? 'Sin indicar') ?? 0) + Number(c.monto_cobrado));
  const porPlataforma = Array.from(mapa.entries()).map(([categoria, monto]) => ({ categoria, monto: Math.round(monto) })).sort((a, b) => b.monto - a.monto);
  // Lo que falta cobrar no depende del mes del filtro: es la lista de trabajo de hoy
  const hoy = hoyAR();
  const cuotas = cuotasPorCobrar(bundle, hoy);
  const aCobrar = todasLasCuotas(cuotas);
  const pendienteTotal = totalCuotas(aCobrar);
  const porMes = porCobrarPorMes(cuotas, hoy);
  const sinMover = aCobrar.filter(hayQueContactar);
  const origen = plataPorPeriodo(bundle, f);
  const agendaPorId = new Map(bundle.agendas.map((a) => [a.id, a]));
  const OPC_TIPO = TIPOS_VENTA.map((x) => ({ value: x, label: x === 'Nueva' ? 'Venta nueva (front end)' : `${x} (back end)` }));
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
          <div className="metric ok">{usd(plata.facturacion)}</div>
          <div className="text-[14px] text-text-muted">Facturación</div>
          <div className="text-[13px] text-text-disabled">Lo que se cobró en el período: front end + back end{plata.reembolsos ? ' − reembolsos' : ''}</div>
        </div>
        <div className="card flex flex-col gap-2">
          <div className="metric">{usd(plata.frontEnd)}</div>
          <div className="text-[14px] text-text-muted">Front End Cash Collected · {parte(plata.frontEnd)}</div>
          <div className="text-[13px] text-text-disabled">De ventas nuevas, cerradas en el período</div>
        </div>
        <div className="card flex flex-col gap-2">
          <div className="metric">{usd(plata.backEnd)}</div>
          <div className="text-[14px] text-text-muted">Back End Cash Collected · {parte(plata.backEnd)}</div>
          <div className="text-[13px] text-text-disabled">Cuotas de ventas anteriores {usd(plata.cuotas)} · renovaciones {usd(plata.renovaciones)}</div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="card flex flex-col gap-2"><div className="metric warn">{usd(pendienteTotal)}</div><div className="text-[14px] text-text-muted">Pendiente de cobrar</div><div className="text-[13px] text-text-disabled">de todas las ventas en cuotas y señas</div></div>
        <div className="card flex flex-col gap-2"><div className={`metric ${cuotas.vencidas.length ? 'bad' : ''}`}>{usd(totalCuotas(cuotas.vencidas))}</div><div className="text-[14px] text-text-muted">Vencido</div><div className="text-[13px] text-text-disabled">{num(cuotas.vencidas.length)} {cuotas.vencidas.length === 1 ? 'cliente' : 'clientes'} con el pago atrasado</div></div>
        <div className="card flex flex-col gap-2"><div className={`metric ${reembolsos ? 'bad' : ''}`}>{usd(reembolsos)}</div><div className="text-[14px] text-text-muted">Reembolsos</div><div className="text-[13px] text-text-disabled">en el período</div></div>
      </section>

      <Seccion eyebrow="A cobrar" titulo={`${num(aCobrar.length)} ${aCobrar.length === 1 ? 'cliente debe' : 'clientes deben'} ${usd(pendienteTotal)}`}
        aside={<span className="text-[13px] text-text-disabled">{sinMover.length ? `${num(sinMover.length)} sin contactar en la última semana` : 'Todos los urgentes tienen seguimiento'}{editor ? ' · se edita con un click' : ''}</span>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          {porMes.vencido > 0 && <div className="card !p-4"><div className="text-[18px] font-medium tabular-nums bad">{usd(porMes.vencido)}</div><div className="text-[12px] text-text-muted">Vencido: ya tendría que haber entrado</div></div>}
          {porMes.meses.map((m) => (
            <div key={m.mes} className="card !p-4"><div className="text-[18px] font-medium tabular-nums">{usd(m.monto)}</div><div className="text-[12px] text-text-muted">Entra en {nombreMes(m.mes).toLowerCase()} · {num(m.pagos)} {m.pagos === 1 ? 'pago' : 'pagos'}</div></div>
          ))}
          {porMes.sinFecha > 0 && <div className="card !p-4"><div className="text-[18px] font-medium tabular-nums warn">{usd(porMes.sinFecha)}</div><div className="text-[12px] text-text-muted">Sin fecha acordada · {num(cuotas.sinFecha.length)} {cuotas.sinFecha.length === 1 ? 'cliente' : 'clientes'}</div></div>}
        </div>
        {aCobrar.length ? <ACobrar filas={aCobrar} hoy={hoy} editable={editor} demo={bundle.demo} /> : <Vacio texto="Nadie debe plata." />}
      </Seccion>

      <Seccion eyebrow="De dónde entra la plata" titulo="Plata nueva vs. back end"
        aside={<span className="text-[13px] text-text-disabled">Front end: ventas nuevas · back end: cuotas de ventas anteriores y renovaciones</span>}>
        <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
          <TablaOrigen titulo="Mes" filas={origen.meses.slice(-6)} />
          <TablaOrigen titulo="Trimestre" filas={origen.trimestres.slice(-4)} corta />
        </div>
      </Seccion>

      <ChartCard titulo="Cobrado por plataforma" sub="Por dónde entró la plata este período" icono={Iconos.cash} color="green">
        {porPlataforma.length ? <BarrasCategoria data={porPlataforma} color="green" /> : <Vacio texto="Sin cobros este período." />}
      </ChartCard>

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
                  <th className="num">Comisión setter</th>
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
                    <td className="editable">
                      {c.es_reembolso ? <span className="tag tag-red">Reembolso</span> : (
                        <EditableCell agendaId={c.agenda_id} campo="tipo_venta" valor={agendaPorId.get(c.agenda_id)?.tipo_venta ?? 'Nueva'} tipo="select" opciones={OPC_TIPO} demo={bundle.demo} editable={editor}
                          mostrar={plata.idsRecompra.has(c.agenda_id) ? <span className="tag tag-blue" title="Renovación o upsell de un cliente que ya había comprado">Back end · {agendaPorId.get(c.agenda_id)?.tipo_venta?.toLowerCase()}</span>
                            : plata.idsFrontEnd.has(c.agenda_id) ? <span className="tag tag-green" title="Venta nueva cerrada en el período">Front end</span>
                              : <span className="tag tag-blue" title="Cuota de una venta cerrada antes del período">Back end · cuota</span>} />
                      )}
                    </td>
                    <td className="num editable"><EditableCell ruta="/api/cobranzas" agendaId={c.id} campo="pendiente" valor={c.pendiente} tipo="number" mostrar={c.pendiente ? <span className="warn">{usd(c.pendiente)}</span> : undefined} demo={bundle.demo} editable={editor} /></td>
                    <td>{NOMBRE_CLOSER[c.closer]}</td>
                    <td className="editable"><EditableCell ruta="/api/cobranzas" agendaId={c.id} campo="plataforma" valor={c.plataforma} tipo="select" opciones={OPC_PLATAFORMA} mostrar={c.plataforma ? <span className="tag tag-blue">{c.plataforma}</span> : <span className="tag tag-yellow">sin indicar</span>} demo={bundle.demo} editable={editor} /></td>
                    <td className="num editable"><EditableCell ruta="/api/cobranzas" agendaId={c.id} campo="comision_setter" valor={c.comision_setter} tipo="number" mostrar={c.comision_setter ? usd(c.comision_setter, 2) : undefined} demo={bundle.demo} editable={editor} /></td>
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
