import { InstallPrompt } from '../components/InstallPrompt';
import { useEffect, useState } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { Home, Megaphone, FolderKanban, Vote, Menu, Settings2, Smartphone, WifiOff, Building2, ShieldCheck, UserRound, Scale } from 'lucide-react';
import { useI18n, locales, type MessageKey } from '@/shared/i18n';
import { county } from '@/shared/config/county';
import { Wordmark } from '@/shared/ui/Logo';
import { buttonClass, IconButton } from '@/shared/ui/Button';
import { Toaster } from '@/shared/ui/Toast';
import { useIsDemo } from '@/shared/api/hooks';
import { useOnline } from '@/shared/lib/hooks';
import { useQueue } from '@/shared/state/queue';
import { useAuth } from '@/shared/state/auth';
import { cn } from '@/shared/lib/utils';
import { DisplaySettings } from './DisplaySettings';

const primaryNav: { to: string; key: MessageKey; end?: boolean }[] = [
  { to: '/report', key: 'nav.report' },
  { to: '/projects', key: 'nav.track' },
  { to: '/vote', key: 'nav.vote' },
  { to: '/services', key: 'nav.services' },
  { to: '/pulse', key: 'nav.pulse' },
];

const secondaryNav: { to: string; key: MessageKey }[] = [
  { to: '/open', key: 'nav.open' },
  { to: '/tenders', key: 'nav.tenders' },
  { to: '/vote/results', key: 'nav.results' },
  { to: '/assembly', key: 'nav.assembly' },
  { to: '/verify', key: 'nav.verify' },
  { to: '/open/api', key: 'nav.data' },
  { to: '/ideas', key: 'nav.proposals' },
  { to: '/alerts', key: 'nav.alerts' },
  { to: '/how-it-works', key: 'nav.how' },
];

function LangToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div role="group" aria-label={t('nav.language')} className={cn('inline-flex rounded-full border border-line bg-surface p-0.5', className)}>
      {locales.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          aria-pressed={locale === l.code}
          title={l.label}
          onClick={() => setLocale(l.code)}
          className={cn('h-8 rounded-full px-2.5 text-xs font-bold tracking-wide transition', locale === l.code ? 'bg-ink text-bg' : 'text-muted hover:text-ink')}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}

function OfflineStrip() {
  const { t } = useI18n();
  const online = useOnline();
  const pending = useQueue((s) => s.items.filter((i) => i.status !== 'sent').length);
  if (online && pending === 0) return null;
  return (
    <div role="status" className="bg-panel px-4 py-2 text-center text-sm font-medium text-panel-ink">
      <WifiOff className="mr-2 inline size-4 align-[-2px]" aria-hidden />
      {!online ? t('offline.banner') : t('offline.pending', { count: pending })}
    </div>
  );
}

function DemoRibbon() {
  const { t } = useI18n();
  const demo = useIsDemo();
  if (!demo) return null;
  return (
    <div className="border-b border-warn/30 bg-warn-soft px-4 py-1.5 text-center text-xs font-semibold text-warn" title={t('common.demoDataHint')}>
      {t('common.demoData')}<span className="hidden sm:inline"> · {t('common.demoDataHint')}</span>
    </div>
  );
}

function AccountChip() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const staff = useAuth((s) => s.roles.length > 0);
  const initials = ((user?.name || user?.email || '?').trim().split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')) || '?';
  return (
    <span className="flex items-center gap-1.5">
      <Link to="/me" className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface pl-1 pr-3.5 text-sm font-semibold transition hover:bg-bg-2">
        <span aria-hidden className="grid size-7 place-items-center rounded-full bg-brand text-xs font-extrabold text-brand-ink">{initials}</span>
        {t('nav.me')}
      </Link>
      {staff && (
        <a href="/console/" className="hidden h-9 items-center gap-1.5 rounded-full bg-panel px-3.5 text-sm font-semibold text-panel-ink transition hover:opacity-90 xl:inline-flex">
          <Building2 className="size-4" aria-hidden /> {t('nav.staffConsole')}
        </a>
      )}
    </span>
  );
}

