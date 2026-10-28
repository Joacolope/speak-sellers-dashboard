import { getBundle } from '@/lib/data';
import { getSesion, puede } from '@/lib/auth';
import { datosResumen, htmlResumen, asuntoResumen } from '@/lib/resumen';
import { appUrl, destinatarios } from '@/lib/resumen-envio';
import { DemoBanner } from '@/components/ui';
import { hoyAR } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Resumen({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const bundle = await getBundle();
  const sesion = await getSesion();
  const admin = puede(sesion, 'admin');
  const d = datosResumen(bundle, hoyAR());
  const para = admin ? await destinatarios() : [];
  const configurado = Boolean(process.env.RESEND_API_KEY);
  // El HTML lo arma el servidor con datos escapados; se muestra tal cual llega al mail.
  const html = htmlResumen(d, appUrl()).replace(/^[\s\S]*?<body[^>]*>/, '').replace(/<\/body>[\s\S]*$/, '');

  return (
    <>
      {bundle.demo && <DemoBanner />}
      <div className="flex flex-col gap-3">
        <div className="eyebrow">Resumen semanal</div>
        <h1 className="h1">Lo que llega por mail los viernes</h1>
        <p className="max-w-2xl text-[15px] text-text-muted">
          Todos los viernes a las 18:00 (Argentina) sale este mail con la semana de sábado a viernes comparada con la anterior.
        </p>
        {searchParams.ok && <div className="ok text-[14px]">{searchParams.ok}</div>}
        {searchParams.error && <div className="bad text-[14px]">{searchParams.error}</div>}
      </div>

      {admin && (
        <div className="card flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1 text-[14px]">
            <div><span className="text-text-muted">Asunto:</span> {asuntoResumen(d)}</div>
            <div><span className="text-text-muted">Se manda a:</span> {para.length ? para.join(', ') : <span className="warn">nadie todavía</span>}</div>
            <div><span className="text-text-muted">Envío:</span> {configurado ? <span className="ok">Resend configurado</span> : <span className="warn">falta RESEND_API_KEY en Vercel</span>}</div>
          </div>
          <form method="POST" action="/api/resumen/enviar">
            <button className="btn-secondary" type="submit" disabled={!configurado}>Mandarme una prueba</button>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
