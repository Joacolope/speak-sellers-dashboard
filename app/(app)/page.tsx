import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import StatCard, { Iconos } from '@/components/StatCard';
import Funnel from '@/components/Funnel';
import Avisos from '@/components/Avisos';
import {
  AdsVsCash, AgendasPorDia, AgendasVentasMes, BarrasMes, CashRevenueMes, InversionMes, VentasPorPais,
} from '@/components/Charts';
import { ChartCard, DemoBanner, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, type SearchParams } from '@/lib/filtros';
import {
  acumuladoAnual, adsVsCashSemanal, agendasPorDia, avisos, funnelMes, mesesDisponibles,
  metricasConAnterior, resumenCloser, serieMeses, ventasPorPais,
} from '@/lib/metrics';
import { nombreMes, num, pct, usd, variacion } from '@/lib/format';
import { CLOSERS } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Inicio({ searchParams }: { searchParams: SearchParams }) {
  const bundle = await getBundle();
  const f = leerFiltros(searchParams);
  const meses = mesesDisponibles(bundle, f.mes);
  const { actual, anterior } = metricasConAnterior(bundle, f);
  const funnel = funnelMes(bundle, f);
  const serie = serieMeses(bundle, f, 6);
  const anual = acumuladoAnual(bundle, f);
  const paises = ventasPorPais(bundle, f);
  const semanas = adsVsCashSemanal(bundle, f);
  const dias = agendasPorDia(bundle, f);
  const closers = CLOSERS.map((c) => resumenCloser(bundle, f, c));
  const hoy = new Date().toISOString().slice(0, 10);
  const pendientes = avisos(bundle, f, hoy);

  return (
    <>
      {bundle.demo && <DemoBanner />}

      <div className="flex flex-col gap-5">
        <div>
          <div className="eyebrow">Inicio</div>
          <h1 className="h1 mt-2">{nombreMes(f.mes)}</h1>
        </div>
        <Suspense>
          <Filtros filtros={f} meses={meses} />
        </Suspense>
      </div>

      {/* Fila 1 · números grandes */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Revenue" valor={usd(actual.revenue)} variacion={variacion(actual.revenue, anterior.revenue)} icono={Iconos.revenue} />
        <StatCard
          label="Cash Collected"
          valor={usd(actual.cash_collected)}
          variacion={variacion(actual.cash_collected, anterior.cash_collected)}
          icono={Iconos.cash}
          nota={actual.costo_software === null ? 'Después de ads · falta software' : undefined}
        />
        <StatCard label="Ventas" valor={num(actual.ventas)} variacion={variacion(actual.ventas, anterior.ventas)} icono={Iconos.ventas} />
        <StatCard label="Agendas" valor={num(actual.agendas)} variacion={variacion(actual.agendas, anterior.agendas)} icono={Iconos.agendas} />
        <StatCard label="% Asistencia" valor={pct(actual.pct_asistencia)} variacion={variacion(actual.pct_asistencia, anterior.pct_asistencia)} icono={Iconos.asistencia} />
        <StatCard label="% Cierre / ofertas" valor={pct(actual.pct_cierre_oferta)} variacion={variacion(actual.pct_cierre_oferta, anterior.pct_cierre_oferta)} icono={Iconos.cierre} />
      </section>

      {/* Fila 2 · mes a mes */}
      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard titulo="Cash y Revenue" sub="Últimos 6 meses · USD">
          <CashRevenueMes data={serie} />
        </ChartCard>
        <ChartCard titulo="ROAS Cash y ROAS Revenue" sub="Cuántas veces vuelve lo invertido en ads">
          <BarrasMes data={serie} a={{ key: 'roas_cash', nombre: 'ROAS Cash' }} b={{ key: 'roas_revenue', nombre: 'ROAS Revenue' }} formato="x" />
        </ChartCard>
        <ChartCard titulo="Inversión en anuncios" sub="Últimos 6 meses · USD">
          <InversionMes data={serie} />
        </ChartCard>
      </section>

      {/* Fila 3 · agendas, embudo, cash nuevo/viejo */}
      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard titulo="Agendas vs. Ventas" sub="Últimos 6 meses">
          <AgendasVentasMes data={serie} />
        </ChartCard>
        <ChartCard titulo="Embudo del mes" sub="De la conversación a la venta · pasá el mouse para ver por closer">
          <Funnel niveles={funnel} />
        </ChartCard>
        <ChartCard titulo="New Cash vs. Old Cash" sub="Ventas del mes vs. cobros de ventas anteriores">
          <BarrasMes data={serie} a={{ key: 'new_cash', nombre: 'New Cash' }} b={{ key: 'old_cash', nombre: 'Old Cash' }} formato="usd" />
        </ChartCard>
      </section>

      {/* Fila 4 · país, acumulados, closers */}
      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard titulo="Ventas por país" sub={nombreMes(f.mes)}>
          {paises.length ? <VentasPorPais data={paises} /> : <Vacio texto="Sin ventas este mes." />}
        </ChartCard>
        <div className="flex flex-col gap-4">
          <div className="card-feature flex flex-1 flex-col justify-center gap-3">
            <div className="eyebrow">Acumulado {anual.year} · Revenue</div>
            <div className="metric-xl">{usd(anual.revenue)}</div>
          </div>
          <div className="card-feature flex flex-1 flex-col justify-center gap-3">
            <div className="eyebrow">Acumulado {anual.year} · Cash Collected</div>
            <div className="metric-xl">{usd(anual.cash)}</div>
          </div>
        </div>
        <ChartCard titulo="Closers" sub={nombreMes(f.mes)}>
          <div className="-mx-3 overflow-x-auto">
          <table className="table [&_td]:!px-3 [&_th]:!px-3">
            <thead>
              <tr>
                <th>Closer</th>
                <th className="num">Agendas</th>
                <th className="num">% Show</th>
                <th className="num">Cierres</th>
                <th className="num">Cash</th>
              </tr>
            </thead>
            <tbody>
              {closers.map((c) => (
                <tr key={c.closer}>
                  <td>{c.closer}</td>
                  <td className="num">{num(c.agendas)}</td>
                  <td className="num">{pct(c.pct_show)}</td>
                  <td className="num">{num(c.cierres)}</td>
                  <td className="num">{usd(c.cash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </ChartCard>
      </section>

      {/* Fila 5 · el mes por dentro */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard titulo="Inversión en ads vs. Cash cobrado" sub="Por semana del mes">
          <AdsVsCash data={semanas} />
        </ChartCard>
        <ChartCard titulo="Agendas por día" sub="Con asistencias">
          <AgendasPorDia data={dias} />
        </ChartCard>
      </section>

      <section className="flex flex-col gap-4">
        <div className="eyebrow">Avisos</div>
        <Avisos pendientes={pendientes} actualizaciones={bundle.actualizaciones} />
      </section>
    </>
  );
}
