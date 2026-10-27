'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Filtros as F } from '@/lib/types';
import { CLOSERS } from '@/lib/types';
import { nombreMes } from '@/lib/format';

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
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-3 panel md:flex-row md:items-center md:gap-6">
      <div className="flex shrink-0 items-center gap-2">
        <span className="eyebrow mr-1 shrink-0">Mes</span>
        <select className="input !w-auto" value={filtros.mes} onChange={(e) => set('mes', e.target.value)}>
          {meses.map((m) => (
            <option key={m} value={m}>{nombreMes(m)}</option>
          ))}
        </select>
      </div>
      {mostrarCloser && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-1 shrink-0">Closer</span>
          <button type="button" className="chip" data-active={filtros.closer === 'todos'} onClick={() => set('closer', null)}>Todos</button>
          {CLOSERS.map((c) => (
            <button key={c} type="button" className="chip" data-active={filtros.closer === c} onClick={() => set('closer', c)}>{c}</button>
          ))}
        </div>
      )}
      {mostrarFuente && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
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
