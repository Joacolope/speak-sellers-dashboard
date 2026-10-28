import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import StatCard, { Iconos } from '@/components/StatCard';
import { EmbudoPorFuente } from '@/components/Funnel';
import Avisos from '@/components/Avisos';
import {
  AdsVsCash, AgendasPorDia, AgendasVentasMes, AnilloRentabilidad, BarrasMes, InversionMes,
  TendenciaMes, VentasPorPais,
} from '@/components/Charts';
import { ChartCard, DemoBanner, Semaforo, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, queryDe, type SearchParams } from '@/lib/filtros';
import {
  acumuladoAnual, adsVsCashSemanal, agendasPorDia, avisos, mesesDisponibles,
  agendasDelMes, agendasPorUtm, cobranzasDelMes, embudosPorFuente, esVenta, metricasConAnterior, resumenCloser, serieMeses, ventasPorPais,
} from '@/lib/metrics';
import ClosersDesplegable, { type DetalleCloser } from '@/components/ClosersDesplegable';
import TablaUtm from '@/components/TablaUtm';
import { comisionesDelMes } from '@/lib/comisiones';
import { fechaLarga, mesActual, mesAnterior, nombreMes, num, pct, usd, variacion } from '@/lib/format';
import { CLOSERS, NOMBRE_CLOSER } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Verde si cumple el objetivo, amarillo si está cerca (−15 %), rojo si está lejos. */
const semaforo = (v: number | null, objetivo: number): 'green' | 'yellow' | 'red' | 'blue' =>
  v === null ? 'blue' : v >= objetivo ? 'green' : v >= objetivo * 0.85 ? 'yellow' : 'red';

