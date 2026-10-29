import { redirect } from 'next/navigation';
import { CLOSERS, NOMBRE_CLOSER, PLATAFORMAS } from '@/lib/types';
import { hoyAR } from '@/lib/format';
import { getSesion, puede } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function Bloque({ titulo, cuando, boton, tipo, children }: { titulo: string; cuando: string; boton: string; tipo: string; children: React.ReactNode }) {
  return (
    <form method="POST" action="/api/cargar" className="card flex flex-col gap-5">
      <div>
        <h2 className="card-title">{titulo}</h2>
        <p className="card-sub mt-1">{cuando}</p>
      </div>
      <input type="hidden" name="tipo" value={tipo} />
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      <div className="mt-auto flex justify-end pt-1">
        <button className="btn-primary" type="submit">{boton}</button>
      </div>
    </form>
  );
}

const Campo = ({ label, ayuda, ancho = false, children }: { label: string; ayuda?: string; ancho?: boolean; children: React.ReactNode }) => (
  <label className={`flex flex-col gap-1.5 text-[13px] text-text-muted ${ancho ? 'sm:col-span-2' : ''}`}>
    <span>{label}</span>
    {children}
    {ayuda && <span className="text-[12px] text-text-disabled">{ayuda}</span>}
  </label>
);

const OPC_PLATAFORMA = PLATAFORMAS.map((p) => <option key={p}>{p}</option>);

export default async function Cargar({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const sesion = await getSesion();
  if (!puede(sesion, 'editor')) redirect('/');
  const hoy = hoyAR();
  return (
    <>
      <div>
        <div className="eyebrow">Cargar</div>
        <h1 className="h1 mt-2">Cargar datos</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-text-muted">
          Elegí qué pasó y completá solo lo que sepas. El lead se busca por nombre: si hay dos con el mismo, escribí el nombre completo.
          Lo que cargues acá no lo pisa la actualización automática.
        </p>
        {searchParams.ok && <div className="ok mt-3 text-[14px]">Guardado: {searchParams.ok}</div>}
        {searchParams.error && <div className="bad mt-3 text-[14px]">{searchParams.error}</div>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloque titulo="Nueva venta" cuando="Cuando alguien compra o deja una seña en la llamada." boton="Guardar venta" tipo="venta">
          <Campo label="Nombre del lead" ancho><input className="input" name="nombre" required placeholder="Ej.: Juan Pérez" /></Campo>
          <Campo label="¿Qué pasó?">
            <select className="input" name="compro" defaultValue="Si">
              <option value="Si">Compró</option><option value="Reserva">Dejó una seña</option><option value="No">No compró</option>
            </select>
          </Campo>
          <Campo label="Forma de pago">
            <select className="input" name="metodo_pago" defaultValue="PIF">
              <option value="PIF">Pago completo</option><option value="Cuotas">En cuotas</option><option value="Reserva">Seña</option>
            </select>
          </Campo>
          <Campo label="Cobrado hoy (USD)" ayuda="Lo que entró en este pago."><input className="input" name="cash_collected" type="number" step="0.01" inputMode="decimal" placeholder="0" /></Campo>
          <Campo label="Valor total de la venta (USD)" ayuda="Si es en cuotas, lo que falta queda como pendiente."><input className="input" name="revenue" type="number" step="0.01" inputMode="decimal" placeholder="0" /></Campo>
          <Campo label="Plataforma de cobro"><select className="input" name="plataforma" defaultValue="Stripe">{OPC_PLATAFORMA}</select></Campo>
          <Campo label="Producto"><input className="input" name="producto" defaultValue="Speak Sellers" /></Campo>
        </Bloque>

        <Bloque titulo="Cobro de cuota o reembolso" cuando="Cuando entra una cuota de una venta anterior, o se devuelve plata." boton="Guardar cobro" tipo="cobranza">
          <Campo label="Nombre del lead" ancho><input className="input" name="nombre" required placeholder="Ej.: Juan Pérez" /></Campo>
          <Campo label="Fecha del cobro"><input className="input" name="fecha_cobro" type="date" required defaultValue={hoy} /></Campo>
          <Campo label="Monto (USD)" ayuda="Para un reembolso, en negativo: -500."><input className="input" name="monto_cobrado" type="number" step="0.01" inputMode="decimal" required placeholder="0" /></Campo>
          <Campo label="Plataforma de cobro"><select className="input" name="plataforma" defaultValue="Stripe">{OPC_PLATAFORMA}</select></Campo>
          <Campo label="Cuánto falta pagar (USD)"><input className="input" name="pendiente" type="number" step="0.01" inputMode="decimal" placeholder="0" /></Campo>
          <Campo label="Cuotas que faltan"><input className="input" name="cuotas_restantes" type="number" min="0" inputMode="numeric" placeholder="0" /></Campo>
          <Campo label="Vence la próxima"><input className="input" name="proximo_vencimiento" type="date" /></Campo>
        </Bloque>

        <Bloque titulo="Resultado de una llamada" cuando="Si alguien no se presentó o canceló y no quedó marcado en GoHighLevel." boton="Guardar resultado" tipo="asistencia">
          <Campo label="Nombre del lead" ancho><input className="input" name="nombre" required placeholder="Ej.: Juan Pérez" /></Campo>
          <Campo label="¿Se presentó?">
            <select className="input" name="asistio" defaultValue="Asistió">
              <option value="Asistió">Sí, se presentó</option><option value="No show">No se presentó</option><option value="Canceló">Canceló</option><option value="Pendiente">Todavía no fue</option>
            </select>
          </Campo>
          <Campo label="Closer" ayuda="Solo si quedó asignado al closer equivocado.">
            <select className="input" name="closer" defaultValue="">
              <option value="">Dejar como está</option>{CLOSERS.map((c) => <option key={c} value={c}>{NOMBRE_CLOSER[c]}</option>)}
            </select>
          </Campo>
        </Bloque>

        <Bloque titulo="Datos de un webinar" cuando="Después de cada webinar. Si el día ya estaba cargado, se corrige." boton="Guardar webinar" tipo="webinar">
          <Campo label="Fecha del webinar"><input className="input" name="fecha" type="date" required /></Campo>
          <Campo label="Nombre (opcional)"><input className="input" name="nombre_webinar" placeholder="Ej.: Webinar 4/10" /></Campo>
          <Campo label="Registrados"><input className="input" name="registrados" type="number" min="0" inputMode="numeric" placeholder="0" /></Campo>
          <Campo label="Registrados calificados" ayuda="Los que cumplen el perfil."><input className="input" name="registrados_calificados" type="number" min="0" inputMode="numeric" placeholder="0" /></Campo>
          <Campo label="Asistentes al vivo"><input className="input" name="asistentes" type="number" min="0" inputMode="numeric" placeholder="0" /></Campo>
        </Bloque>
      </div>
    </>
  );
}
