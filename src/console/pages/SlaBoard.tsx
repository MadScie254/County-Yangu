import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Flag } from 'lucide-react';
import { wardLabel } from '@/shared/config/county';
import { usePageTitle } from '@/shared/lib/hooks';
import { Chip } from '@/shared/ui/Chip';
import { Skeleton } from '@/shared/ui/Card';
import { cn } from '@/shared/lib/utils';
import { isOpen, levelLabel, sla } from '../lib/cases';
import { nameMaps, useCases, useCategories, useDepartments } from '../api/hooks';
import { PageHeader } from '../ui/Page';
import type { CaseRow } from '../api/types';

const cols: { id: string; title: string; hint: string; tone: string; pick: (c: CaseRow) => boolean }[] = [
  { id: 'crit', title: 'Escalated', hint: 'Already climbed the ladder', tone: 'border-bad', pick: (c) => isOpen(c) && c.escalation_level >= 3 },
  { id: 'over', title: 'Overdue', hint: 'Past target, not yet escalated far', tone: 'border-bad/60', pick: (c) => isOpen(c) && c.escalation_level < 3 && sla(c).state === 'overdue' },
  { id: 'risk', title: 'Due in 24 hours', hint: 'Act now', tone: 'border-warn', pick: (c) => isOpen(c) && sla(c).state === 'at_risk' },
  { id: 'ok', title: 'On track', hint: 'More than a day left', tone: 'border-good/60', pick: (c) => isOpen(c) && sla(c).state === 'ok' },
];

export default function SlaBoard() {
  usePageTitle('SLA board', 'CountyConnect');
  const cases = useCases();
  const cats = useCategories();
  const depts = useDepartments();
  const maps = nameMaps(depts.data, cats.data);
  const data = cases.data ?? [];
  const board = useMemo(() => cols.map((col) => ({ ...col, items: data.filter(col.pick).sort((a, b) => sla(a).ms - sla(b).ms) })), [data]);

  return (
    <>
      <PageHeader title="SLA board" subtitle="Every open case, in the column that matches how close it is to its target date." />
      {cases.isLoading ? <div className="grid gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}</div> : (
        <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {board.map((col) => (
            <section key={col.id} aria-labelledby={`c-${col.id}`} className={cn('rounded-[1.5rem] border-t-4 bg-bg-2/60 p-3', col.tone)}>
              <header className="flex items-baseline justify-between px-2 pb-2 pt-1"><h2 id={`c-${col.id}`} className="font-display text-lg font-bold">{col.title}</h2><span className="font-data text-sm font-semibold text-ink-2">{col.items.length}</span></header>
              <p className="px-2 pb-3 text-xs text-muted">{col.hint}</p>
              <ul className="space-y-2">
                {col.items.slice(0, 25).map((c) => {
                  const s = sla(c);
                  return (
                    <li key={c.id}>
                      <Link to={`/cases/${c.id}`} className="block rounded-2xl border border-line bg-surface p-3.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-float">
                        <div className="flex items-start justify-between gap-2"><span className="font-data text-[0.75rem] text-muted">{c.reference}</span><Chip tone={s.tone}>{s.label}</Chip></div>
                        <p className="mt-1.5 font-semibold leading-snug">{maps.cat.get(c.category_id ?? '')}</p>
                        <p className="text-sm text-muted">{wardLabel(c.ward_id)}{c.flagged_financial && <span className="ml-2 inline-flex items-center gap-1 text-bad"><Flag className="size-3" aria-hidden />integrity</span>}</p>
                        {c.escalation_level > 0 && <p className="mt-1.5 text-xs font-semibold text-bad">{levelLabel[c.escalation_level]}</p>}
                      </Link>
                    </li>
                  );
                })}
                {col.items.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">Nothing here</li>}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
