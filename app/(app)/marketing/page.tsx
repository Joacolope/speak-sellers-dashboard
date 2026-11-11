import { DemoBanner, Seccion, Vacio } from '@/components/ui';
import { getBundle } from '@/lib/data';
import { getSesion, puede } from '@/lib/auth';
import { num, usd } from '@/lib/format';
import { cruzarAngulos, embudoPorEtapa, rankingAngulos } from '@/lib/angulos';
import { ESTADOS_ANGULO, ETAPAS, type Angulo, type Etapa } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ETAPA: Record<Etapa, { titulo: string; para: string; color: string; tag: string; ancho: string }> = {
  TOFU: { titulo: 'Atraer', para: 'Gente que todavía no te conoce', color: 'var(--blue)', tag: 'tag-blue', ancho: '100%' },
  MOFU: { titulo: 'Convencer', para: 'Ya te siguen: educar y generar confianza', color: 'var(--yellow)', tag: 'tag-yellow', ancho: '88%' },
  BOFU: { titulo: 'Vender', para: 'Llevar a la agenda y a la compra', color: 'var(--green)', tag: 'tag-green', ancho: '76%' },
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
        <select className="input" name="etapa" defaultValue={a?.etapa ?? 'TOFU'}>{ETAPAS.map((e) => <option key={e} value={e}>{e} · {ETAPA[e].titulo}</option>)}</select>
      </Campo>
      <Campo label="¿Funciona?">
        <select className="input" name="estado" defaultValue={a?.estado ?? 'Probando'}>{ESTADOS_ANGULO.map((e) => <option key={e} value={e}>{e}</option>)}</select>
      </Campo>
      <Campo label="Tipo"><input className="input" name="tipo" list="tipos-angulo" defaultValue={a?.tipo ?? ''} placeholder="Problema, Solución, Objeción…" /></Campo>
      <Campo label="Formato"><input className="input" name="formato" list="formatos-angulo" defaultValue={a?.formato ?? ''} placeholder="Reel, Historia, Anuncio…" /></Campo>
      <Campo label="Hook / frase" ancho><input className="input" name="hook" defaultValue={a?.hook ?? ''} placeholder="La frase con la que abre" /></Campo>
      <Campo label="Palabras clave" ayuda="Separadas por coma. Con esto se cruza solo con los reels y con las etiquetas de ManyChat." ancho>
        <input className="input" name="palabras_clave" defaultValue={a?.palabras_clave.join(', ') ?? ''} placeholder="precio al principio, cta info" />
      </Campo>
      <Campo label="De dónde sale el dato"><input className="input" name="fuente" list="fuentes-angulo" defaultValue={a?.fuente ?? ''} placeholder="Chat del equipo, ManyChat…" /></Campo>
      <Campo label="Link a la pieza"><input className="input" name="url" type="url" defaultValue={a?.url ?? ''} placeholder="https://www.instagram.com/reel/…" /></Campo>
      <Campo label="Por qué funciona (evidencia)" ancho><input className="input" name="resultado" defaultValue={a?.resultado ?? ''} placeholder="Ej.: 170 comentarios, 3 agendas en 2 días" /></Campo>
      <Campo label="Notas" ancho><input className="input" name="notas" defaultValue={a?.notas ?? ''} /></Campo>
    </div>
  );
}

