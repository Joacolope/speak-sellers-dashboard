import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import { DemoBanner, Seccion, SourceDot, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, type SearchParams } from '@/lib/filtros';
import { mesesDisponibles } from '@/lib/metrics';
import { fechaCorta, mesDe, num, pct, usd } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Anuncios({ searchParams }: { searchParams: SearchParams }) {
  const bundle = await getBundle();
  const f = leerFiltros(searchParams);
  const meses = mesesDisponibles(bundle, f.mes);
  const ads = bundle.ads.filter((a) => mesDe(a.fecha) === f.mes).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const fm = ads.filter((a) => a.campana === 'follow_me');
  const web = ads.filter((a) => a.campana === 'webinar');
  const sum = <T,>(arr: T[], fn: (t: T) => number | null | undefined) => arr.reduce((s, t) => s + (fn(t) ?? 0), 0);

  const fmInv = sum(fm, (a) => a.inversion);
  const fmVis = sum(fm, (a) => a.visitas_perfil);
  const fmSeg = sum(fm, (a) => a.seguidores);
  const webInv = sum(web, (a) => a.inversion);
  const webConv = sum(web, (a) => a.conversaciones);
  const newCashWebinar = bundle.agendas
    .filter((a) => mesDe(a.fecha_llamada) === f.mes && a.lead?.fuente === 'Webinar' && (a.compro === 'Si' || a.compro === 'Reserva'))
    .reduce((s, a) => s + (a.cash_collected ?? 0), 0);

  return (
    <>
      {bundle.demo && <DemoBanner />}
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow">Anuncios</div>
          <h1 className="h1 mt-2">Meta Ads</h1>
        </div>
        <Suspense>
          <Filtros filtros={f} meses={meses} mostrarCloser={false} mostrarFuente={false} />
        </Suspense>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion eyebrow="Follow Me Ads · mensual">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="card flex flex-col gap-2"><div className="metric">{usd(fmInv, 2)}</div><div className="text-[14px] text-text-muted">Inversión</div></div>
            <div className="card flex flex-col gap-2"><div className="metric">{num(fmVis)}</div><div className="text-[14px] text-text-muted">Visitas al perfil</div></div>
            <div className="card flex flex-col gap-2"><div className="metric">{num(fmSeg)}</div><div className="text-[14px] text-text-muted">Nuevos seguidores</div></div>
            <div className="card flex flex-col gap-2"><div className="metric">{fmSeg ? usd(fmInv / fmSeg, 2) : '—'}</div><div className="text-[14px] text-text-muted">Costo por seguidor</div></div>
            <div className="card flex flex-col gap-2"><div className="metric">{fmVis ? usd(fmInv / fmVis, 2) : '—'}</div><div className="text-[14px] text-text-muted">Costo por visita</div></div>
          </div>
        </Seccion>
        <Seccion eyebrow="Webinars / otras campañas">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="card flex flex-col gap-2"><div className="metric">{usd(webInv, 2)}</div><div className="text-[14px] text-text-muted">Inversión</div></div>
            <div className="card flex flex-col gap-2"><div className="metric">{num(webConv)}</div><div className="text-[14px] text-text-muted">Conversaciones</div></div>
            <div className="card flex flex-col gap-2"><div className="metric">{webConv ? usd(webInv / webConv, 2) : '—'}</div><div className="text-[14px] text-text-muted">Costo por conversación</div></div>
            <div className="card flex flex-col gap-2"><div className="metric">{usd(newCashWebinar)}</div><div className="text-[14px] text-text-muted">Ventas nuevas generadas</div></div>
          </div>
        </Seccion>
      </div>

      <Seccion eyebrow="Daily FM Tracker" titulo="Follow Me Ads · día por día">
        {fm.length ? (
          <div className="card overflow-x-auto !p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="num">Inversión</th>
                  <th className="num">Impresiones</th>
                  <th className="num">Alcance</th>
                  <th className="num">CPM</th>
                  <th className="num">CTR</th>
                  <th className="num">Frecuencia</th>
                  <th className="num">Visitas</th>
                  <th className="num">Seguidores</th>
                  <th className="num">Conversión</th>
                  <th className="num">Costo / seguidor</th>
                  <th>Bitácora</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {fm.map((a) => (
                  <tr key={a.fecha}>
                    <td>{fechaCorta(a.fecha)}</td>
                    <td className="num">{usd(a.inversion, 2)}</td>
                    <td className="num">{num(a.impresiones)}</td>
                    <td className="num">{num(a.alcance)}</td>
                    <td className="num">{usd(a.cpm, 2)}</td>
                    <td className="num">{pct(a.ctr)}</td>
                    <td className="num">{num(a.frecuencia, 2)}</td>
                    <td className="num">{num(a.visitas_perfil)}</td>
                    <td className="num">{num(a.seguidores)}</td>
                    <td className="num">{a.visitas_perfil && a.seguidores ? pct(a.seguidores / a.visitas_perfil) : '—'}</td>
                    <td className="num">{a.seguidores ? usd(a.inversion / a.seguidores, 2) : '—'}</td>
                    <td className="editable text-text-muted" title="Editable desde /cargar">{a.bitacora ?? ''}</td>
                    <td><SourceDot source={a.source} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Vacio texto="Sin datos de Follow Me Ads este mes." />}
      </Seccion>
    </>
  );
}
