import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Copy, KeyRound, Lock, MessageSquareLock, Send, ShieldAlert } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { createDisclosure, readDisclosure, replyDisclosure, SubmitError } from '@/shared/api/submit';
import type { DisclosureThread, DisclosureTopic } from '@/shared/api/types';
import { useIsDemo } from '@/shared/api/hooks';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea, TextInput } from '@/shared/ui/Field';
import { toast } from '@/shared/ui/Toast';

const topics: DisclosureTopic[] = ['bribery', 'procurement', 'payroll', 'theft', 'abuse_of_office', 'other'];
const sorted = [...wards].sort((a, b) => a.name.localeCompare(b.name));

function Thread({ keyText, thread, onReplied }: { keyText: string; thread: DisclosureThread; onReplied: () => void }) {
  const { t, date } = useI18n();
  const [text, setText] = useState('');
  const send = useMutation({
    mutationFn: () => replyDisclosure(keyText, text.trim()),
    onSuccess: () => { setText(''); toast({ tone: 'good', title: t('speak.replied') }); onReplied(); },
    onError: (e) => toast({ tone: 'bad', title: e instanceof SubmitError && e.code === 'closed' ? t('speak.closed') : t('speak.error') }),
  });
  return (
    <div className="mt-6 rounded-[1.5rem] border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-data text-sm">{thread.reference}</span>
        <Chip tone={thread.status === 'closed' ? 'neutral' : thread.status === 'referred' ? 'warn' : 'info'}>{t(`speak.status.${thread.status}` as MessageKey)}</Chip>
        {thread.referred_to && <Chip>{t('speak.referredTo', { to: thread.referred_to })}</Chip>}
      </div>
      <ol className="mt-4 space-y-3">
        {thread.messages.map((m, i) => (
          <li key={i} className={cn('max-w-[85%] rounded-2xl p-3 text-sm', m.from_reporter ? 'ml-auto bg-brand-soft' : 'bg-bg-2')}>
            <p className="text-xs font-bold text-muted">{m.from_reporter ? t('speak.you') : t('speak.desk')} · {date(m.at, { dateStyle: 'medium', timeStyle: 'short' })}</p>
            <p className="mt-1 whitespace-pre-line">{m.body}</p>
          </li>
        ))}
      </ol>
      {thread.status !== 'closed' && (
        <form className="mt-4 space-y-2" onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 2) send.mutate(); }}>
          <Field label={t('speak.reply')}>{({ id }) => <TextArea id={id} className="min-h-20" maxLength={6000} value={text} onChange={(e) => setText(e.target.value)} />}</Field>
          <Button type="submit" size="sm" icon={<Send className="size-4" aria-hidden />} loading={send.isPending} disabled={text.trim().length < 2}>{t('speak.sendReply')}</Button>
        </form>
      )}
    </div>
  );
}

/**
 * Report corruption safely. Nothing that identifies the reporter is kept; a secret key, shown once, is the only way
 * back to the conversation with the integrity desk.
 */
export default function SpeakUp() {
  const { t } = useI18n();
  const demo = useIsDemo();
  usePageTitle(t('speak.title'));
  const [f, setF] = useState<{ topic: DisclosureTopic; ward_id: string; body: string }>({ topic: 'bribery', ward_id: '', body: '' });
  const [made, setMade] = useState<{ reference: string; key: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [key, setKey] = useState('');
  const [thread, setThread] = useState<DisclosureThread | null>(null);

  const create = useMutation({
    mutationFn: () => createDisclosure({ topic: f.topic, ward_id: f.ward_id || null, body: f.body.trim() }),
    onSuccess: (r) => setMade(r),
    onError: () => toast({ tone: 'bad', title: t('speak.error') }),
  });
  const open = useMutation({
    mutationFn: (k: string) => readDisclosure(k),
    onSuccess: (r) => setThread(r.thread),
    onError: (e) => toast({ tone: 'bad', title: e instanceof SubmitError && e.code === 'not_found' ? t('speak.noKey') : t('speak.error') }),
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="inline-flex items-center gap-2 rounded-full bg-bad-soft px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-bad"><ShieldAlert className="size-3.5" aria-hidden />{t('speak.eyebrow')}</p>
      <h1 className="mt-3 font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('speak.title')}</h1>
      <p className="mt-3 max-w-2xl text-[1.05rem] text-ink-2">{t('speak.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}

      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label={t('speak.safety')}>
        {(['a', 'b', 'c'] as const).map((k) => (
          <div key={k} className="rounded-2xl bg-bg-2/70 p-4 text-sm"><Lock className="mb-2 size-4 text-good" aria-hidden />{t(`speak.safe.${k}`)}</div>
        ))}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="new">
          <h2 id="new" className="font-display text-xl font-bold">{t('speak.new')}</h2>
          {made ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-good">{t('speak.sent', { reference: made.reference })}</p>
              <div className="mt-3 rounded-2xl border-2 border-dashed border-ink p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{t('speak.yourKey')}</p>
                <p className="mt-1 select-all font-data text-2xl tracking-wider">{made.key}</p>
                <Button className="mt-2" variant="secondary" size="sm" icon={copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} onClick={async () => { await navigator.clipboard?.writeText(made.key); setCopied(true); }}>{copied ? t('common.copied') : t('common.copy')}</Button>
              </div>
              <p className="mt-3 text-sm font-semibold text-bad">{t('speak.keyWarning')}</p>
              <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={saved} onChange={(e) => setSaved(e.target.checked)} />{t('speak.keySaved')}</label>
              {saved && <Button className="mt-3" variant="secondary" size="sm" onClick={() => { setKey(made.key); setMade(null); setF({ ...f, body: '' }); }}>{t('speak.done')}</Button>}
            </div>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (f.body.trim().length >= 20) create.mutate(); }}>
              <Field label={t('speak.topic')}>{({ id }) => <SelectInput id={id} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value as DisclosureTopic })}>{topics.map((x) => <option key={x} value={x}>{t(`speak.topics.${x}` as MessageKey)}</option>)}</SelectInput>}</Field>
              <Field label={t('speak.ward')} optionalLabel={t('common.optional')}>{({ id }) => <SelectInput id={id} value={f.ward_id} onChange={(e) => setF({ ...f, ward_id: e.target.value })}><option value="">-</option>{sorted.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
              <Field label={t('speak.what')} hint={t('speak.whatHint')}>{({ id, describedBy }) => <TextArea id={id} aria-describedby={describedBy} className="min-h-36" maxLength={6000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}</Field>
              <Button type="submit" icon={<MessageSquareLock className="size-4" aria-hidden />} loading={create.isPending} disabled={f.body.trim().length < 20}>{t('speak.send')}</Button>
            </form>
          )}
        </section>

        <section className="rounded-[1.75rem] bg-brand-soft p-5 sm:p-6" aria-labelledby="check">
          <h2 id="check" className="flex items-center gap-2 font-display text-xl font-bold"><KeyRound className="size-5" aria-hidden />{t('speak.check')}</h2>
          <p className="mt-1 text-sm text-ink-2">{t('speak.checkIntro')}</p>
          <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (key.trim()) open.mutate(key.trim()); }}>
            <TextInput aria-label={t('speak.yourKey')} className="font-data uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal" placeholder="ABCD-EFGH-JKMN-PQRS" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
            <Button type="submit" loading={open.isPending}>{t('speak.open')}</Button>
          </form>
          {thread && <Thread keyText={key.trim()} thread={thread} onReplied={() => open.mutate(key.trim())} />}
        </section>
      </div>
    </div>
  );
}
