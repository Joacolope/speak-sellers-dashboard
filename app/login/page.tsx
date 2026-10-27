import { rutaSegura } from '@/lib/auth';

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
          <form method="POST" action="/auth/login">
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="btn-secondary flex w-full items-center justify-center gap-3 !py-3">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Entrar con Google
            </button>
          </form>
        )}

        {searchParams.error && <div className="bad text-[14px]">{MENSAJES[searchParams.error] ?? 'No se pudo ingresar.'}</div>}
        {searchParams.salio && <div className="text-[14px] text-text-muted">Cerraste sesión.</div>}
      </div>
    </main>
  );
}
