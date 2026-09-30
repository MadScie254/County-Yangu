import { useMemo, useState } from 'react';
import { CalendarPlus, CalendarDays, MapPin, Users } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { useIsDemo, useMeetings } from '@/shared/api/hooks';
import { meetingIcs } from '@/shared/api/loop';
import type { PublicMeeting } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { SelectInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { FollowButton } from '@/shared/ui/FollowButton';

const wardName = new Map(wards.map((w) => [w.id, w.name]));

function MeetingCard({ m }: { m: PublicMeeting }) {
  const { t, locale, date } = useI18n();
  const title = locale === 'sw' && m.title_sw ? m.title_sw : m.title;
  const start = new Date(m.starts_at);
  const time = new Intl.DateTimeFormat(locale === 'sw' ? 'sw-KE' : 'en-KE', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' });
  const download = () => {
    const url = URL.createObjectURL(new Blob([meetingIcs(m, title, `${window.location.origin}/meetings`)], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url; a.download = `meeting-${start.toISOString().slice(0, 10)}.ics`; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <li className={cn('flex gap-4 rounded-[1.5rem] border border-line bg-surface p-5 shadow-card', m.status === 'cancelled' && 'opacity-70')}>
      <div className="grid w-16 shrink-0 place-items-center self-start rounded-2xl bg-bg-2 py-2 text-center">
        <span className="text-xs font-bold uppercase text-muted">{date(m.starts_at, { month: 'short', timeZone: 'Africa/Nairobi' })}</span>
        <span className="font-display text-2xl font-extrabold leading-none">{date(m.starts_at, { day: 'numeric', timeZone: 'Africa/Nairobi' })}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={m.kind === 'budget_hearing' ? 'vote' : 'info'}>{t(`loop.meetings.kind.${m.kind}` as MessageKey)}</Chip>
          <Chip>{m.ward_id ? wardName.get(m.ward_id) ?? m.ward_id : t('loop.meetings.countyWide')}</Chip>
          {m.status === 'cancelled' && <Chip tone="bad">{t('loop.meetings.cancelled')}</Chip>}
          {m.status === 'held' && <Chip tone="good">{t('loop.meetings.held')}</Chip>}
        </div>
        <h3 className={cn('mt-2 font-display text-lg font-bold leading-snug', m.status === 'cancelled' && 'line-through')}>{title}</h3>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden />{date(m.starts_at, { weekday: 'long', timeZone: 'Africa/Nairobi' })}, {time.format(start)}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{m.venue}</span>
          {m.attendance != null && <span className="inline-flex items-center gap-1.5"><Users className="size-4" aria-hidden />{t('loop.meetings.attendance', { count: m.attendance })}</span>}
        </p>
        {m.agenda && <p className="mt-3 text-sm"><b>{t('loop.meetings.agenda')}.</b> {m.agenda}</p>}
        {m.outcome && <p className="mt-3 rounded-xl bg-good-soft p-3 text-sm"><b className="text-good">{t('loop.meetings.outcome')}.</b> {m.outcome}</p>}
        {m.status === 'scheduled' && new Date(m.ends_at) > new Date() && (
          <Button className="mt-3" size="sm" variant="secondary" icon={<CalendarPlus className="size-4" aria-hidden />} onClick={download}>{t('loop.meetings.addCal')}</Button>
        )}
      </div>
    </li>
  );
}

export default function Meetings() {
  const { t } = useI18n();
  const q = useMeetings();
  const demo = useIsDemo();
  const [ward, setWard] = useState('');
  usePageTitle(t('loop.meetings.title'));
  const [now] = useState(() => Date.now());
  const list = useMemo(() => (q.data ?? []).filter((m) => !ward || m.ward_id === ward || m.ward_id === null), [q.data, ward]);
  const upcoming = list.filter((m) => m.status === 'scheduled' && new Date(m.ends_at).getTime() >= now);
  const past = list.filter((m) => !(m.status === 'scheduled' && new Date(m.ends_at).getTime() >= now)).reverse();
  const usedWards = useMemo(() => [...new Set((q.data ?? []).map((m) => m.ward_id).filter(Boolean) as string[])], [q.data]);
  const options = wards.filter((w) => usedWards.includes(w.id) || w.id === ward).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('loop.meetings.title')}</h1>
      <p className="mt-3 max-w-2xl text-[1.05rem] text-ink-2">{t('loop.meetings.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">
          {t('common.ward')}
          <SelectInput className="mt-1.5 min-w-56" value={ward} onChange={(e) => setWard(e.target.value)}>
            <option value="">{t('loop.meetings.allWards')}</option>
            {options.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </SelectInput>
        </label>
        {ward && <FollowButton kind="ward_tenders" id={ward} label={wardName.get(ward) ?? ward} size="md" />}
      </div>
      {!ward && <p className="mt-2 text-xs text-muted">{t('loop.meetings.followHint')}</p>}

      {q.isLoading ? <Skeleton className="mt-8 h-64" /> : (
        <>
          <h2 className="mt-10 font-display text-xl font-bold">{t('loop.meetings.upcoming')}</h2>
          {upcoming.length === 0 ? <p className="mt-3 text-sm text-muted">{t('loop.meetings.none')}</p> : <ul className="mt-4 space-y-3">{upcoming.map((m) => <MeetingCard key={m.id} m={m} />)}</ul>}
          {past.length > 0 && (
            <>
              <h2 className="mt-10 font-display text-xl font-bold">{t('loop.meetings.past')}</h2>
              <ul className="mt-4 space-y-3">{past.map((m) => <MeetingCard key={m.id} m={m} />)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
