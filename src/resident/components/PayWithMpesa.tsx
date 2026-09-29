import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Smartphone, XCircle } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { getPaymentState, startPayment } from '@/shared/api/services';
import type { Application } from '@/shared/api/services-types';
import { toE164Kenya } from '@/shared/lib/utils';
import { useAuth } from '@/shared/state/auth';
import { Button } from '@/shared/ui/Button';
import { Field, TextInput } from '@/shared/ui/Field';

type Stage = 'idle' | 'sending' | 'waiting' | 'done' | 'failed' | 'timeout';

/** M-Pesa STK push. The amount comes from the server; this component only supplies the phone number. */
export function PayWithMpesa({ app, onPaid }: { app: Application; onPaid: () => void }) {
  const { t, kes } = useI18n();
  const userPhone = useAuth((s) => s.user?.phone);
  const [phone, setPhone] = useState(userPhone ?? '');
  const [stage, setStage] = useState<Stage>('idle');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);

  const pay = async () => {
    const e164 = toE164Kenya(phone);
    if (!e164) return setErr(t('otp.invalidPhone'));
    setErr(null);
    setStage('sending');
    try {
      const { checkoutRequestId } = await startPayment(app.id, e164);
      setStage('waiting');
      for (let i = 0; i < 40 && !cancelled.current; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const s = await getPaymentState(app.id, checkoutRequestId);
        if (s.status === 'completed') { setReceipt(s.mpesa_receipt); setStage('done'); onPaid(); return; }
        if (s.status === 'failed') return setStage('failed');
        if (s.status === 'timeout') return setStage('timeout');
      }
      if (!cancelled.current) setStage('timeout');
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errors.generic'));
      setStage('failed');
    }
  };

  if (stage === 'done') {
    return (
      <div className="rounded-[1.5rem] bg-good-soft p-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-good" aria-hidden />
        <p className="mt-3 font-display text-2xl font-bold">{t('services.pay.done')}</p>
        <p className="mt-1 text-sm text-ink-2">{t('services.pay.doneBody', { receipt: receipt ?? '' })}</p>
      </div>
    );
  }
  if (stage === 'waiting' || stage === 'sending') {
    return (
      <div className="rounded-[1.5rem] border border-line bg-surface p-6 text-center shadow-card" role="status">
        <Loader2 className="mx-auto size-10 animate-spin text-brand-strong" aria-hidden />
        <p className="mt-3 font-display text-2xl font-bold">{t('services.pay.waiting')}</p>
        <p className="mt-1 text-sm text-ink-2">{t('services.pay.waitingBody', { amount: kes(app.amount) })}</p>
      </div>
    );
  }
  return (
    <div className="rounded-[1.5rem] border border-line bg-surface p-5 shadow-card">
      <p className="flex items-center gap-2 font-display text-lg font-bold"><Smartphone className="size-5" aria-hidden />{t('services.pay.title')} · {kes(app.amount)}</p>
      {(stage === 'failed' || stage === 'timeout') && (
        <p role="alert" className="mt-3 flex gap-2 rounded-xl bg-bad-soft p-3 text-sm font-medium text-bad"><XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{stage === 'timeout' ? t('services.pay.timeout') : `${t('services.pay.failed')}. ${t('services.pay.failedBody')}`}</p>
      )}
      <Field className="mt-4" label={t('services.pay.phone')} error={err ?? undefined}>
        {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} invalid={Boolean(err)} inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} onChange={(e) => { setPhone(e.target.value); setErr(null); }} />}
      </Field>
      <Button block size="lg" className="mt-4" onClick={() => void pay()}>{stage === 'failed' || stage === 'timeout' ? t('services.pay.retry') : t('services.pay.send')}</Button>
    </div>
  );
}
