'use client';

import { useState } from 'react';
import type { NivelFunnel } from '@/lib/metrics';
import { num, pct, usd } from '@/lib/format';

const corto = (v: number | null) => (v === null ? '—' : v >= 1000 ? `$${(v / 1000).toFixed(1).replace('.', ',')}k` : usd(v));

/* Embudo estilizado: cada nivel es un trapecio que encastra con el siguiente.
   El ancho es fijo y decreciente (se lee la forma); el número manda.
   Relleno: Ember mezclado con la superficie, de 100 % a 45 %. */
const ANCHOS = [100, 89, 78, 67, 57, 48];

export default function Funnel({ niveles }: { niveles: NivelFunnel[] }) {
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
            className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-center gap-4"
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
                      <span className="text-text-muted">{c}</span>
                      <span className="tabular-nums text-text">{n.esUsd ? usd(v) : num(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {niveles[0].valor === null && (
        <div className="mt-2 text-[13px] text-text-disabled">Conversaciones sin fuente este mes: falta el weekly del setter o la mensajería de Instagram.</div>
      )}
    </div>
  );
}
