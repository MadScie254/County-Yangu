import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Users } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { useOpenCases } from '@/shared/api/hooks';
import { sendMeToo, SubmitError } from '@/shared/api/submit';
import { Button } from '@/shared/ui/Button';
import { Chip, reportTone } from '@/shared/ui/Chip';

/** While reporting: the same kind of problem is already open in this ward. Join one instead of filing a duplicate. */
export function OpenCasesPanel({ ward, category }: { ward: string; category: string | null }) {
  const { t, relative } = useI18n();
  const qc = useQueryClient();
  const q = useOpenCases(ward || null, category);
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  const join = useMutation({
    mutationFn: (ref: string) => sendMeToo(ref),
    onSuccess: (_d, ref) => { setJoined((j) => ({ ...j, [ref]: true })); void qc.invalidateQueries({ queryKey: ['open-cases'] }); },
    onError: (e, ref) => { if (e instanceof SubmitError && e.code === 'already_added') setJoined((j) => ({ ...j, [ref]: true })); },
  });
  const list = q.data ?? [];
  if (!ward || list.length === 0) return null;
  return (
    <section className="mb-6 rounded-[1.5rem] border border-info/30 bg-info-soft p-5" aria-labelledby="dupes">
      <h2 id="dupes" className="font-display text-lg font-bold">{t('loop.dupes.title')}</h2>
      <p className="mt-1 text-sm text-ink-2">{t('loop.dupes.intro')}</p>
      <ul className="mt-4 space-y-2">
        {list.map((c) => (
          <li key={c.reference} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-3 shadow-card">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.category_id ? t(`categories.${c.category_id}` as MessageKey) : c.reference}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                <Chip tone={reportTone(c.status)}>{t(`statuses.${c.status}` as MessageKey)}</Chip>
                {t('loop.dupes.reported', { when: relative(c.created_at) })}
                {c.supporters > 0 && <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{t('loop.metoo.count', { count: c.supporters })}</span>}
              </p>
            </div>
            <Link to={`/case/${c.reference}`} className="text-sm font-semibold underline-offset-4 hover:underline">{t('loop.dupes.view')}</Link>
            {joined[c.reference]
              ? <Chip tone="good"><Check className="size-3.5" aria-hidden />{t('loop.metoo.added')}</Chip>
              : <Button size="sm" loading={join.isPending && join.variables === c.reference} icon={<Users className="size-4" aria-hidden />} onClick={() => join.mutate(c.reference)}>{t('loop.metoo.button')}</Button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
