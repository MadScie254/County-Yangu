import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowBigUp, Send } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wardById } from '@/shared/config/county';
import { useQuestions } from '@/shared/api/hooks';
import { answerQuestion, type McaQuestion } from '@/shared/api/engage';
import { useAuth } from '@/shared/state/auth';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { TextArea } from '@/shared/ui/Field';
import { toast } from '@/shared/ui/Toast';
import { Empty, PageHeader, Panel } from '../ui/Page';

/** Residents' public questions to their MCA. Each MCA answers for their own ward; the answer and its speed are public. */
export default function Questions() {
  usePageTitle("Residents' questions", 'CountyConnect');
  const roles = useAuth((s) => s.roles);
  const myWard = roles.find((r) => r.role === 'assembly_member')?.ward_id ?? null;
  const q = useQuestions(myWard);
  const list = q.data ?? [];
  const open = list.filter((x) => x.status === 'open');
  const done = list.filter((x) => x.status === 'answered');
  return (
    <>
      <PageHeader title="Residents' questions" subtitle={`Questions residents asked${myWard ? ` in ${wardById.get(myWard)?.name ?? myWard}` : ''}, most supported first. Your answers are public, and your answer rate (and whether you answered within 14 days) is shown on the Ask your MCA page.`} />
      {!myWard && <p className="mb-4 rounded-2xl bg-bg-2 p-3 text-sm">Only an assembly member linked to a ward can answer. Administrators can read every ward here.</p>}
      <div className="space-y-6">
        <Panel title={`Waiting for an answer (${open.length})`}>{open.length === 0 ? <Empty>Nothing waiting.</Empty> : <ul className="divide-y divide-line">{open.map((x) => <Row key={x.id} x={x} canAnswer={Boolean(myWard)} />)}</ul>}</Panel>
        <Panel title="Answered">{done.length === 0 ? <Empty>None yet.</Empty> : <ul className="divide-y divide-line">{done.map((x) => <Row key={x.id} x={x} canAnswer={false} />)}</ul>}</Panel>
      </div>
    </>
  );
}

function Row({ x, canAnswer }: { x: McaQuestion; canAnswer: boolean }) {
  const { relative } = useI18n();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const send = useMutation({
    mutationFn: () => answerQuestion(x.id, text),
    onSuccess: () => { toast({ tone: 'good', title: 'Answered in public. The resident has been told.' }); setText(''); void qc.invalidateQueries({ queryKey: ['questions'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error && e.message !== 'not_allowed' ? e.message : 'You can answer only for your own ward.' }),
  });
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Chip tone="info"><ArrowBigUp className="size-3.5" aria-hidden />{x.votes}</Chip>
        <span className="font-semibold">{wardById.get(x.ward_id)?.name ?? x.ward_id}</span>
        <span className="text-muted">{relative(x.created_at)}</span>
      </div>
      <p className="mt-1 font-semibold">{x.body}</p>
      {x.answer && <p className="mt-2 rounded-xl bg-good-soft p-3 text-sm">{x.answer}</p>}
      {canAnswer && (
        <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 5) send.mutate(); }}>
          <TextArea aria-label="Your public answer" className="min-h-20" maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Answer in plain words: what will happen, by when, and who is responsible." />
          <Button size="sm" type="submit" icon={<Send className="size-4" aria-hidden />} loading={send.isPending} disabled={text.trim().length < 5}>Publish answer</Button>
        </form>
      )}
    </li>
  );
}
