import type { Pendiente } from '@/lib/metrics';
import type { UltimaActualizacion } from '@/lib/types';
import { fechaHora } from '@/lib/format';

export default function Avisos({ pendientes, actualizaciones }: { pendientes: Pendiente[]; actualizaciones: UltimaActualizacion[] }) {
  const agente = pendientes.filter((p) => p.tipo === 'agente');
  const fuentes = pendientes.filter((p) => p.tipo === 'fuente');

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card">
        <div className="h3 mb-3">Pendientes del agente</div>
        {agente.length ? (
          <ul className="flex flex-col gap-2 text-[14px]">
            {agente.map((p) => <li key={p.texto} className="flex gap-2"><span className="warn">●</span><span>{p.texto}</span></li>)}
          </ul>
        ) : <div className="text-[14px] text-text-muted">Sin pendientes.</div>}
      </div>
      <div className="card">
        <div className="h3 mb-3">Última actualización</div>
        <ul className="flex flex-col gap-2 text-[14px]">
          {actualizaciones.map((u) => (
            <li key={u.fuente} className="flex justify-between gap-4">
              <span className="text-text-muted">{u.fuente}</span>
              <span className="flex items-center gap-2"><span className={u.ok ? 'ok' : 'bad'}>●</span>{u.ok ? fechaHora(u.fecha) : <span className="bad">no actualizó hoy</span>}</span>
            </li>
          ))}
        </ul>
        {fuentes.map((p) => <div key={p.texto} className="bad mt-2 text-[14px]">{p.texto}</div>)}
      </div>
    </div>
  );
}
