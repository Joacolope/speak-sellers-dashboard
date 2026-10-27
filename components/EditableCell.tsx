'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Opcion = { value: string; label: string };

interface Props {
  agendaId: string;
  campo: string;
  valor: string | number | null | undefined;
  tipo: 'select' | 'number' | 'text';
  opciones?: Opcion[];
  mostrar?: string;
  demo?: boolean;
}

/** Celda editable: click → dropdown o número; escribe a Supabase con source = manual. */
export default function EditableCell({ agendaId, campo, valor, tipo, opciones, mostrar, demo }: Props) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (nuevo: string) => {
    setGuardando(true);
    setError(null);
    const body: Record<string, unknown> = {};
    body[campo] = tipo === 'number' ? (nuevo === '' ? null : Number(nuevo)) : nuevo === '' ? null : nuevo;
    const res = await fetch(`/api/agendas/${agendaId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setGuardando(false);
    setEditando(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'No se pudo guardar');
      return;
    }
    router.refresh();
  };

  if (!editando) {
    return (
      <span
        role="button"
        tabIndex={0}
        className="block -mx-2 px-2 cursor-pointer rounded-[4px] hover:outline hover:outline-1 hover:outline-border-outline"
        title={demo ? 'Modo demo: conectá Supabase para editar' : 'Click para editar'}
        onClick={() => setEditando(true)}
        onKeyDown={(e) => e.key === 'Enter' && setEditando(true)}
      >
        {mostrar ?? (valor === null || valor === undefined || valor === '' ? <span className="text-text-disabled">—</span> : String(valor))}
        {error && <span className="bad ml-2 text-[12px]">{error}</span>}
      </span>
    );
  }

  if (tipo === 'select') {
    return (
      <select
        autoFocus
        className="input !w-auto !py-1"
        defaultValue={valor === null || valor === undefined ? '' : String(valor)}
        disabled={guardando}
        onBlur={() => setEditando(false)}
        onChange={(e) => guardar(e.target.value)}
      >
        <option value="">—</option>
        {opciones?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  return (
    <input
      autoFocus
      className="input !w-28 !py-1"
      type={tipo}
      defaultValue={valor === null || valor === undefined ? '' : String(valor)}
      disabled={guardando}
      onBlur={(e) => (e.target.value !== String(valor ?? '') ? guardar(e.target.value) : setEditando(false))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setEditando(false);
      }}
    />
  );
}
