import { redirect } from 'next/navigation';
import { CLOSERS, PLATAFORMAS } from '@/lib/types';
import { getSesion, puede } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function Bloque({ titulo, tipo, children }: { titulo: string; tipo: string; children: React.ReactNode }) {
  return (
    <form method="POST" action="/api/cargar" className="card flex flex-col gap-4">
      <div className="eyebrow">{titulo}</div>
      <input type="hidden" name="tipo" value={tipo} />
      {children}
      <button className="btn-primary" type="submit">Guardar</button>
    </form>
  );
}

const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-2 text-[14px] text-text-muted">{label}{children}</label>
);

export default async function Cargar({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const sesion = await getSesion();
  if (!puede(sesion, 'editor')) redirect('/');
  return (
    <>
      <div>
        <div className="eyebrow">Carga manual</div>
        <h1 className="h1 mt-2">Cargar a mano</h1>
        <p className="mt-2 max-w-2xl text-[14px] text-text-muted">
          Respaldo del dictado a Claude. Todo lo que se guarda acá queda como carga manual, con tu email, y el cron nunca lo pisa.
          Se busca el lead por nombre; si hay más de uno, hay que pasar el nombre completo.
        </p>
        {searchParams.ok && <div className="ok mt-3 text-[14px]">Guardado: {searchParams.ok}</div>}
        {searchParams.error && <div className="bad mt-3 text-[14px]">{searchParams.error}</div>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
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
          <Campo label="Cobrado hoy (USD)"><input className="input" name="cash_collected" type="number" step="0.01" /></Campo>
          <Campo label="Valor total de la venta (USD)"><input className="input" name="revenue" type="number" step="0.01" /></Campo>
          <Campo label="Producto"><input className="input" name="producto" defaultValue="Speak Sellers" /></Campo>
          <Campo label="Plataforma de cobro">
            <select className="input" name="plataforma" defaultValue="Stripe">{PLATAFORMAS.map((p) => <option key={p}>{p}</option>)}</select>
          </Campo>
        </Bloque>

        <Bloque titulo="Cobranza" tipo="cobranza">
          <Campo label="Nombre del lead"><input className="input" name="nombre" required /></Campo>
          <Campo label="Fecha de cobro"><input className="input" name="fecha_cobro" type="date" required /></Campo>
          <Campo label="Monto cobrado (USD, negativo si es reembolso)"><input className="input" name="monto_cobrado" type="number" step="0.01" required /></Campo>
          <Campo label="Pendiente (USD)"><input className="input" name="pendiente" type="number" step="0.01" /></Campo>
          <Campo label="Cuotas restantes"><input className="input" name="cuotas_restantes" type="number" /></Campo>
          <Campo label="Próximo vencimiento"><input className="input" name="proximo_vencimiento" type="date" /></Campo>
          <Campo label="Plataforma de cobro">
            <select className="input" name="plataforma" defaultValue="Stripe">{PLATAFORMAS.map((p) => <option key={p}>{p}</option>)}</select>
          </Campo>
        </Bloque>

        <Bloque titulo="Asistencia" tipo="asistencia">
          <Campo label="Nombre del lead"><input className="input" name="nombre" required /></Campo>
          <Campo label="¿Asistió?">
            <select className="input" name="asistio" defaultValue="Asistió">
              <option>Asistió</option><option>No show</option><option>Canceló</option><option>Pendiente</option>
            </select>
          </Campo>
          <Campo label="Closer (si hay que corregirlo)">
            <select className="input" name="closer" defaultValue="">
              <option value="">—</option>{CLOSERS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Campo>
        </Bloque>
        <Bloque titulo="Webinar" tipo="webinar">
          <Campo label="Fecha del webinar"><input className="input" name="fecha" type="date" required /></Campo>
          <Campo label="Nombre (opcional)"><input className="input" name="nombre_webinar" placeholder="Ej.: Webinar 4/10" /></Campo>
          <Campo label="Registrados"><input className="input" name="registrados" type="number" min="0" /></Campo>
          <Campo label="Registrados calificados"><input className="input" name="registrados_calificados" type="number" min="0" /></Campo>
          <Campo label="Asistentes"><input className="input" name="asistentes" type="number" min="0" /></Campo>
        </Bloque>
      </div>
    </>
  );
}
