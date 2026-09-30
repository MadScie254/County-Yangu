import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Siren, TriangleAlert, X } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useNotices } from '@/shared/api/hooks';
import { cn } from '@/shared/lib/utils';

/** A thin strip under the header while there is a live disruption or emergency, so nobody has to go looking for it. */
export function NoticesStrip() {
  const { t, locale } = useI18n();
  const { pathname } = useLocation();
  const q = useNotices();
  const live = (q.data ?? []).filter((n) => n.status === 'active' && n.severity !== 'info');
  const key = live.map((n) => n.id).sort().join(',');
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem('cy-notices-hidden') ?? ''; } catch { return ''; } });
  if (!live.length || pathname === '/notices' || hidden === key) return null;
  const top = live.find((n) => n.severity === 'emergency') ?? live[0]!;
  const emergency = top.severity === 'emergency';
  const Icon = emergency ? Siren : TriangleAlert;
  const hide = () => { setHidden(key); try { sessionStorage.setItem('cy-notices-hidden', key); } catch { /* ignore */ } };
  return (
    <div role="status" className={cn('border-b text-sm', emergency ? 'border-bad/30 bg-bad-soft' : 'border-warn/30 bg-warn-soft')}>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
        <Icon className={cn('size-4 shrink-0', emergency ? 'text-bad' : 'text-warn')} aria-hidden />
        <p className="min-w-0 flex-1 truncate">
          <b>{locale === 'sw' && top.title_sw ? top.title_sw : top.title}</b>
          {live.length > 1 && <span className="text-ink-2"> · {t('loop.notices.banner', { count: live.length })}</span>}
        </p>
        <Link to="/notices" className="shrink-0 font-semibold underline underline-offset-4">{t('loop.notices.see')}</Link>
        <button type="button" onClick={hide} className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-surface/60" aria-label={t('common.close')}><X className="size-4" aria-hidden /></button>
      </div>
    </div>
  );
}
