import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Pause, X } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { useChampionQueue } from '@/shared/api/hooks';
import { decideChampion } from '@/shared/api/civic2';
import type { Champion } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { toast } from '@/shared/ui/Toast';
import { Empty, PageHeader, Panel } from '../ui/Page';

const wardName = new Map(wards.map((w) => [w.id, w.name]));

/** Approve residents who check projects in their ward. Row security limits each officer to the wards they manage. */
export default function Champions() {
  usePageTitle('Ward champions', 'CountyConnect');
  const { relative } = useI18n();
  const qc = useQueryClient();
  const q = useChampionQueue();
  const decide = useMutation({
    mutationFn: ({ c, status }: { c: Champion; status: Champion['status'] }) => decideChampion(c.user_id!, status),
    onSuccess: (_, { status }) => { toast({ tone: 'good', title: status === 'active' ? 'Approved. They have been told.' : 'Saved. They have been told.' }); void qc.invalidateQueries({ queryKey: ['champion-queue'] }); void qc.invalidateQueries({ queryKey: ['champions'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : 'You can decide only for wards you manage.' }),
  });
  const list = q.data ?? [];
  const waiting = list.filter((c) => c.status === 'applied');
  const others = list.filter((c) => c.status !== 'applied');
  const row = (c: Champion) => (
    <li key={c.user_id ?? `${c.ward_id}-${c.display_name}`} className="flex flex-wrap items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{c.display_name} <span className="font-normal text-muted">· {wardName.get(c.ward_id) ?? c.ward_id} · {relative(c.created_at)}</span></p>
        {c.motivation && <p className="mt-1 text-sm text-ink-2">{c.motivation}</p>}
      </div>
      <Chip tone={c.status === 'active' ? 'good' : c.status === 'declined' ? 'bad' : c.status === 'paused' ? 'warn' : 'info'}>{c.status}</Chip>
      {c.user_id && (
        <div className="flex flex-wrap gap-2">
          {c.status !== 'active' && <Button size="sm" icon={<Check className="size-4" aria-hidden />} onClick={() => decide.mutate({ c, status: 'active' })}>Approve</Button>}
          {c.status === 'active' && <Button size="sm" variant="secondary" icon={<Pause className="size-4" aria-hidden />} onClick={() => decide.mutate({ c, status: 'paused' })}>Pause</Button>}
          {c.status === 'applied' && <Button size="sm" variant="ghost" icon={<X className="size-4" aria-hidden />} onClick={() => decide.mutate({ c, status: 'declined' })}>Decline</Button>}
        </div>
      )}
    </li>
  );
  return (
    <>
      <PageHeader title="Ward champions" subtitle="Residents who visit county projects in their own ward and say whether the work matches what was promised. Approve people you can vouch for; pause anyone who misuses it." />
      <div className="space-y-6">
        <Panel title={`Waiting (${waiting.length})`}>{waiting.length === 0 ? <Empty>No applications waiting.</Empty> : <ul className="divide-y divide-line">{waiting.map(row)}</ul>}</Panel>
        <Panel title="Decided">{others.length === 0 ? <Empty>None yet.</Empty> : <ul className="divide-y divide-line">{others.map(row)}</ul>}</Panel>
      </div>
    </>
  );
}
