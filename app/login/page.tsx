import { rutaSegura } from '@/lib/auth';
import BotonGoogle from '@/components/BotonGoogle';

export const metadata = { title: 'Ingresar · Speak Sellers Dashboard' };
export const dynamic = 'force-dynamic';

const MENSAJES: Record<string, string> = {
  no_autorizado: 'Ese email no tiene acceso. Pedile a un administrador que lo agregue.',
  google: 'No se pudo completar el ingreso con Google. Probá de nuevo.',
};

export default function LoginPage({ searchParams }: { searchParams: { error?: string; next?: string; falta?: string; salio?: string } }) {
  const next = rutaSegura(searchParams.next);
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card flex w-full max-w-sm flex-col gap-6 !p-8">
        <div>
          <div className="eyebrow">Speak Sellers · Métricas</div>
          <h1 className="h2 mt-2">Speak Sellers Dashboard</h1>
          <p className="mt-2 text-[14px] text-text-muted">Ingresá con tu cuenta de Google autorizada.</p>
        </div>

        {searchParams.falta ? (
          <div className="tag tag-yellow !whitespace-normal !rounded-xl !py-2">
            La plataforma todavía no está conectada a la base de datos. Seguí los pasos de docs/PUESTA_EN_MARCHA.md.
          </div>
        ) : (
          <BotonGoogle next={next} />
        )}

        {searchParams.error && <div className="bad text-[14px]">{MENSAJES[searchParams.error] ?? 'No se pudo ingresar.'}</div>}
        {searchParams.salio && <div className="text-[14px] text-text-muted">Cerraste sesión.</div>}
      </div>
    </main>
  );
}
