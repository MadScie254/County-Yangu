import { useState } from 'react';
import { Building2, Landmark, KeyRound, Smartphone, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/shared/state/auth';
import { toE164Kenya, cn } from '@/shared/lib/utils';
import { county } from '@/shared/config/county';
import { LogoMark } from '@/shared/ui/Logo';
import { Button } from '@/shared/ui/Button';
import { Field, TextInput } from '@/shared/ui/Field';

type Door = 'staff' | 'assembly' | 'auditor';

const doors: { id: Door; icon: typeof Building2; title: string; body: string }[] = [
  { id: 'staff', icon: Building2, title: 'County staff', body: 'Work email, password and authenticator app.' },
  { id: 'assembly', icon: Landmark, title: 'County Assembly member', body: 'Your phone number and a code by SMS.' },
  { id: 'auditor', icon: KeyRound, title: 'Invited auditor', body: 'Use the time-limited link in your invitation email.' },
];

/**
 * The staff door. The three cards below only decide which sign-in form is shown. They grant nothing:
 * what a person can see and do comes from the roles a county administrator assigned in the database.
 */
export default function Login() {
  const auth = useAuth();
  const [door, setDoor] = useState<Door>('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (m: string) => { setError(m); setBusy(false); };

  const signInStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await auth.signIn(email.trim(), password);
    if (!r.ok) return fail(r.error === 'invalid' ? 'Email or password is not right.' : 'We could not sign you in. Try again.');
    setBusy(false);
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const e164 = toE164Kenya(phone);
    if (!e164) return fail('Enter your mobile number, like 0712 345 678.');
    setBusy(true); setError(null);
    const r = await auth.requestPhoneOtp(e164);
    if (!r.ok) return fail('We could not send a code to that number. Members must be registered by the county first.');
    setSent(true); setBusy(false);
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const e164 = toE164Kenya(phone);
    if (!e164) return;
    setBusy(true); setError(null);
    const r = await auth.verifyPhoneOtp(e164, code.trim());
    if (!r.ok) return fail('That code is not right.');
    setBusy(false);
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-bg lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="paper-grain absolute inset-0 opacity-25" />
        <div className="relative flex items-center gap-3">
          <LogoMark className="size-11" />
          <div>
            <p className="font-display text-xl font-extrabold leading-none">CountyConnect</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-bg/60">{county.name} County · staff console</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-display text-5xl font-extrabold leading-[1.02]">Every report answered. Every shilling accounted for.</h1>
          <p className="mt-5 text-lg text-bg/75">One inbox for what residents report, one queue for what they apply for, and one place where the Assembly and auditors can see what is overdue.</p>
        </div>
        <p className="relative text-sm text-bg/60">Everything you do here is recorded in an audit trail that cannot be edited.</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><LogoMark /><p className="font-display text-lg font-extrabold">CountyConnect</p></div>
          <h2 className="font-display text-3xl font-extrabold">Sign in</h2>
          <p className="mt-2 text-ink-2">Choose how you sign in. Your access is set by your county administrator, not by this choice.</p>

          <div role="radiogroup" aria-label="How do you sign in?" className="mt-6 grid gap-2">
            {doors.map(({ id, icon: Icon, title, body }) => (
              <button key={id} type="button" role="radio" aria-checked={door === id} onClick={() => { setDoor(id); setError(null); setSent(false); }}
                className={cn('flex items-center gap-4 rounded-2xl border p-4 text-left transition', door === id ? 'border-ink bg-brand-soft ring-2 ring-ink' : 'border-line bg-surface hover:border-line-strong')}>
                <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', door === id ? 'bg-brand text-brand-ink' : 'bg-bg-2 text-ink-2')}><Icon className="size-5" aria-hidden /></span>
                <span><span className="block font-semibold">{title}</span><span className="block text-sm text-muted">{body}</span></span>
              </button>
            ))}
          </div>

          <div className="mt-6">
            {door === 'staff' && (
              <form onSubmit={signInStaff} className="space-y-4" noValidate>
                <Field label="Work email">{({ id }) => <TextInput id={id} type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
                <Field label="Password">{({ id }) => <TextInput id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
                <Button type="submit" block size="lg" loading={busy} disabled={!email || !password}>Sign in</Button>
              </form>
            )}
            {door === 'assembly' && !sent && (
              <form onSubmit={sendCode} className="space-y-4" noValidate>
                <Field label="Mobile number registered with the county">{({ id }) => <TextInput id={id} type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
                <Button type="submit" block size="lg" loading={busy} icon={<Smartphone className="size-4" aria-hidden />} disabled={!phone}>Send me a code</Button>
              </form>
            )}
            {door === 'assembly' && sent && (
              <form onSubmit={verifyCode} className="space-y-4" noValidate>
                <Field label="6-digit code">{({ id }) => <TextInput id={id} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center font-data text-2xl tracking-[0.5em]" />}</Field>
                <Button type="submit" block size="lg" loading={busy} disabled={code.length !== 6}>Sign in</Button>
              </form>
            )}
            {door === 'auditor' && (
              <div className="rounded-2xl border border-line bg-surface p-5 text-sm text-ink-2">
                <p>Auditors and the Controller of Budget’s staff are invited by the county. Open the link in your invitation email. It works once, for a limited time, and gives read-only access.</p>
                <p className="mt-3">Lost your link? Ask the county administrator to send a new one.</p>
              </div>
            )}
            {error && <p role="alert" className="mt-4 flex gap-2 rounded-xl bg-bad-soft p-3 text-sm font-medium text-bad"><ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{error}</p>}
            {auth.demo && <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-xs font-medium text-warn">Demo mode. Any password works. Try <b>admin@…</b>, <b>officer@…</b>, <b>ward@…</b> or <b>audit@…</b>; for the Assembly, any number and code <b>123456</b>. Your role comes from the email’s first word.</p>}
          </div>

          <p className="mt-10 text-sm text-muted">Are you a resident? <a href="/services" className="font-semibold underline">Go to My Services</a></p>
        </div>
      </main>
    </div>
  );
}
