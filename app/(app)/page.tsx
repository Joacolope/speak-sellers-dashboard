import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import StatCard, { Iconos } from '@/components/StatCard';
import Funnel from '@/components/Funnel';
import Avisos from '@/components/Avisos';
import {
  AdsVsCash, AgendasPorDia, AgendasVentasMes, AnilloRentabilidad, BarrasMes, CashRevenueMes, InversionMes,
  TendenciaMes, VentasPorPais,
} from '@/components/Charts';
import { ChartCard, DemoBanner, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, type SearchParams } from '@/lib/filtros';
import {
  acumuladoAnual, adsVsCashSemanal, agendasPorDia, avisos, funnelMes, mesesDisponibles,
  metricasConAnterior, resumenCloser, serieMeses, ventasPorPais,
} from '@/lib/metrics';
import { mesActual, mesAnterior, nombreMes, num, pct, usd, variacion } from '@/lib/format';
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
  const enCurso = f.mes === mesActual();
  const vsAnterior = (v: number) => (
    <>vs. <span className="text-text-muted">{usd(v)}</span> en {nombreMes(mesAnterior(f.mes)).split(' ')[0].toLowerCase()}</>
  );

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

      {/* Fila 2 · finanzas y rentabilidad (estilo de la referencia) */}
      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard titulo="Finanzas" sub="Revenue y Cash Collected · últimos meses" icono={Iconos.tendencia} className="lg:col-span-2">
          <CashRevenueMes data={serie} />
        </ChartCard>
        <ChartCard titulo="Rentabilidad" sub="Cuánto queda de cada dólar vendido" icono={Iconos.margen}>
          <AnilloRentabilidad revenue={actual.revenue} ads={actual.inversion_ads} software={actual.costo_software} cash={actual.cash_collected} />
        </ChartCard>
      </section>

      {/* Fila 3 · revenue, cash y anuncios */}
      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          titulo="Revenue"
          sub={enCurso ? 'Mes en curso · tramo punteado' : nombreMes(f.mes)}
          icono={Iconos.revenue}
          valor={usd(actual.revenue)}
          comparacion={vsAnterior(anterior.revenue)}
        >
          <TendenciaMes data={serie} campo="revenue" enCurso={enCurso} nombre="Revenue" />
        </ChartCard>
        <ChartCard
          titulo="Cash Collected"
          sub="Revenue − ads − software"
          icono={Iconos.cash}
          valor={usd(actual.cash_collected)}
          comparacion={vsAnterior(anterior.cash_collected)}
        >
          <TendenciaMes data={serie} campo="cash" enCurso={enCurso} nombre="Cash" />
        </ChartCard>
        <ChartCard
          titulo="Inversión en anuncios"
          sub="Meta Ads"
          icono={Iconos.ads}
          valor={usd(actual.inversion_ads, 2)}
          comparacion={vsAnterior(anterior.inversion_ads)}
        >
          <InversionMes data={serie} />
        </ChartCard>
      </section>

      {/* Fila 4 · agendas, embudo, ROAS */}
      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard titulo="Agendas vs. Ventas" sub="Últimos meses" icono={Iconos.agendas}>
          <AgendasVentasMes data={serie} />
        </ChartCard>
        <ChartCard titulo="Embudo del mes" sub="De la conversación a la venta · pasá el mouse para ver por closer" icono={Iconos.embudo}>
          <Funnel niveles={funnel} />
        </ChartCard>
        <ChartCard titulo="ROAS" sub="Veces que vuelve lo invertido en ads" icono={Iconos.tendencia}>
          <BarrasMes data={serie} a={{ key: 'roas_cash', nombre: 'ROAS Cash' }} b={{ key: 'roas_revenue', nombre: 'ROAS Revenue' }} formato="x" />
        </ChartCard>
      </section>

      {/* Fila 5 · cash nuevo/viejo, país */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard titulo="New Cash vs. Old Cash" sub="Ventas del mes vs. cobros de ventas anteriores" icono={Iconos.cash}>
          <BarrasMes data={serie} a={{ key: 'new_cash', nombre: 'New Cash' }} b={{ key: 'old_cash', nombre: 'Old Cash' }} formato="usd" />
        </ChartCard>
        <ChartCard titulo="Ventas por país" sub={nombreMes(f.mes)} icono={Iconos.globo}>
          {paises.length ? <VentasPorPais data={paises} /> : <Vacio texto="Sin ventas este mes." />}
        </ChartCard>
      </section>

      {/* Fila 6 · acumulados y closers */}
      <section className="grid gap-4 lg:grid-cols-3">
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
        <ChartCard titulo="Closers" sub={nombreMes(f.mes)} icono={Iconos.asistencia} className="lg:col-span-2">
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

      {/* Fila 7 · el mes por dentro */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard titulo="Inversión en ads vs. Cash cobrado" sub="Por semana del mes" icono={Iconos.ads}>
          <AdsVsCash data={semanas} />
        </ChartCard>
        <ChartCard titulo="Agendas por día" sub="Con asistencias" icono={Iconos.agendas}>
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
