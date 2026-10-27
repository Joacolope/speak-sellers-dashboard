export const metadata = { title: 'Ingresar · Speak Sellers Dashboard' };

export default function LoginPage({ searchParams }: { searchParams: { error?: string; next?: string; falta?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form method="POST" action="/api/login" className="card flex w-full max-w-sm flex-col gap-4 !p-8">
        <div>
          <div className="eyebrow">Speak Sellers · Métricas</div>
          <h1 className="h2 mt-2">Speak Sellers Dashboard</h1>
        </div>
        <input type="hidden" name="next" value={searchParams.next ?? '/'} />
        <label className="flex flex-col gap-2 text-[14px] text-text-muted">
          Contraseña
          <input className="input" type="password" name="password" autoFocus autoComplete="current-password" required />
        </label>
        {searchParams.error && <div className="bad text-[14px]">Contraseña incorrecta.</div>}
        {searchParams.falta && <div className="text-[14px] text-text-muted">Falta configurar <code>DASHBOARD_PASSWORD</code> en Vercel → Settings → Environment Variables.</div>}
        <button type="submit" className="btn-primary">Entrar</button>
      </form>
    </main>
  );
}
