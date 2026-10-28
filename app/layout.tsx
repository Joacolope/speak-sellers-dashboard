import type { Metadata, Viewport } from 'next';
import { Inter, Inter_Tight } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter-next', display: 'swap' });
// Inter Tight 400 = sustituto de PolySans indicado en DESIGN_dashboards.md
const display = Inter_Tight({ subsets: ['latin'], weight: ['400'], variable: '--font-display-next', display: 'swap' });

export const metadata: Metadata = {
  title: 'Speak Sellers Dashboard',
  description: 'Métricas comerciales de Speak Sellers',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  // Google Search Console: se carga GOOGLE_SITE_VERIFICATION en Vercel (el código de la etiqueta HTML)
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
};

export const viewport: Viewport = {
  themeColor: '#efefef',
};

// Aplica el tema antes del primer render para evitar el parpadeo.
const themeScript = `(function(){try{var t=localStorage.getItem('ss-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning className={`${inter.variable} ${display.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
