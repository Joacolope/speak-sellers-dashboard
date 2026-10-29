import { Suspense, type ReactNode } from 'react';
import Filtros from '@/components/Filtros';
import { DemoBanner, Seccion, SourceDot, Tag, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, periodoAnterior, type SearchParams } from '@/lib/filtros';
import { mesesDisponibles, enPeriodo } from '@/lib/metrics';
import { fechaCorta, fechaHora, mesAnterior, mesCorto, mesDe, num, pct, usd } from '@/lib/format';
import type { CampanaMeta } from '@/lib/types';
import { resumenWebinars, totalWebinars } from '@/lib/webinars';

function Dato({ valor, label, sub, ayuda }: { valor: string; label: string; sub?: ReactNode; ayuda?: string }) {
  return (
    <div className="card flex flex-col gap-2" title={ayuda}>
      <div className="metric">{valor}</div>
      <div className="text-[14px] text-text-muted">{label}</div>
      {sub && <div className="text-[13px] text-text-disabled">{sub}</div>}
    </div>
  );
}

/** "▼ 12 % vs. sep": verde si mejoró (en costos, bajar es mejorar). */
function Delta({ actual, antes, mes, menosEsMejor = false, neutro = false }: { actual: number | null; antes: number | null; mes: string; menosEsMejor?: boolean; neutro?: boolean }) {
  if (actual === null || antes === null || !antes) return null;
  const v = actual / antes - 1;
  if (!Number.isFinite(v)) return null;
  const mejor = menosEsMejor ? v <= 0 : v >= 0;
  return <span><span className={neutro ? 'text-text-muted' : mejor ? 'ok' : 'bad'}>{v >= 0 ? '▲' : '▼'} {pct(Math.abs(v))}</span> vs. {mes}</span>;
}

/** Totales de Follow Me Ads de un conjunto de días. Un costo es null si no hubo resultados. */
function totalesFM(dias: { inversion: number; seguidores?: number | null; conversaciones?: number | null; comentarios?: number | null; visitas_perfil?: number | null; impresiones?: number | null }[]) {
  const s = (fn: (d: (typeof dias)[number]) => number | null | undefined) => (dias.some((d) => fn(d) != null) ? dias.reduce((t, d) => t + (fn(d) ?? 0), 0) : null);
  const inv = dias.reduce((t, d) => t + d.inversion, 0);
  const seg = s((d) => d.seguidores), conv = s((d) => d.conversaciones), com = s((d) => d.comentarios), vis = s((d) => d.visitas_perfil), imp = s((d) => d.impresiones);
  const c = (n: number | null) => (n ? inv / n : null);
  return { inv, seg, conv, com, vis, cSeg: c(seg), cConv: c(conv), cCom: c(com), cVis: c(vis), cpm: imp ? (inv / imp) * 1000 : null };
}

const TIPO: Record<CampanaMeta['tipo'], { label: string; color: 'blue' | 'yellow' | 'gray' }> = {
  follow_me: { label: 'Follow Me Ads', color: 'blue' },
  webinar: { label: 'Webinar', color: 'yellow' },
  otra: { label: 'Otra', color: 'gray' },
};

const SINGULAR: Record<string, string> = { registros: 'registro', seguidores: 'seguidor', visitas: 'visita', conversaciones: 'conversación' };

