'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

const SECCIONES = [
  { href: '/', label: 'Inicio' },
  { href: '/metricas', label: 'Métricas' },
  { href: '/setter', label: 'Setter' },
  { href: '/closers', label: 'Closers' },
  { href: '/cobranzas', label: 'Cobranzas' },
  { href: '/organico', label: 'Orgánico' },
  { href: '/anuncios', label: 'Anuncios' },
  { href: '/puntos-de-contacto', label: 'Contacto' },
];

export default function TopNav() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const query = sp.toString() ? `?${sp.toString()}` : '';
  const activo = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="bg-bg">
      <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between gap-6 px-4 md:px-6">
        <Link href={`/${query}`} className="shrink-0 leading-tight">
          <div className="eyebrow">Speak Sellers · Métricas</div>
          <div className="h3">Speak Sellers Dashboard</div>
        </Link>

        {/* Navigation Pill Container */}
        <nav className="hidden items-center gap-1 rounded-full bg-[var(--nav-pill)] px-2 py-1.5 xl:flex">
          {SECCIONES.map((s) => (
            <Link
              key={s.href}
              href={`${s.href}${query}`}
              className={`rounded-full px-3.5 py-1.5 text-[15px] tracking-[-0.02em] [font-family:var(--font-polysans)] ${
                activo(s.href) ? 'bg-text text-surface' : 'text-text hover:text-accent'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href={`/cargar${query}`} className="btn-primary hidden md:inline-block">Cargar</Link>
          <ThemeToggle />
        </div>
      </div>
      <nav className="mx-auto flex max-w-[1200px] gap-1 overflow-x-auto px-4 pb-3 xl:hidden">
        {SECCIONES.map((s) => (
          <Link
            key={s.href}
            href={`${s.href}${query}`}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[14px] ${activo(s.href) ? 'bg-text text-surface' : 'text-text'}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
