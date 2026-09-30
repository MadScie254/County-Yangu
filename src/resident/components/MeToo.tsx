import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { sendMeToo, SubmitError } from '@/shared/api/submit';
import { Button } from '@/shared/ui/Button';

/** "Me too" on an open report: a neighbour adds their voice instead of filing a duplicate. */
export function MeToo({ reference, count }: { reference: string; count: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const key = `cy-metoo-${reference}`;
  const [done, setDone] = useState<null | 'added' | 'already'>(() => { try { return localStorage.getItem(key) ? 'already' : null; } catch { return null; } });
  const add = useMutation({
    mutationFn: () => sendMeToo(reference),
    onSuccess: () => { setDone('added'); try { localStorage.setItem(key, '1'); } catch { /* private mode */ } void qc.invalidateQueries({ queryKey: ['case', reference] }); },
    onError: (e) => { if (e instanceof SubmitError && e.code === 'already_added') { setDone('already'); try { localStorage.setItem(key, '1'); } catch { /* ignore */ } } },
  });
  return (
    <section className="mt-8 rounded-[1.5rem] border border-line bg-surface p-5 shadow-card" aria-labelledby="metoo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="metoo" className="font-display text-lg font-bold">{t('loop.metoo.title')}</h2>
          {count > 0 && <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2"><Users className="size-4" aria-hidden />{t('loop.metoo.count', { count })}</p>}
        </div>
        {!done && <Button loading={add.isPending} icon={<Users className="size-4" aria-hidden />} onClick={() => add.mutate()}>{t('loop.metoo.button')}</Button>}
      </div>
      <p className="mt-2 text-sm text-muted" aria-live="polite">
        {done === 'added' ? t('loop.metoo.added') : done === 'already' ? t('loop.metoo.already') : add.isError ? t('loop.metoo.error') : t('loop.metoo.hint')}
      </p>
    </section>
  );
}
