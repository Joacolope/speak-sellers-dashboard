'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { num, pct, usd, fechaCorta } from '@/lib/format';

export interface DetalleCloser {
  closer: string;
  nombre: string;
  agendas: number;
  llamadas: number;
  pctShow: number | null;
  cierres: number;
  pctCierre: number | null;
  cash: number;
  comision: number | null;
  porcentaje: number | null;
  noShow: number;
  pendientes: number;
  ventas: { nombre: string; fecha: string; monto: number | null; estado: string }[];
  proximas: { nombre: string; fecha: string }[];
  href: string;
}

const claseSemaforo = (v: number | null, objetivo: number) => (v === null ? '' : v >= objetivo ? 'tag-green' : v >= objetivo * 0.85 ? 'tag-yellow' : 'tag-red');

/** Tabla de closers: clic en una fila despliega su detalle del período. */
export default function ClosersDesplegable({ filas }: { filas: DetalleCloser[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  return (
    <div className="-mx-3 overflow-x-auto">
      <table className="table [&_td]:!px-3 [&_th]:!px-3">
        <thead>
          <tr>
            <th>Closer</th>
            <th className="num">Agendas</th>
            <th className="num">% Show</th>
            <th className="num">Cierres</th>
            <th className="num">% Cierre</th>
            <th className="num">Cash</th>
            <th className="num">Comisión</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((c) => {
            const open = abierto === c.closer;
            return (
              <Fragment key={c.closer}>
                <tr
                  className="cursor-pointer"
                  onClick={() => setAbierto(open ? null : c.closer)}
                  aria-expanded={open}
                >
                  <td className="font-medium">{c.nombre}</td>
                  <td className="num">{num(c.agendas)}</td>
                  <td className="num"><span className={`tag ${claseSemaforo(c.pctShow, 0.6)}`}>{pct(c.pctShow)}</span></td>
                  <td className="num">{num(c.cierres)}</td>
                  <td className="num"><span className={`tag ${claseSemaforo(c.pctCierre, 0.3)}`}>{pct(c.pctCierre)}</span></td>
                  <td className="num ok">{usd(c.cash)}</td>
                  <td className="num">{c.comision === null ? <span className="text-text-disabled">—</span> : <span className={c.comision > 0 ? "bad" : "text-text-muted"}>{usd(c.comision)}</span>}</td>
                  <td className="num text-text-disabled">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="m6 9 6 6 6-6" /></svg>
                  </td>
                </tr>
                {open && (
                  <tr className="hover:!bg-transparent">
                    <td colSpan={8} className="!h-auto !whitespace-normal !bg-[var(--surface-2)] !py-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="flex flex-col gap-1.5 text-[13px]">
                          <div className="font-medium text-text">Resumen</div>
                          <div className="flex justify-between"><span className="text-text-muted">Llamadas hechas</span><span>{num(c.llamadas)}</span></div>
                          <div className="flex justify-between"><span className="text-text-muted">No show</span><span className={c.noShow ? 'bad' : ''}>{num(c.noShow)}</span></div>
                          <div className="flex justify-between"><span className="text-text-muted">Pendientes de marcar</span><span className={c.pendientes ? 'warn' : ''}>{num(c.pendientes)}</span></div>
                          <div className="flex justify-between"><span className="text-text-muted">Comisión</span><span>{c.porcentaje === null ? 'falta cargar %' : `${String(c.porcentaje).replace('.', ',')}% de lo cobrado`}</span></div>
                        </div>
                        <div className="flex flex-col gap-1.5 text-[13px]">
                          <div className="font-medium text-text">Ventas ({num(c.ventas.length)})</div>
                          {c.ventas.length ? c.ventas.slice(0, 6).map((v, i) => (
                            <div key={i} className="flex justify-between gap-3">
                              <span className="truncate text-text-muted">{fechaCorta(v.fecha)} · {v.nombre} {v.estado === 'Reserva' && <span className="warn">(reserva)</span>}</span>
                              <span className="ok">{v.monto === null ? '—' : usd(v.monto)}</span>
                            </div>
                          )) : <span className="text-text-disabled">Sin ventas en el período.</span>}
                        </div>
                        <div className="flex flex-col gap-1.5 text-[13px]">
                          <div className="font-medium text-text">Por marcar o próximas</div>
                          {c.proximas.length ? c.proximas.slice(0, 6).map((p, i) => (
                            <div key={i} className="flex justify-between gap-3">
                              <span className="truncate text-text-muted">{p.nombre}</span>
                              <span className="tag tag-yellow">{fechaCorta(p.fecha)}</span>
                            </div>
                          )) : <span className="text-text-disabled">Nada pendiente.</span>}
                          <Link href={c.href} className="link-ember mt-2 self-start text-[13px] text-text" onClick={(e) => e.stopPropagation()}>
                            Ver todas sus agendas →
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
