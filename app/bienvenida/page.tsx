import Link from 'next/link';
import BotonGoogle from '@/components/BotonGoogle';

export const metadata = {
  title: 'Speak Sellers Dashboard',
  description: 'Panel interno de métricas comerciales de Speak Sellers: ventas, agendas, cobranzas, anuncios y contenido orgánico.',
};

/** Página pública (la que ve Google y cualquiera sin sesión). No muestra datos. */
export default function Bienvenida() {
  const items = [
    ['Ventas y cobranzas', 'Facturación, cash collected, cuotas cobradas y comisiones de cada mes.'],
    ['Agendas y closers', 'Agendas, llamadas presentadas, cierres y desempeño de cada closer.'],
    ['Embudos', 'De la conversación a la venta, por fuente: orgánico, webinar y YouTube.'],
    ['Anuncios y orgánico', 'Inversión en Meta Ads y rendimiento de reels e historias de Instagram.'],
  ];
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-4 py-16">
      <div className="flex flex-col gap-4">
        <div className="eyebrow">Speak Sellers · Métricas</div>
        <h1 className="display text-[44px] leading-[1.05] md:text-[56px]">Speak Sellers Dashboard</h1>
        <p className="max-w-xl text-[17px] leading-relaxed text-text-muted">
          Herramienta interna de Speak Sellers (LANZA SELLING LLC) para ver en un solo lugar las métricas comerciales
          del negocio. La usan solo los miembros autorizados del equipo, que ingresan con su cuenta de Google.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(([t, d]) => (
          <div key={t} className="card !p-5">
            <div className="text-[15px] font-medium text-text">{t}</div>
            <div className="mt-1 text-[14px] text-text-muted">{d}</div>
          </div>
        ))}
      </div>

      <div className="flex max-w-sm flex-col gap-3">
        <BotonGoogle next="/" />
        <p className="text-[13px] text-text-disabled">
          Solo se usa tu nombre y email de Google para verificar que estés autorizado. No accedemos a Gmail, Drive ni otros servicios.
        </p>
      </div>

      <footer className="flex flex-wrap gap-4 text-[13px] text-text-muted">
        <Link href="/privacidad" className="link-ember">Política de privacidad</Link>
        <Link href="/terminos" className="link-ember">Condiciones del servicio</Link>
        <a href="mailto:joaquin@salesspawn.com" className="link-ember">Contacto</a>
      </footer>
    </main>
  );
}
