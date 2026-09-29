import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Field, TextArea, TextInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { DIGEST_KINDS, getSettings, hasSecondFactor, saveSettings, type CountySettings } from '../../api/admin';
import { Panel } from '../../ui/Page';

const onErr = (e: unknown) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined });
const parseEmails = (s: string) => s.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));

export function SettingsTab() {
  const q = useQuery({ queryKey: ['c-settings'], queryFn: getSettings });
  if (!q.data) return <Skeleton className="h-64" />;
  return <SettingsForm s={q.data} />;
}

function SettingsForm({ s }: { s: CountySettings }) {
  const qc = useQueryClient();
  const factor = useQuery({ queryKey: ['c-aal'], queryFn: hasSecondFactor });
  const [f, setF] = useState({ web: s.web_url, console: s.console_url, cap: s.ai_default_cap_kes === null ? '' : String(s.ai_default_cap_kes), emails: Object.fromEntries(DIGEST_KINDS.map(([k]) => [k, (s.digest_recipients[k] ?? []).join('\n')])) as Record<string, string> });

  const save = useMutation({
    mutationFn: (patch: Partial<CountySettings>) => saveSettings(patch),
    onSuccess: () => { toast({ tone: 'good', title: 'Saved' }); void qc.invalidateQueries({ queryKey: ['c-settings'] }); },
    onError: onErr,
  });

  const canEnable = factor.data === true;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Two-factor sign-in for staff">
        <p className="text-ink-2">When this is on, no staff permission applies unless the person signed in with an authenticator app. It is enforced in the database, so it cannot be bypassed from the screen. Residents are not affected.</p>
        <label className="mt-4 flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" className="size-5 accent-[var(--ink)]" checked={s.require_staff_mfa} disabled={save.isPending || (!s.require_staff_mfa && !canEnable)} onChange={(e) => save.mutate({ require_staff_mfa: e.target.checked })} />
          Require an authenticator app for everyone on staff
        </label>
        {!s.require_staff_mfa && !canEnable && <p className="mt-3 flex gap-2 rounded-xl bg-warn-soft p-3 text-sm font-medium text-warn"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />You are signed in with a password only. Sign in again with your authenticator app first, otherwise you would lock yourself out. The database refuses the change from a password-only session.</p>}
        {!s.require_staff_mfa && canEnable && <p className="mt-3 text-sm text-muted">Before turning it on, make sure every staff member and assembly member has enrolled an authenticator app. Anyone who has not will be asked to enrol at their next sign-in.</p>}
      </Panel>

      <Panel title="Web addresses">
        <p className="text-sm text-muted">Used in the links inside SMS and email the system sends.</p>
        <div className="mt-3 space-y-3">
          <Field label="Public site">{({ id }) => <TextInput id={id} inputMode="url" placeholder="https://yangu.example" value={f.web} onChange={(e) => setF({ ...f, web: e.target.value })} />}</Field>
          <Field label="Staff console">{({ id }) => <TextInput id={id} inputMode="url" placeholder="https://console.example" value={f.console} onChange={(e) => setF({ ...f, console: e.target.value })} />}</Field>
          <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate({ web_url: f.web.trim().replace(/\/$/, ''), console_url: f.console.trim().replace(/\/$/, '') })}>Save addresses</Button>
        </div>
      </Panel>

      <Panel title="Monthly digests" className="lg:col-span-2">
        <p className="text-sm text-muted">On the 1st of each month the system builds a summary of overdue cases and sends it to these addresses, and records when each person opens it. The Assembly and executive copies name the officer holding a case that is more than 30 days late; the audit bodies see departments only. One address per line.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {DIGEST_KINDS.map(([k, label]) => (
            <Field key={k} label={label} hint={`${parseEmails(f.emails[k] ?? '').length} valid address(es)`}>{({ id, describedBy }) => <TextArea id={id} aria-describedby={describedBy} rows={3} value={f.emails[k] ?? ''} onChange={(e) => setF({ ...f, emails: { ...f.emails, [k]: e.target.value } })} />}</Field>
          ))}
        </div>
        <Button className="mt-3" variant="secondary" loading={save.isPending} onClick={() => save.mutate({ digest_recipients: Object.fromEntries(DIGEST_KINDS.map(([k]) => [k, parseEmails(f.emails[k] ?? '')])) })}>Save recipients</Button>
      </Panel>

      <Panel title="AI default allowance">
        <p className="text-sm text-muted">The monthly cap, in shillings, for any department that has no cap of its own. Leave empty to keep the assistant off until a cap is set.</p>
        <div className="mt-3 flex gap-2">
          <TextInput aria-label="Default monthly cap (KES)" inputMode="numeric" className="max-w-40" value={f.cap} onChange={(e) => setF({ ...f, cap: e.target.value.replace(/\D/g, '') })} />
          <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate({ ai_default_cap_kes: f.cap === '' ? null : Number(f.cap) })}>Save</Button>
        </div>
      </Panel>

      <Panel title="Audit trail and data residency"><p className="text-ink-2">Every change to roles, services, projects, tenders, payments and cases is recorded with who did it and what changed, and cannot be edited or deleted by anyone, including administrators. Public finance records must have a serving copy in a Kenyan data centre; see the runbook for how it is kept up to date.</p></Panel>
    </div>
  );
}
