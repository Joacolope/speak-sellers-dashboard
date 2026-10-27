import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import { DemoBanner, Seccion, Semaforo } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, type SearchParams } from '@/lib/filtros';
import { mesesDisponibles, metricasMes } from '@/lib/metrics';
import { mesCorto, num, pct, usd } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Metricas({ searchParams }: { searchParams: SearchParams }) {
  const bundle = await getBundle();
  const f = leerFiltros(searchParams);
  const meses = mesesDisponibles(bundle, f.mes);
  const filas = meses.map((mes) => ({ mes, m: metricasMes(bundle, { ...f, mes }), aj: bundle.ajustes.find((a) => a.mes.startsWith(mes)) }));

  return (
    <>
      {bundle.demo && <DemoBanner />}
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow">Métricas de Venta</div>
          <h1 className="h1 mt-2">Mes a mes</h1>
        </div>
        <Suspense>
          <Filtros filtros={f} meses={meses} />
        </Suspense>
      </div>

      <Seccion eyebrow="Métricas Ventas" titulo="Setter · Closer · Conversión">
        <div className="card overflow-x-auto !p-0">
          <table className="table">
            <thead>
              <tr className="group-head">
                <th></th>
                <th colSpan={7}>Setter</th>
                <th colSpan={14}>Closer</th>
                <th colSpan={2}>Costos</th>
                <th colSpan={2}>Conversión</th>
              </tr>
              <tr>
                <th>Mes</th>
                <th className="num" title="Inbound orgánico">Conv. orgánicas</th>
                <th className="num" title="Inbound desde anuncios">Conv. pagadas</th>
                <th className="num" title="Mensajes en frío o de seguimiento que tuvieron respuesta">Conv. outbound</th>
                <th className="num" title="Inbound + outbound con ida y vuelta">Conversaciones</th>
                <th className="num">Seguimientos</th>
                <th className="num">Links</th>
                <th className="num">Agendas</th>
                <th className="num">Asistencias</th>
                <th className="num">% Asist.</th>
                <th className="num">No show</th>
                <th className="num">% No show</th>
                <th className="num">Reservas</th>
                <th className="num">Ventas</th>
                <th className="num">Ofertas</th>
                <th className="num">% cierre total</th>
                <th className="num">% cierre / asist.</th>
                <th className="num">% cierre / oferta</th>
                <th className="num">Cash Collected</th>
                <th className="num">Revenue</th>
                <th className="num">New Cash</th>
                <th className="num">Old Cash</th>
                <th className="num">Inversión ads</th>
                <th className="num">Software</th>
                <th className="num">% Agenda / Conversación</th>
                <th className="num">% Agenda / Link</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ mes, m, aj }) => (
                <tr key={mes} className={mes === f.mes ? 'bg-surface-2' : ''}>
                  <td className="font-medium">{mesCorto(mes)}</td>
                  <td className="num">{num(m.conv_organicas)}</td>
                  <td className="num">{num(m.conv_pagadas)}</td>
                  <td className="num">{num(m.conv_outbound)}</td>
                  <td className="num font-medium">{num(m.conversaciones)}</td>
                  <td className="num">{num(m.seguimientos)}</td>
                  <td className="num">{num(m.links_enviados)}</td>
                  <td className="num">{num(m.agendas)}</td>
                  <td className="num">{num(m.asistencias)}</td>
                  <td className="num"><Semaforo valor={m.pct_asistencia} objetivo={aj?.objetivo_asistencia ?? 0.6} /></td>
                  <td className="num">{num(m.no_show)}</td>
                  <td className="num"><Semaforo valor={m.pct_no_show} objetivo={1 - (aj?.objetivo_asistencia ?? 0.6)} invertir /></td>
                  <td className="num">{num(m.reservas)}</td>
                  <td className="num">{num(m.ventas)}</td>
                  <td className="num">{num(m.ofertas)}</td>
                  <td className="num">{pct(m.pct_cierre_total)}</td>
                  <td className="num">{pct(m.pct_cierre_asistencia)}</td>
                  <td className="num"><Semaforo valor={m.pct_cierre_oferta} objetivo={aj?.objetivo_cierre_oferta ?? 0.3} /></td>
                  <td className="num" title={m.costo_software === null ? 'Falta costo de software' : undefined}>{usd(m.cash_collected)}{m.costo_software === null && <span className="text-text-disabled">*</span>}</td>
                  <td className="num">{usd(m.revenue)}</td>
                  <td className="num">{usd(m.new_cash)}</td>
                  <td className="num">{usd(m.old_cash)}</td>
                  <td className="num">{usd(m.inversion_ads)}</td>
                  <td className="num">{m.costo_software === null ? '—' : usd(m.costo_software)}</td>
                  <td className="num">{pct(m.pct_agenda_conversacion)}</td>
                  <td className="num">{pct(m.pct_agenda_link)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-[14px] text-text-muted">
          Conversaciones = charlas con ida y vuelta: inbound (orgánicas + pagadas) más outbound que tuvo respuesta. Revenue = plata que entró − reembolsos. Cash Collected = Revenue − inversión en ads − software (sale de la sección Costos). <span className="text-text-disabled">*</span> sin software cargado.
          Semáforo: % Asistencia ≥ {pct(0.6)} y % cierre / oferta ≥ {pct(0.3)} (configurable en <code className="mono text-[12px]">ajustes_mensuales</code>).
        </div>
      </Seccion>
    </>
  );
}
