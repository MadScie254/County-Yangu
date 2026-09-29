import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { TextInput } from '@/shared/ui/Field';
import { Meter } from '@/shared/ui/Meter';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { getAiUsage, setAiBudget, type AiUsageRow } from '../../api/admin';
import { Panel, Table, td } from '../../ui/Page';

function Row({ r, onSave }: { r: AiUsageRow; onSave: (dept: string | null, cap: number | null) => void }) {
  const { kes } = useI18n();
  const [cap, setCap] = useState(String(r.cap_kes));
  const pct = r.cap_kes > 0 ? r.spent_kes / r.cap_kes : 1;
  return (
    <tr>
      <td className={td}><span className="font-semibold">{r.department}</span><p className="text-muted">{r.calls} calls this month</p></td>
      <td className={`${td} min-w-56`}><Meter value={r.spent_kes} max={Math.max(r.cap_kes, 1)} label="AI spend this month" tone={pct >= 1 ? 'bad' : pct >= 0.8 ? 'warn' : 'brand'} /><p className="mt-1 font-data text-xs text-muted">{kes(r.spent_kes)} of {kes(r.cap_kes)}{pct >= 1 ? ' · AI paused for this department' : ''}</p></td>
      <td className={td}>
        <div className="flex items-center gap-2">
          <TextInput aria-label={`Monthly cap for ${r.department} (KES)`} inputMode="numeric" className="w-28" value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ''))} />
          <Button size="sm" variant="secondary" disabled={cap === '' || Number(cap) === r.cap_kes} onClick={() => onSave(r.department_id, Number(cap))}>Set</Button>
        </div>
      </td>
    </tr>
  );
}

export function AiTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['c-ai-usage'], queryFn: getAiUsage });
  const save = useMutation({
    mutationFn: (v: { dept: string | null; cap: number | null }) => setAiBudget(v.dept, v.cap),
    onSuccess: () => { toast({ tone: 'good', title: 'Budget updated' }); void qc.invalidateQueries({ queryKey: ['c-ai-usage'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }),
  });
  return (
    <Panel pad={false} title="AI assistant spending" action={<Chip tone="info"><Sparkles className="size-3.5" aria-hidden />resets on the 1st</Chip>}>
      <p className="border-b border-line px-5 py-3 text-sm text-muted">Staff can ask the assistant to draft replies and answer questions about the county’s data. Each department has a monthly cap in shillings; when it is reached the assistant stops for that department until the next month. A department with no cap of its own uses the county-wide one. The assistant only drafts and answers: nothing it writes is sent or decided without a person.</p>
      {q.isLoading ? <div className="p-5"><Skeleton className="h-40" /></div> : (
        <Table head={['Department', 'Spent', 'Monthly cap (KES)']}>
          {q.data!.map((r) => <Row key={r.department_id ?? 'pool'} r={r} onSave={(dept, cap) => save.mutate({ dept, cap })} />)}
        </Table>
      )}
    </Panel>
  );
}