export function ResidentShell() {
  const { t } = useI18n();
  const [settings, setSettings] = useState(false);
  const { pathname } = useLocation();
  const [moreOn, setMoreOn] = useState<string | null>(null);
  const more = moreOn === pathname;
  const setMore = (v: boolean | ((o: boolean) => boolean)) => setMoreOn((typeof v === 'function' ? v(more) : v) ? pathname : null);
  const flush = useQueue((s) => s.flush);
  const authStatus = useAuth((s) => s.status);
  const initAuth = useAuth((s) => s.init);
  const staff = useAuth((s) => s.roles.length > 0);
  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  // retry the offline queue on load and whenever the connection returns
  useEffect(() => {
    void flush();
    const on = () => void flush();
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [flush]);

  const isHome = pathname === '/';

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-bg">
        {t('nav.skip')}
      </a>
      <OfflineStrip />
      <DemoRibbon />

      <header className="glass sticky top-0 z-40 border-b border-line/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label={`${t('common.appName')}, ${t('nav.home')}`} className="rounded-xl">
            <Wordmark sub={county.name} className="[&_.sub]:hidden sm:[&_.sub]:block" />
          </Link>

          <nav aria-label={t('nav.main')} className="hidden items-center gap-1 lg:flex">
            {primaryNav.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('rounded-full px-3.5 py-2 text-[0.92rem] font-semibold transition', isActive ? 'bg-ink text-bg' : 'text-ink-2 hover:bg-bg-2 hover:text-ink')}>
                {t(n.key)}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <LangToggle />
            <span className="hidden sm:block">
              <IconButton label={t('a11y.settings')} onClick={() => setSettings(true)}>
                <Settings2 className="size-5" aria-hidden />
              </IconButton>
            </span>
            <span className="hidden md:block">
              {authStatus === 'in' ? (
                <AccountChip />
              ) : (
                <Link to="/services/account" className={buttonClass('secondary', 'sm')}>
                  {t('nav.signIn')}
                </Link>
              )}
            </span>
            <span className="lg:hidden">
              <IconButton label={t('nav.more')} onClick={() => setMore((v) => !v)} aria-expanded={more}>
                <Menu className="size-5" aria-hidden />
              </IconButton>
            </span>
          </div>
        </div>

        {more && (
          <nav aria-label={t('nav.more')} className="border-t border-line bg-surface lg:hidden">
            <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-1 p-3 sm:grid-cols-3">
              {[...primaryNav, ...secondaryNav].map((n) => (
                <li key={n.to}>
                  <NavLink to={n.to} className={({ isActive }) => cn('flex h-12 items-center rounded-xl px-3 font-semibold', isActive ? 'bg-bg-2' : 'hover:bg-bg-2')}>
                    {t(n.key)}
                  </NavLink>
                </li>
              ))}
              <li>
                <NavLink to={authStatus === 'in' ? '/me' : '/services/account'} className={({ isActive }) => cn('flex h-12 items-center gap-2 rounded-xl px-3 font-semibold', isActive ? 'bg-bg-2' : 'hover:bg-bg-2')}>
                  <UserRound className="size-4" aria-hidden /> {authStatus === 'in' ? t('nav.me') : t('nav.signIn')}
                </NavLink>
              </li>
              {staff && (
                <li>
                  <a href="/console/" className="flex h-12 items-center gap-2 rounded-xl px-3 font-semibold hover:bg-bg-2"><Building2 className="size-4" aria-hidden /> {t('nav.staffConsole')}</a>
                </li>
              )}
              <li>
                <button type="button" onClick={() => setSettings(true)} className="flex h-12 w-full items-center gap-2 rounded-xl px-3 text-left font-semibold hover:bg-bg-2">
                  <Settings2 className="size-4" aria-hidden /> {t('a11y.settings')}
                </button>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main id="main" className="flex-1 pb-24 lg:pb-0" tabIndex={-1}>
        <Outlet />
        <InstallPrompt />
      </main>

      <footer className={cn('border-t border-line bg-bg-2', isHome ? '' : 'mt-8')}>
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark sub={county.name} />
            <p className="mt-4 max-w-sm text-sm text-ink-2">{t('footer.about', { county: county.name })}</p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-sm font-semibold shadow-card">
              <Smartphone className="size-4 text-brand-strong" aria-hidden /> {t('footer.dial', { code: county.ussdCode })}
            </p>
          </div>
          <ul className="space-y-2 text-sm font-medium">
            {secondaryNav.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className="text-ink-2 hover:text-ink hover:underline">
                  {t(n.key)}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="space-y-2 text-sm font-medium">
            <li>
              <a href="/#roadmap" className="inline-flex items-center gap-2 text-ink-2 hover:text-ink hover:underline"><Scale className="size-4" aria-hidden /> {t('nav.roadmap')}</a>
            </li>
            <li>
              <Link to="/how-it-works#privacy" className="inline-flex items-center gap-2 text-ink-2 hover:text-ink hover:underline">
                <ShieldCheck className="size-4" aria-hidden /> {t('footer.privacy')}
              </Link>
            </li>
            <li>
              {/* The staff door lives at its own path (and can be moved to its own hostname). */}
              <a href="/console/" className="inline-flex items-center gap-2 text-ink-2 hover:text-ink hover:underline">
                <Building2 className="size-4" aria-hidden /> {t('footer.staff')}
              </a>
            </li>
          </ul>
        </div>
        <div className="border-t border-line py-4 text-center text-xs text-muted">{t('footer.rights')} · © {new Date().getFullYear()} {county.name} County</div>
      </footer>

      {/* Phone-style bottom navigation with a raised Report button */}
      <nav aria-label={t('nav.main')} className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line/70 lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-1.5">
          {[
            { to: '/', key: 'nav.home' as const, icon: Home, end: true },
            { to: '/projects', key: 'nav.track' as const, icon: FolderKanban },
            { to: '/report', key: 'nav.report' as const, icon: Megaphone, fab: true },
            { to: '/vote', key: 'nav.vote' as const, icon: Vote },
            { to: authStatus === 'in' ? '/me' : '/services/account', key: (authStatus === 'in' ? 'nav.me' : 'nav.signIn') as 'nav.me' | 'nav.signIn', icon: UserRound },
          ].map(({ to, key, icon: Icon, end, fab }) => (
            <li key={to} className="flex justify-center">
              <NavLink to={to} end={end} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 rounded-2xl px-2 pb-1 text-[0.68rem] font-bold', fab ? '-mt-6' : 'pt-1.5', isActive && !fab ? 'text-ink' : 'text-muted')}>
                {({ isActive }) => (
                  <>
                    <span className={cn('grid place-items-center rounded-full transition', fab ? 'size-14 bg-brand text-brand-ink shadow-float ring-4 ring-bg animate-pulse-ring' : cn('size-8', isActive && 'bg-bg-2'))}>
                      <Icon className={fab ? 'size-6' : 'size-5'} aria-hidden />
                    </span>
                    <span>{t(key)}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <DisplaySettings open={settings} onClose={() => setSettings(false)} />
      <Toaster dismissLabel={t('common.close')} />
    </div>
  );
}
