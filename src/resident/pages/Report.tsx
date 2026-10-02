import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { OpenCasesPanel } from '../components/report/OpenCasesPanel';
import { VoiceInput } from '../components/report/VoiceInput';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, Copy, Share2, ShieldCheck, TriangleAlert, WifiOff, Landmark, Zap } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { county, wardById, wardsBySubCounty } from '@/shared/config/county';
import { categoryIds, categoryMeta, type CategoryId } from '@/shared/data/categories';
import { reportSchema, type ReportForm } from '@/shared/lib/schemas';
import { toE164Kenya, cn } from '@/shared/lib/utils';
import { usePageTitle } from '@/shared/lib/hooks';
import { useQueue } from '@/shared/state/queue';
import { useCategorySla } from '@/shared/api/hooks';
import { usePrefs } from '@/shared/state/prefs';
import { useWardGeometry } from '@/shared/map/useGeometry';
import { nearestSubCounty, wardAtPoint, type LngLat } from '@/shared/map/geo';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { CategoryIcon } from '@/shared/ui/CategoryIcon';
import { Chip } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea, TextInput } from '@/shared/ui/Field';
import { toast } from '@/shared/ui/Toast';
import { PhotoPicker, type Photo } from '../components/report/PhotoPicker';
import { LocationPicker } from '../components/report/LocationPicker';

const errKey = (m?: string): MessageKey | undefined =>
  m && ['tooShort', 'needCategory', 'needWard', 'callbackInvalid'].includes(m) ? (`report.${m}` as MessageKey) : undefined;

const STEPS = ['stepWhat', 'stepWhere', 'stepDetails'] as const;

