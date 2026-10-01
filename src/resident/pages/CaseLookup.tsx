import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search, Smartphone } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { referenceRegex } from '@/shared/lib/schemas';
import { usePageTitle } from '@/shared/lib/hooks';
import { useQueue } from '@/shared/state/queue';
import { wardLabel } from '@/shared/config/county';
import { Button } from '@/shared/ui/Button';
import { Field, TextInput } from '@/shared/ui/Field';
import { Chip } from '@/shared/ui/Chip';

export default function CaseLookup() {
  const { t, date } = useI18n();
  usePageTitle(t('status.title'));
  const nav = useNavigate();
  const [ref, setRef] = useState('');
  const [bad, setBad] = useState(false);
  // select the stable array and filter outside the store: a selector that returns a new array every time loops forever
  const items = useQueue((s) => s.items);
  const mine = useMemo(() => items.filter((i) => i.kind === 'report'), [items]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold">{t('status.title')}</h1>
      <p className="mt-3 text-ink-2">{t('status.intro')}</p>

      <form
        className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const v = ref.trim().toUpperCase();
          if (!referenceRegex.test(v)) return setBad(true);
          nav(`/case/${v}`);
        }}
      >
        <Field className="flex-1" label={t('status.referenceLabel')} error={bad ? t('status.notFound') : undefined}>
          {({ id, describedBy }) => (
            <TextInput id={id} aria-describedby={describedBy} invalid={bad} value={ref} onChange={(e) => { setRef(e.target.value); setBad(false); }} placeholder={t('status.referencePlaceholder')} autoCapitalize="characters" autoComplete="off" spellCheck={false} className="font-data uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal" />
          )}
        </Field>
        <Button type="submit" size="lg" icon={<Search className="size-4" aria-hidden />}>{t('status.lookup')}</Button>
      </form>

      {mine.length > 0 && (
        <section className="mt-12">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold"><Smartphone className="size-5 text-muted" aria-hidden /> {t('status.onThisPhone')}</h2>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[1.5rem] border border-line bg-surface">
            {mine.map((i) => {
              const reference = i.kind === 'report' && i.result && 'reference' in i.result ? i.result.reference : null;
              return (
                <li key={i.id}>
                  {reference ? (
                    <Link to={`/case/${reference}`} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-bg-2">
                      <span>
                        <span className="block font-data font-medium">{reference}</span>
                        <span className="block text-sm text-muted">{wardLabel(i.kind === 'report' ? i.payload.ward_id : '')} · {date(i.createdAt)}</span>
                      </span>
                      <ArrowRight className="size-4 text-muted" aria-hidden />
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                      <span className="text-sm text-muted">{wardLabel(i.kind === 'report' ? i.payload.ward_id : '')} · {date(i.createdAt)}</span>
                      <Chip tone={i.status === 'failed' ? 'bad' : 'warn'}>{i.status === 'failed' ? t('offline.failed') : t('offline.sending')}</Chip>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
