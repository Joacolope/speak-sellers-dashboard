/** Se muestra al instante al cambiar de sección, mientras llegan los datos (el clic se siente inmediato). */
export default function Cargando() {
  const bloque = 'animate-pulse rounded-xl bg-[var(--surface)] border border-border';
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Cargando">
      <div className="flex flex-col gap-4">
        <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="h-10 w-72 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className={`${bloque} h-[104px]`} />
      </div>
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className={`${bloque} h-[168px]`} />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => <div key={i} className={`${bloque} h-[260px]`} />)}
      </div>
    </div>
  );
}
