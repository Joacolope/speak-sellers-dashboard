'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Botón "Lo contacté hoy": anota la fecha del último seguimiento de un saldo pendiente. */
export default function MarcarContacto({ cobranzaId, hoy, demo }: { cobranzaId: string; hoy: string; demo?: boolean }) {
  const router = useRouter();
  const [estado, setEstado] = useState<'listo' | 'guardando' | 'error'>('listo');
  const marcar = async () => {
    if (demo) return;
    setEstado('guardando');
    const res = await fetch(`/api/cobranzas/${cobranzaId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ultimo_contacto: hoy }) });
    setEstado(res.ok ? 'listo' : 'error');
    if (res.ok) router.refresh();
  };
  return (
    <button type="button" onClick={marcar} disabled={estado === 'guardando'} className="chip whitespace-nowrap text-[12px]" title={demo ? 'Modo demo' : 'Anota que hoy se le escribió por el pago'}>
      {estado === 'guardando' ? 'Guardando…' : estado === 'error' ? 'No se guardó' : 'Lo contacté hoy'}
    </button>
  );
}
