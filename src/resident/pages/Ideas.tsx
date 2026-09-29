import { useMemo, useState } from 'react';
import { HeartHandshake, Lightbulb, Plus, ThumbsUp, Check } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { wardById, wardsBySubCounty } from '@/shared/config/county';
import { useProposals } from '@/shared/api/hooks';
import { submitProposal, supportProposal } from '@/shared/api/submit';
import type { Proposal } from '@/shared/api/types';
import { useQueryClient } from '@tanstack/react-query';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Chip, type Tone } from '@/shared/ui/Chip';
import { Field, Segmented, SelectInput, TextArea, TextInput } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { PhoneVerify } from '../components/PhoneVerify';

const statusTone: Record<Proposal['status'], Tone> = { submitted: 'info', under_review: 'warn', accepted: 'good', declined: 'bad', merged: 'neutral' };
type Filter = 'all' | Proposal['kind'];

export default function Ideas() {
  const { t, number } = useI18n();
  usePageTitle(t('ideas.title'));
  const q = useProposals();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [supported, setSupported] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('cy-supported') ?? '[]') as string[]));
  const [supportTarget, setSupportTarget] = useState<string | null>(null);
  const [composer, setComposer] = useState(false);
  const [form, setForm] = useState({ kind: 'proposal' as Proposal['kind'], ward_id: '', title: '', body: '' });
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const groups = wardsBySubCounty();

  const list = useMemo(() => (q.data ?? []).filter((p) => filter === 'all' || p.kind === filter), [q.data, filter]);
  const remember = (id: string) => {
    const next = new Set(supported).add(id);
    setSupported(next);
    localStorage.setItem('cy-supported', JSON.stringify([...next]));
  };

  const doSupport = async (tok: string) => {
    if (!supportTarget) return;
    try {
      await supportProposal({ token: tok, proposal_id: supportTarget });
      remember(supportTarget);
      void qc.invalidateQueries({ queryKey: ['proposals'] });
    } catch {
      toast({ tone: 'bad', title: t('errors.generic') });
    }
    setSupportTarget(null);
  };

  const send = async (tok: string) => {
    setBusy(true);
    try {
      await submitProposal({ token: tok, ward_id: form.ward_id || null, kind: form.kind, title: form.title.trim(), body: form.body.trim() });
      toast({ tone: 'good', title: t('ideas.form.sent') });
      setComposer(false);
      setForm({ kind: 'proposal', ward_id: '', title: '', body: '' });
      setToken(null);
      void qc.invalidateQueries({ queryKey: ['proposals'] });
    } catch {
      toast({ tone: 'bad', title: t('ideas.form.failed') });
    } finally {
      setBusy(false);
    }
  };

  const valid = form.title.trim().length >= 5 && form.body.trim().length >= 10;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold">{t('ideas.title')}</h1>
          <p className="mt-3 text-[1.05rem] text-ink-2">{t('ideas.intro')}</p>
        </div>
        <Button onClick={() => setComposer(true)} icon={<Plus className="size-4" aria-hidden />}>{t('ideas.new')}</Button>
      </header>

      <Segmented<Filter> className="mt-8" label={t('ideas.title')} value={filter} onChange={setFilter} options={[{ value: 'all', label: t('ideas.all') }, { value: 'petition', label: t('ideas.kindPetition') }, { value: 'proposal', label: t('ideas.kindProposal') }]} />

      <div className="mt-6 space-y-4">
        {q.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}
        {q.isSuccess && list.length === 0 && <p className="rounded-[1.5rem] border border-dashed border-line-strong p-10 text-center text-muted">{t('ideas.none')}</p>}
        {list.map((p) => {
          const did = supported.has(p.id);
          return (
            <article key={p.id} className="rounded-[1.5rem] border border-line bg-surface p-5 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={p.kind === 'petition' ? 'vote' : 'brand'}>{p.kind === 'petition' ? <HeartHandshake className="size-3.5" aria-hidden /> : <Lightbulb className="size-3.5" aria-hidden />}{p.kind === 'petition' ? t('ideas.kindPetition') : t('ideas.kindProposal')}</Chip>
                <Chip tone={statusTone[p.status]}>{t(`ideas.status.${p.status}` as MessageKey)}</Chip>
                <span className="text-xs font-semibold text-muted">{p.ward_id ? wardById.get(p.ward_id)?.name : ''}</span>
              </div>
              <h2 className="mt-3 font-display text-xl font-bold leading-snug">{p.title}</h2>
              <p className="mt-2 text-ink-2">{p.body}</p>
              {p.response && (
                <div className="mt-4 rounded-2xl bg-bg-2 p-4 text-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{t('ideas.response')}</p>
                  <p className="mt-1">{p.response}</p>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-muted">{t('ideas.supporters', { count: p.supporters })}</span>
                <Button variant={did ? 'soft' : 'secondary'} size="sm" disabled={did} onClick={() => setSupportTarget(p.id)} icon={did ? <Check className="size-4" aria-hidden /> : <ThumbsUp className="size-4" aria-hidden />}>
                  {did ? t('ideas.supported') : t('ideas.support')}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="sr-only">{number(list.length)}</p>

      <Sheet open={Boolean(supportTarget)} onClose={() => setSupportTarget(null)} title={t('ideas.support')} closeLabel={t('common.close')}>
        <PhoneVerify purpose="petition" onVerified={(tok) => void doSupport(tok)} />
      </Sheet>

      <Sheet open={composer} onClose={() => setComposer(false)} title={t('ideas.new')} closeLabel={t('common.close')}>
        <div className="space-y-4">
          <Segmented<Proposal['kind']> label={t('ideas.form.kind')} value={form.kind} onChange={(kind) => setForm((f) => ({ ...f, kind }))} options={[{ value: 'proposal', label: t('ideas.kindProposal') }, { value: 'petition', label: t('ideas.kindPetition') }]} />
          <Field label={t('ideas.form.title')} hint={t('ideas.form.titleHint')}>{({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} maxLength={160} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />}</Field>
          <Field label={t('ideas.form.body')}>{({ id }) => <TextArea id={id} maxLength={4000} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />}</Field>
          <Field label={t('ideas.form.ward')}>
            {({ id }) => (
              <SelectInput id={id} value={form.ward_id} onChange={(e) => setForm((f) => ({ ...f, ward_id: e.target.value }))}>
                <option value="">{t('ideas.form.wardCounty')}</option>
                {groups.map((g) => <optgroup key={g.subCounty.id} label={g.subCounty.name}>{g.wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</optgroup>)}
              </SelectInput>
            )}
          </Field>
          {!token ? (
            <>
              <p className={cn('text-sm font-semibold', valid ? 'text-ink' : 'text-muted')}>{t('ideas.form.verify')}</p>
              {valid && <PhoneVerify purpose="petition" onVerified={(tok) => setToken(tok)} />}
            </>
          ) : (
            <Button block size="lg" loading={busy} onClick={() => void send(token)}>{t('ideas.form.submit')}</Button>
          )}
        </div>
      </Sheet>
    </div>
  );
}
