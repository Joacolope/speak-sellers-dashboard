import { Seccion } from '@/components/ui';
import { num, usd } from '@/lib/format';
import { cruzarAngulos, ordenarAngulos, type CruceAngulo } from '@/lib/angulos';
import { ESTADOS_ANGULO, ETAPAS, type Angulo, type Etapa, type RawBundle } from '@/lib/types';

const DESC_ETAPA: Record<Etapa, string> = {
  TOFU: 'Atraer: gente que todavía no te conoce',
  MOFU: 'Educar y generar confianza: ya te siguen',
  BOFU: 'Vender: llevar a la agenda o a la compra',
};
const TAG_ESTADO = { Funcionando: 'tag-green', Probando: 'tag-yellow', Descartado: 'tag-gray' } as const;
const TIPOS = ['Problema', 'Solución', 'Prueba social', 'Oferta', 'Objeción', 'Identidad', 'Autoridad', 'Historia personal'];
const FORMATOS = ['Reel', 'Historia', 'Anuncio', 'Carrusel', 'Post', 'DM', 'Webinar', 'YouTube'];

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
      <Campo label="Ángulo" ancho><input className="input" name="nombre" required defaultValue={a?.nombre} placeholder="Ej.: Cobrar el precio al principio de la llamada" /></Campo>
      <Campo label="Etapa">
        <select className="input" name="etapa" defaultValue={a?.etapa ?? 'TOFU'}>{ETAPAS.map((e) => <option key={e} value={e}>{e}</option>)}</select>
      </Campo>
      <Campo label="Estado">
        <select className="input" name="estado" defaultValue={a?.estado ?? 'Probando'}>{ESTADOS_ANGULO.map((e) => <option key={e} value={e}>{e}</option>)}</select>
      </Campo>
      <Campo label="Tipo">
        <input className="input" name="tipo" list="tipos-angulo" defaultValue={a?.tipo ?? ''} placeholder="Problema, Solución, Objeción…" />
      </Campo>
      <Campo label="Formato">
        <input className="input" name="formato" list="formatos-angulo" defaultValue={a?.formato ?? ''} placeholder="Reel, Historia, Anuncio…" />
      </Campo>
      <Campo label="Hook / frase" ancho><input className="input" name="hook" defaultValue={a?.hook ?? ''} placeholder="La frase con la que abre" /></Campo>
      <Campo label="Por qué funciona (evidencia)" ancho><input className="input" name="resultado" defaultValue={a?.resultado ?? ''} placeholder="Ej.: 170 comentarios, 3 agendas en 2 días" /></Campo>
      <Campo label="Link a la pieza"><input className="input" name="url" type="url" defaultValue={a?.url ?? ''} placeholder="https://www.instagram.com/reel/…" /></Campo>
      <Campo label="Palabras clave" ayuda="Separadas por coma. Se cruzan con las etiquetas de ManyChat y los títulos de los reels.">
        <input className="input" name="palabras_clave" defaultValue={a?.palabras_clave.join(', ') ?? ''} placeholder="precio al principio, cta info" />
      </Campo>
      <Campo label="Notas" ancho><input className="input" name="notas" defaultValue={a?.notas ?? ''} /></Campo>
    </div>
  );
}

