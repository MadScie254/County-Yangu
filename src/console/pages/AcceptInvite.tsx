import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { functionsUrl } from '@/shared/api/client';
import { dataSource } from '@/shared/api/public';
import { useAuth } from '@/shared/state/auth';
import { county } from '@/shared/config/county';
import { usePageTitle } from '@/shared/lib/hooks';
import { LogoMark } from '@/shared/ui/Logo';
import { Button } from '@/shared/ui/Button';
import { Field, TextInput } from '@/shared/ui/Field';

/**
 * Landing page for the time-limited link emailed to an invited auditor. The token is exchanged, on the server,
 * for a read-only auditor role on the account they create here. It works once and expires.
 */
export default function AcceptInvite() {
  usePageTitle('Accept invitation', 'CountyConnect');
  const { token = '' } = useParams();
  const signIn = useAuth((s) => s.signIn);
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if ((await dataSource()) !== 'live' || !functionsUrl) throw new Error('offline');
      const res = await fetch(`${functionsUrl}/auditor-accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
        body: JSON.stringify({ token, name: f.name.trim(), email: f.email.trim(), password: f.password }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'failed');
      const r = await signIn(f.email.trim(), f.password);
      if (!r.ok) throw new Error('signin');
      window.location.assign('/console/');
    } catch (err) {
      const m = (err as Error).message;
      setError(m === 'expired' ? 'This invitation is not valid for that email address, has expired, or was already used. Check the address, or ask the county for a new invitation.' : m === 'account_exists' ? 'You already have an account with that email. Sign in, and ask the county to grant you access.' : m === 'offline' ? 'Invitations can only be accepted on the live system.' : 'We could not accept the invitation. Check the details and try again.');
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-bg-2 px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-[1.75rem] border border-line bg-surface p-7 shadow-float">
        <div className="flex items-center gap-3"><LogoMark className="size-11" /><div className="leading-none"><p className="font-display text-xl font-extrabold">CountyConnect</p><p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{county.name} County</p></div></div>
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold"><KeyRound className="size-6" aria-hidden />Auditor invitation</h1>
          <p className="mt-1.5 text-ink-2">Create your account to review the county’s cases, spending and audit trail. Access is read-only and time-limited.</p>
        </div>
        <Field label="Your name">{({ id }) => <TextInput id={id} autoComplete="name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="Email the invitation was sent to">{({ id }) => <TextInput id={id} type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label="Choose a password" hint="At least 12 characters.">{({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} type="password" autoComplete="new-password" minLength={12} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />}</Field>
        {error && <p role="alert" className="rounded-xl bg-bad-soft p-3 text-sm font-semibold text-bad">{error}</p>}
        <Button type="submit" block size="lg" loading={busy} disabled={!token || !f.name.trim() || !f.email.trim() || f.password.length < 12}>Accept and continue</Button>
      </form>
    </main>
  );
}
