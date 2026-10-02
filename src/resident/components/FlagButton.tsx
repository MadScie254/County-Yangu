import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { flagContent } from '@/shared/api/civic2';
import type { FlagKind, FlagReason } from '@/shared/api/types';
import { useAuth } from '@/shared/state/auth';
import { toast } from '@/shared/ui/Toast';

const reasons: FlagReason[] = ['abuse', 'personal_details', 'false', 'spam', 'other'];

/** Report abusive public content. Three different people flagging the same thing hides it until an admin decides. */
export function FlagButton({ kind, id }: { kind: FlagKind; id: string | number }) {
  const { t } = useI18n();
  const signedIn = useAuth((s) => s.status === 'in');
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const send = useMutation({
    mutationFn: (r: FlagReason) => flagContent(kind, String(id), r),
    onSuccess: () => { setDone(true); setOpen(false); toast({ tone: 'good', title: t('flag.thanks') }); },
    onError: () => toast({ tone: 'bad', title: t('flag.error') }),
  });
  if (done) return <span className="text-xs text-muted">{t('flag.done')}</span>;
  if (!open) {
    return (
      <button type="button" onClick={() => (signedIn ? setOpen(true) : toast({ tone: 'info', title: t('flag.signIn') }))} className="inline-flex items-center gap-1 text-xs text-muted hover:text-bad" aria-label={t('flag.label')}>
        <Flag className="size-3.5" aria-hidden />{t('flag.label')}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span className="font-semibold">{t('flag.why')}</span>
      {reasons.map((r) => (
        <button key={r} type="button" disabled={send.isPending} onClick={() => send.mutate(r)} className="rounded-full border border-line-strong px-2 py-1 hover:bg-bg-2">{t(`flag.reasons.${r}` as MessageKey)}</button>
      ))}
      <button type="button" onClick={() => setOpen(false)} className="px-1 text-muted underline">{t('common.cancel')}</button>
    </span>
  );
}
