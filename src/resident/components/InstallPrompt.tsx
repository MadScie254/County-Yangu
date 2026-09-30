import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const DISMISSED = 'cy-install-dismissed';

/** Offers "add to home screen" once the browser says the app is installable. Asked at most once per person. */
export function InstallPrompt() {
  const { t } = useI18n();
  const [ev, setEv] = useState<InstallEvent | null>(null);
  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISSED) === '1'; } catch { /* private mode */ }
    if (dismissed) return;
    const on = (e: Event) => { e.preventDefault(); setEv(e as InstallEvent); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  if (!ev) return null;
  const close = () => { try { localStorage.setItem(DISMISSED, '1'); } catch { /* ignore */ } setEv(null); };
  return (
    <div role="region" aria-label={t('loop.offline.install')} className="fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-line-strong bg-surface p-4 shadow-pop lg:bottom-6">
      <Download className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t('loop.offline.install')}</p>
        <p className="mt-0.5 text-sm text-ink-2">{t('loop.offline.installHint')}</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => { void ev.prompt().finally(close); }}>{t('loop.offline.install')}</Button>
          <Button size="sm" variant="ghost" onClick={close}>{t('loop.offline.dismiss')}</Button>
        </div>
      </div>
      <button type="button" aria-label={t('common.close')} onClick={close} className="grid size-8 place-items-center rounded-full hover:bg-bg-2"><X className="size-4" aria-hidden /></button>
    </div>
  );
}