export default async function Marketing({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const bundle = await getBundle();
  const editor = puede(await getSesion(), 'editor');
  const cruce = cruzarAngulos(bundle);
  const embudo = embudoPorEtapa(bundle, cruce);
  const ranking = rankingAngulos(bundle.angulos, cruce);
  const activos = ranking.filter((a) => a.estado !== 'Descartado');
  const descartados = ranking.filter((a) => a.estado === 'Descartado');

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

      <Seccion eyebrow="Embudo" titulo="Qué hace cada etapa">
        <div className="card flex flex-col items-center gap-2">
          {embudo.map((e) => (
            <div key={e.etapa} className="rounded-xl px-5 py-4" style={{ width: ETAPA[e.etapa].ancho, minWidth: 'min(100%, 560px)', background: `color-mix(in srgb, ${ETAPA[e.etapa].color} 14%, transparent)`, borderLeft: `4px solid ${ETAPA[e.etapa].color}` }}>
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <div className="min-w-[200px]">
                  <div className="text-[16px] font-medium text-text">{e.etapa} · {ETAPA[e.etapa].titulo}</div>
                  <div className="text-[13px] text-text-muted">{ETAPA[e.etapa].para}</div>
                </div>
                <div className="flex flex-wrap gap-x-7 gap-y-2 text-[13px] text-text-muted">
                  <div><div className="text-[18px] tabular-nums text-text">{num(e.angulos)}</div>ángulos · {num(e.funcionando)} funcionando</div>
                  <div><div className="text-[18px] tabular-nums text-text">{num(e.views)}</div>views en {num(e.reels)} reels</div>
                  <div><div className="text-[18px] tabular-nums text-text">{num(e.agendas)}</div>agendas</div>
                  <div><div className="text-[18px] tabular-nums text-text">{num(e.ventas)}</div>ventas</div>
                  <div><div className="text-[18px] tabular-nums text-text">{usd(e.cash)}</div>cobrado</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[13px] text-text-disabled">
          Los números salen solos: los views, de los reels de Instagram que tienen las palabras clave del ángulo; las agendas, ventas y lo cobrado, de los leads que tienen
          esas palabras en sus etiquetas de ManyChat. Una misma venta puede aparecer en más de una etapa si el lead tocó ángulos de las dos.
        </p>
      </Seccion>

      <Seccion eyebrow="Ranking" titulo={`Los ángulos que más están funcionando · ${num(activos.length)}`}>
        {activos.length ? (
          <div className="card overflow-x-auto !p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ángulo</th>
                  <th>Etapa</th>
                  <th>¿Funciona?</th>
                  <th className="num">Reels</th>
                  <th className="num">Views</th>
                  <th className="num">Coment.</th>
                  <th className="num">Agendas</th>
                  <th className="num">Ventas</th>
                  <th className="num">Cobrado</th>
                  <th>De dónde sale</th>
                </tr>
              </thead>
              <tbody>
                {activos.map((a, i) => {
                  const c = cruce.get(a.id);
                  return (
                    <tr key={a.id} className="align-top">
                      <td className="text-text-disabled">{i + 1}</td>
                      <td className="min-w-[260px] max-w-[420px] whitespace-normal">
                        <div className="font-medium">{a.nombre}</div>
                        {(a.tipo || a.formato) && <div className="text-[12px] text-text-muted">{[a.tipo, a.formato].filter(Boolean).join(' · ')}</div>}
                        {a.hook && <div className="text-[13px] italic text-text-muted">{a.hook}</div>}
                        {a.resultado && <div className="text-[13px] text-text-muted">{a.resultado}</div>}
                        {c && c.quienes.length > 0 && <div className="text-[12px] text-text-disabled">Compraron: {c.quienes.join(', ')}</div>}
                        {a.url && <a className="text-[12px] text-[var(--accent)] hover:underline" href={a.url} target="_blank" rel="noopener noreferrer">Ver pieza ↗</a>}
                      </td>
                      <td><span className={`tag ${ETAPA[a.etapa].tag}`}>{a.etapa}</span></td>
                      <td><span className={`tag ${TAG_ESTADO[a.estado]}`}>{a.estado}</span></td>
                      <td className="num">{c?.reels ? num(c.reels) : '—'}</td>
                      <td className="num">{c?.reels ? num(c.views) : '—'}</td>
                      <td className="num">{c?.reels ? num(c.comentarios) : '—'}</td>
                      <td className="num">{c?.agendas ? num(c.agendas) : '—'}</td>
                      <td className="num">{c?.ventas ? num(c.ventas) : '—'}</td>
                      <td className="num">{c?.ventas ? usd(c.cash) : '—'}</td>
                      <td className="max-w-[180px] whitespace-normal text-[13px] text-text-muted">{a.fuente ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Vacio texto="Todavía no hay ángulos cargados." />}
        {descartados.length > 0 && (
          <p className="text-[13px] text-text-disabled">Descartados: {descartados.map((a) => `${a.nombre} (${a.etapa})`).join(' · ')}</p>
        )}
      </Seccion>

      {editor && (
        <Seccion eyebrow="Cargar y corregir" titulo="Editar ángulos">
          <details className="card">
            <summary className="cursor-pointer text-[15px] text-text">+ Nuevo ángulo</summary>
            <form method="POST" action="/api/angulos" className="mt-4 flex flex-col gap-4">
              <input type="hidden" name="accion" value="alta" />
              <CamposAngulo />
              <div className="flex justify-end"><button className="btn-primary" type="submit">Guardar ángulo</button></div>
            </form>
          </details>
          {ranking.map((a) => (
            <details key={a.id} className="card">
              <summary className="cursor-pointer text-[14px] text-text">
                <span className={`tag mr-2 ${ETAPA[a.etapa].tag}`}>{a.etapa}</span>{a.nombre}
                <span className="ml-2 text-text-disabled">· {a.estado}</span>
              </summary>
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
          ))}
        </Seccion>
      )}
    </>
  );
}
