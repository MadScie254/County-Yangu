import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Droplets, HeartPulse, Info, Lightbulb, MapPin, Route, Siren, Trash2, type LucideIcon } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { useIsDemo, useNotices } from '@/shared/api/hooks';
import type { NoticeKind, ServiceNotice } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Chip } from '@/shared/ui/Chip';
import { SelectInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { FollowButton } from '@/shared/ui/FollowButton';
import { ShareListen } from '@/shared/ui/ShareListen';

const wardName = new Map(wards.map((w) => [w.id, w.name]));
export const noticeIcon: Record<NoticeKind, LucideIcon> = { water: Droplets, power: Lightbulb, road: Route, waste: Trash2, health: HeartPulse, other: Info };

function NoticeCard({ n }: { n: ServiceNotice }) {
  const { t, locale, date } = useI18n();
  const Icon = n.severity === 'emergency' ? Siren : noticeIcon[n.kind];
  const title = locale === 'sw' && n.title_sw ? n.title_sw : n.title;
  const when = (iso: string) => date(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' });
  const live = n.status === 'active';
  return (
    <li className={cn('flex gap-4 rounded-[1.5rem] border bg-surface p-5 shadow-card',
      live && n.severity === 'emergency' ? 'border-bad' : live && n.severity === 'disruption' ? 'border-warn' : 'border-line', !live && 'opacity-80')}>
      <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl',
        !live ? 'bg-good-soft text-good' : n.severity === 'emergency' ? 'bg-bad-soft text-bad' : n.severity === 'disruption' ? 'bg-warn-soft text-warn' : 'bg-bg-2 text-ink-2')}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={n.severity === 'emergency' ? 'bad' : n.severity === 'disruption' ? 'warn' : 'info'}>{t(`loop.notices.severity.${n.severity}` as MessageKey)}</Chip>
          <Chip>{t(`loop.notices.kind.${n.kind}` as MessageKey)}</Chip>
          <Chip>{n.ward_id ? wardName.get(n.ward_id) ?? n.ward_id : t('loop.notices.countyWide')}</Chip>
          {n.status === 'cancelled' && <Chip tone="bad">{t('loop.notices.cancelled')}</Chip>}
        </div>
        <h3 className="mt-2 font-display text-lg font-bold leading-snug">{title}</h3>
        {n.area && <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-2"><MapPin className="size-4" aria-hidden />{n.area}</p>}
        {n.body && <p className="mt-2 text-sm">{n.body}</p>}
        <p className="mt-3 text-sm font-semibold">
          {live
            ? <>{t('loop.notices.since', { when: when(n.starts_at) })} · {n.ends_at ? t(n.severity === 'info' ? 'loop.notices.until' : 'loop.notices.expected', { when: when(n.ends_at) }) : t('loop.notices.unknownEnd')}</>
            : n.status === 'resolved' && n.resolved_at ? <span className="text-good">{t('loop.notices.resolved', { when: when(n.resolved_at) })}</span> : null}
        </p>
        {n.resolved_note && <p className="mt-2 rounded-xl bg-good-soft p-3 text-sm">{n.resolved_note}</p>}
        {live && <ShareListen className="mt-3" text={title} speak={[title, n.area, n.body].filter(Boolean).join('. ')} />}
      </div>
    </li>
  );
}

export default function Notices() {
  const { t } = useI18n();
  const q = useNotices();
  const demo = useIsDemo();
  const [ward, setWard] = useState(() => new URLSearchParams(window.location.search).get('ward') ?? '');
  usePageTitle(t('loop.notices.title'));
  const list = useMemo(() => (q.data ?? []).filter((n) => !ward || n.ward_id === ward || n.ward_id === null), [q.data, ward]);
  const rank = { emergency: 0, disruption: 1, info: 2 } as const;
  const now = list.filter((n) => n.status === 'active').sort((a, b) => rank[a.severity] - rank[b.severity]);
  const past = list.filter((n) => n.status !== 'active');
  const sorted = useMemo(() => [...wards].sort((a, b) => a.name.localeCompare(b.name)), []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('loop.notices.title')}</h1>
      <p className="mt-3 max-w-2xl text-[1.05rem] text-ink-2">{t('loop.notices.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">
          {t('common.ward')}
          <SelectInput className="mt-1.5 min-w-56" value={ward} onChange={(e) => setWard(e.target.value)}>
            <option value="">{t('loop.notices.allWards')}</option>
            {sorted.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </SelectInput>
        </label>
        {ward && <FollowButton kind="ward_tenders" id={ward} label={wardName.get(ward) ?? ward} size="md" />}
        <Link to="/alerts" className="inline-flex h-11 items-center px-2 text-sm font-semibold text-brand underline-offset-4 hover:underline">{t('loop.notices.smsLink')}</Link>
      </div>
      {!ward && <p className="mt-2 text-xs text-muted">{t('loop.notices.followHint')}</p>}

      {q.isLoading ? <Skeleton className="mt-8 h-64" /> : (
        <>
          <h2 className="mt-10 font-display text-xl font-bold">{t('loop.notices.now')}</h2>
          {now.length === 0 ? <p className="mt-3 rounded-2xl bg-good-soft p-4 text-sm font-semibold text-good">{t('loop.notices.none')}</p> : <ul className="mt-4 space-y-3">{now.map((n) => <NoticeCard key={n.id} n={n} />)}</ul>}
          {past.length > 0 && (
            <>
              <h2 className="mt-10 font-display text-xl font-bold">{t('loop.notices.recent')}</h2>
              <ul className="mt-4 space-y-3">{past.map((n) => <NoticeCard key={n.id} n={n} />)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
