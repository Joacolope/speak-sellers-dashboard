import { Suspense } from 'react';
import TopNav from '@/components/TopNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<div className="h-20" />}>
        <TopNav />
      </Suspense>
      <main className="mx-auto flex max-w-[1200px] flex-col gap-12 px-4 pb-8 pt-4 md:px-6 md:pb-12">{children}</main>
      <footer className="mx-auto max-w-[1200px] px-4 py-10 text-[14px] text-text-muted md:px-6">
        <span className="mono text-[12px]">● automático · ◐ agente · ○ manual</span>
      </footer>
    </>
  );
}
