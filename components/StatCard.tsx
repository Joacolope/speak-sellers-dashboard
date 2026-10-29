import type { ReactNode } from 'react';
import { Variacion } from './ui';

interface Props {
  /** Contra qué se compara (\"mes anterior\", \"1–29 sep\", \"día anterior\") */
  contra?: string;
  label: string;
  valor: string;
  variacion: number | null;
  icono: ReactNode;
  nota?: string;
  /** Para costos: bajar es bueno (verde). */
  invertir?: boolean;
  color?: 'blue' | 'green' | 'red' | 'yellow';
}

export default function StatCard({ label, valor, variacion, icono, nota, invertir, color = 'blue', contra }: Props) {
  return (
    <div className="card flex flex-col gap-3 !p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="card-title !text-[14px]">{label}</span>
        <span className={`icon-badge icon-${color} !h-8 !w-8`} aria-hidden>{icono}</span>
      </div>
      <div className="metric">{valor}</div>
      {nota ? <div className="text-[13px] text-text-disabled">{nota}</div> : <Variacion v={variacion} invertir={invertir} contra={contra} />}
    </div>
  );
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const Iconos = {
  revenue: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  cash: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>,
  ventas: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M20 6 9 17l-5-5" /></svg>,
  agendas: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  asistencia: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  margen: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6.5 6.2" /></svg>,
  ads: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z" /><path d="M16 9a4 4 0 0 1 0 6" /></svg>,
  tendencia: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>,
  globo: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>,
  embudo: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M3 4h18l-7 8v6l-4 2v-8z" /></svg>,
  cierre: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></svg>,
};