export default async function Inicio({ searchParams }: { searchParams: SearchParams }) {
  const bundle = await getBundle();
  const f = leerFiltros(searchParams);
  const meses = mesesDisponibles(bundle, f.mes);
  const { actual, anterior } = metricasConAnterior(bundle, f);
  const embudos = embudosPorFuente(bundle, f);
  const utms = Object.fromEntries((['utm_campaign', 'utm_source', 'utm_content', 'utm_medium'] as const).map((n) => [n, agendasPorUtm(bundle, f, n)]));
  const serie = serieMeses(bundle, f, 6);
  const anual = acumuladoAnual(bundle, f);
  const paises = ventasPorPais(bundle, f);
  const semanas = adsVsCashSemanal(bundle, f);
  const dias = agendasPorDia(bundle, f);
  const closers = CLOSERS.map((c) => resumenCloser(bundle, f, c));
  const comision = new Map(comisionesDelMes(bundle.comisiones, cobranzasDelMes(bundle, { ...f, closer: 'todos' }), f.mes).porCloser.map((c) => [c.closer, c]));
  const periodo = f.dia ? fechaLarga(f.dia) : nombreMes(f.mes);
  const detalleClosers: DetalleCloser[] = closers.map((r) => {
    const ag = agendasDelMes(bundle, { ...f, closer: r.closer });
    const com = comision.get(r.closer);
    return {
      closer: r.closer,
      nombre: NOMBRE_CLOSER[r.closer],
      agendas: r.agendas,
      llamadas: r.asistencias,
      pctShow: r.pct_show,
      cierres: r.cierres,
      pctCierre: r.pct_cierre,
      cash: r.cash,
      comision: com?.monto ?? null,
      porcentaje: com?.porcentaje ?? null,
      noShow: ag.filter((a) => a.asistio === 'No show').length,
      pendientes: ag.filter((a) => a.asistio === 'Pendiente').length,
      ventas: ag.filter(esVenta).sort((a, b) => b.fecha_llamada.localeCompare(a.fecha_llamada)).map((a) => ({ nombre: a.lead?.nombre ?? '—', fecha: a.fecha_llamada, monto: a.cash_collected ?? null, estado: a.compro ?? '' })),
      proximas: ag.filter((a) => a.asistio === 'Pendiente').sort((a, b) => a.fecha_llamada.localeCompare(b.fecha_llamada)).map((a) => ({ nombre: a.lead?.nombre ?? '—', fecha: a.fecha_llamada })),
      href: `/closers${queryDe({ ...f, closer: r.closer })}`,
    };
  });
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
          <h1 className="h1 mt-2">{f.dia ? fechaLarga(f.dia) : nombreMes(f.mes)}</h1>
        </div>
        <Suspense>
          <Filtros filtros={f} meses={meses} />
        </Suspense>
      </div>

      {/* Fila 1 · números grandes */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Revenue" valor={usd(actual.revenue)} variacion={variacion(actual.revenue, anterior.revenue)} icono={Iconos.revenue} color="blue" />
        <StatCard
          label="Cash Collected"
          valor={usd(actual.cash_collected)}
          variacion={variacion(actual.cash_collected, anterior.cash_collected)}
          icono={Iconos.cash}
          color="green"
          nota={actual.costo_software === null ? 'Después de ads · falta software' : undefined}
        />
        <StatCard label="Ventas" valor={num(actual.ventas)} variacion={variacion(actual.ventas, anterior.ventas)} icono={Iconos.ventas} color="green" />
        <StatCard label="Agendas" valor={num(actual.agendas)} variacion={variacion(actual.agendas, anterior.agendas)} icono={Iconos.agendas} color="blue" />
        <StatCard label="% Asistencia" valor={pct(actual.pct_asistencia)} variacion={variacion(actual.pct_asistencia, anterior.pct_asistencia)} icono={Iconos.asistencia} color={semaforo(actual.pct_asistencia, 0.6)} />
        <StatCard label="% Cierre / llamadas" valor={pct(actual.pct_cierre_asistencia)} variacion={variacion(actual.pct_cierre_asistencia, anterior.pct_cierre_asistencia)} icono={Iconos.cierre} color={semaforo(actual.pct_cierre_asistencia, 0.3)} />
      </section>

      {/* Fila 2 · rentabilidad, revenue y cash */}
      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard titulo="Rentabilidad" sub="Cuánto queda de cada dólar vendido" icono={Iconos.margen} color="green">
          <AnilloRentabilidad revenue={actual.revenue} ads={actual.inversion_ads} software={actual.costo_software} comisiones={actual.comisiones} plataformas={actual.comisiones_plataformas} cash={actual.cash_collected} />
        </ChartCard>
        <ChartCard
          titulo="Revenue"
          color="blue"
          sub={enCurso ? 'Mes en curso · tramo punteado' : nombreMes(f.mes)}
          icono={Iconos.revenue}
          valor={usd(actual.revenue)}
          comparacion={vsAnterior(anterior.revenue)}
        >
          <TendenciaMes data={serie} campo="revenue" enCurso={enCurso} nombre="Revenue" />
        </ChartCard>
        <ChartCard
          titulo="Cash Collected"
          color="green"
          sub="Revenue − ads − software − comisiones (closers y plataformas)"
          icono={Iconos.cash}
          valor={usd(actual.cash_collected)}
          comparacion={vsAnterior(anterior.cash_collected)}
        >
          <TendenciaMes data={serie} campo="cash" enCurso={enCurso} nombre="Cash" />
        </ChartCard>
      </section>

      {/* Fila 3 · embudo, agendas y anuncios */}
      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard titulo="Embudo" sub={`${periodo} · elegí la fuente · pasá el mouse para ver por closer`} icono={Iconos.embudo} color="blue">
          <EmbudoPorFuente embudos={embudos} />
        </ChartCard>
        <ChartCard titulo="Agendas vs. Ventas" sub="Agendas (azul) y ventas (verde)" icono={Iconos.agendas} color="blue">
          <AgendasVentasMes data={serie} />
        </ChartCard>
        <ChartCard
          titulo="Inversión en anuncios"
          color="red"
          sub="Meta Ads"
          icono={Iconos.ads}
          valor={usd(actual.inversion_ads, 2)}
          comparacion={vsAnterior(anterior.inversion_ads)}
        >
          <InversionMes data={serie} />
        </ChartCard>
      </section>

      {/* Fila 4 · ROAS, ventas nuevas vs cuotas, país */}
      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard titulo="ROAS" sub="Veces que vuelve lo invertido en ads" icono={Iconos.tendencia} color="green">
          <BarrasMes data={serie} a={{ key: 'roas_cash', nombre: 'ROAS Cash', color: 'green' }} b={{ key: 'roas_revenue', nombre: 'ROAS Revenue', color: 'blue' }} formato="x" />
        </ChartCard>
        <ChartCard titulo="Ventas nuevas vs. Cuotas cobradas" sub="Plata de ventas cerradas en el mes vs. cuotas de ventas de meses anteriores" icono={Iconos.cash} color="green">
          <BarrasMes data={serie} a={{ key: 'new_cash', nombre: 'Ventas nuevas', color: 'green' }} b={{ key: 'old_cash', nombre: 'Cuotas cobradas', color: 'yellow' }} formato="usd" />
        </ChartCard>
        <ChartCard titulo="Ventas por país" sub={nombreMes(f.mes)} icono={Iconos.globo} color="green">
          {paises.length ? <VentasPorPais data={paises} /> : <Vacio texto="Sin ventas este mes." />}
        </ChartCard>
      </section>

      {/* UTM: de qué link vienen las agendas */}
      <ChartCard titulo="Agendas por UTM" sub={`${periodo} · de qué campaña, fuente o contenido vienen las agendas y cuánto venden`} icono={Iconos.tendencia} color="blue">
        <TablaUtm datos={utms} limite={8} />
      </ChartCard>

      {/* Fila 6 · acumulados y closers */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          <div className="card-feature flex flex-1 flex-col justify-center gap-3 !bg-[var(--blue-soft)]">
            <div className="eyebrow !text-[var(--blue-ink)]">Acumulado {anual.year} · Revenue</div>
            <div className="metric-xl">{usd(anual.revenue)}</div>
          </div>
          <div className="card-feature flex flex-1 flex-col justify-center gap-3 !bg-[var(--green-soft)]">
            <div className="eyebrow !text-[var(--green-ink)]">Acumulado {anual.year} · Cash Collected</div>
            <div className="metric-xl">{usd(anual.cash)}</div>
          </div>
        </div>
        <ChartCard titulo="Closers" sub={`${periodo} · tocá un closer para ver su detalle`} icono={Iconos.asistencia} color="blue" className="lg:col-span-2">
          <ClosersDesplegable filas={detalleClosers} />
        </ChartCard>
      </section>

      {/* Fila 7 · el mes por dentro */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard titulo="Inversión en ads vs. Cash cobrado" sub="Ads (rojo) vs. cash cobrado (verde) por semana" icono={Iconos.ads} color="red">
          <AdsVsCash data={semanas} />
        </ChartCard>
        <ChartCard titulo="Agendas por día" sub="Agendas (azul) y asistencias (verde)" icono={Iconos.agendas} color="blue">
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
