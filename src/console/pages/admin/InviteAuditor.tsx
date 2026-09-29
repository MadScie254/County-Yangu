import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Field, TextInput } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { toast } from '@/shared/ui/Toast';
import { inviteAuditor } from '../../api/admin';

/** Email an external auditor (OAG, Controller of Budget) a single-use, expiring link to create a read-only account. */
export function InviteAuditor() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ email: '', organisation: '', days: '7' });
  const send = useMutation({
    mutationFn: () => inviteAuditor({ email: f.email.trim(), organisation: f.organisation.trim(), days: Number(f.days) || 7 }),
    onSuccess: () => { toast({ tone: 'good', title: 'Invitation sent', body: `${f.email.trim()} will get a link that works once.` }); setOpen(false); setF({ email: '', organisation: '', days: '7' }); },
    onError: (e) => toast({ tone: 'bad', title: 'Could not send the invitation', body: e instanceof Error && e.message === 'email_failed' ? 'The email service refused it. Check the address and the email settings.' : undefined }),
  });
  return (
    <>
      <Button size="sm" variant="secondary" icon={<KeyRound className="size-4" aria-hidden />} onClick={() => setOpen(true)}>Invite an auditor</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Invite an auditor">
        <div className="space-y-4">
          <p className="text-sm text-ink-2">They get an email with a link that works once. It lets them create an account with read-only access to cases, spending and the audit trail. The access expires by itself after 30 days.</p>
          <Field label="Their email">{({ id }) => <TextInput id={id} type="email" autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
          <Field label="Organisation" optionalLabel="Optional" hint="For example: Office of the Auditor-General">{({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} value={f.organisation} onChange={(e) => setF({ ...f, organisation: e.target.value })} />}</Field>
          <Field label="Link valid for (days)">{({ id }) => <TextInput id={id} inputMode="numeric" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value.replace(/\D/g, '') })} />}</Field>
          <Button block size="lg" loading={send.isPending} disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())} onClick={() => send.mutate()}>Send invitation</Button>
        </div>
      </Sheet>
    </>
  );
}
