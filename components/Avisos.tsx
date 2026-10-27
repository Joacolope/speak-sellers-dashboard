import type { Pendiente } from '@/lib/metrics';
import type { UltimaActualizacion } from '@/lib/types';
import { fechaHora } from '@/lib/format';

export default function Avisos({ pendientes, actualizaciones }: { pendientes: Pendiente[]; actualizaciones: UltimaActualizacion[] }) {
  const cobranzas = pendientes.filter((p) => p.tipo === 'cobranza');
  const agente = pendientes.filter((p) => p.tipo === 'agente');
  const fuentes = pendientes.filter((p) => p.tipo === 'fuente');

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="card">
        <div className="h3 mb-3">Cobranzas pendientes esta semana</div>
        {cobranzas.length ? (
          <ul className="flex flex-col gap-2 text-[14px]">
            {cobranzas.map((p) => <li key={p.texto}>{p.texto}</li>)}
          </ul>
        ) : <div className="text-[14px] text-text-muted">Nada por cobrar esta semana.</div>}
      </div>
      <div className="card">
        <div className="h3 mb-3">Pendientes del agente</div>
        {agente.length ? (
          <ul className="flex flex-col gap-2 text-[14px]">
            {agente.map((p) => <li key={p.texto}><span className="mr-2 text-accent">◐</span>{p.texto}</li>)}
          </ul>
        ) : <div className="text-[14px] text-text-muted">Sin pendientes.</div>}
      </div>
      <div className="card">
        <div className="h3 mb-3">Última actualización</div>
        <ul className="flex flex-col gap-2 text-[14px]">
          {actualizaciones.map((u) => (
            <li key={u.fuente} className="flex justify-between gap-4">
              <span className="text-text-muted">{u.fuente}</span>
              <span className={u.ok ? '' : 'bad'}>{u.ok ? fechaHora(u.fecha) : 'no actualizó hoy'}</span>
            </li>
          ))}
        </ul>
        {fuentes.map((p) => <div key={p.texto} className="bad mt-2 text-[14px]">{p.texto}</div>)}
      </div>
    </div>
  );
}
