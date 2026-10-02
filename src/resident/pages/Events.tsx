import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Check, LogIn, MapPin, Plus, Users } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { wardById, wards } from '@/shared/config/county';
import { useEvents, useIsDemo, useMyChampion, useMyRsvps } from '@/shared/api/hooks';
import { createEvent, setRsvp, type CommunityEvent } from '@/shared/api/engage';
import { useAuth } from '@/shared/state/auth';
import { usePrefs } from '@/shared/state/prefs';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea, TextInput } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { Skeleton } from '@/shared/ui/Card';
import { ShareCardButton } from '@/shared/ui/ShareCardButton';
import { toast } from '@/shared/ui/Toast';

const kinds: CommunityEvent['kind'][] = ['cleanup', 'tree_planting', 'drainage', 'other'];
const sortedWards = [...wards].sort((a, b) => a.name.localeCompare(b.name));
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/** Neighbourhood clean-ups and similar, posted by ward champions and ward staff. Residents say they are going. */
export default function Events() {
  const { t, date } = useI18n();
  const loc = useLocation();
  const qc = useQueryClient();
  const q = useEvents();
  const demo = useIsDemo();
  const user = useAuth((s) => s.user);
  const signedIn = useAuth((s) => s.status === 'in');
  const staff = useAuth((s) => s.roles.some((r) => ['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin'].includes(r.role)));
  const champ = useMyChampion(user?.id);
  const mine = useMyRsvps(signedIn);
  const prefWard = usePrefs((s) => s.wardId);
  const [local2, setLocal2] = useState<Record<string, boolean>>({});
  const [ward, setWard] = useState('');
  const [now] = useState(() => Date.now());
  const [form, setForm] = useState<null | { ward_id: string; kind: CommunityEvent['kind']; title: string; details: string; meet_at: string; start: string; hours: number }>(null);
  usePageTitle(t('events.title'));

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id && q.data?.length) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
  }, [q.data?.length]);

  const going = (id: string) => local2[id] ?? (mine.data ?? []).includes(id);
  const rsvp = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => setRsvp(id, on),
    onMutate: ({ id, on }) => setLocal2((s) => ({ ...s, [id]: on })),
    onSuccess: (_, { on }) => { if (on) toast({ tone: 'good', title: t('events.seeYou') }); void qc.invalidateQueries({ queryKey: ['events'] }); void qc.invalidateQueries({ queryKey: ['my-rsvps'] }); },
    onError: (_e, { id }) => { setLocal2((s) => { const c = { ...s }; delete c[id]; return c; }); toast({ tone: 'bad', title: t('events.error') }); },
  });
  const create = useMutation({
    mutationFn: () => {
      const start = new Date(form!.start);
      return createEvent({ ward_id: form!.ward_id, kind: form!.kind, title: form!.title.trim(), details: form!.details.trim() || null, meet_at: form!.meet_at.trim(),
        starts_at: start.toISOString(), ends_at: new Date(start.getTime() + form!.hours * 3_600_000).toISOString() });
    },
    onSuccess: () => { toast({ tone: 'good', title: t('events.posted') }); setForm(null); void qc.invalidateQueries({ queryKey: ['events'] }); },
    onError: () => toast({ tone: 'bad', title: t('events.postError') }),
  });

  const canPost = demo || staff || champ.data?.status === 'active';
  const list = useMemo(() => (q.data ?? []).filter((e) => !ward || e.ward_id === ward), [q.data, ward]);
  const upcoming = list.filter((e) => e.status === 'scheduled' && Date.parse(e.ends_at) > now);
  const past = list.filter((e) => !(e.status === 'scheduled' && Date.parse(e.ends_at) > now)).reverse();
  const valid = form && form.ward_id && form.title.trim().length >= 5 && form.meet_at.trim().length >= 3 && form.start && Date.parse(form.start) > now;

  const card = (e: CommunityEvent) => {
    const open = e.status === 'scheduled' && Date.parse(e.ends_at) > now;
    const wardName = wardById.get(e.ward_id)?.name ?? e.ward_id;
    return (
      <li key={e.id} id={e.id} className="scroll-mt-24 rounded-[1.5rem] border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="good">{t(`events.kind.${e.kind}` as MessageKey)}</Chip>
          <Chip>{wardName}</Chip>
          {e.status === 'cancelled' && <Chip tone="bad">{t('events.cancelled')}</Chip>}
          {e.status === 'held' && <Chip tone="info">{t('events.held')}</Chip>}
        </div>
        <h3 className="mt-2 font-display text-lg font-bold leading-snug">{e.title}</h3>
        <p className="mt-1 text-sm font-semibold">{date(e.starts_at, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2"><MapPin className="size-4" aria-hidden />{e.meet_at}</p>
        {e.details && <p className="mt-2 text-sm text-ink-2">{e.details}</p>}
        {e.outcome && <p className="mt-3 rounded-xl bg-good-soft p-3 text-sm"><b>{t('events.outcome')}</b> {e.outcome}{e.attended ? ` ${t('events.attended', { count: e.attended })}` : ''}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold"><Users className="size-4" aria-hidden />{t('events.going', { count: e.going + (local2[e.id] === true && !(mine.data ?? []).includes(e.id) ? 1 : 0) })}</span>
          {open && (signedIn || demo ? (
            <Button size="sm" variant={going(e.id) ? 'soft' : 'primary'} icon={going(e.id) ? <Check className="size-4" aria-hidden /> : <CalendarPlus className="size-4" aria-hidden />}
              aria-pressed={going(e.id)} onClick={() => rsvp.mutate({ id: e.id, on: !going(e.id) })}>{going(e.id) ? t('events.imGoing') : t('events.join')}</Button>
          ) : <ButtonLink size="sm" variant="secondary" to={`/services/account?next=${encodeURIComponent(`${loc.pathname}#${e.id}`)}`} icon={<LogIn className="size-4" aria-hidden />}>{t('events.signIn')}</ButtonLink>)}
          {open && <ShareCardButton path={`/events#${e.id}`} text={t('events.shareText', { title: e.title, ward: wardName })}
            card={{ kicker: wardName, title: e.title, stat: date(e.starts_at, { day: 'numeric', month: 'short' }), statLabel: e.meet_at, tone: 'good', lines: [t('events.going', { count: e.going })] }} />}
        </div>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('events.title')}</h1>
      <p className="mt-3 max-w-2xl text-[1.05rem] text-ink-2">{t('events.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">{t('events.filter')}
          <SelectInput className="mt-1.5" value={ward} onChange={(e) => setWard(e.target.value)}><option value="">{t('events.allWards')}</option>{sortedWards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>
        </label>
        {canPost
          ? <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => { const d = new Date(now + 3 * 86_400_000); d.setHours(8, 0, 0, 0); setForm({ ward_id: champ.data?.ward_id ?? prefWard ?? '', kind: 'cleanup', title: '', details: '', meet_at: '', start: local(d), hours: 3 }); }}>{t('events.post')}</Button>
          : <p className="text-sm text-muted">{t('events.whoPosts')} <Link to="/champions" className="font-semibold underline">{t('events.becomeChampion')}</Link></p>}
      </div>

      {q.isLoading ? <Skeleton className="mt-8 h-64" /> : (
        <>
          <h2 className="mt-8 font-display text-xl font-bold">{t('events.upcoming')}</h2>
          {upcoming.length === 0 ? <p className="mt-3 text-sm text-muted">{t('events.noneUpcoming')}</p> : <ul className="mt-3 space-y-3">{upcoming.map(card)}</ul>}
          {past.length > 0 && (<><h2 className="mt-10 font-display text-xl font-bold">{t('events.past')}</h2><ul className={cn('mt-3 space-y-3')}>{past.map(card)}</ul></>)}
        </>
      )}

      <Sheet open={Boolean(form)} onClose={() => setForm(null)} title={t('events.post')} className="sm:max-w-xl">
        {form && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) create.mutate(); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('events.ward')}>{({ id }) => <SelectInput id={id} value={form.ward_id} onChange={(e) => setForm({ ...form, ward_id: e.target.value })}><option value="">{t('report.wardPick')}</option>{sortedWards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
              <Field label={t('events.what')}>{({ id }) => <SelectInput id={id} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as CommunityEvent['kind'] })}>{kinds.map((k) => <option key={k} value={k}>{t(`events.kind.${k}` as MessageKey)}</option>)}</SelectInput>}</Field>
            </div>
            <Field label={t('events.titleLabel')}>{({ id }) => <TextInput id={id} maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
            <Field label={t('events.meet')}>{({ id }) => <TextInput id={id} maxLength={200} value={form.meet_at} onChange={(e) => setForm({ ...form, meet_at: e.target.value })} />}</Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('events.when')}>{({ id }) => <TextInput id={id} type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />}</Field>
              <Field label={t('events.hours')}>{({ id }) => <SelectInput id={id} value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })}>{[2, 3, 4, 6].map((h) => <option key={h} value={h}>{h}</option>)}</SelectInput>}</Field>
            </div>
            <Field label={t('events.details')} optionalLabel={t('common.optional')}>{({ id }) => <TextArea id={id} className="min-h-20" maxLength={1000} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />}</Field>
            <Button type="submit" icon={<CalendarPlus className="size-4" aria-hidden />} loading={create.isPending} disabled={!valid}>{t('events.publish')}</Button>
          </form>
        )}
      </Sheet>
    </div>
  );
}
