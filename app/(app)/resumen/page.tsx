import { getBundle } from '@/lib/data';
import { datosResumen, htmlResumen } from '@/lib/resumen';
import { ids } from '@/lib/cliente';
import { DemoBanner } from '@/components/ui';
import { hoyAR } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Resumen() {
  const bundle = await getBundle();
  const d = datosResumen(bundle, hoyAR());
  // El HTML lo arma el servidor con datos escapados.
  const html = htmlResumen(d, ids.appUrl()).replace(/^[\s\S]*?<body[^>]*>/, '').replace(/<\/body>[\s\S]*$/, '');

  return (
    <>
      {bundle.demo && <DemoBanner />}
      <div className="flex flex-col gap-3">
        <div className="eyebrow">Resumen semanal</div>
        <h1 className="h1">La semana comparada con la anterior</h1>
        <p className="max-w-2xl text-[15px] text-text-muted">
          La semana de sábado a viernes contra la anterior. Se arma solo con los datos del dashboard.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
