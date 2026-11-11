import { DemoBanner, Seccion, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { getSesion, puede } from '@/lib/auth';
import { num, usd } from '@/lib/format';
import { cruzarAngulos, embudoPorEtapa, rankingAngulos, type CruceAngulo } from '@/lib/angulos';
import { ESTADOS_ANGULO, ETAPAS, type Angulo, type Etapa } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ETAPA: Record<Etapa, { color: string; tag: string; ancho: string }> = {
  TOFU: { color: 'var(--blue)', tag: 'tag-blue', ancho: '100%' },
  MOFU: { color: 'var(--yellow)', tag: 'tag-yellow', ancho: '86%' },
  BOFU: { color: 'var(--green)', tag: 'tag-green', ancho: '72%' },
};
const TAG_ESTADO = { Funcionando: 'tag-green', Probando: 'tag-yellow', Descartado: 'tag-gray' } as const;
const TIPOS = ['Problema', 'Solución', 'Prueba social', 'Oferta', 'Objeción', 'Identidad', 'Autoridad', 'Historia personal'];
const FORMATOS = ['Reel', 'Historia', 'Anuncio', 'Carrusel', 'Post', 'DM', 'Webinar', 'YouTube'];
const FUENTES = ['ManyChat (etiquetas)', 'Chat del equipo', 'Instagram', 'Anuncios de Meta', 'Llamadas de venta'];

const Campo = ({ label, ayuda, ancho, children }: { label: string; ayuda?: string; ancho?: boolean; children: React.ReactNode }) => (
  <label className={`flex flex-col gap-1.5 text-[13px] text-text-muted ${ancho ? 'sm:col-span-2' : ''}`}>
    {label}
    {children}
    {ayuda && <span className="text-[12px] text-text-disabled">{ayuda}</span>}
  </label>
);

/** Campos del ángulo: los mismos para cargar uno nuevo y para editar. */
function CamposAngulo({ a }: { a?: Angulo }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Campo label="Ángulo" ancho><input className="input" name="nombre" required defaultValue={a?.nombre} placeholder="Ej.: Decir el precio al principio de la llamada" /></Campo>
      <Campo label="Etapa del embudo">
        <select className="input" name="etapa" defaultValue={a?.etapa ?? 'TOFU'}>{ETAPAS.map((e) => <option key={e} value={e}>{e}</option>)}</select>
      </Campo>
      <Campo label="¿Funciona?">
        <select className="input" name="estado" defaultValue={a?.estado ?? 'Probando'}>{ESTADOS_ANGULO.map((e) => <option key={e} value={e}>{e}</option>)}</select>
      </Campo>
      <Campo label="Tipo"><input className="input" name="tipo" list="tipos-angulo" defaultValue={a?.tipo ?? ''} placeholder="Problema, Solución, Objeción…" /></Campo>
      <Campo label="Formato"><input className="input" name="formato" list="formatos-angulo" defaultValue={a?.formato ?? ''} placeholder="Reel, Historia, Anuncio…" /></Campo>
      <Campo label="Hook / frase" ancho><input className="input" name="hook" defaultValue={a?.hook ?? ''} placeholder="La frase con la que abre" /></Campo>
      <Campo label="Palabras clave" ayuda="Separadas por coma. Con esto se cruza solo con los reels, las etiquetas de ManyChat y el origen de los leads." ancho>
        <input className="input" name="palabras_clave" defaultValue={a?.palabras_clave.join(', ') ?? ''} placeholder="precio al principio, cta info" />
      </Campo>
      <Campo label="De dónde sale el dato"><input className="input" name="fuente" list="fuentes-angulo" defaultValue={a?.fuente ?? ''} placeholder="Chat del equipo, ManyChat…" /></Campo>
      <Campo label="Link a la pieza"><input className="input" name="url" type="url" defaultValue={a?.url ?? ''} placeholder="https://www.instagram.com/reel/…" /></Campo>
      <Campo label="Por qué funciona (evidencia)" ancho><input className="input" name="resultado" defaultValue={a?.resultado ?? ''} placeholder="Ej.: 170 comentarios, 3 agendas en 2 días" /></Campo>
      <Campo label="Notas" ancho><input className="input" name="notas" defaultValue={a?.notas ?? ''} /></Campo>
    </div>
  );
}

const Numero = ({ valor, label }: { valor: string; label: string }) => (
  <div className="flex flex-col gap-1">
    <div className="text-[22px] leading-none tabular-nums text-text [font-family:var(--font-polysans)]">{valor}</div>
    <div className="text-[12px] text-text-disabled">{label}</div>
  </div>
);

const Fila = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
    <div className="w-[150px] shrink-0 pt-0.5 text-[12px] uppercase tracking-wide text-text-disabled">{titulo}</div>
    <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-2 text-[14px]">{children}</div>
  </div>
);

