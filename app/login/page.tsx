import Link from 'next/link';
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
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="card flex w-full max-w-md flex-col items-center gap-7 !p-10 text-center">
        <span className="icon-badge icon-blue !h-12 !w-12" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></svg>
        </span>
        <div className="flex flex-col items-center gap-2">
          <div className="eyebrow">Speak Sellers · Métricas</div>
          <h1 className="h2">Speak Sellers Dashboard</h1>
          <p className="max-w-xs text-[15px] leading-relaxed text-text-muted">Ingresá con tu cuenta de Google. Solo entran los mails autorizados del equipo.</p>
        </div>

        {searchParams.falta ? (
          <div className="w-full rounded-xl px-4 py-3 text-[14px]" style={{ background: 'var(--yellow-soft)', color: 'var(--yellow-ink)' }}>
            La plataforma todavía no está conectada a la base de datos.
          </div>
        ) : (
          <div className="w-full"><BotonGoogle next={next} /></div>
        )}

        {searchParams.error && <div className="bad text-[14px]">{MENSAJES[searchParams.error] ?? 'No se pudo ingresar.'}</div>}
        {searchParams.salio && <div className="text-[14px] text-text-muted">Cerraste sesión. ¡Hasta la próxima!</div>}

        <div className="flex gap-5 text-[13px] text-text-disabled">
          <Link href="/privacidad" className="hover:text-text">Privacidad</Link>
          <Link href="/terminos" className="hover:text-text">Términos</Link>
        </div>
      </div>
    </main>
  );
}
