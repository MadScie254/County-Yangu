import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BellRing, Banknote, Building, Eye, FolderKanban, Gauge, Inbox, LogOut, Menu, MessageSquareText, Scale, Settings, Sparkles, Vote, X, ClipboardCheck, FileStack, Lightbulb, Timer } from 'lucide-react';
import { useAuth } from '@/shared/state/auth';
import { county } from '@/shared/config/county';
import { LogoMark } from '@/shared/ui/Logo';
import { Toaster } from '@/shared/ui/Toast';
import { useIsDemo } from '@/shared/api/hooks';
import { cn } from '@/shared/lib/utils';
import { useCan } from '../lib/perm';

type Item = { to: string; label: string; icon: typeof Inbox; show: (c: ReturnType<typeof useCan>) => boolean; end?: boolean };
type Group = { title: string; items: Item[] };

const groups: Group[] = [
  { title: 'Work', items: [
    { to: '/', label: 'Overview', icon: Gauge, end: true, show: () => true },
    { to: '/cases', label: 'Case inbox', icon: Inbox, show: (c) => c.working },
    { to: '/sla', label: 'SLA board', icon: Timer, show: (c) => c.working },
    { to: '/applications', label: 'Applications', icon: ClipboardCheck, show: (c) => c.working },
    { to: '/assistant', label: 'AI assistant', icon: Sparkles, show: (c) => c.working },
  ] },
  { title: 'Publish', items: [
    { to: '/projects', label: 'Projects', icon: FolderKanban, show: (c) => c.publish },
    { to: '/tenders', label: 'Tenders', icon: FileStack, show: (c) => c.publish },
    { to: '/budget', label: 'Budget cycles', icon: Vote, show: (c) => c.admin },
    { to: '/alerts', label: 'Ward alerts', icon: BellRing, show: (c) => c.working },
    { to: '/ideas', label: 'Ideas & petitions', icon: Lightbulb, show: (c) => c.working },
  ] },
  { title: 'Money', items: [{ to: '/revenue', label: 'Revenue', icon: Banknote, show: (c) => c.finance }] },
  { title: 'Oversight', items: [{ to: '/oversight', label: 'Overdue & digests', icon: Eye, show: (c) => c.oversight }] },
  { title: 'Administer', items: [{ to: '/admin', label: 'Administration', icon: Settings, show: (c) => c.admin }] },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const can = useCan();
  return (
    <nav aria-label="Console" className="space-y-6">
      {groups.map((g) => {
        const items = g.items.filter((i) => i.show(can));
        if (!items.length) return null;
        return (
          <div key={g.title}>
            <p className="px-3 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-bg/50">{g.title}</p>
            <ul className="mt-2 space-y-0.5">
              {items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink to={to} end={end} onClick={onNavigate} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.92rem] font-semibold transition', isActive ? 'bg-bg text-ink' : 'text-bg/80 hover:bg-bg/10 hover:text-bg')}>
                    <Icon className="size-[1.1rem]" aria-hidden /> {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function ConsoleShell() {
  const { pathname } = useLocation();
  // the menu is open for one page only: navigating elsewhere closes it without an effect
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenOn((typeof v === 'function' ? v(open) : v) ? pathname : null);
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const can = useCan();
  const demo = useIsDemo();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);

  const brand = (
    <div className="flex items-center gap-3">
      <LogoMark className="size-10" />
      <div className="leading-none">
        <p className="font-display text-lg font-extrabold text-bg">CountyConnect</p>
        <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-bg/60">{county.name} County</p>
      </div>
    </div>
  );

  const account = (
    <div className="rounded-2xl bg-bg/10 p-3 text-bg">
      <p className="truncate text-sm font-semibold">{user?.name || user?.email}</p>
      <p className="truncate text-xs text-bg/70">{can.topRole}</p>
      <button type="button" onClick={() => void signOut()} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-bg/80 underline-offset-4 hover:text-bg hover:underline"><LogOut className="size-3.5" aria-hidden />Sign out</button>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 overflow-y-auto bg-ink p-5 lg:flex">
        {brand}
        <div className="flex-1"><Nav /></div>
        {account}
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-ink px-4 lg:hidden">
        {brand}
        <button type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((v) => !v)} className="tap grid place-items-center text-bg">{open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}</button>
      </header>
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-30 flex flex-col gap-8 overflow-y-auto bg-ink p-5 lg:hidden">
          <Nav onNavigate={() => setOpen(false)} />
          {account}
        </div>
      )}

      <div className="min-w-0">
        {demo && <div className="border-b border-warn/30 bg-warn-soft px-4 py-1.5 text-center text-xs font-semibold text-warn">Demo data: actions here change sample records on this device only.</div>}
        {can.readOnly && <div className="border-b border-info/30 bg-info-soft px-4 py-1.5 text-center text-xs font-semibold text-info"><Scale className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden />Read-only access: you can see what is overdue but cannot change anything.</div>}
        <main id="main" tabIndex={-1} className="mx-auto max-w-[88rem] px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
      <Toaster dismissLabel="Dismiss" />
    </div>
  );
}

export { Building, MessageSquareText };
