import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import { BarrasSimples } from '@/components/Charts';
import { DemoBanner, Seccion, SourceDot, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, type SearchParams } from '@/lib/filtros';
import { mesesDisponibles } from '@/lib/metrics';
import { fechaCorta, mesDe, num, pct } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Setter({ searchParams }: { searchParams: SearchParams }) {
  const bundle = await getBundle();
  const f = leerFiltros(searchParams);
  const meses = mesesDisponibles(bundle, f.mes);
  const filas = bundle.setter.filter((s) => mesDe(s.fecha) === f.mes).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const agendasPorDia = new Map<string, number>();
  for (const a of bundle.agendas) {
    if (mesDe(a.fecha_agendada ?? a.fecha_llamada) === f.mes) {
      const d = (a.fecha_agendada ?? a.fecha_llamada).slice(0, 10);
      agendasPorDia.set(d, (agendasPorDia.get(d) ?? 0) + 1);
    }
  }
  const sum = (k: keyof (typeof filas)[number]) => filas.reduce((acc, s) => acc + ((s[k] as number | null) ?? 0), 0);
  const totOrg = sum('conv_organicas');
  const totPag = sum('conv_pagadas');
  const totOut = sum('respuestas');
  const metaConv = bundle.ads.filter((a) => mesDe(a.fecha) === f.mes).reduce((acc, a) => acc + (a.conversaciones ?? 0), 0);
  const chart = filas.map((s) => ({ x: s.fecha.slice(8), organicas: s.conv_organicas ?? 0, pagadas: s.conv_pagadas ?? 0, outbound: s.respuestas ?? 0 }));

  return (
    <>
      {bundle.demo && <DemoBanner />}
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow">Setter</div>
          <h1 className="h1 mt-2">Conversaciones y seguimiento</h1>
        </div>
        <Suspense>
          <Filtros filtros={f} meses={meses} mostrarCloser={false} mostrarFuente={false} />
        </Suspense>
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="card flex flex-col gap-2"><div className="metric">{num(totOrg + totPag + totOut)}</div><div className="text-[14px] text-text-muted">Conversaciones (ida y vuelta)</div></div>
        <div className="card flex flex-col gap-2"><div className="metric">{num(totOrg)}</div><div className="text-[14px] text-text-muted">Conv. orgánicas</div></div>
        <div className="card flex flex-col gap-2"><div className="metric">{num(totPag)}</div><div className="text-[14px] text-text-muted">Conv. pagadas</div></div>
        <div className="card flex flex-col gap-2"><div className="metric">{num(sum('links_enviados'))}</div><div className="text-[14px] text-text-muted">Links enviados</div></div>
        <div className="card flex flex-col gap-2"><div className="metric">{num(totOut)}</div><div className="text-[14px] text-text-muted">Conv. outbound (con respuesta)</div></div>
      </section>

      <Seccion
        eyebrow="Comparar con Meta"
        aside={
          <div className="rounded-lg border border-border-strong bg-surface-2 px-4 py-2 text-[14px]">
            Weekly: <strong>{num(totPag)}</strong> pagadas · Meta: <strong>{metaConv ? num(metaConv) : '—'}</strong>
            {metaConv ? <span className="text-text-muted"> · diferencia {pct(Math.abs(totPag - metaConv) / metaConv)}</span> : null}
          </div>
        }
      >
        <div className="card">
          <div className="eyebrow mb-4">Conversaciones por día · orgánicas, pagadas y outbound</div>
          {chart.length ? (
            <BarrasSimples data={chart} series={[{ key: 'organicas', nombre: 'Orgánicas', color: 'main' }, { key: 'pagadas', nombre: 'Pagadas', color: 'accent' }, { key: 'outbound', nombre: 'Outbound', color: 'soft' }]} />
          ) : <Vacio texto="Sin datos de setter este mes." />}
        </div>
      </Seccion>

      <Seccion eyebrow="Setter 1" titulo="Tabla diaria">
        {filas.length ? (
          <div className="card overflow-x-auto !p-0">
            <table className="table">
              <thead>
                <tr className="group-head">
                  <th></th>
                  <th colSpan={3}>Inbound</th>
                  <th colSpan={3}>Outbound</th>
                  <th colSpan={4}>Global</th>
                </tr>
                <tr>
                  <th>Fecha</th>
                  <th className="num">Conv. orgánicas</th>
                  <th className="num">Conv. pagadas</th>
                  <th className="num">Bienvenidas</th>
                  <th className="num">En frío</th>
                  <th className="num">Msj. seguimiento</th>
                  <th className="num" title="Cuentan como conversación outbound">Respuestas</th>
                  <th className="num">Seguimientos</th>
                  <th className="num">Links</th>
                  <th className="num">Agendas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((s) => (
                  <tr key={s.fecha}>
                    <td>{fechaCorta(s.fecha)}</td>
                    <td className="num">{num(s.conv_organicas)}</td>
                    <td className="num">{num(s.conv_pagadas)}</td>
                    <td className="num">{num(s.bienvenidas)}</td>
                    <td className="num">{num(s.conv_frio)}</td>
                    <td className="num">{num(s.mensajes_seguimiento)}</td>
                    <td className="num">{num(s.respuestas)}</td>
                    <td className="num">{num(s.seguimientos)}</td>
                    <td className="num">{num(s.links_enviados)}</td>
                    <td className="num">{num(s.agendas ?? agendasPorDia.get(s.fecha) ?? 0)}</td>
                    <td><SourceDot source={s.source} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Vacio texto="Sin datos de setter este mes. Se cargan desde la mensajería de Instagram (cron) o del weekly del setter (manual)." />}
      </Seccion>
    </>
  );
}
