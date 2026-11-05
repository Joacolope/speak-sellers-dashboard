import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSesion, puede } from '@/lib/auth';
import { estadoConexiones, type Conexion, type Estado } from '@/lib/conexiones';
import { CLIENTE } from '@/lib/cliente';
import { DemoBanner } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Conexiones' };

const PUNTO: Record<Estado, { clase: string; texto: string }> = {
  ok: { clase: 'ok', texto: 'Conectado' },
  aviso: { clase: 'warn', texto: 'Revisar' },
  falta: { clase: 'bad', texto: 'Falta' },
  error: { clase: 'bad', texto: 'Con error' },
};

function Fila({ c }: { c: Conexion }) {
  const p = PUNTO[c.estado];
  const mostrarArreglo = c.estado !== 'ok' && c.arreglo;
  return (
    <li className="card flex flex-col gap-2 !p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className={`${p.clase} text-[13px]`} aria-hidden>●</span>
          <span className="text-[16px] font-medium text-text">{c.nombre}</span>
          {c.opcional && c.estado !== 'ok' && <span className="tag tag-gray !text-[11px]">opcional</span>}
        </div>
        <span className={`${p.clase} text-[13px] font-medium`}>{p.texto}</span>
      </div>
      <div className="text-[14px] leading-relaxed text-text-muted">{c.detalle}</div>
      {mostrarArreglo && (
        <div className="mt-1 rounded-xl bg-[var(--surface-2)] px-4 py-3 text-[14px] leading-relaxed text-text">
          <span className="font-medium">Cómo arreglarlo: </span>{c.arreglo}
        </div>
      )}
    </li>
  );
}

/** Solo admin: qué está conectado y qué falta, chequeado en vivo contra cada servicio. */
export default async function Conexiones() {
  const sesion = await getSesion();
  if (!puede(sesion, 'admin')) redirect('/');
  const conexiones = await estadoConexiones();
  const ok = conexiones.filter((c) => c.estado === 'ok').length;
  const obligatorias = conexiones.filter((c) => !c.opcional);
  const okObl = obligatorias.filter((c) => c.estado === 'ok').length;
  const pendientes = conexiones.filter((c) => c.estado !== 'ok');

  return (
    <>
      {sesion?.demo && <DemoBanner />}
      <div className="flex flex-col gap-3">
        <div className="eyebrow">Conexiones</div>
        <h1 className="h1">{ok === conexiones.length ? 'Todo conectado' : `${ok} de ${conexiones.length} conexiones en verde`}</h1>
        <p className="max-w-2xl text-[15px] text-text-muted">
          {okObl === obligatorias.length
            ? `Las ${obligatorias.length} conexiones necesarias de ${CLIENTE.nombre} están andando.`
            : `Faltan ${obligatorias.length - okObl} de las ${obligatorias.length} necesarias para que el dashboard se actualice solo.`}{' '}
          Cada fila se chequea en vivo al abrir esta página; recargá para volver a probar. Los pasos completos están en{' '}
          <code className="mono text-[13px]">docs/PUESTA_EN_MARCHA.md</code> y lo que tiene que dar el cliente en <code className="mono text-[13px]">docs/ACCESOS_CLIENTE.md</code>.
        </p>
      </div>

      {pendientes.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="eyebrow">Para resolver</div>
          <ul className="grid gap-3">{pendientes.map((c) => <Fila key={c.clave} c={c} />)}</ul>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="eyebrow">{pendientes.length ? 'Andando' : 'Detalle'}</div>
        <ul className="grid gap-3">{conexiones.filter((c) => c.estado === 'ok').map((c) => <Fila key={c.clave} c={c} />)}</ul>
      </section>

      <div className="text-[13px] text-text-disabled">
        Lo que no está acá (metas del mes, costos, comisiones) se carga desde el propio dashboard. <Link href="/" className="hover:text-text">Volver al inicio →</Link>
      </div>
    </>
  );
}
