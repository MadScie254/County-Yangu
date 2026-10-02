import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, LogIn, Send, ShieldCheck } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { useChampions, useIsDemo, useMyChampion } from '@/shared/api/hooks';
import { applyChampion } from '@/shared/api/civic2';
import { useAuth } from '@/shared/state/auth';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea, TextInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';

const wardName = new Map(wards.map((w) => [w.id, w.name]));
const sorted = [...wards].sort((a, b) => a.name.localeCompare(b.name));

/** Verified residents who check projects in their own ward. After Nigeria's Tracka community monitors. */
export default function Champions() {
  const { t } = useI18n();
  const loc = useLocation();
  const qc = useQueryClient();
  const q = useChampions();
  const demo = useIsDemo();
  const user = useAuth((s) => s.user);
  const signedIn = useAuth((s) => s.status === 'in');
  const mine = useMyChampion(user?.id);
  usePageTitle(t('champions.title'));
  const [f, setF] = useState({ ward_id: '', display_name: user?.name ?? '', motivation: '' });
  const apply = useMutation({
    mutationFn: () => applyChampion(f),
    onSuccess: () => { toast({ tone: 'good', title: t('champions.applied') }); void qc.invalidateQueries({ queryKey: ['my-champion'] }); },
    onError: () => toast({ tone: 'bad', title: t('champions.error') }),
  });
  const byWard = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of q.data ?? []) m.set(c.ward_id, [...(m.get(c.ward_id) ?? []), c.display_name]);
    return [...m.entries()].sort((a, b) => (wardName.get(a[0]) ?? a[0]).localeCompare(wardName.get(b[0]) ?? b[0]));
  }, [q.data]);
  const valid = f.ward_id && f.display_name.trim().length >= 2;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('champions.title')}</h1>
      <p className="mt-3 max-w-2xl text-[1.05rem] text-ink-2">{t('champions.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="rounded-[1.75rem] bg-brand-soft p-5 sm:p-6" aria-labelledby="what">
          <h2 id="what" className="font-display text-xl font-bold">{t('champions.what')}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(['a', 'b', 'c', 'd'] as const).map((k) => <li key={k} className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />{t(`champions.duty.${k}`)}</li>)}
          </ul>
        </section>
        <section className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="apply">
          <h2 id="apply" className="font-display text-xl font-bold">{t('champions.apply')}</h2>
          {!signedIn && !demo ? (
            <>
              <p className="mt-2 text-sm text-ink-2">{t('champions.signInWhy')}</p>
              <ButtonLink className="mt-4" to={`/services/account?next=${encodeURIComponent(loc.pathname)}`} icon={<LogIn className="size-4" aria-hidden />}>{t('champions.signIn')}</ButtonLink>
            </>
          ) : mine.data ? (
            <p className="mt-3 text-sm">{t('champions.yourStatus')} <Chip tone={mine.data.status === 'active' ? 'good' : mine.data.status === 'declined' ? 'bad' : 'info'}>{t(`champions.status.${mine.data.status}` as MessageKey)}</Chip></p>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) apply.mutate(); }}>
              <Field label={t('champions.ward')}>{({ id }) => <SelectInput id={id} value={f.ward_id} onChange={(e) => setF({ ...f, ward_id: e.target.value })}><option value="">{t('report.wardPick')}</option>{sorted.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
              <Field label={t('champions.name')} hint={t('champions.nameHint')}>{({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} maxLength={60} value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} />}</Field>
              <Field label={t('champions.why')} optionalLabel={t('common.optional')}>{({ id }) => <TextArea id={id} className="min-h-20" maxLength={600} value={f.motivation} onChange={(e) => setF({ ...f, motivation: e.target.value })} />}</Field>
              <Button type="submit" icon={<Send className="size-4" aria-hidden />} loading={apply.isPending} disabled={!valid}>{t('champions.send')}</Button>
            </form>
          )}
        </section>
      </div>

      <section className="mt-10" aria-labelledby="list">
        <h2 id="list" className="font-display text-xl font-bold">{t('champions.list')}</h2>
        {q.isLoading ? <Skeleton className="mt-4 h-32" /> : byWard.length === 0 ? <p className="mt-3 text-sm text-muted">{t('champions.none')}</p> : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {byWard.map(([w, names]) => (
              <li key={w} className="rounded-2xl border border-line bg-surface p-4">
                <Link to={`/ward/${w}`} className="font-semibold hover:underline">{wardName.get(w) ?? w}</Link>
                <ul className="mt-2 space-y-1 text-sm">{names.map((n) => <li key={n} className="flex items-center gap-1.5"><BadgeCheck className="size-4 text-good" aria-hidden />{n}</li>)}</ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