/** En qué se basa cada número: las conversaciones de ManyChat, las etiquetas que coincidieron y los reels. */
function Evidencia({ a, c }: { a: Angulo; c: CruceAngulo }) {
  const compraron = c.leads.filter((l) => l.compro);
  const agendaron = c.leads.filter((l) => !l.compro);
  const Lead = ({ l }: { l: CruceAngulo['leads'][number] }) =>
    l.chat
      ? <a className="text-[var(--accent)] hover:underline" href={l.chat} target="_blank" rel="noopener noreferrer" title="Abrir la conversación en ManyChat">{l.nombre}{l.compro ? ` · ${usd(l.cash)}` : ''} ↗</a>
      : <span className="text-text-muted">{l.nombre}{l.compro ? ` · ${usd(l.cash)}` : ''}</span>;
  const hay = c.leads.length > 0 || c.listaReels.length > 0 || a.url || a.fuente || a.resultado;
  if (!hay) return <div className="text-[13px] text-text-disabled">Todavía sin conversaciones ni reels que coincidan con: {a.palabras_clave.join(', ') || 'sin palabras clave'}.</div>;
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-[var(--surface-2)] p-5">
      <div className="text-[13px] text-text-muted">En qué se basa</div>
      {compraron.length > 0 && <Fila titulo="Compraron">{compraron.map((l) => <Lead key={l.nombre} l={l} />)}</Fila>}
      {agendaron.length > 0 && <Fila titulo="Agendaron">{agendaron.map((l) => <Lead key={l.nombre} l={l} />)}</Fila>}
      {c.origenes.length > 0 && (
        <Fila titulo="Origen del lead">{c.origenes.map((t) => <span key={t} className="tag tag-gray">{t}</span>)}</Fila>
      )}
      {c.etiquetas.length > 0 && (
        <Fila titulo="Etiquetas de ManyChat">{c.etiquetas.map((t) => <span key={t} className="tag tag-gray">{t}</span>)}</Fila>
      )}
      {c.listaReels.length > 0 && (
        <Fila titulo="Reels">
          {c.listaReels.slice(0, 6).map((r, i) => r.url
            ? <a key={i} className="text-[var(--accent)] hover:underline" href={r.url} target="_blank" rel="noopener noreferrer">{r.titulo.slice(0, 48)} · {num(r.views)} views ↗</a>
            : <span key={i} className="text-text-muted">{r.titulo.slice(0, 48)} · {num(r.views)} views</span>)}
        </Fila>
      )}
      {(a.url || a.fuente || a.resultado) && (
        <Fila titulo="Además">
          {a.resultado && <span className="text-text-muted">{a.resultado}</span>}
          {a.fuente && <span className="text-text-muted">Fuente: {a.fuente}</span>}
          {a.url && <a className="text-[var(--accent)] hover:underline" href={a.url} target="_blank" rel="noopener noreferrer">Ver pieza ↗</a>}
        </Fila>
      )}
    </div>
  );
}

