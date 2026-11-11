import { Suspense } from 'react';
import Filtros from '@/components/Filtros';
import { DemoBanner, Seccion, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { leerFiltros, type SearchParams } from '@/lib/filtros';
import { agendasPorUtm, esVenta, mesesDisponibles, enPeriodo } from '@/lib/metrics';
import TablaUtm from '@/components/TablaUtm';
import { ChartCard } from '@/components/ui';
import { Iconos } from '@/components/StatCard';
import { fechaCorta, mesCorto, num, usd } from '@/lib/format';
import { COLOR_ORIGEN, nombreUtm, origenSinUtm } from '@/lib/origen';
import { clavePieza, leerTags, tiempoEntre } from '@/lib/manychat';
import { enPalabras, tramosDeCompra, velocidad, velocidadPorOrigen } from '@/lib/velocidad';
import { esCloser, rangoComisiones, RANGOS, tablaPerfil, type FilaPerfil } from '@/lib/perfil';
import { pct } from '@/lib/format';
import type { Agenda } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Cómo llegó a la agenda: lo cargado a mano; si no, el link con el que agendó; sin link = se lo pasó el setter. */
function comoAgendo(a: Agenda): string {
  const l = a.lead;
  if (l?.como_agendo) return l.como_agendo;
  const utm = l?.utm_campaign || l?.utm_content || l?.utm_medium;
  return utm ? nombreUtm(utm).nombre : 'Setting';
}
const huboSetter = (a: Agenda): boolean | null => a.lead?.intervino_setter ?? (comoAgendo(a) === 'Setting' ? true : null);

interface Grupo { clave: string; ventas: number; cash: number; color?: string }
function agrupar(ventas: Agenda[], clave: (a: Agenda) => string, color?: (a: Agenda) => string): Grupo[] {
  const m = new Map<string, Grupo>();
  for (const a of ventas) {
    const k = clave(a);
    const g = m.get(k) ?? { clave: k, ventas: 0, cash: 0, color: color?.(a) };
    g.ventas++;
    g.cash += a.cash_collected ?? 0;
    m.set(k, g);
  }
  return Array.from(m.values()).sort((x, y) => y.cash - x.cash || y.ventas - x.ventas);
}

function Reparto({ titulo, ayuda, grupos }: { titulo: string; ayuda: string; grupos: Grupo[] }) {
  const max = Math.max(1, ...grupos.map((g) => g.cash));
  return (
    <div className="card flex flex-col gap-3">
      <div>
        <div className="text-[15px] text-text">{titulo}</div>
        <div className="text-[12px] text-text-disabled">{ayuda}</div>
      </div>
      {grupos.length ? grupos.map((g) => (
        <div key={g.clave} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="flex min-w-0 items-center gap-2"><span className="dot shrink-0" style={{ background: g.color ?? 'var(--blue)' }} /><span className="truncate">{g.clave}</span></span>
            <span className="shrink-0 tabular-nums text-text-muted">{num(g.ventas)} · {usd(g.cash)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--surface-2)]"><div className="h-1.5 rounded-full" style={{ width: `${(g.cash / max) * 100}%`, background: g.color ?? 'var(--blue)' }} /></div>
        </div>
      )) : <span className="text-[14px] text-text-disabled">—</span>}
    </div>
  );
}

