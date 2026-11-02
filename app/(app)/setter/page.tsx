import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import { BarrasSimples } from '@/components/Charts';
import { Bloque, DemoBanner, Seccion, SourceDot, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, type SearchParams } from '@/lib/filtros';
import { mesesDisponibles, metricasMes, enPeriodo } from '@/lib/metrics';
import { getSesion, puede } from '@/lib/auth';
import { fechaCorta, fechaHora, mesDe, num, pct } from '@/lib/format';
import { colorRespuesta, formatoEspera, lunesDe, resumenSemanal } from '@/lib/respuesta';

export const dynamic = 'force-dynamic';

export default async function Setter({ searchParams }: { searchParams: SearchParams & { ok?: string; error?: string } }) {
  const bundle = await getBundle();
  const editor = puede(await getSesion(), 'editor');
  const ok = typeof searchParams.ok === 'string' ? searchParams.ok : null;
  const error = typeof searchParams.error === 'string' ? searchParams.error : null;
  const f = leerFiltros(searchParams);
  const meses = mesesDisponibles(bundle, f.mes);
  const filas = bundle.setter.filter((s) => enPeriodo(f, s.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const agendasPorDia = new Map<string, number>();
  for (const a of bundle.agendas) {
    if (enPeriodo(f, a.fecha_agendada ?? a.fecha_llamada)) {
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
  const metaConv = bundle.ads.filter((a) => enPeriodo(f, a.fecha)).reduce((acc, a) => acc + (a.conversaciones ?? 0), 0);
  const m = metricasMes(bundle, { ...f, closer: 'todos', fuente: 'todas' });
  const rs = resumenSemanal(bundle.respuestaSemanal, f);
  // La semana que terminó más recientemente (el lunes de ayer: un lunes sugiere la semana anterior completa)
  const semanaSugerida = lunesDe(new Date(Date.now() - 3 * 3600000 - 86400000).toISOString().slice(0, 10));
  const origenConv = (o: 'setter' | 'meta' | 'ig' | null) => (o === 'meta' ? 'según Meta Ads (el setter no las cargó)' : o === 'ig' ? 'estimadas con la API de Instagram' : o === 'setter' ? 'planilla del setter' : 'sin cargar');
  const convApi = filas.reduce((acc, s) => acc + (s.conv_api ?? 0), 0);
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

      <Bloque titulo="Conversaciones" sub="Cuántas charlas con ida y vuelta hubo y de dónde vinieron">
      <section className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
        <div className="card flex flex-col gap-3"><div className="metric">{num(m.conversaciones)}</div><div className="text-[14px] text-text-muted">Conversaciones (ida y vuelta)</div><div className="text-[13px] text-text-disabled">Orgánicas + pagadas + outbound</div></div>
        <div className="card flex flex-col gap-3"><div className="metric">{m.conv_organicas === null ? '—' : num(m.conv_organicas)}</div><div className="text-[14px] text-text-muted">Conv. orgánicas</div><div className="text-[13px] text-text-disabled">{origenConv(m.conv_organicas_origen)}</div></div>
        <div className="card flex flex-col gap-3"><div className="metric">{m.conv_pagadas === null ? '—' : num(m.conv_pagadas)}</div><div className="text-[14px] text-text-muted">Conv. pagadas</div><div className="text-[13px] text-text-disabled">{origenConv(m.conv_pagadas_origen)}</div></div>
        <div className="card flex flex-col gap-3"><div className="metric">{num(sum('links_enviados'))}</div><div className="text-[14px] text-text-muted">Links enviados</div><div className="text-[13px] text-text-disabled">Links de agenda mandados</div></div>
        <div className="card flex flex-col gap-3"><div className="metric">{num(totOut)}</div><div className="text-[14px] text-text-muted">Conv. outbound con respuesta</div><div className="text-[13px] text-text-disabled">IG {num(outIg.resp)} · WA {num(outWa.resp)}</div></div>
      </section>
      </Bloque>

      <Bloque titulo="De conversación a agenda" sub="Qué porcentaje de las charlas termina en una llamada agendada">
      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="card flex flex-col gap-3"><div className="metric">{pct(m.pct_agenda_conversacion)}</div><div className="text-[14px] text-text-muted">% Agenda total</div><div className="text-[13px] text-text-disabled">{num(m.agendas)} agendas / {num(m.conversaciones)} conversaciones</div></div>
        <div className="card flex flex-col gap-3"><div className="metric" style={{ color: 'var(--blue-ink)' }}>{pct(m.pct_agenda_inbound)}</div><div className="text-[14px] text-text-muted">% Agenda inbound</div><div className="text-[13px] text-text-disabled">{num(m.agendas_inbound)} agendas / {m.conv_inbound === null ? 'sin datos de' : num(m.conv_inbound)} conversaciones que escribieron</div></div>
        <div className="card flex flex-col gap-3"><div className="metric" style={{ color: 'var(--green-ink)' }}>{pct(m.pct_agenda_outbound)}</div><div className="text-[14px] text-text-muted">% Agenda outbound</div><div className="text-[13px] text-text-disabled">{num(m.agendas_outbound)} agendas / {num(m.conv_outbound)} respuestas en frío</div></div>
      </section>
      </Bloque>

      <Bloque
        titulo="Mensajes de Instagram · Business Suite"
        sub="Los mismos números de Meta Business Suite (Bandeja de entrada → Estadísticas) · el mes se calcula solo"
      >
        {rs.semanas.length ? (
          <>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
              <div className="card flex flex-col gap-3">
                <div className="metric">{rs.contactos === null ? '—' : num(rs.contactos)}</div>
                <div className="text-[14px] text-text-muted">Contactos totales</div>
                <div className="text-[13px] text-text-disabled">{rs.contactosNuevos === null ? 'Personas que escribieron' : `${num(rs.contactosNuevos)} nuevos`}</div>
              </div>
              <div className="card flex flex-col gap-3">
                <div className="metric">{num(rs.conversaciones)}</div>
                <div className="text-[14px] text-text-muted">Conversaciones iniciadas</div>
                <div className="text-[13px] text-text-disabled">Con mensajes</div>
              </div>
              <div className="card flex flex-col gap-3">
                <div className="metric" style={{ color: 'var(--ig)' }}>{rs.convOrganicas === null ? '—' : num(rs.convOrganicas)}</div>
                <div className="text-[14px] text-text-muted">Orgánicos</div>
                <div className="text-[13px] text-text-disabled">Contactos sin anuncio</div>
              </div>
              <div className="card flex flex-col gap-3">
                <div className="metric" style={{ color: 'var(--blue-ink)' }}>{rs.convPagadas === null ? '—' : num(rs.convPagadas)}</div>
                <div className="text-[14px] text-text-muted">Pagados</div>
                <div className="text-[13px] text-text-disabled">Contactos desde anuncios</div>
              </div>
              <div className="card flex flex-col gap-3">
                <div className="metric">{pct(rs.pctRespuesta)}</div>
                <div className="text-[14px] text-text-muted">Índice de respuesta</div>
                <div className="text-[13px] text-text-disabled">Conversaciones respondidas</div>
              </div>
              <div className="card flex flex-col gap-3">
                <div className={`metric ${colorRespuesta(rs.promedio)}`}>{formatoEspera(rs.promedio)}</div>
                <div className="text-[14px] text-text-muted">Tiempo de respuesta</div>
                <div className="text-[13px]">
                  {rs.cambio === null ? <span className="text-text-disabled">Promedio 24/7</span> : (
                    <span className={rs.cambio <= 0 ? 'ok' : 'bad'}>{rs.cambio <= 0 ? '▼' : '▲'} {pct(Math.abs(rs.cambio))} vs. período anterior</span>
                  )}
                </div>
              </div>
            </div>
            <div className="card overflow-x-auto !p-0">
              <table className="table">
                <thead>
                  <tr>
                    <th className="!pl-6">Período</th><th className="num">Contactos</th><th className="num">Nuevos</th><th className="num">Conv. iniciadas</th>
                    <th className="num">Orgánicos</th><th className="num">Pagados</th><th className="num">Índice resp.</th><th className="num !pr-6">Tiempo resp.</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rs.semanas].reverse().map((w) => (
                    <tr key={w.semana}>
                      <td className="!pl-6">{fechaCorta(w.semana)} – {fechaCorta(w.hasta)}{w.dias < w.largo && <span className="ml-1 text-[12px] text-text-disabled">({w.dias} de {w.largo} días en el período)</span>}</td>
                      <td className="num">{num(w.contactos ?? null)}</td>
                      <td className="num">{num(w.contactos_nuevos ?? null)}</td>
                      <td className="num">{num(w.conversaciones ?? null)}</td>
                      <td className="num">{num(w.conv_organicas ?? null)}</td>
                      <td className="num">{num(w.conv_pagadas ?? null)}</td>
                      <td className="num">{pct(w.pct_respuesta ?? null)}</td>
                      <td className={`num !pr-6 ${colorRespuesta(w.tr_promedio_min)}`}>{formatoEspera(w.tr_promedio_min)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <Vacio texto="Todavía no hay datos de Business Suite. Cargá el primer período abajo, o mandale la captura a Claude." />}
        {editor && (
          <form method="POST" action="/api/setter" className="card flex flex-col gap-4">
            <input type="hidden" name="tipo" value="respuesta_semanal" />
            <input type="hidden" name="mes" value={f.mes} />
            <div>
              <h3 className="card-title">Cargar un período de Business Suite</h3>
              <div className="card-sub">
                Meta Business Suite → Bandeja de entrada → Estadísticas. Elegí las fechas (una semana o el mes) y copiá los números tal cual.
                El tiempo se escribe como aparece: "2 h 11 min". Si ese período ya estaba, se corrige.
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Desde<input className="input" name="semana" type="date" required defaultValue={semanaSugerida} /></label>
              <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Hasta<input className="input" name="hasta" type="date" /></label>
              <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Contactos totales<input className="input" name="contactos" type="number" min="0" placeholder="ej.: 756" /></label>
              <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Conversaciones iniciadas<input className="input" name="conversaciones" type="number" min="0" placeholder="ej.: 917" /></label>
              <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Orgánicos<input className="input" name="conv_organicas" type="number" min="0" placeholder="ej.: 355" /></label>
              <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Pagados<input className="input" name="conv_pagadas" type="number" min="0" placeholder="ej.: 401" /></label>
              <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Contactos nuevos<input className="input" name="contactos_nuevos" type="number" min="0" placeholder="ej.: 553" /></label>
              <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Índice de respuesta (%)<input className="input" name="pct_respuesta" inputMode="decimal" placeholder="ej.: 87,9" /></label>
              <label className="flex flex-col gap-1.5 text-[13px] text-text-muted">Tiempo de respuesta<input className="input" name="tr_promedio" placeholder="ej.: 2 h 11 min" /></label>
            </div>
            <div className="flex justify-end"><button className="btn-primary" type="submit">Guardar período</button></div>
          </form>
        )}
      </Bloque>

      <Seccion eyebrow="Outbound por canal">
        <div className="grid gap-5 md:grid-cols-2">
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
