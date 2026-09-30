import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, MessagesSquare } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { useConsultations, useIsDemo } from '@/shared/api/hooks';
import { consultationOpen } from '@/shared/api/rights';
import type { Consultation } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { Chip } from '@/shared/ui/Chip';
import { Skeleton } from '@/shared/ui/Card';

const wardName = new Map(wards.map((w) => [w.id, w.name]));
const DAY = 86_400_000;

function Card({ c, now }: { c: Consultation; now: number }) {
  const { t, locale, date, number } = useI18n();
  const open = consultationOpen(c, now);
  const left = Math.ceil((Date.parse(c.closes_at) - now) / DAY);
  return (
    <li>
      <Link to={`/have-your-say/${c.slug}`} className="block rounded-[1.5rem] border border-line bg-surface p-5 shadow-card transition-colors hover:border-line-strong">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="vote">{t(`rights.say.kind.${c.kind}` as MessageKey)}</Chip>
          <Chip>{c.ward_id ? wardName.get(c.ward_id) ?? c.ward_id : t('loop.notices.countyWide')}</Chip>
          {open ? <Chip tone="good">{t('rights.say.daysLeft', { days: number(Math.max(0, left)) })}</Chip> : c.report ? <Chip tone="info">{t('rights.say.report')}</Chip> : <Chip>{t('rights.say.closed')}</Chip>}
        </div>
        <h3 className="mt-2 font-display text-lg font-bold leading-snug">{locale === 'sw' && c.title_sw ? c.title_sw : c.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-ink-2">{locale === 'sw' && c.summary_sw ? c.summary_sw : c.summary}</p>
        <p className="mt-2 text-xs font-semibold text-muted">{open ? t('rights.say.closes', { date: date(c.closes_at, { dateStyle: 'medium' }) }) : t('rights.say.closedOn', { date: date(c.closes_at, { dateStyle: 'medium' }) })}</p>
      </Link>
    </li>
  );
}

export default function HaveYourSay() {
  const { t } = useI18n();
  const q = useConsultations();
  const demo = useIsDemo();
  const [now] = useState(() => Date.now());
  usePageTitle(t('rights.say.title'));
  const all = q.data ?? [];
  const open = all.filter((c) => consultationOpen(c, now)).sort((a, b) => a.closes_at.localeCompare(b.closes_at));
  const closed = all.filter((c) => Date.parse(c.closes_at) < now);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('rights.say.title')}</h1>
      <p className="mt-3 max-w-2xl text-[1.05rem] text-ink-2">{t('rights.say.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}
      {q.isLoading ? <Skeleton className="mt-8 h-64" /> : (
        <>
          <h2 className="mt-10 flex items-center gap-2 font-display text-xl font-bold"><MessagesSquare className="size-5" aria-hidden />{t('rights.say.open')}</h2>
          {open.length === 0 ? <p className="mt-3 text-sm text-muted">{t('rights.say.none')}</p> : <ul className="mt-4 space-y-3">{open.map((c) => <Card key={c.id} c={c} now={now} />)}</ul>}
          {closed.length > 0 && (
            <>
              <h2 className="mt-10 flex items-center gap-2 font-display text-xl font-bold"><FileText className="size-5" aria-hidden />{t('rights.say.closed')}</h2>
              <ul className="mt-4 space-y-3">{closed.map((c) => <Card key={c.id} c={c} now={now} />)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
