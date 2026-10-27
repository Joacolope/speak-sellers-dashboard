import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import { DemoBanner, Seccion, SourceDot, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, type SearchParams } from '@/lib/filtros';
import { mesesDisponibles } from '@/lib/metrics';
import { fechaCorta, mesDe, num, pct } from '@/lib/format';
import type { OrganicoPieza } from '@/lib/types';

export const dynamic = 'force-dynamic';

function Top({ titulo, piezas, campo }: { titulo: string; piezas: OrganicoPieza[]; campo: 'respuestas' | 'comentarios' | 'views' }) {
  return (
    <div className="panel">
      <div className="eyebrow mb-3">{titulo}</div>
      {piezas.length ? (
        <ol className="flex flex-col gap-2 text-[14px]">
          {piezas.map((p, i) => (
            <li key={p.ig_media_id} className="flex items-center gap-3">
              <span className="mono w-4 text-text-muted">{i + 1}</span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-border-outline bg-surface text-[12px] text-text-muted" aria-hidden>
                {p.tipo === 'reel' ? '▶' : '◫'}
              </span>
              <span className="flex-1 truncate">
                {p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="hover:text-accent">{p.titulo}</a> : p.titulo}
                <span className="ml-2 text-text-muted">{fechaCorta(p.fecha)}</span>
                {p.a_confirmar && <span className="tag tag-yellow ml-2 !text-[11px]">a confirmar</span>}
              </span>
              <span className="tabular-nums">{num(p[campo])}</span>
            </li>
          ))}
        </ol>
      ) : <div className="text-[14px] text-text-muted">Sin piezas este mes.</div>}
    </div>
  );
}

export default async function Organico({ searchParams }: { searchParams: SearchParams }) {
  const bundle = await getBundle();
  const f = leerFiltros(searchParams);
  const meses = mesesDisponibles(bundle, f.mes);
  const filas = bundle.organico.filter((o) => mesDe(o.fecha) === f.mes).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const piezasMes = bundle.piezas.filter((p) => mesDe(p.fecha) === f.mes && !p.promocionado);
  const top = (tipo: 'reel' | 'historia', campo: 'respuestas' | 'comentarios' | 'views') =>
    piezasMes.filter((p) => p.tipo === tipo).sort((a, b) => (b[campo] ?? 0) - (a[campo] ?? 0)).slice(0, 3);
  const promocionadas = bundle.piezas.filter((p) => mesDe(p.fecha) === f.mes && p.promocionado).length;

  return (
    <>
      {bundle.demo && <DemoBanner />}
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow">Orgánico</div>
          <h1 className="h1 mt-2">Instagram orgánico</h1>
        </div>
        <Suspense>
          <Filtros filtros={f} meses={meses} mostrarCloser={false} mostrarFuente={false} />
        </Suspense>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Seccion eyebrow="Diario" titulo="Historias y reels">
          {filas.length ? (
            <div className="card overflow-x-auto !p-0">
              <table className="table">
                <thead>
                  <tr className="group-head">
                    <th></th>
                    <th colSpan={6}>Historias</th>
                    <th colSpan={3}>Reels</th>
                    <th></th>
                  </tr>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th className="num">Views 1ª</th>
                    <th className="num">Views última</th>
                    <th className="num">Cant.</th>
                    <th className="num">Drop-off</th>
                    <th className="num">Respuestas</th>
                    <th>Formato</th>
                    <th>Palabra clave</th>
                    <th className="num">Coment. 48 h</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((o) => {
                    const drop = o.views_primera && o.views_ultima ? 1 - o.views_ultima / o.views_primera : null;
                    return (
                      <tr key={o.fecha}>
                        <td>{fechaCorta(o.fecha)}</td>
                        <td>{o.tipo_historia ?? '—'}</td>
                        <td className="num">{num(o.views_primera)}</td>
                        <td className="num">{num(o.views_ultima)}</td>
                        <td className="num">{num(o.cantidad_historias)}</td>
                        <td className="num text-text-muted">{pct(drop)}</td>
                        <td className="num" title={o.notas ?? undefined}>
                          {num(o.respuestas)}{o.notas?.includes('confirmar') && <span className="warn ml-1 text-[12px]" title="A confirmar">●</span>}
                        </td>
                        <td>{o.formato_reel ?? '—'}</td>
                        <td className="mono text-[12px]">{o.tipo_cta ?? '—'}</td>
                        <td className="num">{num(o.comentarios_48h)}</td>
                        <td><SourceDot source={o.source} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <Vacio texto="Sin datos orgánicos este mes." />}
          <div className="text-[14px] text-text-muted">
            Solo Instagram orgánico. {promocionadas ? `${num(promocionadas)} pieza(s) promocionada(s) excluidas de los rankings (📣).` : 'Las piezas promocionadas se excluyen de los rankings.'}
          </div>
        </Seccion>

        <Seccion eyebrow="Top performers del mes">
          <div className="flex flex-col gap-4">
            <Top titulo="Historias · por respuestas" piezas={top('historia', 'respuestas')} campo="respuestas" />
            <Top titulo="Reels · por comentarios" piezas={top('reel', 'comentarios')} campo="comentarios" />
            <Top titulo="Reels · por views" piezas={top('reel', 'views')} campo="views" />
          </div>
        </Seccion>
      </div>
    </>
  );
}
