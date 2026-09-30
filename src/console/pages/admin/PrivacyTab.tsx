import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useErasureQueue } from '@/shared/api/hooks';
import { carryOutErasure } from '@/shared/api/rights';
import { Button } from '@/shared/ui/Button';
import { toast } from '@/shared/ui/Toast';
import { Empty, Panel } from '../../ui/Page';

/** Data Protection Act, 2019: erasure requests must be acted on within 14 days. */
export function PrivacyTab() {
  const { date } = useI18n();
  const qc = useQueryClient();
  const q = useErasureQueue(true);
  const [now] = useState(() => Date.now());
  const run = useMutation({
    mutationFn: carryOutErasure,
    onSuccess: () => { toast({ tone: 'good', title: 'Personal details erased. Delete the sign-in itself in Supabase: Authentication, Users.' }); void qc.invalidateQueries({ queryKey: ['erasure-queue'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }),
  });
  const list = q.data ?? [];
  return (
    <Panel title="Erasure requests" action={<span className="flex items-center gap-1.5 text-sm text-muted"><ShieldCheck className="size-4" aria-hidden />14 days to act</span>}>
      <p className="mb-3 text-sm text-ink-2">Erasing removes the profile details, follows, notifications and consultation comments, and hides the name on information requests. Payments, permits issued and applications are kept because the law requires the county to keep them; the resident is told this when they ask.</p>
      {list.length === 0 ? <Empty>No open requests.</Empty> : (
        <ul className="divide-y divide-line">
          {list.map((r) => {
            const late = Date.parse(r.due_at) < now;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1"><b>{r.email ?? 'Unknown email'}</b>{r.reason && <span className="block text-sm text-ink-2">{r.reason}</span>}</span>
                <span className={late ? 'text-sm font-semibold text-bad' : 'text-sm text-muted'}>due {date(r.due_at, { dateStyle: 'medium' })}</span>
                <Button size="sm" variant="danger" loading={run.isPending} onClick={() => { if (window.confirm('Erase this person\'s details now? This cannot be undone.')) run.mutate(r.id); }}>Erase now</Button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
