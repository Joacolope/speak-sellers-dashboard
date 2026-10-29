import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import { DemoBanner, Seccion, Vacio } from '@/components/ui';
import TortaFuente from '@/components/TortaFuente';
import { getBundle } from '@/lib/data';
import { leerFiltros, type SearchParams } from '@/lib/filtros';
import { agendasPorUtm, esVenta, mesesDisponibles, enPeriodo } from '@/lib/metrics';
import TablaUtm from '@/components/TablaUtm';
import { ChartCard } from '@/components/ui';
import { Iconos } from '@/components/StatCard';
import { fechaCorta, mesCorto, mesDe, num, usd } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PuntosDeContacto({ searchParams }: { searchParams: SearchParams }) {
  const bundle = await getBundle();
  const f = leerFiltros(searchParams);
  const meses = mesesDisponibles(bundle, f.mes);
  const compradores = bundle.agendas
    .filter((a) => esVenta(a) && enPeriodo(f, a.fecha_llamada) && (f.closer === 'todos' || a.closer === f.closer) && (f.fuente === 'todas' || a.lead?.fuente === f.fuente))
    .sort((a, b) => b.fecha_llamada.localeCompare(a.fecha_llamada));
  const porFuente = new Map<string, number>();
  for (const c of compradores) {
    const k = c.lead?.fuente ?? 'Otro';
    porFuente.set(k, (porFuente.get(k) ?? 0) + 1);
  }
  const sinPrimerToque = compradores.filter((a) => !a.lead?.primer_punto_contacto).length;
  const torta = Array.from(porFuente.entries()).map(([name, value]) => ({ name, value }));
  const utms = Object.fromEntries((['utm_campaign', 'utm_source', 'utm_content', 'utm_medium'] as const).map((n) => [n, agendasPorUtm(bundle, f, n)]));

  return (
    <>
      {bundle.demo && <DemoBanner />}
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow">Puntos de contacto</div>
          <h1 className="h1 mt-2">De dónde vienen las agendas y los compradores</h1>
        </div>
        <Suspense>
          <Filtros filtros={f} meses={meses} />
        </Suspense>
      </div>

      <ChartCard titulo="Agendas por UTM" sub="Todas las agendas del período, agrupadas por el link con que agendaron" icono={Iconos.tendencia} color="blue">
        <TablaUtm datos={utms} />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Seccion
          eyebrow="Compradores · trazabilidad inversa"
          titulo={`${num(compradores.length)} ventas`}
          aside={sinPrimerToque ? <span className="tag tag-yellow">{num(sinPrimerToque)} sin primer punto de contacto</span> : undefined}
        >
          {compradores.length ? (
            <div className="card overflow-x-auto !p-0">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Fecha de cierre</th>
                    <th>Nombre · Instagram</th>
                    <th className="num">Cobrado</th>
                    <th>Fuente</th>
                    <th>Primer punto de contacto</th>
                    <th>Último punto de contacto</th>
                    <th>Funnel / IG</th>
                    <th>UTM (campaña · contenido)</th>
                  </tr>
                </thead>
                <tbody>
                  {compradores.map((a) => (
                    <tr key={a.id}>
                      <td className="text-text-muted">{mesCorto(mesDe(a.fecha_llamada))}</td>
                      <td>{fechaCorta(a.fecha_llamada)}</td>
                      <td className="font-medium">{a.lead?.nombre}{a.lead?.instagram && <span className="ml-2 text-text-muted">{a.lead.instagram}</span>}</td>
                      <td className="num">{usd(a.cash_collected)}</td>
                      <td>{a.lead?.fuente ?? '—'}</td>
                      <td>{a.lead?.primer_punto_contacto ?? <span className="warn">Falta</span>}</td>
                      <td>{a.lead?.ultimo_punto_contacto ?? <span className="text-text-disabled">—</span>}</td>
                      <td>{a.lead?.fuente === 'Webinar' ? 'Funnel' : 'Instagram'}</td>
                      <td className="text-text-muted">{[a.lead?.utm_campaign, a.lead?.utm_content].filter(Boolean).join(' · ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Vacio texto="Sin compradores para este filtro." />}
        </Seccion>
        <Seccion eyebrow="Por fuente">
          <div className="card">
            {torta.length ? <TortaFuente data={torta} /> : <Vacio texto="—" />}
          </div>
        </Seccion>
      </div>
    </>
  );
}
