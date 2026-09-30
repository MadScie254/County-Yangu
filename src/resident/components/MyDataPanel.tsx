import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, ShieldCheck, Trash2 } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { downloadMyData, requestErasure } from '@/shared/api/rights';
import { Button } from '@/shared/ui/Button';
import { Field, TextArea } from '@/shared/ui/Field';
import { toast } from '@/shared/ui/Toast';

/** Data Protection Act, 2019: a copy of everything held about me, and a request to erase it. */
export function MyDataPanel() {
  const { t, date } = useI18n();
  const [erase, setErase] = useState(false);
  const [reason, setReason] = useState('');
  const [due, setDue] = useState<string | null>(null);
  const dl = useMutation({
    mutationFn: downloadMyData,
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `my-county-data-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
      toast({ tone: 'good', title: t('rights.data.downloaded') });
    },
    onError: () => toast({ tone: 'bad', title: t('rights.data.error') }),
  });
  const rq = useMutation({ mutationFn: () => requestErasure(reason.trim()), onSuccess: (d) => setDue(d), onError: () => toast({ tone: 'bad', title: t('rights.data.error') }) });
  return (
    <div className="space-y-3 text-sm">
      <p className="flex gap-2 text-ink-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />{t('rights.data.intro')}</p>
      <Button variant="secondary" size="sm" icon={<Download className="size-4" aria-hidden />} loading={dl.isPending} onClick={() => dl.mutate()}>{t('rights.data.download')}</Button>
      {due ? <p className="rounded-2xl bg-good-soft p-3 font-semibold text-good">{t('rights.data.eraseSent', { date: date(due, { dateStyle: 'long' }) })}</p> : erase ? (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); rq.mutate(); }}>
          <Field label={t('rights.data.eraseReason')}>{({ id }) => <TextArea id={id} className="min-h-16" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
          <Button type="submit" variant="danger" size="sm" loading={rq.isPending}>{t('rights.data.eraseConfirm')}</Button>
        </form>
      ) : (
        <button type="button" className="flex items-center gap-1.5 text-xs font-semibold text-ink-2 underline underline-offset-4 hover:text-bad" onClick={() => setErase(true)}><Trash2 className="size-3.5" aria-hidden />{t('rights.data.erase')}</button>
      )}
    </div>
  );
}
