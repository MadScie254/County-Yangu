import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, Search, ShieldAlert, ShieldX } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useIsDemo, useVerify } from '@/shared/api/hooks';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { TextInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';

export default function Verify() {
  const { code = '' } = useParams();
  const { t, date, kes } = useI18n();
  const nav = useNavigate();
  const demo = useIsDemo();
  const [input, setInput] = useState(code);
  const clean = code.trim().toUpperCase();
  const q = useVerify(clean.length >= 6 ? clean : null);
  usePageTitle(t('loop.verify.title'));
  const r = q.data;
  const state = r?.state ?? 'unknown';
  const Icon = state === 'valid' ? BadgeCheck : state === 'revoked' ? ShieldAlert : ShieldX;
  const tone = state === 'valid' ? 'good' : state === 'revoked' ? 'warn' : 'bad';
  const row = (label: string, value?: string | null) => value ? <div><dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{label}</dt><dd className="mt-0.5 font-semibold">{value}</dd></div> : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="font-display text-[clamp(1.9rem,5.5vw,2.6rem)] font-extrabold leading-tight">{t('loop.verify.title')}</h1>
      <p className="mt-3 text-ink-2">{t('loop.verify.intro')}</p>
      <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (input.trim()) nav(`/verify/${encodeURIComponent(input.trim().toUpperCase())}`); }}>
        <TextInput aria-label={t('loop.verify.label')} placeholder={t('loop.verify.placeholder')} value={input} onChange={(e) => setInput(e.target.value)} autoCapitalize="characters" autoComplete="off" className="font-data uppercase" />
        <Button type="submit" icon={<Search className="size-4" aria-hidden />}>{t('loop.verify.check')}</Button>
      </form>
      {demo && <p className="mt-2 text-xs text-muted">{t('loop.verify.demoHint')}</p>}

      <div className="mt-8" aria-live="polite">
        {q.isLoading && <Skeleton className="h-48" />}
        {r && (
          <div className={cn('rounded-[1.75rem] border p-6 shadow-card', tone === 'good' ? 'border-good bg-good-soft' : tone === 'warn' ? 'border-warn bg-warn-soft' : 'border-bad bg-bad-soft')}>
            <div className="flex items-center gap-3">
              <Icon className={cn('size-9', tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : 'text-bad')} aria-hidden />
              <div>
                <p className="font-display text-2xl font-extrabold">{t(`loop.verify.${state === 'not_valid' ? 'unknown' : state}` as 'loop.verify.valid')}</p>
                <p className="text-sm text-ink-2">{state === 'valid' ? t('loop.verify.validText') : state === 'revoked' ? t('loop.verify.revokedText') : t('loop.verify.unknownText')}</p>
              </div>
            </div>
            {r.kind && (
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm">
                {row(t('loop.verify.permit'), r.kind === 'permit' ? r.service : null)}
                {row(t('loop.verify.receipt'), r.kind === 'receipt' ? r.reference : null)}
                {row(t('loop.verify.holder'), r.holder)}
                {row(t('loop.verify.ward'), r.ward)}
                {row(t('loop.verify.amount'), r.amount ? kes(r.amount) : null)}
                {row(t('loop.verify.issued'), r.issued_at ? date(r.issued_at) : null)}
                {r.kind === 'permit' && row(t('loop.verify.reference'), r.reference)}
                {row(t('loop.verify.reason'), r.revoked_reason)}
              </dl>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
