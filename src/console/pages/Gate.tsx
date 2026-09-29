import { useEffect, useState, type ReactNode } from 'react';
import { LogOut, ShieldCheck, UserX } from 'lucide-react';
import { useAuth } from '@/shared/state/auth';
import { enrollTotp, getMfaState, verifyTotp, type MfaState } from '@/shared/state/mfa';
import { LogoMark } from '@/shared/ui/Logo';
import { Button } from '@/shared/ui/Button';
import { Field, TextInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import Login from './Login';

function Center({ children }: { children: ReactNode }) {
  return <div className="grid min-h-dvh place-items-center px-4 py-10"><div className="w-full max-w-md">{children}</div></div>;
}

function NoAccess() {
  const signOut = useAuth((s) => s.signOut);
  const email = useAuth((s) => s.user?.email);
  return (
    <Center>
      <UserX className="size-12 text-muted" aria-hidden />
      <h1 className="mt-5 font-display text-3xl font-extrabold">This account has no staff access</h1>
      <p className="mt-3 text-ink-2">{email} is signed in, but a county administrator has not given it a role. Looking for permits, payments or reporting? That lives under <a className="font-semibold underline" href="/services">My Services</a>.</p>
      <Button className="mt-6" variant="secondary" icon={<LogOut className="size-4" aria-hidden />} onClick={() => void signOut()}>Sign out</Button>
    </Center>
  );
}

/** Second factor: enrol an authenticator app on first use, then ask for a code at each sign-in. */
function MfaStep({ mode, onDone }: { mode: 'challenge' | 'enroll'; onDone: () => void }) {
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signOut = useAuth((s) => s.signOut);

  useEffect(() => {
    if (mode === 'enroll') void enrollTotp().then(setEnroll);
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const ok = await verifyTotp(code.trim(), enroll?.factorId);
    setBusy(false);
    if (ok) onDone();
    else setError('That code is not right. Codes change every 30 seconds.');
  };

  return (
    <Center>
      <ShieldCheck className="size-12 text-good" aria-hidden />
      <h1 className="mt-5 font-display text-3xl font-extrabold">{mode === 'enroll' ? 'Set up your authenticator app' : 'Enter your authenticator code'}</h1>
      <p className="mt-3 text-ink-2">{mode === 'enroll' ? 'County staff must use a second factor. Scan this with Google Authenticator, Microsoft Authenticator or a similar app, then enter the 6-digit code it shows.' : 'Open your authenticator app and enter the 6-digit code for CountyConnect.'}</p>
      {mode === 'enroll' && enroll && (
        <div className="mt-5 rounded-2xl border border-line bg-white p-4 text-center">
          <img src={enroll.qr} alt="QR code for your authenticator app" className="mx-auto size-44" />
          <p className="mt-3 text-xs text-muted">Can’t scan? Enter this key: <span className="font-data text-ink">{enroll.secret}</span></p>
        </div>
      )}
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="6-digit code" error={error ?? undefined}>{({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} invalid={Boolean(error)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center font-data text-2xl tracking-[0.5em]" />}</Field>
        <Button type="submit" block size="lg" loading={busy} disabled={code.length !== 6 || (mode === 'enroll' && !enroll)}>Verify</Button>
      </form>
      <Button variant="ghost" className="mt-3" onClick={() => void signOut()}>Use a different account</Button>
    </Center>
  );
}

/** Everything under the console sits behind this: signed in, second factor done, and at least one role. */
export function Gate({ children }: { children: ReactNode }) {
  const { status, roles, user, init, demo } = useAuth();
  // the answer belongs to one signed-in user; for anyone else (or nobody) it is "still loading"
  const [asked, setAsked] = useState<{ uid: string | undefined; state: MfaState } | null>(null);
  const mfa: MfaState | 'loading' = status !== 'in' ? 'loading' : demo ? 'ok' : asked && asked.uid === user?.id ? asked.state : 'loading';
  const setMfa = (state: MfaState) => setAsked({ uid: user?.id, state });

  useEffect(() => { void init(); }, [init]);
  useEffect(() => {
    if (status !== 'in' || demo) return;
    const uid = user?.id;
    void getMfaState().then((state) => setAsked({ uid, state }));
  }, [status, demo, user?.id]);

  if (status === 'loading') return <Center><Skeleton className="h-10 w-2/3" /><Skeleton className="mt-4 h-40" /></Center>;
  if (status === 'anon') return <Login />;
  if (mfa === 'loading') return <Center><Skeleton className="h-10 w-2/3" /></Center>;
  if (mfa === 'challenge' || mfa === 'enroll') return <MfaStep mode={mfa} onDone={() => setMfa('ok')} />;
  if (roles.length === 0) return <NoAccess />;
  return <>{children}</>;
}

export { LogoMark };
