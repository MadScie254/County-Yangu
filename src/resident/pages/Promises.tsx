import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, History } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { useCommitments, useIsDemo, useProjects } from '@/shared/api/hooks';
import { isOverdue } from '@/shared/api/loop';
import type { Commitment, CommitmentStatus } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Chip, type Tone } from '@/shared/ui/Chip';
import { SelectInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { FollowButton } from '@/shared/ui/FollowButton';

const order: CommitmentStatus[] = ['delivered', 'in_progress', 'not_started', 'delayed', 'dropped'];
export const promiseTone: Record<CommitmentStatus, Tone> = { delivered: 'good', in_progress: 'info', not_started: 'neutral', delayed: 'warn', dropped: 'bad' };
const barColor: Record<CommitmentStatus, string> = { delivered: 'bg-good', in_progress: 'bg-info', not_started: 'bg-line-strong', delayed: 'bg-warn', dropped: 'bg-bad' };
const wardName = new Map(wards.map((w) => [w.id, w.name]));
const DAY = 86_400_000;

function PromiseCard({ c, today, projectSlug }: { c: Commitment; today: string; projectSlug: string | null }) {
  const { t, locale, date, number } = useI18n();
  const [open, setOpen] = useState(false);
  const title = locale === 'sw' && c.title_sw ? c.title_sw : c.title;
  const late = isOverdue(c, today);
  const lateDays = late && c.due_on ? Math.round((Date.parse(today) - Date.parse(c.due_on)) / DAY) : 0;
  return (
    <li id={c.slug} className="scroll-mt-24 rounded-[1.5rem] border border-line bg-surface p-5 shadow-card target:ring-2 target:ring-brand">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={promiseTone[c.status]}>{t(`loop.promises.status.${c.status}` as MessageKey)}</Chip>
        {late && <Chip tone="bad">{t('loop.promises.overdueBy', { days: number(lateDays) })}</Chip>}
        {c.sector && <Chip>{c.sector}</Chip>}
        {c.ward_id && <Chip>{wardName.get(c.ward_id) ?? c.ward_id}</Chip>}
      </div>
      <h3 className="mt-2 font-display text-lg font-bold leading-snug">{title}</h3>
      {c.detail && <p className="mt-1 text-sm text-ink-2">{c.detail}</p>}
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div><dt className="inline font-semibold">{t('loop.promises.source')}: </dt><dd className="inline">{c.source}{c.made_on ? `, ${date(c.made_on, { dateStyle: 'medium' })}` : ''}</dd></div>
        <div className={cn(late && 'font-semibold text-bad')}>{c.due_on ? t('loop.promises.due', { date: date(c.due_on, { dateStyle: 'medium' }) }) : t('loop.promises.noDue')}</div>
      </dl>
      {c.evidence && <p className="mt-3 rounded-xl bg-bg-2/70 p-3 text-sm"><b>{t('loop.promises.evidence')}.</b> {c.evidence}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FollowButton kind="commitment" id={c.slug} label={c.title.slice(0, 160)} />
        {c.source_url && <a href={c.source_url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand hover:underline"><ExternalLink className="size-4" aria-hidden />{t('loop.promises.readSource')}</a>}
        {projectSlug && <Link to={`/projects/${projectSlug}`} className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-brand hover:underline">{t('loop.promises.project')}</Link>}
        {c.updates.length > 1 && (
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold hover:bg-bg-2">
            <History className="size-4" aria-hidden />{t('loop.promises.history')} ({c.updates.length})
          </button>
        )}
      </div>
      {open && (
        <ol className="mt-3 space-y-3 border-l-2 border-line pl-4">
          {[...c.updates].reverse().map((u) => (
            <li key={u.id} className="relative text-sm">
              <span aria-hidden className={cn('absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full', barColor[u.status])} />
              <p><b>{t(`loop.promises.status.${u.status}` as MessageKey)}</b> <span className="text-muted">· {date(u.created_at, { dateStyle: 'medium' })}</span></p>
              {u.note && <p className="text-ink-2">{u.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

export default function Promises() {
  const { t, number } = useI18n();
  const q = useCommitments();
  const projects = useProjects();
  const demo = useIsDemo();
  usePageTitle(t('loop.promises.title'));
  const [status, setStatus] = useState<CommitmentStatus | 'overdue' | ''>('');
  const [sector, setSector] = useState('');
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const all = useMemo(() => q.data ?? [], [q.data]);
  const counts = useMemo(() => Object.fromEntries(order.map((s) => [s, all.filter((c) => c.status === s).length])) as Record<CommitmentStatus, number>, [all]);
  const overdue = all.filter((c) => isOverdue(c, today)).length;
  const sectors = useMemo(() => [...new Set(all.map((c) => c.sector).filter(Boolean) as string[])].sort(), [all]);
  const list = all.filter((c) => (!sector || c.sector === sector) && (!status || (status === 'overdue' ? isOverdue(c, today) : c.status === status)));
  const slugOf = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.slug])), [projects.data]);

  // Arriving from a notification (/promises#slug): scroll to that promise once the list is on screen.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id && all.length) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
  }, [all.length]);

  const tile = (key: CommitmentStatus | 'overdue' | '', label: string, value: number, tone?: string) => (
    <button type="button" onClick={() => setStatus(status === key ? '' : key)} aria-pressed={status === key}
      className={cn('rounded-2xl border p-4 text-left transition-colors', status === key ? 'border-ink bg-bg-2' : 'border-line bg-surface hover:bg-bg-2/60')}>
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className={cn('mt-1 font-display text-2xl font-extrabold', tone)}>{number(value)}</p>
    </button>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('loop.promises.title')}</h1>
      <p className="mt-3 max-w-2xl text-[1.05rem] text-ink-2">{t('loop.promises.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}

      {q.isLoading ? <Skeleton className="mt-8 h-72" /> : all.length === 0 ? <p className="mt-8 rounded-2xl bg-bg-2 p-5 text-sm">{t('loop.promises.none')}</p> : (
        <>
          <div className="mt-8 flex h-3 overflow-hidden rounded-full bg-bg-2" role="img" aria-label={order.map((s) => `${t(`loop.promises.status.${s}` as MessageKey)}: ${counts[s]}`).join(', ')}>
            {order.map((s) => counts[s] > 0 && <span key={s} className={cn('h-full border-r-2 border-surface last:border-r-0', barColor[s])} style={{ width: `${(100 * counts[s]) / all.length}%` }} />)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {tile('', t('loop.promises.total'), all.length)}
            {tile('delivered', t('loop.promises.status.delivered'), counts.delivered, 'text-good')}
            {tile('in_progress', t('loop.promises.status.in_progress'), counts.in_progress)}
            {tile('not_started', t('loop.promises.status.not_started'), counts.not_started)}
            {tile('delayed', t('loop.promises.status.delayed'), counts.delayed, 'text-warn')}
            {tile('overdue', t('loop.promises.overdue'), overdue, overdue ? 'text-bad' : undefined)}
          </div>

          {sectors.length > 1 && (
            <label className="mt-6 block max-w-xs text-sm font-semibold">
              {t('loop.promises.sector')}
              <SelectInput className="mt-1.5" value={sector} onChange={(e) => setSector(e.target.value)}>
                <option value="">{t('loop.promises.all')}</option>
                {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
              </SelectInput>
            </label>
          )}

          {list.length === 0 ? <p className="mt-6 text-sm text-muted">{t('loop.promises.noneFilter')}</p> : (
            <ul className="mt-6 space-y-3">
              {list.map((c) => <PromiseCard key={c.id} c={c} today={today} projectSlug={c.project_id ? slugOf.get(c.project_id) ?? null : null} />)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
