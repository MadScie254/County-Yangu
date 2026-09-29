import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Code2, Send, Sparkles } from 'lucide-react';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { TextInput } from '@/shared/ui/Field';
import { askAssistant, type AssistantAnswer } from '../api/ai';
import { PageHeader, Panel, Table, td } from '../ui/Page';

const suggestions = [
  'Which five wards have the most open drainage cases?',
  'How many cases are more than 14 days overdue, by department?',
  'How much permit revenue did we collect this week compared with last week?',
];

type Turn = { q: string; a?: AssistantAnswer; error?: string };

/**
 * A question-answering helper for staff. It never changes anything: it writes a read-only query against
 * approved views, runs it with the asker's own permissions, and always shows the query beside the answer
 * so a person can check it.
 */
export default function Assistant() {
  usePageTitle('AI assistant', 'CountyConnect');
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const ask = useMutation({
    mutationFn: async (q: string) => {
      setTurns((t) => [...t, { q }]);
      try {
        const a = await askAssistant(q);
        setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a } : x)));
      } catch (e) {
        const error = (e as Error).message === 'budget' ? 'Your department has used its AI allowance for this month.' : 'The assistant could not answer that. Try rephrasing it.';
        setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error } : x)));
      }
      setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
    },
  });
  const send = (q: string) => { const v = q.trim(); if (!v || ask.isPending) return; setText(''); ask.mutate(v); };

  return (
    <>
      <PageHeader title="AI assistant" subtitle="Ask a question about the county's data in plain English. It reads, it never changes anything, and it shows its working." />
      <div className="mx-auto max-w-3xl space-y-4">
        {turns.length === 0 && (
          <Panel>
            <p className="flex items-center gap-2 font-display text-lg font-bold"><Sparkles className="size-5 text-brand" aria-hidden />Try asking</p>
            <ul className="mt-3 space-y-2">
              {suggestions.map((s) => <li key={s}><button type="button" onClick={() => send(s)} className="w-full rounded-2xl border border-line bg-bg px-4 py-3 text-left text-sm font-medium transition hover:border-ink">{s}</button></li>)}
            </ul>
            <p className="mt-4 text-xs text-muted">Personal details are removed before a question leaves the county’s systems. Every question is logged against your department’s monthly allowance.</p>
          </Panel>
        )}

        {turns.map((t, i) => (
          <div key={i} className="space-y-3">
            <p className="ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-lg bg-ink px-4 py-2.5 text-bg">{t.q}</p>
            <Panel>
              {!t.a && !t.error && <p role="status" className="text-muted">Working it out…</p>}
              {t.error && <p role="alert" className="font-medium text-bad">{t.error}</p>}
              {t.a && (
                <div className="space-y-4">
                  <p className="whitespace-pre-line">{t.a.answer}</p>
                  {t.a.columns && t.a.rows && (
                    <div className="overflow-hidden rounded-xl border border-line">
                      <Table head={t.a.columns}>
                        {t.a.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className={`${td} ${ci > 0 ? 'font-data' : ''}`}>{c ?? '—'}</td>)}</tr>)}
                      </Table>
                    </div>
                  )}
                  {t.a.query && (
                    <details className="rounded-xl bg-bg-2 p-3 text-sm">
                      <summary className="flex cursor-pointer items-center gap-2 font-semibold"><Code2 className="size-4" aria-hidden />The query behind this answer</summary>
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-data text-[0.8rem] text-ink-2">{t.a.query}</pre>
                    </details>
                  )}
                </div>
              )}
            </Panel>
          </div>
        ))}
        <div ref={end} />

        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="sticky bottom-4 flex gap-2 rounded-[1.5rem] border border-line bg-surface p-2 shadow-float">
          <TextInput aria-label="Your question" placeholder="Ask about cases, projects, revenue…" className="border-0 bg-transparent shadow-none" value={text} onChange={(e) => setText(e.target.value)} maxLength={400} />
          <Button type="submit" icon={<Send className="size-4" aria-hidden />} loading={ask.isPending} disabled={!text.trim()}>Ask</Button>
        </form>
      </div>
    </>
  );
}
