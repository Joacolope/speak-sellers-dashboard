import { CLIENTE, CONTACTO, EMPRESA, EYEBROW, TITULO } from '@/lib/cliente';

export const metadata = { title: `Condiciones del servicio · ${TITULO}` };

export default function Terminos() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-16 text-[15px] leading-relaxed text-text-muted">
      <div className="eyebrow">{EYEBROW}</div>
      <h1 className="h1 text-text">Condiciones del servicio</h1>
      <p>{TITULO} es de uso interno de {CLIENTE.nombre}{EMPRESA !== CLIENTE.nombre ? ` (${EMPRESA})` : ''}. Solo pueden ingresar las personas autorizadas por un administrador.</p>
      <p>La información que se ve es confidencial y no se puede compartir fuera del equipo. El acceso se puede quitar en cualquier momento.</p>
      {CONTACTO && <p>Consultas: {CONTACTO}.</p>}
      <p className="text-[13px] text-text-disabled">Última actualización: noviembre de 2026.</p>
    </main>
  );
}
