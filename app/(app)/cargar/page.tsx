import { CLOSERS } from '@/lib/types';

export const dynamic = 'force-dynamic';

function Bloque({ titulo, tipo, children }: { titulo: string; tipo: string; children: React.ReactNode }) {
  return (
    <form method="POST" action="/api/cargar" className="card flex flex-col gap-4">
      <div className="eyebrow">{titulo}</div>
      <input type="hidden" name="tipo" value={tipo} />
      {children}
      <label className="flex flex-col gap-2 text-[14px] text-text-muted">
        PIN
        <input className="input" name="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required />
      </label>
      <button className="btn-primary" type="submit">Guardar</button>
    </form>
  );
}

const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-2 text-[14px] text-text-muted">{label}{children}</label>
);

export default function Cargar({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  return (
    <>
      <div>
        <div className="eyebrow">Carga manual</div>
        <h1 className="h1 mt-2">Cargar a mano</h1>
        <p className="mt-2 max-w-2xl text-[14px] text-text-muted">
          Respaldo del dictado a Claude. Todo lo que se guarda acá queda con <span className="mono text-[12px]">source = manual</span> y el cron nunca lo pisa.
          Se busca el lead por nombre; si hay más de uno, hay que pasar el nombre completo.
        </p>
        {searchParams.ok && <div className="ok mt-3 text-[14px]">Guardado: {searchParams.ok}</div>}
        {searchParams.error && <div className="bad mt-3 text-[14px]">{searchParams.error}</div>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Bloque titulo="Venta" tipo="venta">
          <Campo label="Nombre del lead"><input className="input" name="nombre" required /></Campo>
          <Campo label="Compró">
            <select className="input" name="compro" defaultValue="Si">
              <option>Si</option><option>Reserva</option><option>No</option>
            </select>
          </Campo>
          <Campo label="Método">
            <select className="input" name="metodo_pago" defaultValue="PIF">
              <option>PIF</option><option>Cuotas</option><option>Reserva</option>
            </select>
          </Campo>
          <Campo label="Cash collected (USD)"><input className="input" name="cash_collected" type="number" step="0.01" /></Campo>
          <Campo label="Revenue (USD)"><input className="input" name="revenue" type="number" step="0.01" /></Campo>
          <Campo label="Producto"><input className="input" name="producto" defaultValue="Speak Sellers" /></Campo>
        </Bloque>

        <Bloque titulo="Cobranza" tipo="cobranza">
          <Campo label="Nombre del lead"><input className="input" name="nombre" required /></Campo>
          <Campo label="Fecha de cobro"><input className="input" name="fecha_cobro" type="date" required /></Campo>
          <Campo label="Monto cobrado (USD, negativo si es reembolso)"><input className="input" name="monto_cobrado" type="number" step="0.01" required /></Campo>
          <Campo label="Pendiente (USD)"><input className="input" name="pendiente" type="number" step="0.01" /></Campo>
          <Campo label="Cuotas restantes"><input className="input" name="cuotas_restantes" type="number" /></Campo>
          <Campo label="Próximo vencimiento"><input className="input" name="proximo_vencimiento" type="date" /></Campo>
        </Bloque>

        <Bloque titulo="Asistencia" tipo="asistencia">
          <Campo label="Nombre del lead"><input className="input" name="nombre" required /></Campo>
          <Campo label="¿Asistió?">
            <select className="input" name="asistio" defaultValue="Asistió">
              <option>Asistió</option><option>No show</option><option>Canceló</option><option>Pendiente</option>
            </select>
          </Campo>
          <Campo label="Oferta hecha">
            <select className="input" name="oferta_hecha" defaultValue="">
              <option value="">—</option><option value="true">Sí</option><option value="false">No</option>
            </select>
          </Campo>
          <Campo label="Cualificación económica (1–10)"><input className="input" name="cualificacion_economica" type="number" min="1" max="10" /></Campo>
          <Campo label="Closer (si hay que corregirlo)">
            <select className="input" name="closer" defaultValue="">
              <option value="">—</option>{CLOSERS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Campo>
        </Bloque>
      </div>
    </>
  );
}