function Tarjeta({ a, c, editor }: { a: Angulo; c?: CruceAngulo; editor: boolean }) {
  const conCruce = c && (c.ventas > 0 || c.reels > 0);
  return (
    <div className={`card flex flex-col gap-3 ${a.estado === 'Descartado' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[15px] font-medium leading-snug text-text">{a.nombre}</div>
        <span className={`tag shrink-0 ${TAG_ESTADO[a.estado]}`}>{a.estado}</span>
      </div>
      {(a.tipo || a.formato) && <div className="text-[12px] text-text-muted">{[a.tipo, a.formato].filter(Boolean).join(' · ')}</div>}
      {a.hook && <div className="text-[14px] italic text-text-muted">{a.hook}</div>}
      {a.resultado && <div className="text-[13px] text-text">{a.resultado}</div>}
      {conCruce && (
        <div className="flex flex-col gap-1 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-[13px]">
          {c!.ventas > 0 && <div title={c!.quienes.join(', ')}><span className="font-medium text-text">{num(c!.ventas)} venta{c!.ventas === 1 ? '' : 's'}</span> · {usd(c!.cash)} cobrados <span className="text-text-disabled">· {c!.quienes.slice(0, 3).join(', ')}{c!.quienes.length > 3 ? '…' : ''}</span></div>}
          {c!.reels > 0 && <div className="text-text-muted">{num(c!.reels)} reel{c!.reels === 1 ? '' : 's'} · {num(c!.views)} views · {num(c!.comentarios)} comentarios{c!.seguidores ? ` · ${num(c!.seguidores)} seguidores` : ''}</div>}
        </div>
      )}
      {a.palabras_clave.length > 0 && !conCruce && <div className="text-[12px] text-text-disabled">Sin ventas ni reels con: {a.palabras_clave.join(', ')}</div>}
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        {a.url && <a className="text-[var(--accent)] hover:underline" href={a.url} target="_blank" rel="noopener noreferrer">Ver pieza ↗</a>}
        {a.notas && <span className="text-text-disabled">{a.notas}</span>}
      </div>
      {editor && (
        <details className="text-[13px]">
          <summary className="cursor-pointer text-text-muted hover:text-text">Editar</summary>
          <form method="POST" action="/api/angulos" className="mt-3 flex flex-col gap-3">
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
    </div>
  );
}

/** Sección de ángulos de comunicación (va dentro de Contacto, junto a la trazabilidad de las ventas). */
export default function Angulos({ bundle, editor, ok, error }: { bundle: RawBundle; editor: boolean; ok?: string | null; error?: string | null }) {
  const cruce = cruzarAngulos(bundle);
  const funcionando = bundle.angulos.filter((a) => a.estado === 'Funcionando').length;

  return (
    <div id="angulos" className="flex scroll-mt-24 flex-col gap-6">
      <datalist id="tipos-angulo">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist>
      <datalist id="formatos-angulo">{FORMATOS.map((t) => <option key={t} value={t} />)}</datalist>

      <Seccion eyebrow="Ángulos de comunicación" titulo={`${num(bundle.angulos.length)} ángulos · ${num(funcionando)} funcionando`}>
        <p className="-mt-2 max-w-3xl text-[14px] text-text-muted">
          Qué mensaje usamos en cada etapa del embudo y si está funcionando. Con palabras clave se cruza solo con las etiquetas de ManyChat de los que compraron y con los reels.
        </p>
        {ok && <div className="ok text-[14px]">{ok}</div>}
        {error && <div className="bad text-[14px]">{error}</div>}
        <div className="grid gap-5 lg:grid-cols-3">
          {ETAPAS.map((etapa) => {
            const lista = ordenarAngulos(bundle.angulos.filter((a) => a.etapa === etapa), cruce);
            return (
              <div key={etapa} className="flex flex-col gap-4">
                <div>
                  <div className="h3">{etapa}</div>
                  <div className="text-[13px] text-text-disabled">{DESC_ETAPA[etapa]}</div>
                </div>
                {lista.length
                  ? lista.map((a) => <Tarjeta key={a.id} a={a} c={cruce.get(a.id)} editor={editor} />)
                  : <div className="card text-[14px] text-text-disabled">Todavía no hay ángulos {etapa}.</div>}
              </div>
            );
          })}
        </div>
        {editor && (
          <details className="card">
            <summary className="cursor-pointer text-[15px] text-text">+ Nuevo ángulo</summary>
            <form method="POST" action="/api/angulos" className="mt-4 flex flex-col gap-4">
              <input type="hidden" name="accion" value="alta" />
              <CamposAngulo />
              <div className="flex justify-end"><button className="btn-primary" type="submit">Guardar ángulo</button></div>
            </form>
          </details>
        )}
      </Seccion>
    </div>
  );
}
