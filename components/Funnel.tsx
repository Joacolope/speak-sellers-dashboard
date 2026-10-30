'use client';

import { useState } from 'react';
import type { NivelFunnel } from '@/lib/metrics';
import { num, pct, usd } from '@/lib/format';
import { NOMBRE_CLOSER, type Closer } from '@/lib/types';

const corto = (v: number | null) => (v === null ? '—' : v >= 1000 ? `$${(v / 1000).toFixed(1).replace('.', ',')}k` : usd(v));

/* Embudo estilizado: cada nivel es un trapecio que encastra con el siguiente.
   El ancho es fijo y decreciente (se lee la forma); el número manda.
   Relleno: Ember mezclado con la superficie, de 100 % a 45 %. */
const ANCHOS = [100, 91, 82, 73, 64, 56, 48];

export default function Funnel({ niveles, sinAviso = false }: { niveles: NivelFunnel[]; sinAviso?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      {niveles.map((n, i) => {
        const w = ANCHOS[i] ?? 30;
        const wNext = ANCHOS[i + 1] ?? w * 0.8;
        const inset = ((w - wNext) / 2 / w) * 100;
        const ultimo = i === niveles.length - 1;
        const mezcla = ultimo ? 100 : Math.round(100 - i * 13);
        const base = ultimo ? 'var(--green)' : 'var(--blue)';
        const anterior = niveles[i - 1];
        const conv = anterior && anterior.valor && n.valor !== null && !n.esUsd ? n.valor / anterior.valor : null;
        return (
          <div
            key={n.nombre}
            className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-center gap-5"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="flex justify-center">
              <div
                className="flex h-[52px] items-center justify-center"
                style={{
                  width: `${w}%`,
                  background: `color-mix(in srgb, ${base} ${mezcla}%, var(--surface))`,
                  clipPath: `polygon(0 0, 100% 0, ${100 - inset}% 100%, ${inset}% 100%)`,
                  borderRadius: 4,
                }}
              >
                <span className="metric !text-[24px]" style={{ color: mezcla >= 70 ? '#ffffff' : 'var(--text)' }}>
                  {n.esUsd ? corto(n.valor) : num(n.valor)}
                </span>
              </div>
            </div>
            <div className="relative flex items-center gap-2">
              <span className="dot shrink-0" style={{ background: `color-mix(in srgb, ${base} ${mezcla}%, var(--surface))` }} />
              <span className="text-[14px] text-text">{n.nombre}</span>
              {conv !== null && <span className="text-[13px] text-text-disabled">{pct(conv)}</span>}
              {n.esUsd && <span className="text-[13px] text-text-disabled">{usd(n.valor)}</span>}
              {hover === i && n.porCloser && (
                <div className="absolute left-4 top-full z-10 mt-1 whitespace-nowrap rounded-xl border border-border bg-surface px-3 py-2 text-[13px]">
                  {Object.entries(n.porCloser).map(([c, v]) => (
                    <div key={c} className="flex justify-between gap-6">
                      <span className="text-text-muted">{NOMBRE_CLOSER[c as Closer] ?? c}</span>
                      <span className="tabular-nums text-text">{n.esUsd ? usd(v) : num(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {!sinAviso && niveles.some((n) => n.valor === null) && (
        <div className="mt-2 text-[13px] text-text-disabled">
          {niveles[0].nombre === 'Registrados'
            ? 'Registrados, calificados y asistentes de cada webinar se cargan en "Cargar" (o dictándoselos a Claude).'
            : 'Conversaciones sin dato para esta fuente: se cargan desde el setter, Instagram o Meta.'}
        </div>
      )}
    </div>
  );
}

/** Embudo con botones para cambiar de fuente: General, Orgánico, Follow Me Ads, Webinar, Lead magnet. */
export function EmbudoPorFuente({ embudos }: { embudos: { clave: string; nombre: string; niveles: NivelFunnel[] }[] }) {
  const [activa, setActiva] = useState(embudos[0]?.clave ?? 'general');
  const actual = embudos.find((e) => e.clave === activa) ?? embudos[0];
  const sinDatos = actual.niveles.every((n) => !n.valor);
  return (
    <div className="flex flex-col gap-4" data-fuente={actual.clave}>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Fuente del embudo">
        {embudos.map((e) => (
          <button
            key={e.clave}
            type="button"
            role="tab"
            aria-selected={e.clave === activa}
            className="chip !px-3 !py-1 !text-[13px]"
            data-active={e.clave === activa}
            onClick={() => setActiva(e.clave)}
          >
            {e.nombre}
          </button>
        ))}
      </div>
      {sinDatos ? (
        <div className="rounded-xl bg-[var(--surface-2)] p-6 text-center text-[14px] text-text-muted">
          Sin agendas de {actual.nombre} este período. Los leads se clasifican por funnel al cargarlos o desde el agente diario.
        </div>
      ) : (
        <>
          <Funnel niveles={actual.niveles} sinAviso={actual.clave === 'YouTube'} />
          {actual.clave === 'YouTube' && (
            <div className="-mt-2 text-[13px] text-text-disabled">YouTube todavía no tiene fuente de conversaciones: el embudo arranca en las agendas de leads que vinieron de YouTube.</div>
          )}
        </>
      )}
    </div>
  );
}
