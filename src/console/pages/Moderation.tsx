import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Trash2 } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useModerationQueue } from '@/shared/api/hooks';
import { moderate, type ModerationItem } from '@/shared/api/civic2';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { toast } from '@/shared/ui/Toast';
import { Empty, PageHeader, Panel } from '../ui/Page';

const kinds: Record<string, string> = { consultation_comment: 'Consultation comment', statement: 'Statement', champion_check: 'Champion check', concern: 'Procurement concern' };
const reasons: Record<string, string> = { abuse: 'Abuse or hate', personal_details: 'Personal details', false: 'False information', spam: 'Spam', other: 'Other' };

/**
 * Content residents have flagged. Three flags hide a comment or statement until someone here decides.
 * Keep anything that is only critical of the county: removing criticism is not what this is for.
 */
export default function Moderation() {
  usePageTitle('Moderation', 'CountyConnect');
  const { relative } = useI18n();
  const qc = useQueryClient();
  const q = useModerationQueue();
  const act = useMutation({
    mutationFn: ({ m, remove }: { m: ModerationItem; remove: boolean }) => moderate(m.kind, m.target_id, remove),
    onSuccess: (_, { remove }) => { toast({ tone: 'good', title: remove ? 'Removed from public view.' : 'Kept and shown again.' }); void qc.invalidateQueries({ queryKey: ['moderation'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }),
  });
  const list = q.data ?? [];
  return (
    <>
      <PageHeader title="Moderation" subtitle="Flagged comments and statements. Remove abuse, hate, spam and other people's phone numbers or ID numbers. Keep criticism of the county, even when it is harsh." />
      <Panel title={`Flagged (${list.length})`}>
        {list.length === 0 ? <Empty>Nothing flagged.</Empty> : (
          <ul className="divide-y divide-line">{list.map((m) => (
            <li key={`${m.kind}-${m.target_id}`} className="py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Chip>{kinds[m.kind] ?? m.kind}</Chip>
                <Chip tone="bad">{m.flags} flag{m.flags === 1 ? '' : 's'}</Chip>
                {m.hidden && <Chip tone="warn">hidden for now</Chip>}
                <span className="text-muted">{m.reasons.map((r) => reasons[r] ?? r).join(', ')} · {relative(m.last)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line rounded-xl bg-bg-2 p-3 text-sm">{m.text ?? '(no longer available)'}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" icon={<Check className="size-4" aria-hidden />} onClick={() => act.mutate({ m, remove: false })}>Keep</Button>
                <Button size="sm" variant="danger" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => act.mutate({ m, remove: true })}>Remove</Button>
              </div>
            </li>
          ))}</ul>
        )}
      </Panel>
    </>
  );
}
