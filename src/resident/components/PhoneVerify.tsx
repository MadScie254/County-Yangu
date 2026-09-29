import { useEffect, useState } from 'react';
import { Lock, MessageSquareText } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { backendConfigured } from '@/shared/api/client';
import { requestOtp, verifyOtp, SubmitError } from '@/shared/api/submit';
import { maskPhone, toE164Kenya } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Field, TextInput } from '@/shared/ui/Field';

type Purpose = 'vote' | 'alerts' | 'petition';

const errorKey = (e: unknown): MessageKey => {
  if (e instanceof SubmitError) {
    if (e.code === 'invalid_code') return 'otp.invalidCode';
    if (e.code === 'expired') return 'otp.expired';
    if (e.code === 'rate_limited') return 'otp.rateLimited';
    if (e.message === 'network') return 'errors.network';
  }
  return 'errors.generic';
};

/**
 * Phone check for anonymous-but-verified actions (vote, alerts, petitions). Sends a 6-digit SMS code through
 * our own function (so voters do not become billable auth users) and returns a short-lived token.
 * The token proves "this phone was verified"; the phone itself is not stored with the vote.
 */
export function PhoneVerify({ purpose, onVerified }: { purpose: Purpose; onVerified: (token: string, phoneE164: string) => void }) {
  const { t } = useI18n();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const e164 = toE164Kenya(phone);

  const send = async () => {
    if (!e164) return setError('otp.invalidPhone');
    setBusy(true);
    setError(null);
    try {
      await requestOtp(e164, purpose);
      setStage('code');
      setWait(45);
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!e164) return;
    setBusy(true);
    setError(null);
    try {
      const { token } = await verifyOtp(e164, code.trim(), purpose);
      onVerified(token, e164);
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[1.5rem] border border-line bg-surface p-5 shadow-card">
      {stage === 'phone' ? (
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} noValidate>
          <Field label={t('otp.phoneLabel')} error={error ? t(error) : undefined}>
            {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} invalid={Boolean(error)} inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} onChange={(e) => { setPhone(e.target.value); setError(null); }} />}
          </Field>
          <Button type="submit" block size="lg" className="mt-4" loading={busy} icon={<MessageSquareText className="size-4" aria-hidden />}>
            {busy ? t('otp.sending') : t('otp.sendCode')}
          </Button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void verify(); }} noValidate>
          <p className="mb-3 text-sm text-ink-2">{t('otp.codeHint', { phone: maskPhone(e164 ?? phone) })}</p>
          <Field label={t('otp.codeLabel')} error={error ? t(error) : undefined}>
            {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} invalid={Boolean(error)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(null); }} className="text-center font-data text-2xl tracking-[0.5em]" />}
          </Field>
          <Button type="submit" block size="lg" className="mt-4" loading={busy} disabled={code.length !== 6}>
            {busy ? t('otp.verifying') : t('otp.verify')}
          </Button>
          <div className="mt-3 flex items-center justify-between text-sm">
            <button type="button" className="font-semibold underline underline-offset-4 disabled:no-underline disabled:opacity-60" disabled={wait > 0 || busy} onClick={() => void send()}>
              {wait > 0 ? t('otp.resendIn', { seconds: wait }) : t('otp.resend')}
            </button>
            <button type="button" className="text-muted underline underline-offset-4" onClick={() => { setStage('phone'); setCode(''); setError(null); }}>{t('otp.changeNumber')}</button>
          </div>
        </form>
      )}
      <p className="mt-4 flex gap-2 text-xs text-muted"><Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t('otp.why')}</p>
      {!backendConfigured && <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-xs font-medium text-warn">{t('otp.demoHint')}</p>}
    </div>
  );
}
