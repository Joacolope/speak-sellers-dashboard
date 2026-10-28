import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import { BarrasSimples } from '@/components/Charts';
import { DemoBanner, Seccion, SourceDot, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, type SearchParams } from '@/lib/filtros';
import { mesesDisponibles, metricasMes } from '@/lib/metrics';
import { getSesion, puede } from '@/lib/auth';
import { fechaCorta, fechaHora, mesDe, num, pct } from '@/lib/format';
import { OBJETIVO_RESPUESTA_MIN, colorRespuesta, formatoEspera, resumenRespuesta } from '@/lib/respuesta';

export const dynamic = 'force-dynamic';

export default async function Setter({ searchParams }: { searchParams: SearchParams & { ok?: string; error?: string } }) {
  const bundle = await getBundle();
  const editor = puede(await getSesion(), 'editor');
  const ok = typeof searchParams.ok === 'string' ? searchParams.ok : null;
  const error = typeof searchParams.error === 'string' ? searchParams.error : null;
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
  const outIg = { frio: sum('conv_frio'), resp: sum('respuestas') };
  const outWa = { frio: sum('frio_wa'), resp: sum('respuestas_wa') };
  const totOut = outIg.resp + outWa.resp;
  const metaConv = bundle.ads.filter((a) => mesDe(a.fecha) === f.mes).reduce((acc, a) => acc + (a.conversaciones ?? 0), 0);
  const m = metricasMes(bundle, { ...f, closer: 'todos', fuente: 'todas' });
  const rr = resumenRespuesta(filas);
  const convApi = filas.reduce((acc, s) => acc + (s.conv_api ?? 0), 0);
  const chartResp = filas.filter((s) => s.tr_mediana_min != null).map((s) => ({ x: s.fecha.slice(8), mediana: s.tr_mediana_min ?? 0 }));
  const chart = filas.map((s) => ({ x: s.fecha.slice(8), organicas: s.conv_organicas ?? 0, pagadas: s.conv_pagadas ?? 0, outbound: (s.respuestas ?? 0) + (s.respuestas_wa ?? 0) }));

  return (
    <>
      {bundle.demo && <DemoBanner />}
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow">Setter</div>
          <h1 className="h1 mt-2">Conversaciones y seguimiento</h1>
          {ok && <div className="ok mt-3 text-[14px]">Guardado: {ok}</div>}
          {error && <div className="bad mt-3 text-[14px]">{error}</div>}
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
        <div className="card flex flex-col gap-2"><div className="metric">{num(totOut)}</div><div className="text-[14px] text-text-muted">Conv. outbound (con respuesta)</div><div className="text-[13px] text-text-disabled">IG {num(outIg.resp)} · WA {num(outWa.resp)}</div></div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card flex flex-col gap-2"><div className="metric">{pct(m.pct_agenda_conversacion)}</div><div className="text-[14px] text-text-muted">% Agenda total · {num(m.agendas)} agendas / {num(m.conversaciones)} conv.</div></div>
        <div className="card flex flex-col gap-2"><div className="metric" style={{ color: 'var(--blue-ink)' }}>{pct(m.pct_agenda_inbound)}</div><div className="text-[14px] text-text-muted">% Agenda inbound · {num(m.agendas_inbound)} / {num(m.conv_inbound)} conv. que escribieron</div></div>
        <div className="card flex flex-col gap-2"><div className="metric" style={{ color: 'var(--green-ink)' }}>{pct(m.pct_agenda_outbound)}</div><div className="text-[14px] text-text-muted">% Agenda outbound · {num(m.agendas_outbound)} / {num(m.conv_outbound)} respuestas en frío</div></div>
      </section>

      <Seccion
        eyebrow="Velocidad de respuesta · DMs de Instagram"
        titulo="¿Cuánto tarda el setter en contestar?"
        aside={rr.ultimo ? <span className="text-[13px] text-text-disabled">Se actualiza solo cada mañana · último día: {fechaCorta(rr.ultimo.fecha)}</span> : undefined}
      >
        {rr.ultimo ? (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="card flex flex-col gap-2" title="La mitad de los mensajes se contestó en menos de este tiempo">
                <div className={`metric ${colorRespuesta(rr.ultimo.tr_mediana_min ?? null)}`}>{formatoEspera(rr.ultimo.tr_mediana_min)}</div>
                <div className="text-[14px] text-text-muted">Tiempo de respuesta · {fechaCorta(rr.ultimo.fecha)}</div>
                <div className="text-[13px] text-text-disabled">Mediana · objetivo {OBJETIVO_RESPUESTA_MIN} min · promedio {formatoEspera(rr.ultimo.tr_promedio_min)}</div>
              </div>
              <div className="card flex flex-col gap-2">
                <div className={`metric ${colorRespuesta(rr.medianaPeriodo)}`}>{formatoEspera(rr.medianaPeriodo)}</div>
                <div className="text-[14px] text-text-muted">Tiempo de respuesta del mes</div>
                <div className="text-[13px] text-text-disabled">Promedio de {num(rr.dias)} días medidos</div>
              </div>
              <div className="card flex flex-col gap-2">
                <div className="metric">{pct(rr.pctRapidasPeriodo)}</div>
                <div className="text-[14px] text-text-muted">Respondidas en menos de 5 min</div>
                <div className="text-[13px] text-text-disabled">Promedio del mes</div>
              </div>
              <div className="card flex flex-col gap-2">
                <div className={`metric ${rr.ultimo.sin_respuesta ? 'bad' : 'ok'}`}>{num(rr.ultimo.sin_respuesta ?? 0)}</div>
                <div className="text-[14px] text-text-muted">Sin responder · {fechaCorta(rr.ultimo.fecha)}</div>
                <div className="text-[13px] text-text-disabled">{num(rr.sinRespuestaPeriodo)} en el mes</div>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="card">
                <div className="eyebrow mb-4">Tiempo de respuesta por día (mediana, minutos)</div>
                <BarrasSimples data={chartResp} series={[{ key: 'mediana', nombre: 'Minutos', color: 'main' }]} />
              </div>
              <div className="card flex flex-col gap-3">
                <div className="eyebrow">Para auditar · las más lentas del {fechaCorta(rr.ultimo.fecha)}</div>
                {rr.ultimo.respuestas_lentas?.length ? (
                  <ul className="flex flex-col">
                    {rr.ultimo.respuestas_lentas.map((r) => (
                      <li key={r.usuario + r.llego} className="flex items-center justify-between gap-3 border-t border-border py-2 text-[14px]">
                        <span className="min-w-0">
                          <span className="block truncate text-text">@{r.usuario}</span>
                          <span className="block text-[12px] text-text-disabled">escribió {fechaHora(r.llego)}</span>
                        </span>
                        <span className={`shrink-0 tabular-nums ${r.espera_min === null ? 'bad' : colorRespuesta(r.espera_min)}`}>{r.espera_min === null ? 'Sin responder' : formatoEspera(r.espera_min)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <div className="text-[14px] text-text-muted">Todas respondidas rápido.</div>}
              </div>
            </div>
            <p className="text-[13px] text-text-disabled">
              Se mide desde que el lead escribe hasta la primera respuesta humana: las respuestas automáticas de ManyChat (menos de 15 segundos) no cuentan. Es la mediana: la mitad de los mensajes se contestó más rápido que eso.
            </p>
          </>
        ) : <Vacio texto="Todavía sin datos. Se llena solo cuando esté conectada la API de mensajes de Instagram (META_TOKEN + META_PAGE_ID)." />}
      </Seccion>

      <Seccion eyebrow="Outbound por canal">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { canal: 'Instagram', o: outIg },
            { canal: 'WhatsApp', o: outWa },
          ].map(({ canal, o }) => (
            <div key={canal} className="card flex flex-col gap-4">
              <div className="card-title">{canal}</div>
              <div className="grid grid-cols-3 gap-3">
                <div><div className="metric !text-[28px]">{num(o.frio)}</div><div className="text-[13px] text-text-muted">Mensajes en frío</div></div>
                <div><div className="metric !text-[28px]">{num(o.resp)}</div><div className="text-[13px] text-text-muted">Respuestas</div></div>
                <div><div className="metric !text-[28px]" style={{ color: 'var(--green-ink)' }}>{o.frio ? pct(o.resp / o.frio) : '—'}</div><div className="text-[13px] text-text-muted">% respuesta</div></div>
              </div>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion
        eyebrow="Comparar con Meta"
        aside={
          <div className="rounded-lg border border-border-strong bg-surface-2 px-4 py-2 text-[14px]">
            Weekly: <strong>{num(totPag)}</strong> pagadas · Meta: <strong>{metaConv ? num(metaConv) : '—'}</strong>
            {convApi ? <> · Instagram (ida y vuelta): <strong>{num(convApi)}</strong> vs. cargadas <strong>{num(totOrg + totPag)}</strong></> : null}
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

      {editor && (
        <form method="POST" action="/api/setter" className="card flex flex-col gap-4">
          <div>
            <h3 className="card-title">Cargar un día del setter</h3>
            <div className="card-sub">Completá solo lo que tengas; lo vacío no se toca. Si el día ya estaba cargado, se corrige.</div>
          </div>
          <input type="hidden" name="mes" value={f.mes} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Fecha<input className="input" name="fecha" type="date" required defaultValue={f.dia ?? new Date().toISOString().slice(0, 10)} /></label>
            <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Conv. orgánicas<input className="input" name="conv_organicas" type="number" min="0" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Conv. pagadas<input className="input" name="conv_pagadas" type="number" min="0" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Bienvenidas<input className="input" name="bienvenidas" type="number" min="0" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Links enviados<input className="input" name="links_enviados" type="number" min="0" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Seguimientos<input className="input" name="seguimientos" type="number" min="0" /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="eyebrow sm:col-span-2 lg:col-span-6">Outbound</div>
            <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Instagram · en frío<input className="input" name="conv_frio" type="number" min="0" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Instagram · seguimiento<input className="input" name="mensajes_seguimiento" type="number" min="0" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Instagram · respuestas<input className="input" name="respuestas" type="number" min="0" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">WhatsApp · en frío<input className="input" name="frio_wa" type="number" min="0" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">WhatsApp · seguimiento<input className="input" name="seguimiento_wa" type="number" min="0" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">WhatsApp · respuestas<input className="input" name="respuestas_wa" type="number" min="0" /></label>
          </div>
          <div className="flex justify-end"><button className="btn-primary" type="submit">Guardar día</button></div>
        </form>
      )}

      <Seccion eyebrow="Setter 1" titulo="Tabla diaria">
        {filas.length ? (
          <div className="card overflow-x-auto !p-0">
            <table className="table">
              <thead>
                <tr className="group-head">
                  <th></th>
                  <th colSpan={3}>Inbound</th>
                  <th colSpan={3}>Outbound Instagram</th>
                  <th colSpan={3}>Outbound WhatsApp</th>
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
                    <td className="num">{num(s.frio_wa)}</td>
                    <td className="num">{num(s.seguimiento_wa)}</td>
                    <td className="num">{num(s.respuestas_wa)}</td>
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