function TarjetaCampana({ c }: { c: CampanaMeta }) {
  const activa = c.estado === 'ACTIVE';
  return (
    <div className={`card flex min-w-0 flex-col gap-4 ${activa ? '' : 'opacity-70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-medium text-text" title={c.nombre}>{c.nombre}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Tag color={TIPO[c.tipo].color}>{TIPO[c.tipo].label}</Tag>
            <Tag color={activa ? 'green' : 'gray'}>{activa ? 'Activa' : 'Pausada'}</Tag>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[15px] tabular-nums text-text">{c.presupuesto_diario ? `${usd(c.presupuesto_diario)}/día` : c.presupuesto_total ? usd(c.presupuesto_total) : '—'}</div>
          <div className="text-[12px] text-text-disabled">{c.presupuesto_diario || !c.presupuesto_total ? 'presupuesto' : 'presupuesto total'}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 border-t border-border pt-4">
        <div><div className="text-[18px] tabular-nums text-text">{usd(c.inversion_7d, 2)}</div><div className="text-[12px] text-text-muted">Inversión 7 días</div></div>
        <div><div className="text-[18px] tabular-nums text-text">{num(c.resultados_7d)}</div><div className="text-[12px] text-text-muted capitalize">{c.resultado ?? 'resultados'} 7 días</div></div>
        <div><div className="text-[18px] tabular-nums text-text">{costo(c.inversion_7d ?? 0, c.resultados_7d ?? null)}</div><div className="text-[12px] text-text-muted">Costo por {SINGULAR[c.resultado ?? ''] ?? 'resultado'}</div></div>
      </div>
      <div className="text-[12px] text-text-disabled">
        En el mes: {usd(c.inversion_mes, 2)} · {num(c.resultados_mes)} {c.resultado ?? 'resultados'}
      </div>
    </div>
  );
}

const costo = (inv: number, n: number | null) => (n ? usd(inv / n, 2) : '—');
const de = (n: number | null, total: number | null, que: string) => (n !== null && total ? `${pct(n / total)} de ${que}` : undefined);

export const dynamic = 'force-dynamic';

export default async function Anuncios({ searchParams }: { searchParams: SearchParams }) {
  const bundle = await getBundle();
  const f = leerFiltros(searchParams);
  const meses = mesesDisponibles(bundle, f.mes);
  const ads = bundle.ads.filter((a) => enPeriodo(f, a.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const fm = ads.filter((a) => a.campana === 'follow_me');
  const web = ads.filter((a) => a.campana === 'webinar');
  const sum = <T,>(arr: T[], fn: (t: T) => number | null | undefined) => arr.reduce((s, t) => s + (fn(t) ?? 0), 0);

  const fmInv = sum(fm, (a) => a.inversion);
  const t = totalesFM(fm);
  const fp = periodoAnterior(f);
  const tp = totalesFM(bundle.ads.filter((a) => a.campana === 'follow_me' && enPeriodo(fp, a.fecha)));
  const mp = mesCorto(fp.mes).split(' ')[0].toLowerCase();
  const u2 = (v: number | null) => (v === null ? '—' : usd(v, 2));
  const activas = bundle.campanas.filter((c) => c.estado === 'ACTIVE').sort((a, b) => (b.inversion_7d ?? 0) - (a.inversion_7d ?? 0));
  const pausadasMes = bundle.campanas.filter((c) => c.estado !== 'ACTIVE' && (c.inversion_mes ?? 0) > 0);
  const actualizadoCamp = bundle.campanas.reduce<string | null>((m, c) => (c.updated_at && (!m || c.updated_at > m) ? c.updated_at : m), null);
  const webTotalMes = sum(web, (a) => a.inversion);
  const webinars = resumenWebinars(bundle, f);
  const w = totalWebinars(webinars);

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

      <Seccion eyebrow="Inversión del mes por funnel">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Dato valor={usd(fmInv + webTotalMes, 2)} label="Total invertido" />
          <Dato valor={usd(fmInv, 2)} label="Orgánico · Follow Me Ads" sub={fmInv + webTotalMes ? `${pct(fmInv / (fmInv + webTotalMes))} del total` : undefined} />
          <Dato valor={usd(webTotalMes, 2)} label="Webinar" sub={fmInv + webTotalMes ? `${pct(webTotalMes / (fmInv + webTotalMes))} del total` : undefined} />
        </div>
      </Seccion>

      <Seccion
        eyebrow="Ahora en Meta"
        titulo={`Campañas activas (${activas.length})`}
        aside={actualizadoCamp ? <span className="text-[13px] text-text-disabled">Actualizado {fechaHora(actualizadoCamp)}</span> : undefined}
      >
        {activas.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activas.map((c) => <TarjetaCampana key={c.id} c={c} />)}
          </div>
        ) : <Vacio texto={bundle.campanas.length ? 'No hay campañas corriendo ahora.' : 'Las campañas aparecen cuando se conecte Meta (META_TOKEN).'} />}
        {pausadasMes.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-[14px] text-text-muted">Pausadas que gastaron este mes ({pausadasMes.length})</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pausadasMes.map((c) => <TarjetaCampana key={c.id} c={c} />)}
            </div>
          </details>
        )}
      </Seccion>

      <Seccion eyebrow="Follow Me Ads · funnel orgánico" titulo="Cuánto cuesta cada resultado">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <Dato valor={usd(t.inv, 2)} label="Inversión" sub={<Delta actual={t.inv} antes={tp.inv} mes={mp} neutro />} />
          <Dato valor={u2(t.cSeg)} label="Costo por seguidor" ayuda="Inversión / seguidores nuevos" sub={<>{num(t.seg)} seguidores · <Delta actual={t.cSeg} antes={tp.cSeg} mes={mp} menosEsMejor /></>} />
          <Dato valor={u2(t.cConv)} label="Costo por conversación" ayuda="Inversión / conversaciones iniciadas por mensaje" sub={<>{num(t.conv)} conversaciones · <Delta actual={t.cConv} antes={tp.cConv} mes={mp} menosEsMejor /></>} />
          <Dato valor={u2(t.cCom)} label="Costo por comentario" ayuda="Inversión / comentarios en los anuncios" sub={<>{num(t.com)} comentarios · <Delta actual={t.cCom} antes={tp.cCom} mes={mp} menosEsMejor /></>} />
          <Dato valor={u2(t.cVis)} label="Costo por visita al perfil" ayuda="Inversión / visitas al perfil" sub={<>{num(t.vis)} visitas · <Delta actual={t.cVis} antes={tp.cVis} mes={mp} menosEsMejor /></>} />
        </div>
        <p className="text-[13px] text-text-disabled">
          Cómo leerlo: Follow Me Ads busca seguidores y conversaciones baratas, no ventas directas (es un funnel lento: el seguidor de hoy agenda en semanas).
          Si el costo por seguidor o por conversación sube varias semanas seguidas, el público se está quemando: rotar creativos. CPM del mes: {u2(t.cpm)}.
        </p>
      </Seccion>

      <Seccion eyebrow={`Webinars · ${webinars.length === 1 ? webinars[0].nombre : `${webinars.length} webinars en el mes`}`}>
        {webinars.length ? (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              <Dato valor={usd(w.inversion, 2)} label="Inversión" sub="Anuncios hasta el día del vivo" />
              <Dato valor={costo(w.inversion, w.registrados)} label="Costo por registro" ayuda="Inversión / registrados" sub={`${num(w.registrados)} registrados`} />
              <Dato valor={costo(w.inversion, w.calificados)} label="Costo por registro calificado" ayuda="Inversión / registrados que cumplen el perfil" sub={`${num(w.calificados)} calificados${w.calificados !== null && w.registrados ? ` · ${pct(w.calificados / w.registrados)}` : ''}`} />
              <Dato valor={costo(w.inversion, w.asistentes)} label="Costo por asistente" ayuda="Inversión / asistentes al vivo" sub={`${num(w.asistentes)} asistentes${w.asistentes !== null && w.registrados ? ` · ${pct(w.asistentes / w.registrados)} show` : ''}`} />
              <Dato valor={costo(w.inversion, w.agendas)} label="Costo por agenda" ayuda="Inversión / agendas de leads del webinar" sub={`${num(w.agendas)} agendas · ${num(w.presentadas)} presentadas`} />
              <Dato valor={costo(w.inversion, w.ventas)} label="Costo por venta" ayuda="Inversión / ventas (costo de adquisición)" sub={`${num(w.ventas)} ventas`} />
              <Dato valor={usd(w.cash)} label="Ventas nuevas (cobrado)" />
              <Dato valor={w.inversion ? `${num(w.cash / w.inversion, 2)}x` : '—'} label="ROAS" sub="Cobrado / inversión" />
            </div>
            {webinars.length > 1 && (
              <div className="card overflow-x-auto !p-0">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Webinar</th>
                      <th className="num">Inversión</th>
                      <th className="num">Registrados</th>
                      <th className="num">Calificados</th>
                      <th className="num">Asistentes</th>
                      <th className="num">Agendas</th>
                      <th className="num">Presentadas</th>
                      <th className="num">Ventas</th>
                      <th className="num">Ventas nuevas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webinars.map((x) => (
                      <tr key={x.fecha}>
                        <td>{x.nombre}</td>
                        <td className="num">{usd(x.inversion, 2)}</td>
                        <td className="num">{num(x.registrados)}</td>
                        <td className="num">{num(x.calificados)}</td>
                        <td className="num">{num(x.asistentes)}</td>
                        <td className="num">{num(x.agendas)}</td>
                        <td className="num">{num(x.presentadas)}</td>
                        <td className="num">{num(x.ventas)}</td>
                        <td className="num">{usd(x.cash)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[13px] text-text-disabled">
              Cómo leerlo: el webinar se mide por registros, no por conversaciones. Lo clave es el costo por registro calificado (calidad del público) y el costo por venta (si el webinar paga).
              Registrados, calificados y asistentes se cargan en &quot;Cargar → Webinar&quot;. Si no hay registrados cargados se usan los registros de Meta.
              Agendas y ventas: leads del funnel Webinar con llamada desde el vivo hasta el webinar siguiente.
            </p>
          </>
        ) : <Vacio texto="No hubo webinars este mes. Se cargan en Cargar → Webinar." />}
      </Seccion>

      <Seccion eyebrow="Daily Webinar Tracker" titulo="Anuncios de webinar · día por día">
        {web.length ? (
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
                  <th className="num">Registros</th>
                  <th className="num">Costo / registro</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {web.map((a) => (
                  <tr key={a.fecha}>
                    <td>{fechaCorta(a.fecha)}</td>
                    <td className="num">{usd(a.inversion, 2)}</td>
                    <td className="num">{num(a.impresiones)}</td>
                    <td className="num">{num(a.alcance)}</td>
                    <td className="num">{usd(a.cpm, 2)}</td>
                    <td className="num">{pct(a.ctr)}</td>
                    <td className="num">{num(a.registros)}</td>
                    <td className="num">{costo(a.inversion, a.registros ?? null)}</td>
                    <td><SourceDot source={a.source} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Vacio texto="Sin anuncios de webinar este mes." />}
      </Seccion>

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
                  <th className="num">Conversaciones</th>
                  <th className="num">Comentarios</th>
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
                    <td className="num">{num(a.conversaciones)}</td>
                    <td className="num">{num(a.comentarios)}</td>
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