function TablaPerfil({ titulo, filas }: { titulo: string; filas: FilaPerfil[] }) {
  return (
    <div className="card flex flex-col gap-4 !p-6">
      <div className="text-[15px] text-text">{titulo}</div>
      <table className="w-full text-[14px]">
        <thead>
          <tr className="text-left text-[12px] text-text-disabled">
            <th className="pb-3 font-normal">Perfil</th>
            <th className="pb-3 text-right font-normal">Llamadas</th>
            <th className="pb-3 text-right font-normal">Ventas</th>
            <th className="pb-3 text-right font-normal">% cierre</th>
            <th className="pb-3 text-right font-normal">Ticket</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.segmento} className={`border-t border-[color-mix(in_srgb,var(--text)_10%,transparent)] ${f.segmento === 'Sin dato' ? 'text-text-disabled' : ''}`}>
              <td className="py-3 pr-3">{f.segmento}</td>
              <td className="py-3 text-right tabular-nums">{num(f.presentadas)}</td>
              <td className="py-3 text-right tabular-nums">{num(f.ventas)}</td>
              <td className="py-3 text-right tabular-nums">{f.presentadas >= 3 ? pct(f.pctCierre) : '—'}</td>
              <td className="py-3 text-right tabular-nums">{f.ticket === null ? '—' : usd(f.ticket)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Paso = ({ nombre, tramo, n }: { nombre: string; tramo?: string; n?: number }) => (
  <>
    {tramo !== undefined && (
      <div className="flex min-w-[130px] flex-1 flex-col items-center gap-1 px-2 text-center">
        <div className="text-[20px] leading-none tabular-nums text-text [font-family:var(--font-polysans)]">{tramo}</div>
        <div className="h-px w-full bg-[color-mix(in_srgb,var(--text)_25%,transparent)]" />
        <div className="text-[12px] text-text-disabled">{n ? `mediana de ${n}` : 'sin datos'}</div>
      </div>
    )}
    <div className="rounded-full bg-[var(--surface-2)] px-4 py-2 text-[14px] text-text">{nombre}</div>
  </>
);

const mediana = (v: number[]) => {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  return o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2;
};

export default async function PuntosDeContacto({ searchParams }: { searchParams: SearchParams }) {
  const bundle = await getBundle();
  const f = leerFiltros(searchParams);
  const meses = mesesDisponibles(bundle, f.mes);
  const compradores = bundle.agendas
    .filter((a) => esVenta(a) && enPeriodo(f, a.fecha_llamada) && (f.closer === 'todos' || a.closer === f.closer) && (f.fuente === 'todas' || a.lead?.fuente === f.fuente))
    .sort((a, b) => b.fecha_llamada.localeCompare(a.fecha_llamada));
  const utms = Object.fromEntries((['utm_campaign', 'utm_source', 'utm_content', 'utm_medium'] as const).map((n) => [n, agendasPorUtm(bundle, f, n)]));

  const sinChat = compradores.filter((a) => !a.lead?.manychat_url).length;
  const porOrigen = agrupar(compradores, origenSinUtm, (a) => COLOR_ORIGEN[origenSinUtm(a)]);
  const porAgenda = agrupar(compradores, comoAgendo);
  const porSetter = agrupar(compradores, (a) => { const s = huboSetter(a); return s === null ? 'Sin dato' : s ? 'Con setter' : 'Sin setter'; });

  // Días desde el primer DM (alta en ManyChat) hasta la llamada donde compró
  const diasHastaCompra = compradores
    .filter((a) => a.lead?.manychat_desde)
    .map((a) => Math.max(0, Math.round((Date.parse(a.fecha_llamada) - Date.parse(a.lead!.manychat_desde!)) / 86400000)));
  const med = mediana(diasHastaCompra);
  const rapidas = diasHastaCompra.filter((d) => d <= 14).length;

  // Qué tocaron los que compraron: piezas (etiquetas con fecha), aperturas y material que se les mandó
  const toques = new Map<string, { tipo: string; nombre: string; fecha: string | null; ventas: number; cash: number; quienes: string[] }>();
  const sumar = (tipo: string, nombre: string, fecha: string | null, a: Agenda) => {
    const k = `${tipo}:${clavePieza(nombre)}`;
    const t = toques.get(k) ?? { tipo, nombre, fecha, ventas: 0, cash: 0, quienes: [] };
    const quien = a.lead?.nombre ?? '—';
    if (!t.quienes.includes(quien)) {
      t.ventas++;
      t.cash += a.cash_collected ?? 0;
      t.quienes.push(quien);
    }
    if (fecha && (!t.fecha || fecha > t.fecha)) t.fecha = fecha;
    toques.set(k, t);
  };
  for (const a of compradores) {
    const t = leerTags(a.lead?.manychat_tags);
    for (const p of t.piezas) sumar('Pieza', p.nombre, p.fecha, a);
    for (const r of t.ranteos) sumar('Material enviado', r, null, a);
    for (const ap of t.aperturas) sumar('Apertura', ap, null, a);
  }
  // Velocidad del proceso y perfil: con todo el historial cargado, no solo el período del filtro
  const todas = bundle.agendas.filter((a) => f.closer === 'todos' || a.closer === f.closer);
  const vel = velocidad(todas);
  const velOrigen = velocidadPorOrigen(todas).filter((o) => o.v.dmAAgenda.n + o.v.agendaALlamada.n + o.v.dmACompra.n > 0);
  const tramos = tramosDeCompra(todas);
  const perfilComisiones = tablaPerfil(todas, (a) => rangoComisiones(a.lead?.rango_comisiones), RANGOS);
  const perfilCloser = tablaPerfil(todas, (a) => esCloser(a.lead?.closer_en_actividad));
  const perfilPais = tablaPerfil(todas, (a) => a.lead?.pais);

  const filasToques = Array.from(toques.values()).sort((x, y) => y.ventas - x.ventas || y.cash - x.cash);
  const conTags = compradores.filter((a) => a.lead?.manychat_tags?.length).length;

  return (
    <>
      {bundle.demo && <DemoBanner />}
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow">Puntos de contacto</div>
          <h1 className="h1 mt-2">De dónde vienen las ventas</h1>
        </div>
        <Suspense>
          <Filtros filtros={f} meses={meses} />
        </Suspense>
      </div>

      <Seccion
        eyebrow="Ingeniería inversa"
        titulo={`${num(compradores.length)} ventas · ${usd(compradores.reduce((s, a) => s + (a.cash_collected ?? 0), 0))} cobrados`}
        aside={sinChat > 0 ? <span className="tag tag-gray">{num(sinChat)} sin conversación de ManyChat</span> : undefined}
      >
        {compradores.length ? (
          <>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <Reparto titulo="Por origen" ayuda="De dónde salió el lead · ventas y cobrado" grupos={porOrigen} />
              <Reparto titulo="Cómo agendó" ayuda="Setting = el setter le pasó el calendario" grupos={porAgenda} />
              <Reparto titulo="Setter" ayuda="Si hubo conversación con el setter antes de agendar" grupos={porSetter} />
              <div className="card flex flex-col gap-2">
                <div className="text-[15px] text-text">Del primer DM a la compra</div>
                <div className="metric">{med === null ? '—' : `${num(Math.round(med))} días`}</div>
                <div className="text-[13px] text-text-disabled">
                  {med === null
                    ? 'Falta el dato de ManyChat de estas ventas.'
                    : `Mediana de ${num(diasHastaCompra.length)} de ${num(compradores.length)} ventas · ${num(rapidas)} compraron en 2 semanas o menos`}
                </div>
              </div>
            </div>

            <div className="card overflow-x-auto !p-0">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cierre</th>
                    <th>Quién</th>
                    <th>Links</th>
                    <th className="num">Cobrado</th>
                    <th>Origen</th>
                    <th>Nos sigue desde</th>
                    <th>Primer DM</th>
                    <th>Cómo agendó</th>
                    <th>Setter</th>
                    <th>Qué tocó antes de comprar</th>
                  </tr>
                </thead>
                <tbody>
                  {compradores.map((a) => {
                    const l = a.lead;
                    const t = leerTags(l?.manychat_tags);
                    const sigue = l?.seguidor_desde?.slice(0, 7) ?? t.seguidorDesde;
                    const setter = huboSetter(a);
                    const origen = origenSinUtm(a);
                    return (
                      <tr key={a.id} className="align-top">
                        <td className="whitespace-nowrap">{fechaCorta(a.fecha_llamada)}</td>
                        <td className="min-w-[180px]">
                          <div className="font-medium">{l?.nombre}</div>
                          {l?.instagram && <div className="text-[12px] text-text-muted">{l.instagram}</div>}
                        </td>
                        <td className="whitespace-nowrap text-[13px]">
                          <div className="flex flex-col gap-1">
                            {l?.manychat_url
                              ? <a className="text-[var(--accent)] hover:underline" href={l.manychat_url} target="_blank" rel="noopener noreferrer" title="Abrir la conversación en ManyChat">Chat ↗</a>
                              : <span className="text-text-disabled">Sin chat</span>}
                            {a.fathom_url
                              ? <a className="text-[var(--accent)] hover:underline" href={a.fathom_url} target="_blank" rel="noopener noreferrer" title="Ver la grabación de la llamada en Fathom">Llamada ↗</a>
                              : <span className="text-text-disabled">Sin llamada</span>}
                          </div>
                        </td>
                        <td className="num">{usd(a.cash_collected)}</td>
                        <td className="whitespace-nowrap">
                          <span className="flex items-center gap-2"><span className="dot shrink-0" style={{ background: COLOR_ORIGEN[origen] }} />{origen}</span>
                          {l?.primer_punto_contacto && !/^(social media|direct traffic)$/i.test(l.primer_punto_contacto) && <div className="max-w-[220px] whitespace-normal text-[12px] text-text-muted">{l.primer_punto_contacto}</div>}
                        </td>
                        <td className="whitespace-nowrap">
                          {sigue ? <>{mesCorto(sigue)}<div className="text-[12px] text-text-muted">{tiempoEntre(`${sigue}-15`, a.fecha_llamada) ?? '—'} antes</div></> : <span className="text-text-disabled">—</span>}
                        </td>
                        <td className="whitespace-nowrap">
                          {l?.manychat_desde ? <>{fechaCorta(l.manychat_desde)}<div className="text-[12px] text-text-muted">{tiempoEntre(l.manychat_desde, a.fecha_llamada) ?? '—'} antes</div></> : <span className="text-text-disabled">—</span>}
                        </td>
                        <td className="whitespace-nowrap">{comoAgendo(a)}</td>
                        <td>{setter === null ? <span className="text-text-disabled">—</span> : setter ? 'Sí' : 'No'}</td>
                        <td className="min-w-[280px] max-w-[460px] whitespace-normal">
                          {l?.recorrido && <div className="text-[13px]">{l.recorrido}</div>}
                          {(t.piezas.length > 0 || t.ranteos.length > 0) && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {t.piezas.map((p) => <span key={p.fecha + p.nombre} className="tag tag-blue" title="Pieza o recurso al que respondió">{fechaCorta(p.fecha)} {p.nombre}</span>)}
                              {t.ranteos.map((r) => <span key={r} className="tag tag-gray" title="Material que se le mandó">{r}</span>)}
                            </div>
                          )}
                          {!l?.recorrido && !t.piezas.length && !t.ranteos.length && <span className="text-text-disabled">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] text-text-disabled">
              &quot;Nos sigue desde&quot; y las piezas salen de las etiquetas de ManyChat (&quot;Nuevo Seguidor…&quot; y las que empiezan con fecha). &quot;Primer DM&quot; es el alta del contacto en ManyChat.
              Se actualiza solo cada mañana para las ventas que tienen su conversación de ManyChat cargada.
            </p>
          </>
        ) : <Vacio texto="Sin ventas para este filtro." />}
      </Seccion>

      {filasToques.length > 0 && (
        <Seccion eyebrow="Qué tocaron los que compraron" titulo={`${num(filasToques.length)} piezas y materiales en ${num(conTags)} ventas`}>
          <div className="card overflow-x-auto !p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Pieza o material</th>
                  <th>Tipo</th>
                  <th className="num">Ventas</th>
                  <th className="num">Cobrado</th>
                  <th>Quiénes</th>
                </tr>
              </thead>
              <tbody>
                {filasToques.map((t) => (
                  <tr key={t.tipo + t.nombre}>
                    <td className="font-medium">{t.nombre}{t.fecha && <span className="ml-2 text-[12px] text-text-muted">{fechaCorta(t.fecha)}</span>}</td>
                    <td className="text-text-muted">{t.tipo}</td>
                    <td className="num">{num(t.ventas)}</td>
                    <td className="num">{usd(t.cash)}</td>
                    <td className="max-w-[420px] whitespace-normal text-text-muted">{t.quienes.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[13px] text-text-disabled">
            Cuenta en cuántas ventas del período aparece cada pieza (una venta puede tocar varias, así que el cobrado no se suma entre filas). Sirve para ver qué contenido está detrás de la plata, no cuál &quot;cerró&quot; la venta.
          </p>
        </Seccion>
      )}

      <Seccion eyebrow="Proceso de venta · todo el historial" titulo="Cuánto tarda">
        <div className="card flex flex-col gap-7 !p-7">
          <div className="flex flex-wrap items-center gap-y-4">
            <Paso nombre="Primer DM" />
            <Paso nombre="Agenda" tramo={enPalabras(vel.dmAAgenda.mediana)} n={vel.dmAAgenda.n} />
            <Paso nombre="Llamada" tramo={enPalabras(vel.agendaALlamada.mediana)} n={vel.agendaALlamada.n} />
          </div>
          <div className="flex flex-wrap items-end gap-x-12 gap-y-5">
            <div>
              <div className="metric">{enPalabras(vel.dmACompra.mediana)}</div>
              <div className="text-[13px] text-text-disabled">del primer DM a la compra · mediana de {num(vel.dmACompra.n)} ventas</div>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {tramos.map((t) => (
                <div key={t.label}>
                  <div className="text-[20px] leading-none tabular-nums text-text [font-family:var(--font-polysans)]">{num(t.n)}</div>
                  <div className="mt-1 text-[12px] text-text-disabled">{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {velOrigen.length > 0 && (
          <div className="card overflow-x-auto !p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Origen</th>
                  <th className="num">Agendas</th>
                  <th className="num">Ventas</th>
                  <th className="num">Primer DM → agenda</th>
                  <th className="num">Agenda → llamada</th>
                  <th className="num">Primer DM → compra</th>
                </tr>
              </thead>
              <tbody>
                {velOrigen.map((o) => (
                  <tr key={o.origen}>
                    <td><span className="flex items-center gap-2"><span className="dot shrink-0" style={{ background: COLOR_ORIGEN[o.origen] }} />{o.origen}</span></td>
                    <td className="num">{num(o.agendas)}</td>
                    <td className="num">{num(o.ventas)}</td>
                    <td className="num">{enPalabras(o.v.dmAAgenda.mediana)}{o.v.dmAAgenda.n > 0 && <span className="ml-1 text-[12px] text-text-disabled">({o.v.dmAAgenda.n})</span>}</td>
                    <td className="num">{enPalabras(o.v.agendaALlamada.mediana)}{o.v.agendaALlamada.n > 0 && <span className="ml-1 text-[12px] text-text-disabled">({o.v.agendaALlamada.n})</span>}</td>
                    <td className="num">{enPalabras(o.v.dmACompra.mediana)}{o.v.dmACompra.n > 0 && <span className="ml-1 text-[12px] text-text-disabled">({o.v.dmACompra.n})</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[13px] text-text-disabled">
          Medianas. Entre paréntesis, cuántas llamadas tienen el dato. &quot;Primer DM&quot; es el alta del contacto en ManyChat (solo leads con su conversación cargada);
          la fecha en que agendó viene de GoHighLevel.
        </p>
      </Seccion>

      <Seccion eyebrow="Perfil · todo el historial" titulo="Qué perfil compra">
        <div className="grid gap-5 lg:grid-cols-3">
          <TablaPerfil titulo="Cuánto comisiona por mes (USD)" filas={perfilComisiones} />
          <TablaPerfil titulo="¿Es closer?" filas={perfilCloser} />
          <TablaPerfil titulo="País" filas={perfilPais} />
        </div>
        <p className="text-[13px] text-text-disabled">
          Llamadas = las que se presentaron. % cierre = ventas / llamadas presentadas (se muestra con 3 llamadas o más). Sale de las respuestas del formulario de agenda y del teléfono.
        </p>
      </Seccion>

      <ChartCard titulo="Agendas por UTM" sub="Todas las agendas del período, agrupadas por el link con que agendaron" icono={Iconos.tendencia} color="blue">
        <TablaUtm datos={utms} />
      </ChartCard>
    </>
  );
}
