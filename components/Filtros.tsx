'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Filtros as F } from '@/lib/types';
import { CLOSERS, NOMBRE_CLOSER } from '@/lib/types';
import { diasDelMes, nombreMes } from '@/lib/format';

const FUENTES_FILTRO = ['Instagram', 'Webinar', 'WhatsApp', 'YouTube'] as const;

interface Props {
  filtros: F;
  meses: string[];
  mostrarCloser?: boolean;
  mostrarFuente?: boolean;
}

export default function Filtros({ filtros, meses, mostrarCloser = true, mostrarFuente = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (v === null) p.delete(k);
    else p.set(k, v);
    // Al cambiar de mes se vuelve al período por defecto (en el mes en curso: del 1 a hoy)
    if (k === 'mes') ['dia', 'desde', 'hasta', 'todo'].forEach((x) => p.delete(x));
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  /** Cambia el período: un día, un rango o el mes entero. */
  const periodo = (q: { dia?: string; desde?: string; hasta?: string; todo?: boolean }) => {
    const p = new URLSearchParams(sp.toString());
    ['dia', 'desde', 'hasta', 'todo'].forEach((x) => p.delete(x));
    if (q.dia) p.set('dia', q.dia);
    if (q.desde) p.set('desde', q.desde);
    if (q.hasta) p.set('hasta', q.hasta);
    if (q.todo) p.set('todo', '1');
    p.set('mes', filtros.mes);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const hoy = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  const primero = `${filtros.mes}-01`;
  const ultimo = diasDelMes(filtros.mes).slice(-1)[0];
  const esMesActual = hoy.startsWith(filtros.mes);
  const desde = filtros.dia ?? filtros.desde ?? primero;
  const hasta = filtros.dia ?? filtros.hasta ?? ultimo;
  const modo = filtros.dia ? (filtros.dia === hoy ? 'hoy' : 'dia') : filtros.rangoAuto ? 'mesHoy' : filtros.desde || filtros.hasta ? 'rango' : 'mes';

  return (
    <div className="flex flex-col gap-3 panel lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6">
      <div className="flex shrink-0 items-center gap-2">
        <span className="eyebrow mr-1 shrink-0">Mes</span>
        <select className="input !w-auto" value={filtros.mes} onChange={(e) => set('mes', e.target.value)}>
          {meses.map((m) => (
            <option key={m} value={m}>{nombreMes(m)}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1 shrink-0">Desde</span>
        <input type="date" className="input !w-auto" value={desde} min={primero} max={ultimo} aria-label="Desde"
          onChange={(e) => e.target.value && periodo({ desde: e.target.value, hasta: hasta < e.target.value ? e.target.value : hasta })} />
        <span className="eyebrow shrink-0">Hasta</span>
        <input type="date" className="input !w-auto" value={hasta} min={primero} max={ultimo} aria-label="Hasta"
          onChange={(e) => e.target.value && periodo({ desde: desde > e.target.value ? e.target.value : desde, hasta: e.target.value })} />
        <div className="flex flex-wrap gap-1.5">
          {esMesActual && <button type="button" className="chip" data-active={modo === 'hoy'} onClick={() => periodo({ dia: hoy })}>Hoy</button>}
          {esMesActual && <button type="button" className="chip" data-active={modo === 'mesHoy'} onClick={() => periodo({})} title="Del 1 a hoy (se actualiza solo)">Mes hasta hoy</button>}
          <button type="button" className="chip" data-active={modo === 'mes'} onClick={() => periodo(esMesActual ? { todo: true } : {})} title="Todo el mes, incluidas las llamadas que vienen">Mes completo</button>
        </div>
      </div>
      {mostrarCloser && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-1 shrink-0">Closer</span>
          <button type="button" className="chip" data-active={filtros.closer === 'todos'} onClick={() => set('closer', null)}>Todos</button>
          {CLOSERS.map((c) => (
            <button key={c} type="button" className="chip" data-active={filtros.closer === c} onClick={() => set('closer', c)}>{NOMBRE_CLOSER[c]}</button>
          ))}
        </div>
      )}
      {mostrarFuente && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-1 shrink-0">Fuente</span>
          <button type="button" className="chip" data-active={filtros.fuente === 'todas'} onClick={() => set('fuente', null)}>Todas</button>
          {FUENTES_FILTRO.map((f) => (
            <button key={f} type="button" className="chip" data-active={filtros.fuente === f} onClick={() => set('fuente', f)}>{f}</button>
          ))}
        </div>
      )}
    </div>
  );
}