export default function Report() {
  const { t, locale, list } = useI18n();
  usePageTitle(t('report.title'));
  const [params] = useSearchParams();
  const geometry = useWardGeometry();
  const savedWard = usePrefs((s) => s.wardId);
  const setSavedWard = usePrefs((s) => s.setWardId);
  const enqueue = useQueue((s) => s.enqueueReport);

  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [point, setPoint] = useState<LngLat | null>(null);
  const [wardTouched, setWardTouched] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const initialWard = params.get('ward') ?? savedWard ?? '';
  const form = useForm<ReportForm>({
    resolver: zodResolver(reportSchema),
    mode: 'onTouched',
    defaultValues: { category_id: (categoryIds as readonly string[]).includes(params.get('category') ?? '') ? (params.get('category') as CategoryId) : undefined, extra_category_ids: [], ward_id: wardById.has(initialWard) ? initialWard : '', description: '', lat: null, lng: null, callback_consent: false, callback_phone: '' },
  });
  const { register, control, watch, setValue, trigger, handleSubmit, formState: { errors } } = form;
  const category = watch('category_id') as CategoryId | undefined;
  const extras = (watch('extra_category_ids') ?? []) as CategoryId[];
  const selected = [category, ...extras].filter(Boolean) as CategoryId[];
  const sla = useCategorySla();
  const sameDay = useMemo(() => new Set((sla.data ?? []).filter((c) => c.resolve_unit === 'hours' && c.resolve_value <= 24).map((c) => c.id)), [sla.data]);
  // Tapping a tile adds or removes it. The first one chosen is the main issue; up to five in all.
  const toggle = (id: CategoryId) => {
    if (selected.includes(id)) {
      const rest = selected.filter((x) => x !== id);
      setValue('category_id', (rest[0] ?? undefined) as CategoryId, { shouldValidate: Boolean(rest[0]) });
      setValue('extra_category_ids', rest.slice(1));
    } else if (selected.length < 5) {
      if (!category) setValue('category_id', id, { shouldValidate: true });
      else setValue('extra_category_ids', [...extras, id]);
    }
  };
  const ward = watch('ward_id');
  const consent = watch('callback_consent');
  const description = watch('description');

  // Where the pin rests -> lat/lng, and (when ward polygons exist) the ward.
  const onPoint = (p: LngLat) => {
    setPoint(p);
    setValue('lat', p.lat);
    setValue('lng', p.lng);
    if (!wardTouched) {
      const w = wardAtPoint(geometry.data ?? null, p);
      if (w) setValue('ward_id', w, { shouldValidate: true });
    }
  };
  const nearby = point ? nearestSubCounty(point) : null;
  const groups = useMemo(() => {
    const all = wardsBySubCounty();
    if (!nearby) return all;
    // nearest sub-county first, so the likely wards are at the top of the list
    return [...all].sort((a, b) => Number(b.subCounty.id === nearby.id) - Number(a.subCounty.id === nearby.id));
  }, [nearby]);

  const initialPoint: LngLat | null = useMemo(() => {
    const w = wardById.get(initialWard);
    const sc = w ? county && wardsBySubCounty().find((g) => g.subCounty.id === w.subCountyId)?.subCounty : undefined;
    return sc?.lat != null && sc.lng != null ? { lat: sc.lat, lng: sc.lng } : null;
  }, [initialWard]);

  // live status of what we just queued
  const item = useQueue((s) => s.items.find((i) => i.id === submittedId));
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, submittedId]);

  const next = async () => {
    const fields: (keyof ReportForm)[][] = [['category_id'], ['ward_id'], ['description', 'callback_phone']];
    if (await trigger(fields[step])) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const onSubmit = handleSubmit(async (v) => {
    setSending(true);
    try {
      const it = await enqueue(
        {
          category_id: v.category_id,
          extra_category_ids: v.extra_category_ids.filter((c) => c !== v.category_id),
          ward_id: v.ward_id,
          description: v.description.trim(),
          lat: v.lat,
          lng: v.lng,
          locale,
          callback_phone: v.callback_consent ? toE164Kenya(v.callback_phone) : null,
        },
        photos.map((p) => p.blob),
      );
      setSavedWard(v.ward_id);
      setSubmittedId(it.id);
    } catch {
      toast({ tone: 'bad', title: t('report.errorTitle'), body: t('report.errorRetry') });
    } finally {
      setSending(false);
    }
  });

  if (submittedId && item) return <Confirmation status={item.status} reference={item.result && 'reference' in item.result ? item.result.reference : undefined} others={item.result && 'reports' in item.result ? (item.result.reports ?? []).slice(1) : []} wardId={form.getValues('ward_id')} error={item.error} onAgain={() => { setSubmittedId(null); setStep(0); form.reset({ ward_id: form.getValues('ward_id'), description: '', callback_consent: false, callback_phone: '', lat: null, lng: null, category_id: undefined as unknown as CategoryId, extra_category_ids: [] }); setPhotos([]); setPoint(null); }} />;

  const remaining = 2000 - (description?.length ?? 0);
  const metas = selected.map((c) => categoryMeta[c]);
  const meta = { sensitive: metas.some((m) => m.sensitive), urgent: metas.some((m) => m.urgent) };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold">{t('report.title')}</h1>
        <p className="mt-3 text-[1.05rem] text-ink-2">{t('report.intro', { county: county.name })}</p>
      </header>

      <ol aria-label={t('report.title')} className="mt-8 grid grid-cols-3 gap-2">
        {STEPS.map((k, i) => (
          <li key={k} aria-current={i === step ? 'step' : undefined}>
            <div className={cn('h-1.5 rounded-full transition-colors', i <= step ? 'bg-brand' : 'bg-line')} />
            <p className={cn('mt-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em]', i === step ? 'text-ink' : 'text-muted')}>
              {i < step ? <Check className="size-3.5 text-good" aria-hidden /> : <span className="font-data">{i + 1}</span>}
              {t(`report.${k}`)}
            </p>
          </li>
        ))}
      </ol>

      <form onSubmit={onSubmit} noValidate className="mt-8">
        {/* ---- 1. what + photo ---- */}
        <section hidden={step !== 0} aria-labelledby="s1">
          <h2 id="s1" className="font-display text-2xl font-bold">{t('report.category')}</h2>
          <p className="mt-1 text-sm text-muted">{t('report.categoryHelp')}</p>
          <p className="mt-2 rounded-xl bg-bg-2/70 px-3 py-2 text-sm">{t('report.multiHint')} <b className="font-data">{selected.length}/5</b></p>
          <Controller
            control={control}
            name="category_id"
            render={() => (
              <div role="group" aria-label={t('report.category')} className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {categoryIds.map((id) => {
                  const pos = selected.indexOf(id);
                  const on = pos >= 0;
                  const full = !on && selected.length >= 5;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={on}
                      disabled={full}
                      onClick={() => toggle(id)}
                      className={cn('relative flex min-h-[4.5rem] items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.98] disabled:opacity-40', on ? 'border-ink bg-brand-soft shadow-card ring-2 ring-ink' : 'border-line bg-surface hover:border-line-strong')}
                    >
                      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', on ? 'bg-brand text-brand-ink' : 'bg-bg-2 text-ink-2')}>
                        {on ? <span className="font-data text-base font-bold">{pos + 1}</span> : <CategoryIcon id={id} className="size-5" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.9rem] font-semibold leading-snug">{t(`categories.${id}`)}</span>
                        {pos === 0 && selected.length > 1 && <span className="mt-0.5 block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ink-2">{t('report.mainIssue')}</span>}
                        {sameDay.has(id) && <span className="mt-0.5 inline-flex items-center gap-1 text-[0.7rem] font-semibold text-good"><Zap className="size-3" aria-hidden />{t('report.sameDay')}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          />
          {selected.length > 1 && <p className="mt-3 text-sm text-ink-2">{t('report.multiNote', { count: selected.length })}</p>}
          {errors.category_id && <p role="alert" className="mt-2 text-sm font-medium text-bad">{t('report.needCategory')}</p>}
          {meta?.sensitive && (
            <p className="mt-4 flex gap-2.5 rounded-2xl bg-info-soft p-3.5 text-sm text-info">
              <Landmark className="mt-0.5 size-4 shrink-0" aria-hidden /> {t('report.sensitiveNote')}
            </p>
          )}
          {meta?.urgent && (
            <p className="mt-4 flex gap-2.5 rounded-2xl bg-bad-soft p-3.5 text-sm font-medium text-bad">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {t('report.urgentNote')}
            </p>
          )}

          <h2 className="mt-10 font-display text-2xl font-bold">{t('report.addPhoto')} <span className="text-base font-medium text-muted">· {t('common.optional')}</span></h2>
          <div className="mt-3">
            <PhotoPicker photos={photos} onChange={setPhotos} />
          </div>
        </section>

        {/* ---- 2. where ---- */}
        <section hidden={step !== 1} aria-labelledby="s2">
          <h2 id="s2" className="font-display text-2xl font-bold">{t('report.where')}</h2>
          <div className="mt-4">
            {step === 1 && <LocationPicker point={point} onPoint={onPoint} initial={initialPoint} />}
          </div>
          <Field className="mt-5" label={t('report.wardLabel')} error={errKey(errors.ward_id?.message) && t(errKey(errors.ward_id?.message)!)} hint={ward && !wardTouched && geometry.data ? t('report.wardAuto', { ward: wardById.get(ward)?.name ?? '' }) : undefined}>
            {({ id, describedBy }) => (
              <SelectInput id={id} aria-describedby={describedBy} invalid={Boolean(errors.ward_id)} {...register('ward_id', { onChange: () => setWardTouched(true) })}>
                <option value="">{t('report.wardPick')}</option>
                {groups.map((g) => (
                  <optgroup key={g.subCounty.id} label={g.subCounty.name}>
                    {g.wards.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </optgroup>
                ))}
              </SelectInput>
            )}
          </Field>
        </section>

        {/* ---- 3. details + privacy + send ---- */}
        <section hidden={step !== 2} aria-labelledby="s3">
          {step === 2 && <OpenCasesPanel ward={ward} category={category ?? null} />}
          <h2 id="s3" className="font-display text-2xl font-bold">{t('report.describe')}</h2>
          <Field className="mt-3" label={t('report.describe')} hint={t('report.describeHelp')} error={errKey(errors.description?.message) && t(errKey(errors.description?.message)!)}>
            {({ id, describedBy }) => <TextArea id={id} aria-describedby={describedBy} invalid={Boolean(errors.description)} maxLength={2000} placeholder={t('report.describePlaceholder')} {...register('description')} />}
          </Field>
          <VoiceInput onText={(text) => setValue('description', `${form.getValues('description')} ${text}`.trim().slice(0, 2000), { shouldValidate: true, shouldDirty: true })} />
          <p className="mt-1 text-right text-xs text-muted">{t('report.charsLeft', { count: remaining })}</p>

          <Card className="mt-6 p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-1 size-5 accent-[var(--ink)]" {...register('callback_consent')} />
              <span>
                <span className="block font-semibold">{t('report.callbackTitle')}</span>
                <span className="mt-1 block text-sm text-muted">{t('report.callbackBody')}</span>
              </span>
            </label>
            {consent && (
              <Field className="mt-4" label={t('report.callbackPhone')} error={errKey(errors.callback_phone?.message) && t(errKey(errors.callback_phone?.message)!)}>
                {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} invalid={Boolean(errors.callback_phone)} inputMode="tel" autoComplete="tel" placeholder="0712 345 678" {...register('callback_phone')} />}
              </Field>
            )}
            <p className="mt-3 text-xs text-muted">{t('report.callbackConsent')}</p>
          </Card>

          <div className="mt-6 rounded-[1.5rem] bg-good-soft p-5">
            <p className="flex items-center gap-2 font-display text-lg font-bold text-good">
              <ShieldCheck className="size-5" aria-hidden /> {t('report.privacyTitle')}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-ink">
              {list('report.privacyBullets').map((b) => (
                <li key={b} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-good" aria-hidden /> {b}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- controls ---- */}
        <div className="glass sticky bottom-20 z-20 mt-8 flex items-center justify-between gap-3 rounded-full border border-line p-2 shadow-float lg:bottom-4">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} className={cn(step === 0 && 'invisible')} icon={<ArrowLeft className="size-4" aria-hidden />}>
            {t('common.back')}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} iconRight={<ArrowRight className="size-4" aria-hidden />} size="lg" className="min-w-40">
              {t('common.next')}
            </Button>
          ) : (
            <Button type="submit" size="lg" loading={sending} className="min-w-44">
              {sending ? t('report.sending') : t('report.submit')}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Confirmation({ status, reference, others, wardId, error, onAgain }: { status: string; reference?: string; others: { reference: string; category_id: string }[]; wardId: string; error?: string; onAgain: () => void }) {
  const { t } = useI18n();
  const sent = status === 'sent' && reference;
  const [copied, setCopied] = useState(false);
  const wardName = wardById.get(wardId)?.name ?? '';

  const share = async () => {
    const text = t('report.shareText', { ward: wardName, ref: reference ?? '' });
    if (navigator.share) await navigator.share({ text, url: `${location.origin}/case/${reference}` }).catch(() => undefined);
    else await navigator.clipboard?.writeText(`${text} ${location.origin}/case/${reference}`);
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-14 text-center sm:py-20">
      <div className={cn('mx-auto grid size-20 place-items-center rounded-full', sent ? 'bg-good-soft text-good' : 'bg-warn-soft text-warn')}>
        {sent ? <Check className="size-10" aria-hidden strokeWidth={2.5} /> : <WifiOff className="size-9" aria-hidden />}
      </div>
      <h1 className="mt-6 font-display text-4xl font-extrabold">{sent ? t('report.successTitle') : t('report.queuedTitle')}</h1>
      <p className="mt-3 text-ink-2">{sent ? t('report.successBody') : t('report.queuedBody')}</p>
      {status === 'failed' && <p role="alert" className="mt-3 text-sm font-medium text-bad">{t('report.errorTitle')}{error ? ` (${error})` : ''}</p>}

      {sent && (
        <div className="mt-8 rounded-[1.5rem] border border-line bg-surface p-6 shadow-card">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{t('report.reference')}</p>
          <p className="mt-2 break-all font-data text-3xl font-medium tracking-wide" data-testid="reference">{reference}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" size="sm" icon={copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} onClick={async () => { await navigator.clipboard?.writeText(reference!); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
              {copied ? t('common.copied') : t('common.copy')}
            </Button>
            <Button variant="secondary" size="sm" icon={<Share2 className="size-4" aria-hidden />} onClick={share}>{t('common.share')}</Button>
          </div>
          {others.length > 0 && (
            <div className="mt-5 border-t border-line pt-4 text-left">
              <p className="text-sm font-semibold">{t('report.alsoFiled', { count: others.length })}</p>
              <ul className="mt-2 space-y-1.5">
                {others.map((o) => (
                  <li key={o.reference}><Link to={`/case/${o.reference}`} className="flex items-center justify-between gap-3 rounded-xl bg-bg-2/70 px-3 py-2 text-sm hover:bg-bg-2"><span>{t(`categories.${o.category_id}` as MessageKey)}</span><span className="font-data">{o.reference}</span></Link></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
        {sent && <ButtonLink to={`/case/${reference}`}>{t('report.trackIt')}</ButtonLink>}
        <Button variant="secondary" onClick={onAgain}>{t('report.reportAnother')}</Button>
      </div>
      {!sent && <p className="mt-6"><Chip tone="warn">{t('offline.sending')}</Chip></p>}
      <p className="mt-8 text-sm text-muted"><Link to="/case" className="underline">{t('status.title')}</Link></p>
    </div>
  );
}
