import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { sendCaseFeedback, SubmitError } from '@/shared/api/submit';
import { Button } from '@/shared/ui/Button';
import { TextArea } from '@/shared/ui/Field';

/** Shown on a fixed case that nobody has answered for yet: "Was it really fixed?" A "no" reopens the case. */
export function CaseFeedback({ reference }: { reference: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [done, setDone] = useState<null | 'yes' | 'no' | 'already'>(null);
  const send = useMutation({
    mutationFn: (fixed: boolean) => sendCaseFeedback({ reference, fixed, comment: comment.trim() || undefined }),
    onSuccess: (r) => { setDone(r.reopened ? 'no' : 'yes'); void qc.invalidateQueries({ queryKey: ['case', reference] }); void qc.invalidateQueries({ queryKey: ['fix-stats'] }); },
    onError: (e) => { if (e instanceof SubmitError && e.code === 'already_answered') setDone('already'); },
  });

  if (done) {
    return (
      <section className="mt-8 rounded-[1.5rem] border border-line bg-good-soft p-5" aria-live="polite">
        <p className="font-semibold">{done === 'already' ? t('loop.feedback.already') : done === 'yes' ? t('loop.feedback.thanksYes') : t('loop.feedback.thanksNo')}</p>
      </section>
    );
  }
  return (
    <section className="mt-8 rounded-[1.5rem] border border-line-strong bg-surface p-5 shadow-card sm:p-6" aria-labelledby="fb-title">
      <h2 id="fb-title" className="font-display text-xl font-bold">{t('loop.feedback.title')}</h2>
      <p className="mt-1 text-sm text-ink-2">{t('loop.feedback.intro')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Button variant={answer === true ? 'primary' : 'secondary'} aria-pressed={answer === true} icon={<ThumbsUp className="size-4" aria-hidden />} onClick={() => setAnswer(true)}>{t('loop.feedback.yes')}</Button>
        <Button variant={answer === false ? 'danger' : 'secondary'} aria-pressed={answer === false} icon={<ThumbsDown className="size-4" aria-hidden />} onClick={() => setAnswer(false)}>{t('loop.feedback.no')}</Button>
      </div>
      {answer !== null && (
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-semibold">
            {t('loop.feedback.commentLabel')}
            <TextArea className="mt-1.5 min-h-20" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <p className="text-xs text-muted">{t('loop.feedback.commentHint')}</p>
          {send.isError && !(send.error instanceof SubmitError && send.error.code === 'already_answered') && <p role="alert" className="text-sm font-medium text-bad">{t('loop.feedback.error')}</p>}
          <Button loading={send.isPending} onClick={() => send.mutate(answer)}>{t('loop.feedback.send')}</Button>
        </div>
      )}
    </section>
  );
}
