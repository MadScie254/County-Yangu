import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { useAuth, type AuthError } from '@/shared/state/auth';
import { usePageTitle } from '@/shared/lib/hooks';
import { toE164Kenya } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Field, Segmented, TextInput } from '@/shared/ui/Field';

export default function Account() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const auth = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  usePageTitle(mode === 'in' ? t('auth.signInTitle') : t('auth.signUpTitle'));
  const init = auth.init;
  useEffect(() => { void init(); }, [init]);

  const next = params.get('next');
  if (auth.status === 'in') {
    if (next && next.startsWith('/') && !next.startsWith('//')) return <Navigate to={next} replace />;
    return <Navigate to="/me" replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const phone = form.phone ? toE164Kenya(form.phone) : null;
    const r = mode === 'in'
      ? await auth.signIn(form.email.trim(), form.password)
      : await auth.signUp({ name: form.name.trim(), email: form.email.trim(), password: form.password, ...(phone ? { phone } : {}) });
    setBusy(false);
    if (!r.ok) setError(r.error);
    else if (r.needsEmailConfirmation) setConfirm(true);
  };

  if (confirm) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <MailCheck className="mx-auto size-14 text-good" aria-hidden />
        <h1 className="mt-5 font-display text-3xl font-extrabold">{t('auth.checkEmail')}</h1>
        <p className="mt-2 text-ink-2">{t('auth.checkEmailBody', { email: form.email })}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <h1 className="font-display text-[clamp(2rem,6vw,2.6rem)] font-extrabold">{mode === 'in' ? t('auth.signInTitle') : t('auth.signUpTitle')}</h1>
      <p className="mt-3 text-ink-2">{t('auth.signInIntro')}</p>
      <Segmented<'in' | 'up'> className="mt-6" label={t('services.account')} value={mode} onChange={(m) => { setMode(m); setError(null); }} options={[{ value: 'in', label: t('auth.signIn') }, { value: 'up', label: t('auth.signUp') }]} />

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {mode === 'up' && <Field label={t('auth.name')}>{({ id }) => <TextInput id={id} autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>}
        <Field label={t('auth.email')}>{({ id }) => <TextInput id={id} type="email" autoComplete="email" inputMode="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
        <Field label={t('auth.password')} hint={mode === 'up' ? t('auth.passwordHint') : undefined}>{({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={mode === 'up' ? 8 : undefined} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}</Field>
        {mode === 'up' && <Field label={t('auth.phone')} optionalLabel={t('common.optional')}>{({ id }) => <TextInput id={id} type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}</Field>}
        {error && <p role="alert" className="rounded-xl bg-bad-soft p-3 text-sm font-medium text-bad">{t(`auth.errors.${error}` as MessageKey)}</p>}
        <Button type="submit" block size="lg" loading={busy} disabled={!form.email || !form.password || (mode === 'up' && !form.name)}>{mode === 'in' ? t('auth.signIn') : t('auth.signUp')}</Button>
        {auth.demo && <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs font-medium text-warn">{t('auth.demoNote')}</p>}
      </form>
      <p className="mt-8 text-sm text-muted">{t('auth.staffNote')} <a href="/console/" className="font-semibold underline">{t('auth.staffLink')}</a></p>
      <p className="mt-2 text-sm text-muted"><Link to="/" className="underline">{t('nav.home')}</Link></p>
    </div>
  );
}
