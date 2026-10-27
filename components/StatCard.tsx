import type { ReactNode } from 'react';
import { Variacion } from './ui';

interface Props {
  label: string;
  valor: string;
  variacion: number | null;
  icono: ReactNode;
  nota?: string;
}

export default function StatCard({ label, valor, variacion, icono, nota }: Props) {
  return (
    <div className="card flex flex-col gap-3 !p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-text-muted">{label}</span>
        <span className="text-accent" aria-hidden>{icono}</span>
      </div>
      <div className="metric">{valor}</div>
      {nota ? <div className="text-[13px] text-text-disabled">{nota}</div> : <Variacion v={variacion} />}
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
  cierre: <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></svg>,
};
