import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import TopNav from '@/components/TopNav';
import { getSesion, puede } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion();
  if (!sesion) redirect('/login');
  return (
    <>
      <Suspense fallback={<div className="h-20" />}>
        <TopNav email={sesion.email} rol={sesion.rol} puedeCargar={puede(sesion, 'editor') && !sesion.demo} />
      </Suspense>
      <main className="mx-auto flex max-w-[1280px] flex-col gap-14 px-4 pb-8 pt-6 md:px-8 md:pb-16">{children}</main>
      <footer className="mx-auto max-w-[1280px] px-4 py-10 text-[14px] text-text-muted md:px-8">
        <span className="text-[12px]">● automático · ◐ agente · ○ manual</span>
      </footer>
    </>
  );
}
