'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

/** Torta monocroma: mismo azul con opacidad decreciente, nunca una paleta multicolor. */
export default function TortaFuente({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const ordenada = [...data].sort((a, b) => b.value - a.value);
  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={ordenada} dataKey="value" nameKey="name" innerRadius={56} outerRadius={96} stroke="var(--surface)" strokeWidth={2} paddingAngle={1}>
            {ordenada.map((d, i) => (
              <Cell key={d.name} fill="var(--accent)" fillOpacity={1 - i * 0.18} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-outline)', borderRadius: 8, fontSize: 14, color: 'var(--text)' }} itemStyle={{ color: 'var(--text)' }} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex flex-col gap-2 text-[14px]">
        {ordenada.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="dot" style={{ background: 'var(--accent)', opacity: 1 - i * 0.18 }} />
              {d.name}
            </span>
            <span className="tabular-nums text-text-muted">{d.value} · {((d.value / total) * 100).toFixed(1).replace('.', ',')}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
