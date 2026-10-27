import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import { DemoBanner, Seccion, SourceDot, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, type SearchParams } from '@/lib/filtros';
import { cobranzasDelMes, mesesDisponibles } from '@/lib/metrics';
import { fechaCorta, num, usd } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Cobranzas({ searchParams }: { searchParams: SearchParams }) {
  const bundle = await getBundle();
  const f = leerFiltros(searchParams);
  const meses = mesesDisponibles(bundle, f.mes);
  const filas = cobranzasDelMes(bundle, f).sort((a, b) => b.fecha_cobro.localeCompare(a.fecha_cobro));
  const cobrado = filas.filter((c) => !c.es_reembolso).reduce((s, c) => s + c.monto_cobrado, 0);
  const reembolsos = filas.filter((c) => c.es_reembolso).reduce((s, c) => s + Math.abs(c.monto_cobrado), 0);
  // Pendiente total: última cobranza por agenda con pendiente > 0 (de cualquier mes)
  const ultimaPorAgenda = new Map<string, (typeof bundle.cobranzas)[number]>();
  for (const c of [...bundle.cobranzas].sort((a, b) => a.fecha_cobro.localeCompare(b.fecha_cobro))) ultimaPorAgenda.set(c.agenda_id, c);
  const pendienteTotal = Array.from(ultimaPorAgenda.values()).reduce((s, c) => s + (c.pendiente ?? 0), 0);
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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card flex flex-col gap-2"><div className="metric">{usd(cobrado)}</div><div className="text-[14px] text-text-muted">Cobrado en el mes</div></div>
        <div className="card flex flex-col gap-2"><div className="metric">{usd(pendienteTotal)}</div><div className="text-[14px] text-text-muted">Pendiente total</div></div>
        <div className="card"><div className={`metric ${reembolsos ? 'bad' : ''}`}>{usd(reembolsos)}</div><div className="text-[14px] text-text-muted">Reembolsos</div></div>
      </section>

      <Seccion eyebrow="Movimientos" titulo={`${num(filas.length)} cobranzas`}>
        {filas.length ? (
          <div className="card overflow-x-auto !p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Fecha de cobro</th>
                  <th className="num">Monto cobrado</th>
                  <th className="num">Pendiente</th>
                  <th>Closer</th>
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
                    <td>{fechaCorta(c.fecha_cobro)}</td>
                    <td className={`num ${c.es_reembolso ? 'bad' : ''}`}>{usd(c.monto_cobrado)}</td>
                    <td className="num">{c.pendiente ? usd(c.pendiente) : '—'}</td>
                    <td>{c.closer}</td>
                    <td className="num">{c.cuotas_restantes ? num(c.cuotas_restantes) : '—'}</td>
                    <td>{fechaCorta(c.proximo_vencimiento)}</td>
                    <td className="text-text-muted">{c.notas ?? ''}</td>
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