export default async function Marketing({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const bundle = await getBundle();
  const editor = puede(await getSesion(), 'editor');
  const cruce = cruzarAngulos(bundle);
  const embudo = embudoPorEtapa(bundle, cruce);
  const ranking = rankingAngulos(bundle.angulos, cruce);

  return (
    <>
      {bundle.demo && <DemoBanner />}
      <div className="flex flex-col gap-3">
        <div className="eyebrow">Marketing</div>
        <h1 className="h1">Ángulos de comunicación</h1>
        <p className="max-w-3xl text-[15px] text-text-muted">
          Qué mensajes estamos usando, en qué parte del embudo va cada uno y cuáles terminan en ventas.
        </p>
        {searchParams.ok && <div className="ok text-[14px]">{searchParams.ok}</div>}
        {searchParams.error && <div className="bad text-[14px]">{searchParams.error}</div>}
      </div>

      <datalist id="tipos-angulo">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist>
      <datalist id="formatos-angulo">{FORMATOS.map((t) => <option key={t} value={t} />)}</datalist>
      <datalist id="fuentes-angulo">{FUENTES.map((t) => <option key={t} value={t} />)}</datalist>

      <Seccion eyebrow="Embudo" titulo="Por etapa">
        <div className="card flex flex-col items-center gap-3 !p-6">
          {embudo.map((e) => {
            const deEtapa = ranking.filter((a) => a.etapa === e.etapa && a.estado !== 'Descartado');
            return (
              <details key={e.etapa} className="group rounded-2xl px-7 py-6" style={{ width: ETAPA[e.etapa].ancho, minWidth: 'min(100%, 620px)', background: `color-mix(in srgb, ${ETAPA[e.etapa].color} 14%, transparent)`, borderLeft: `4px solid ${ETAPA[e.etapa].color}` }}>
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-10 gap-y-5 [&::-webkit-details-marker]:hidden" title="Ver los ángulos de esta etapa">
                  <div className="flex items-center gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[13px] text-text transition-transform group-open:rotate-90" aria-hidden>▶</span>
                    <div>
                      <div className="h3">{e.etapa}</div>
                      <div className="mt-1 text-[13px] text-text-muted">{num(e.angulos)} {e.angulos === 1 ? 'ángulo' : 'ángulos'} · {num(e.funcionando)} funcionando</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-10 gap-y-4">
                    <Numero valor={num(e.views)} label={`views · ${num(e.reels)} reels`} />
                    <Numero valor={num(e.agendas)} label="agendas" />
                    <Numero valor={num(e.ventas)} label="ventas" />
                    <Numero valor={usd(e.cash)} label="cobrado" />
                  </div>
                </summary>
                <div className="mt-6 flex flex-col gap-1 border-t border-[color-mix(in_srgb,var(--text)_14%,transparent)] pt-5">
                  {deEtapa.length ? deEtapa.map((a) => {
                    const c = cruce.get(a.id)!;
                    return (
                      <a key={a.id} href={`#angulo-${a.id}`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-lg px-3 py-2.5 text-[14px] hover:bg-[var(--surface)]">
                        <span className="flex min-w-0 items-center gap-2 text-text"><span className={`tag ${TAG_ESTADO[a.estado]}`}>{a.estado}</span><span className="truncate">{a.nombre}</span></span>
                        <span className="shrink-0 tabular-nums text-text-muted">
                          {c.ventas ? `${num(c.ventas)} venta${c.ventas === 1 ? '' : 's'} · ${usd(c.cash)}` : c.agendas ? `${num(c.agendas)} agenda${c.agendas === 1 ? '' : 's'}` : c.reels ? `${num(c.views)} views` : 'sin datos todavía'} →
                        </span>
                      </a>
                    );
                  }) : <span className="px-3 text-[14px] text-text-disabled">Todavía no hay ángulos en esta etapa.</span>}
                </div>
              </details>
            );
          })}
        </div>
        <p className="text-[13px] text-text-disabled">
          Tocá la flecha de cada etapa para ver sus ángulos. Views: reels de Instagram con las palabras clave del ángulo. Agendas, ventas y cobrado: leads con esas palabras en sus etiquetas de ManyChat o en su origen (fuente, primer contacto, UTM). Una venta puede contar en más de un ángulo.
        </p>
      </Seccion>

      <Seccion eyebrow="Ranking" titulo={`Los ángulos que más están funcionando · ${num(ranking.filter((a) => a.estado !== 'Descartado').length)}`}>
        {editor && (
          <details className="card !p-6">
            <summary className="cursor-pointer text-[15px] text-text">+ Nuevo ángulo</summary>
            <form method="POST" action="/api/angulos" className="mt-5 flex flex-col gap-4">
              <input type="hidden" name="accion" value="alta" />
              <CamposAngulo />
              <div className="flex justify-end"><button className="btn-primary" type="submit">Guardar ángulo</button></div>
            </form>
          </details>
        )}
        {ranking.length ? ranking.map((a, i) => {
          const c = cruce.get(a.id)!;
          return (
            <article key={a.id} id={`angulo-${a.id}`} className={`card flex scroll-mt-6 flex-col gap-6 !p-7 ${a.estado === 'Descartado' ? 'opacity-60' : ''}`}>
              <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="mt-0.5 text-[15px] tabular-nums text-text-disabled">{String(i + 1).padStart(2, '0')}</div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <h3 className="h3">{a.nombre}</h3>
                    {(a.tipo || a.formato) && <div className="text-[13px] text-text-muted">{[a.tipo, a.formato].filter(Boolean).join(' · ')}</div>}
                    {a.hook && <div className="text-[14px] italic text-text-muted">{a.hook}</div>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <span className={`tag ${ETAPA[a.etapa].tag}`}>{a.etapa}</span>
                  <span className={`tag ${TAG_ESTADO[a.estado]}`}>{a.estado}</span>
                </div>
              </header>

              <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
                <Numero valor={c.ventas ? usd(c.cash) : '—'} label="cobrado" />
                <Numero valor={c.ventas ? num(c.ventas) : '—'} label="ventas" />
                <Numero valor={c.agendas ? num(c.agendas) : '—'} label="agendas" />
                <Numero valor={c.reels ? num(c.views) : '—'} label="views" />
                <Numero valor={c.reels ? num(c.comentarios) : '—'} label="comentarios" />
                <Numero valor={c.reels ? num(c.reels) : '—'} label="reels" />
              </div>

              <Evidencia a={a} c={c} />

              {editor && (
                <details className="text-[13px]">
                  <summary className="cursor-pointer text-text-muted hover:text-text">Editar</summary>
                  <form method="POST" action="/api/angulos" className="mt-4 flex flex-col gap-4">
                    <input type="hidden" name="accion" value="editar" />
                    <input type="hidden" name="id" value={a.id} />
                    <CamposAngulo a={a} />
                    <div className="flex justify-end"><button className="btn-primary" type="submit">Guardar cambios</button></div>
                  </form>
                  <form method="POST" action="/api/angulos" className="mt-2 flex justify-end">
                    <input type="hidden" name="accion" value="borrar" />
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn-secondary" type="submit">Borrar ángulo</button>
                  </form>
                </details>
              )}
            </article>
          );
        }) : <Vacio texto="Todavía no hay ángulos cargados." />}
      </Seccion>
    </>
  );
}
