import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import { DemoBanner, Seccion, SourceDot, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, type SearchParams } from '@/lib/filtros';
import { mesesDisponibles, enPeriodo } from '@/lib/metrics';
import { fechaCorta, hoyAR, mesDe, num, pct } from '@/lib/format';
import { etapasDePiezas, ritmoDeContenido } from '@/lib/contenido';
import { OBJETIVOS } from '@/lib/cliente';
import { ETAPAS } from '@/lib/types';
import EditableCell from '@/components/EditableCell';
import { getSesion, puede } from '@/lib/auth';
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
  const editor = puede(await getSesion(), 'editor');
  const meses = mesesDisponibles(bundle, f.mes);
  // Ritmo de contenido: últimas 4 semanas contra la meta (no depende del mes elegido)
  const etapas = etapasDePiezas(bundle);
  const ritmo = ritmoDeContenido(bundle, hoyAR(), etapas);
  const recientes = ritmo.slice(-2).flatMap((s) => s.piezas).reverse();
  const metaSemana = OBJETIVOS.piezasPorDia * 7;
  const semaforo = (v: number, meta: number) => (v >= meta ? 'ok' : v >= meta * 0.6 ? 'warn' : 'bad');
  const OPC_ETAPA = ETAPAS.map((e) => ({ value: e, label: e }));
  const COLOR_ETAPA = { TOFU: 'tag-blue', MOFU: 'tag-yellow', BOFU: 'tag-green' } as const;
  const filas = bundle.organico.filter((o) => enPeriodo(f, o.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const piezasMes = bundle.piezas.filter((p) => enPeriodo(f, p.fecha) && !p.promocionado);
  const top = (tipo: 'reel' | 'historia', campo: 'respuestas' | 'comentarios' | 'views') =>
    piezasMes.filter((p) => p.tipo === tipo).sort((a, b) => (b[campo] ?? 0) - (a[campo] ?? 0)).slice(0, 3);
  const promocionadas = bundle.piezas.filter((p) => enPeriodo(f, p.fecha) && p.promocionado).length;

  // Qué reel trae seguidores (últimos meses, no solo el mes elegido): candidato a Follow Me Ads
  const porSeguidores = bundle.piezas
    .filter((p) => p.tipo === 'reel' && p.seguidores != null)
    .sort((a, b) => (b.seguidores ?? 0) - (a.seguidores ?? 0) || (b.visitas_perfil ?? 0) - (a.visitas_perfil ?? 0))
    .slice(0, 10);


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

      <Seccion eyebrow="Ritmo de contenido" titulo="Lo que se publicó vs. la meta"
        aside={<span className="text-[13px] text-text-disabled">Meta: {num(OBJETIVOS.piezasPorDia)} publicaciones por día y {num(OBJETIVOS.tofuPorSemana)} TOFU por semana · últimas 4 semanas</span>}>
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="card overflow-x-auto !p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Semana</th>
                  <th className="num" title={`Publicaciones del feed (reels, carruseles, imágenes). Meta: ${metaSemana} por semana`}>Piezas</th>
                  <th className="num" title={`Meta: ${OBJETIVOS.piezasPorDia} por día`}>Por día</th>
                  <th className="num" title={`Meta: ${OBJETIVOS.tofuPorSemana} por semana`}>TOFU</th>
                  <th className="num">MOFU</th>
                  <th className="num">BOFU</th>
                  <th className="num" title="Todavía sin etapa: se clasifican en la lista de al lado">Sin clasificar</th>
                </tr>
              </thead>
              <tbody>
                {ritmo.map((s) => (
                  <tr key={s.desde}>
                    <td className="font-medium whitespace-nowrap">{fechaCorta(s.desde)} – {fechaCorta(s.hasta)}{s.enCurso && <span className="tag tag-gray ml-2 !text-[11px]">en curso</span>}</td>
                    <td className="num">{num(s.piezas.length)}</td>
                    <td className={`num ${semaforo(s.porDia, OBJETIVOS.piezasPorDia)}`}>{String(s.porDia).replace('.', ',')}</td>
                    <td className={`num ${s.enCurso ? '' : semaforo(s.tofu, OBJETIVOS.tofuPorSemana)}`}>{num(s.tofu)}</td>
                    <td className="num">{num(s.mofu)}</td>
                    <td className="num">{num(s.bofu)}</td>
                    <td className={`num ${s.sinClasificar ? 'warn' : ''}`}>{num(s.sinClasificar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card overflow-x-auto !p-0">
            <table className="table">
              <thead>
                <tr><th>Publicación (últimas 2 semanas)</th><th>Fecha</th><th title="Se deduce del ángulo de Marketing; se puede corregir con un click">Etapa</th><th>Ángulo</th><th className="num">Views</th></tr>
              </thead>
              <tbody>
                {recientes.length ? recientes.map((p) => {
                  const e = etapas.get(p.ig_media_id);
                  return (
                    <tr key={p.ig_media_id}>
                      <td className="max-w-[260px] truncate">{p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">{p.titulo} ↗</a> : p.titulo}</td>
                      <td className="whitespace-nowrap text-text-muted">{fechaCorta(p.fecha)}</td>
                      <td className="editable">
                        <EditableCell ruta="/api/piezas" agendaId={p.ig_media_id} campo="etapa" valor={p.etapa ?? e?.etapa ?? null} tipo="select" opciones={OPC_ETAPA} demo={bundle.demo} editable={editor}
                          mostrar={e ? <span className={`tag ${COLOR_ETAPA[e.etapa]}`} title={e.como === 'a mano' ? 'Cargada a mano' : `Deducida por la ${e.como}`}>{e.etapa}{e.como !== 'a mano' ? ' ·' : ''}</span> : <span className="tag tag-gray">sin clasificar</span>} />
                      </td>
                      <td className="max-w-[220px] truncate text-text-muted">{e?.angulo ?? '—'}</td>
                      <td className="num">{num(p.views)}</td>
                    </tr>
                  );
                }) : <tr><td colSpan={5} className="text-text-muted">Sin publicaciones en las últimas 2 semanas.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </Seccion>

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

      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion eyebrow="Para Follow Me Ads" titulo="Reels que más seguidores traen">
          {porSeguidores.length ? (
            <div className="card overflow-x-auto !p-0">
              <table className="table">
                <thead>
                  <tr><th>#</th><th>Reel</th><th className="num">Seguidores</th><th className="num">Visitas al perfil</th><th className="num">Views</th></tr>
                </thead>
                <tbody>
                  {porSeguidores.map((p, i) => (
                    <tr key={p.ig_media_id}>
                      <td className="mono text-text-muted">{i + 1}</td>
                      <td>
                        {p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="hover:text-accent">{p.titulo}</a> : p.titulo}
                        <span className="ml-2 text-text-muted">{fechaCorta(p.fecha)}</span>
                        {p.promocionado && <span className="ml-1" title="Promocionado">📣</span>}
                      </td>
                      <td className="num">{num(p.seguidores)}</td>
                      <td className="num">{num(p.visitas_perfil)}</td>
                      <td className="num text-text-muted">{num(p.views)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Vacio texto="Todavía sin datos de seguidores por reel: se cargan con el próximo sync diario de Instagram (repasa los últimos 120 días)." />}
        </Seccion>

      </div>
    </>
  );
}
