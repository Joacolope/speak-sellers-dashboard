import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import StatCard, { Iconos } from '@/components/StatCard';
import { AnilloRentabilidad, BarrasCategoria, CostosMes } from '@/components/Charts';
import { ChartCard, DemoBanner, SourceDot, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, type SearchParams } from '@/lib/filtros';
import { cobranzasDelMes, mesesDisponibles, metricasConAnterior, serieMeses } from '@/lib/metrics';
import { comisionesDelMes } from '@/lib/comisiones';
import { costosDelMes, equivalenteMensual } from '@/lib/costos';
import { fechaCorta, nombreMes, num, pct, usd, variacion } from '@/lib/format';
import { CATEGORIAS_COSTO, CLOSERS, NOMBRE_CLOSER } from '@/lib/types';
import { getSesion, puede } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">{label}{children}</label>
);

export default async function Costos({ searchParams }: { searchParams: SearchParams & { ok?: string; error?: string } }) {
  const bundle = await getBundle();
  const sesion = await getSesion();
  const editor = puede(sesion, 'editor');
  const f = { ...leerFiltros(searchParams), closer: 'todos' as const, fuente: 'todas' as const };
  const meses = mesesDisponibles(bundle, f.mes);
  const { actual, anterior } = metricasConAnterior(bundle, f);
  const cm = costosDelMes(bundle.costos, f.mes);
  const serie = serieMeses(bundle, f, 6);
  const com = comisionesDelMes(bundle.comisiones, cobranzasDelMes(bundle, f), f.mes);
  const costosTotales = actual.inversion_ads + cm.total + (actual.comisiones ?? 0);
  const anteriorTotales = anterior.inversion_ads + (anterior.costo_software ?? 0) + (anterior.comisiones ?? 0);
  const margen = actual.revenue > 0 ? actual.cash_collected / actual.revenue : null;
  // Para los formularios: herramientas vigentes hoy (sin baja o con baja futura)
  const hoy = new Date().toISOString().slice(0, 10);
  const vigentes = bundle.costos.filter((c) => c.frecuencia !== 'Único' && (!c.fecha_baja || c.fecha_baja >= hoy));
  const historicas = bundle.costos.filter((c) => !cm.items.some((it) => it.costo.id === c.id)).sort((a, b) => b.fecha_alta.localeCompare(a.fecha_alta));
  const ok = typeof searchParams.ok === 'string' ? searchParams.ok : null;
  const error = typeof searchParams.error === 'string' ? searchParams.error : null;

  return (
    <>
      {bundle.demo && <DemoBanner />}
      <div className="flex flex-col gap-5">
        <div>
          <div className="eyebrow">Costos</div>
          <h1 className="h1 mt-2">Software y costos fijos</h1>
          <p className="mt-2 max-w-2xl text-[14px] text-text-muted">
            Lo que pagamos por mes en herramientas y en comisiones de closers. Todo se descuenta del Revenue, junto con los anuncios, para calcular el Cash Collected.
          </p>
          {ok && <div className="ok mt-3 text-[14px]">Guardado: {ok}</div>}
          {error && <div className="bad mt-3 text-[14px]">{error}</div>}
        </div>
        <Suspense>
          <Filtros filtros={f} meses={meses} mostrarCloser={false} mostrarFuente={false} />
        </Suspense>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Software del mes" valor={usd(cm.total, cm.total % 1 ? 2 : 0)} variacion={variacion(cm.total, anterior.costo_software)} icono={Iconos.margen} invertir color="yellow" />
        <StatCard label="Inversión en ads" valor={usd(actual.inversion_ads)} variacion={variacion(actual.inversion_ads, anterior.inversion_ads)} icono={Iconos.ads} invertir color="red" />
        <StatCard label="Comisiones closers" valor={actual.comisiones === null ? '—' : usd(actual.comisiones)} variacion={variacion(actual.comisiones, anterior.comisiones)} icono={Iconos.asistencia} invertir color="yellow"
          nota={actual.comisiones === null ? 'Falta cargar el % de cada closer' : undefined} />
        <StatCard label="Costos totales" valor={usd(costosTotales)} variacion={variacion(costosTotales, anteriorTotales)} icono={Iconos.cash} invertir color="red" />
        <StatCard label="Cash Collected" valor={usd(actual.cash_collected)} variacion={variacion(actual.cash_collected, anterior.cash_collected)} icono={Iconos.revenue} color="green"
          nota={margen === null ? undefined : `Margen ${pct(margen)} sobre Revenue`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard titulo="Costos vs. Cash Collected" sub="Ads, software y comisiones vs. lo que queda (cash, verde)" icono={Iconos.tendencia} color="red" className="lg:col-span-2">
          <CostosMes data={serie} />
        </ChartCard>
        <ChartCard titulo="Rentabilidad" sub={nombreMes(f.mes)} icono={Iconos.margen} color="green">
          <AnilloRentabilidad revenue={actual.revenue} ads={actual.inversion_ads} software={actual.costo_software} comisiones={actual.comisiones} cash={actual.cash_collected} />
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard titulo="Herramientas activas" sub={`${num(cm.items.length)} en ${nombreMes(f.mes).toLowerCase()}`} icono={Iconos.margen} color="yellow" className="lg:col-span-2">
          {cm.items.length ? (
            <div className="-mx-6 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="!pl-6">Herramienta</th>
                    <th>Categoría</th>
                    <th>Frecuencia</th>
                    <th className="num">Monto</th>
                    <th className="num">Este mes</th>
                    <th>Desde</th>
                    <th>Hasta</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cm.items.map(({ costo: c, monto }) => (
                    <tr key={c.id}>
                      <td className="!pl-6 font-medium" title={c.notas ?? undefined}>
                        {c.nombre}
                        {c.notas && <div className="text-[12px] font-normal text-text-disabled">{c.notas}</div>}
                      </td>
                      <td className="text-text-muted">{c.categoria}</td>
                      <td>{c.frecuencia}</td>
                      <td className="num">{usd(c.monto, c.monto % 1 ? 2 : 0)}</td>
                      <td className="num font-medium">{monto ? <span className="bad">{usd(monto, monto % 1 ? 2 : 0)}</span> : <span className="tag tag-green">Gratis</span>}</td>
                      <td>{fechaCorta(c.fecha_alta)}</td>
                      <td className="text-text-muted">{c.fecha_baja ? fechaCorta(c.fecha_baja) : '—'}</td>
                      <td><SourceDot source={c.source} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="!pl-6 h-11 font-medium" colSpan={4}>Total del mes</td>
                    <td className="num font-medium bad">{usd(cm.total, 2)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : <Vacio texto="No hay herramientas cargadas para este mes. Agregá la primera abajo." />}
        </ChartCard>
        <ChartCard titulo="Por categoría" sub="Equivalente mensual" icono={Iconos.globo} color="red">
          {cm.porCategoria.length ? <BarrasCategoria data={cm.porCategoria.filter((c) => c.monto > 0)} /> : <Vacio texto="—" />}
        </ChartCard>
      </section>

      <ChartCard titulo="Comisiones de closers" sub={`% sobre lo cobrado en ${nombreMes(f.mes).toLowerCase()}, neto de reembolsos`} icono={Iconos.asistencia} color="yellow">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="-mx-6 overflow-x-auto lg:mx-0">
            <table className="table">
              <thead>
                <tr><th className="!pl-6 lg:!pl-3">Closer</th><th className="num">%</th><th className="num">Cobrado del mes</th><th className="num">Comisión</th></tr>
              </thead>
              <tbody>
                {com.porCloser.map((c) => (
                  <tr key={c.closer}>
                    <td className="!pl-6 font-medium lg:!pl-3">{NOMBRE_CLOSER[c.closer]}</td>
                    <td className="num">{c.porcentaje === null ? <span className="tag tag-yellow">falta cargar</span> : `${String(c.porcentaje).replace('.', ',')}%`}</td>
                    <td className="num">{usd(c.base)}</td>
                    <td className="num">{c.monto === null ? '—' : <span className={c.monto ? 'bad' : ''}>{usd(c.monto, c.monto % 1 ? 2 : 0)}</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td className="!pl-6 h-11 font-medium lg:!pl-3" colSpan={3}>Total del mes</td><td className="num font-medium bad">{usd(com.total, com.total % 1 ? 2 : 0)}</td></tr>
              </tfoot>
            </table>
          </div>
          {editor ? (
            <form method="POST" action="/api/comisiones" className="flex flex-col gap-3 rounded-xl bg-[var(--surface-2)] p-4">
              <div className="text-[14px] font-medium">Cambiar % de comisión</div>
              <input type="hidden" name="mes" value={f.mes} />
              <Campo label="Closer">
                <select className="input" name="closer" defaultValue="Andrea">{CLOSERS.map((c) => <option key={c} value={c}>{NOMBRE_CLOSER[c]}</option>)}</select>
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="% sobre lo cobrado"><input className="input" name="porcentaje" type="number" step="0.5" min="0" max="100" required /></Campo>
                <Campo label="Desde"><input className="input" name="desde" type="date" defaultValue={`${f.mes}-01`} /></Campo>
              </div>
              <div><button className="btn-primary" type="submit">Guardar</button></div>
              <div className="text-[12px] text-text-disabled">Los meses anteriores a la fecha elegida no cambian.</div>
            </form>
          ) : null}
        </div>
      </ChartCard>

      {editor && (<section className="grid gap-4 lg:grid-cols-2">
        <form method="POST" action="/api/costos" className="card flex flex-col gap-4">
          <div>
            <h3 className="card-title">Agregar herramienta</h3>
            <div className="card-sub">Software, suscripción o servicio. En USD tal cual se cobra.</div>
          </div>
          <input type="hidden" name="accion" value="alta" />
          <input type="hidden" name="mes" value={f.mes} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Nombre"><input className="input" name="nombre" placeholder="Ej.: ManyChat Pro" required /></Campo>
            <Campo label="Categoría">
              <select className="input" name="categoria" defaultValue="CRM y ventas">
                {CATEGORIAS_COSTO.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Campo>
            <Campo label="Monto (USD)"><input className="input" name="monto" type="number" step="0.01" min="0" required /></Campo>
            <Campo label="Frecuencia">
              <select className="input" name="frecuencia" defaultValue="Mensual">
                <option>Mensual</option><option>Anual</option><option>Único</option>
              </select>
            </Campo>
            <Campo label="Desde"><input className="input" name="fecha_alta" type="date" defaultValue={hoy} /></Campo>
            <Campo label="Notas"><input className="input" name="notas" placeholder="Para qué se usa" /></Campo>
          </div>
          <div><button className="btn-primary" type="submit">Agregar</button></div>
        </form>

        <form method="POST" action="/api/costos" className="card flex flex-col gap-4">
          <div>
            <h3 className="card-title">Cambiar precio o dar de baja</h3>
            <div className="card-sub">El precio nuevo rige desde la fecha elegida. Los meses anteriores no cambian.</div>
          </div>
          <input type="hidden" name="mes" value={f.mes} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Herramienta">
              <select className="input" name="id" required defaultValue="">
                <option value="" disabled>Elegí una</option>
                {vigentes.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {usd(equivalenteMensual(c), 2)}/mes</option>)}
              </select>
            </Campo>
            <Campo label="Acción">
              <select className="input" name="accion" defaultValue="precio">
                <option value="precio">Cambiar precio</option>
                <option value="baja">Dar de baja</option>
              </select>
            </Campo>
            <Campo label="Nuevo monto (solo para cambio de precio)"><input className="input" name="monto" type="number" step="0.01" min="0" /></Campo>
            <Campo label="Fecha"><input className="input" name="fecha" type="date" defaultValue={hoy} /></Campo>
          </div>
          <div><button className="btn-secondary" type="submit">Guardar</button></div>
        </form>
      </section>)}

      {historicas.length > 0 && (
        <ChartCard titulo="Historial" sub="Herramientas que no cuentan en este mes (dadas de baja, futuras o pagos únicos de otro mes)">
          <div className="-mx-6 overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th className="!pl-6">Herramienta</th><th>Frecuencia</th><th className="num">Monto</th><th>Desde</th><th>Hasta</th></tr>
              </thead>
              <tbody>
                {historicas.map((c) => (
                  <tr key={c.id}>
                    <td className="!pl-6 text-text-muted">{c.nombre}</td>
                    <td className="text-text-muted">{c.frecuencia}</td>
                    <td className="num text-text-muted">{usd(c.monto, c.monto % 1 ? 2 : 0)}</td>
                    <td className="text-text-muted">{fechaCorta(c.fecha_alta)}</td>
                    <td className="text-text-muted">{c.fecha_baja ? fechaCorta(c.fecha_baja) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </>
  );
}
