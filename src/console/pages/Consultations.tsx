import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, Plus, Save } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { useConsultationComments, useConsultations, useConsultationTally } from '@/shared/api/hooks';
import { consultationOpen, saveConsultation } from '@/shared/api/rights';
import type { Consultation, ConsultationKind } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea, TextInput } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { toast } from '@/shared/ui/Toast';
import { Empty, PageHeader, Panel } from '../ui/Page';

const kinds: [ConsultationKind, string][] = [['bill', 'Draft bill'], ['budget', 'Budget'], ['policy', 'Policy'], ['plan', 'Plan'], ['other', 'Other']];
type Draft = { id?: string; slug: string; kind: ConsultationKind; title: string; title_sw: string; summary: string; summary_sw: string; document_url: string; questions: string; ward_id: string; opens: string; closes: string; report: string; report_url: string };
const blank: Draft = { slug: '', kind: 'bill', title: '', title_sw: '', summary: '', summary_sw: '', document_url: '', questions: '', ward_id: '', opens: '', closes: '', report: '', report_url: '' };
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
const nai = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString().slice(0, 10);

function Summary({ c }: { c: Consultation }) {
  const comments = useConsultationComments(c.id);
  const tally = useConsultationTally(c.slug);
  const tl = tally.data;
  const byQ = new Map<number | null, number>();
  for (const x of comments.data ?? []) byQ.set(x.question, (byQ.get(x.question) ?? 0) + 1);
  return (
    <div className="space-y-2 rounded-2xl bg-bg-2 p-3 text-sm">
      <p><b>{tl?.comments ?? 0}</b> comments from <b>{tl?.people ?? 0}</b> people in <b>{tl?.wards ?? 0}</b> wards. Support {tl?.by_stance.support ?? 0}, oppose {tl?.by_stance.oppose ?? 0}, change {tl?.by_stance.amend ?? 0}, comment {tl?.by_stance.comment ?? 0}.</p>
      {c.questions.length > 0 && <ul className="list-disc pl-5">{c.questions.map((q, i) => <li key={q}>{q}: {byQ.get(i) ?? 0}</li>)}<li>Whole draft: {byQ.get(null) ?? 0}</li></ul>}
    </div>
  );
}

