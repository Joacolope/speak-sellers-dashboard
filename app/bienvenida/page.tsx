import Link from 'next/link';
import BotonGoogle from '@/components/BotonGoogle';

export const metadata = {
  title: 'Speak Sellers Dashboard',
  description: 'Panel interno de métricas comerciales de Speak Sellers: ventas, agendas, cobranzas, anuncios y contenido orgánico.',
};

/** Página pública (la que ve Google y cualquiera sin sesión). No muestra datos. */
export default function Bienvenida() {
  const items = [
    ['Ventas y cobranzas', 'Facturación, cash collected, cuotas por cobrar y comisiones de cada mes.'],
    ['Agendas y closers', 'Agendas, llamadas presentadas, cierres y desempeño de cada closer.'],
    ['Embudos', 'De la conversación a la venta, por fuente: orgánico, webinar y YouTube.'],
    ['Anuncios y orgánico', 'Inversión en Meta Ads y rendimiento de reels e historias de Instagram.'],
  ];
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-12 px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-5">
        <span className="icon-badge icon-blue !h-12 !w-12" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></svg>
        </span>
        <div className="eyebrow">Speak Sellers · Métricas</div>
        <h1 className="display text-[40px] leading-[1.05] md:text-[56px]">Speak Sellers Dashboard</h1>
        <p className="max-w-xl text-[17px] leading-relaxed text-text-muted">
          Herramienta interna de Speak Sellers (LANZA SELLING LLC) para ver en un solo lugar las métricas comerciales
          del negocio. La usan solo los miembros autorizados del equipo, que ingresan con su cuenta de Google.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col items-center gap-3">
        <div className="w-full"><BotonGoogle next="/" /></div>
        <p className="text-[13px] leading-relaxed text-text-disabled">
          Solo usamos tu nombre y tu email de Google para verificar que estés autorizado. No accedemos a Gmail, Drive ni otros servicios.
        </p>
      </div>

      <div className="grid w-full gap-3 sm:grid-cols-2">
        {items.map(([t, d]) => (
          <div key={t} className="card !p-6">
            <div className="text-[16px] font-medium text-text">{t}</div>
            <div className="mt-2 text-[14px] leading-relaxed text-text-muted">{d}</div>
          </div>
        ))}
      </div>

      <footer className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-text-muted">
        <Link href="/privacidad" className="link-ember">Política de privacidad</Link>
        <Link href="/terminos" className="link-ember">Condiciones del servicio</Link>
        <a href="mailto:joaquin@salesspawn.com" className="link-ember">Contacto</a>
      </footer>
    </main>
  );
}