/** Public participation on drafts (Constitution art. 196, County Governments Act s. 87). Publish a report when it closes. */
export default function Consultations() {
  usePageTitle('Have your say', 'CountyConnect');
  const { date } = useI18n();
  const qc = useQueryClient();
  const q = useConsultations();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [sel, setSel] = useState<Consultation | null>(null);
  const save = useMutation({
    mutationFn: (d: Draft) => saveConsultation({
      id: d.id, slug: d.slug, kind: d.kind, title: d.title.trim(), title_sw: d.title_sw.trim() || null, summary: d.summary.trim(), summary_sw: d.summary_sw.trim() || null,
      document_url: d.document_url.trim() || null, questions: d.questions.split('\n').map((x) => x.trim()).filter(Boolean), ward_id: d.ward_id || null,
      opens_at: new Date(`${d.opens}T00:00:00+03:00`).toISOString(), closes_at: new Date(`${d.closes}T23:59:00+03:00`).toISOString(),
      report: d.report.trim() || null, report_url: d.report_url.trim() || null,
    }),
    onSuccess: () => { toast({ tone: 'good', title: 'Saved and published.' }); setEdit(null); void qc.invalidateQueries({ queryKey: ['consultations'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }),
  });
  const open = (c: Consultation) => {
    setSel(c);
    setEdit({ id: c.id, slug: c.slug, kind: c.kind, title: c.title, title_sw: c.title_sw ?? '', summary: c.summary, summary_sw: c.summary_sw ?? '', document_url: c.document_url ?? '', questions: c.questions.join('\n'), ward_id: c.ward_id ?? '', opens: nai(c.opens_at), closes: nai(c.closes_at), report: c.report ?? '', report_url: c.report_url ?? '' });
  };
  const today = new Date().toISOString().slice(0, 10);
  const days = edit?.opens && edit.closes ? (Date.parse(edit.closes) - Date.parse(edit.opens)) / 86_400_000 : 0;
  const valid = edit && edit.title.trim().length >= 5 && edit.summary.trim().length >= 20 && /^[a-z0-9][a-z0-9-]{2,78}$/.test(edit.slug) && edit.opens && edit.closes && days >= 7
    && (!edit.document_url || edit.document_url.startsWith('https://')) && (!edit.report_url || edit.report_url.startsWith('https://'));
  const list = q.data ?? [];

  return (
    <>
      <PageHeader title="Have your say" subtitle="Publish draft bills, budgets and policies for comment, with a plain-language summary and the questions you want answered. Comments stay open at least seven days. When it closes, publish what you heard and what changed: everyone who commented is told."
        actions={<Button icon={<Plus className="size-4" aria-hidden />} onClick={() => { setSel(null); setEdit({ ...blank, opens: today }); }}>New consultation</Button>} />
      <Panel title="Consultations">
        {list.length === 0 ? <Empty>No consultations yet.</Empty> : (
          <ul className="divide-y divide-line">
            {list.map((c) => {
              const isOpen = consultationOpen(c);
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => open(c)} className="flex w-full flex-wrap items-center gap-3 py-3 text-left hover:bg-bg-2/60">
                    <Chip tone={isOpen ? 'good' : c.report ? 'info' : 'warn'}>{isOpen ? 'open' : c.report ? 'report published' : 'report due'}</Chip>
                    <span className="min-w-0 flex-1 font-semibold">{c.title}</span>
                    <span className="text-sm text-muted">closes {date(c.closes_at, { dateStyle: 'medium' })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Sheet open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? 'Consultation' : 'New consultation'} className="sm:max-w-xl">
        {edit && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(edit); }}>
            {sel && <Summary c={sel} />}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kind">{({ id }) => <SelectInput id={id} value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as ConsultationKind })}>{kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</SelectInput>}</Field>
              <Field label="Ward">{({ id }) => <SelectInput id={id} value={edit.ward_id} onChange={(e) => setEdit({ ...edit, ward_id: e.target.value })}><option value="">County-wide</option>{[...wards].sort((a, b) => a.name.localeCompare(b.name)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
            </div>
            <Field label="Title">{({ id }) => <TextInput id={id} value={edit.title} maxLength={200} onChange={(e) => setEdit({ ...edit, title: e.target.value, slug: edit.id ? edit.slug : slugify(e.target.value) })} />}</Field>
            <Field label="Title in Kiswahili" optionalLabel="optional">{({ id }) => <TextInput id={id} value={edit.title_sw} maxLength={200} onChange={(e) => setEdit({ ...edit, title_sw: e.target.value })} />}</Field>
            <Field label="Plain-language summary: what changes and for whom">{({ id }) => <TextArea id={id} className="min-h-28" maxLength={4000} value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} />}</Field>
            <Field label="Summary in Kiswahili" optionalLabel="optional">{({ id }) => <TextArea id={id} className="min-h-20" maxLength={4000} value={edit.summary_sw} onChange={(e) => setEdit({ ...edit, summary_sw: e.target.value })} />}</Field>
            <Field label="Link to the full draft" optionalLabel="optional">{({ id }) => <TextInput id={id} placeholder="https://" value={edit.document_url} onChange={(e) => setEdit({ ...edit, document_url: e.target.value })} />}</Field>
            <Field label="Parts or questions residents can comment on, one per line" optionalLabel="optional">{({ id }) => <TextArea id={id} className="min-h-20" value={edit.questions} onChange={(e) => setEdit({ ...edit, questions: e.target.value })} />}</Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Opens">{({ id }) => <TextInput id={id} type="date" value={edit.opens} onChange={(e) => setEdit({ ...edit, opens: e.target.value })} />}</Field>
              <Field label="Closes">{({ id }) => <TextInput id={id} type="date" value={edit.closes} onChange={(e) => setEdit({ ...edit, closes: e.target.value })} />}</Field>
              <Field label="Web address">{({ id }) => <TextInput id={id} value={edit.slug} disabled={Boolean(edit.id)} onChange={(e) => setEdit({ ...edit, slug: slugify(e.target.value) })} />}</Field>
            </div>
            {edit.opens && edit.closes && days < 7 && <p className="text-sm font-semibold text-bad">Keep comments open for at least seven days.</p>}
            {edit.id && (
              <div className="space-y-3 rounded-2xl border border-line p-3">
                <p className="flex items-center gap-2 font-semibold"><FileCheck2 className="size-4" aria-hidden />Report: what you heard and what changed</p>
                <Field label="Report (published; everyone who commented is told)" optionalLabel="optional">{({ id }) => <TextArea id={id} className="min-h-28" maxLength={20000} value={edit.report} onChange={(e) => setEdit({ ...edit, report: e.target.value })} />}</Field>
                <Field label="Link to the full report" optionalLabel="optional">{({ id }) => <TextInput id={id} placeholder="https://" value={edit.report_url} onChange={(e) => setEdit({ ...edit, report_url: e.target.value })} />}</Field>
              </div>
            )}
            <Button type="submit" icon={<Save className="size-4" aria-hidden />} loading={save.isPending} disabled={!valid}>Save</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}
