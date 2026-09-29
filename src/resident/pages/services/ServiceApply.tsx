import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, FileUp, ShieldCheck } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { getApplication, getService, saveDraft, submitApplication, uploadDocument } from '@/shared/api/services';
import type { Application, FormField, Service } from '@/shared/api/services-types';
import { useAuth } from '@/shared/state/auth';
import { preparePhoto } from '@/shared/lib/image';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { wardById } from '@/shared/config/county';
import { Button } from '@/shared/ui/Button';
import { Field, TextInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { DynamicField } from '../../components/DynamicField';
import { PayWithMpesa } from '../../components/PayWithMpesa';

const KRA_PIN = /^[AP]\d{9}[A-Z]$/i;
const MAX_DOC = 8 * 1024 * 1024;
type Step = 'details' | 'documents' | 'review' | 'pay';

export default function ServiceApply() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { t, kes, locale } = useI18n();
  const user = useAuth((s) => s.user);

  const q = useQuery({ queryKey: ['service', slug], queryFn: () => getService(slug) });
  const service = q.data ?? null;
  usePageTitle(service ? service.name : t('services.title'));

  const [step, setStep] = useState<Step>('details');
  const [values, setValues] = useState<Record<string, string>>({});
  const [businessName, setBusinessName] = useState('');
  const [kraPin, setKraPin] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<Record<string, { blob: Blob; name: string; ext: string }>>({});
  const [draft, setDraft] = useState<Application | null>(null);
  const [busy, setBusy] = useState(false);

  // resume a draft
  const draftId = params.get('draft');
  useEffect(() => {
    if (!draftId) return;
    void getApplication(draftId).then((r) => {
      if (!r) return;
      setDraft(r.app);
      setValues(r.app.form_data ?? {});
      setBusinessName(r.app.business_name ?? '');
      setKraPin(r.app.kra_pin ?? '');
      if (r.app.status === 'awaiting_payment') setStep('pay');
    });
  }, [draftId]);

  const steps = useMemo<Step[]>(() => (service ? (['details', ...(service.required_documents.length ? ['documents'] : []), 'review', ...(service.fee > 0 ? ['pay'] : [])] as Step[]) : ['details']), [service]);
  const idx = steps.indexOf(step);
  const pick = (b?: { en: string; sw?: string }) => (b ? (locale === 'sw' && b.sw ? b.sw : b.en) : '');

  if (q.isLoading) return <div className="mx-auto max-w-2xl space-y-4 px-4 py-12"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64" /></div>;
  if (!service) return <div className="mx-auto max-w-md px-4 py-24 text-center"><h1 className="font-display text-3xl font-extrabold">{t('errors.notFoundTitle')}</h1><Link to="/services" className="mt-6 inline-block font-semibold underline">{t('services.title')}</Link></div>;

  const validateDetails = (s: Service) => {
    const e: Record<string, string> = {};
    for (const f of s.form_schema) {
      const v = (values[f.key] ?? '').trim();
      if (f.required && !v) e[f.key] = t('services.apply_.required');
      else if (v && f.pattern && !new RegExp(f.pattern, 'i').test(v)) e[f.key] = t('services.apply_.required');
    }
    if (s.requires_kra_pin) {
      if (!businessName.trim()) e.business_name = t('services.apply_.required');
      if (!KRA_PIN.test(kraPin.trim())) e.kra_pin = t('services.apply_.kraInvalid');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const persist = async (): Promise<Application> => {
    const wardField = service.form_schema.find((f: FormField) => f.type === 'ward');
    const wardId = wardField ? values[wardField.key] : undefined;
    const app = await saveDraft(user!.id, { service_id: service.id, ward_id: wardId && wardById.has(wardId) ? wardId : null, business_name: service.requires_kra_pin ? businessName.trim() : null, kra_pin: service.requires_kra_pin ? kraPin.trim().toUpperCase() : null, form_data: values }, draft?.id);
    setDraft(app);
    return app;
  };

  const go = async (dir: 1 | -1) => {
    if (dir === -1) return setStep(steps[Math.max(0, idx - 1)]!);
    setBusy(true);
    try {
      if (step === 'details') {
        if (!validateDetails(service)) return;
        await persist();
      } else if (step === 'documents') {
        const missing = service.required_documents.filter((k) => !docs[k] && !(draft && draftId));
        if (missing.length) return setErrors({ docs: t('services.apply_.docMissing') });
        setErrors({});
        const app = draft ?? (await persist());
        for (const [kind, d] of Object.entries(docs)) await uploadDocument(user!.id, app.id, kind, d.blob, d.ext);
      } else if (step === 'review') {
        const app = draft ?? (await persist());
        const next = await submitApplication(app);
        setDraft(next);
        void qc.invalidateQueries({ queryKey: ['applications'] });
        if (next.status === 'awaiting_payment') return setStep('pay');
        toast({ tone: 'good', title: t('services.app.statuses.submitted') });
        return nav(`/services/applications/${next.id}`);
      }
      setStep(steps[Math.min(steps.length - 1, idx + 1)]!);
    } catch {
      toast({ tone: 'bad', title: t('errors.generic') });
    } finally {
      setBusy(false);
    }
  };

  const addDoc = async (kind: string, file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_DOC * (file.type.startsWith('image/') ? 4 : 1)) return setErrors({ docs: `${file.name}: max 8 MB` });
    try {
      if (file.type.startsWith('image/')) {
        const p = await preparePhoto(file);
        setDocs((d) => ({ ...d, [kind]: { blob: p.blob, name: file.name, ext: p.blob.type === 'image/webp' ? 'webp' : 'jpg' } }));
      } else if (file.type === 'application/pdf') {
        setDocs((d) => ({ ...d, [kind]: { blob: file, name: file.name, ext: 'pdf' } }));
      } else return setErrors({ docs: t('services.apply_.docsHint') });
      setErrors({});
    } catch {
      toast({ tone: 'bad', title: t('errors.generic') });
    }
  };

  const stepLabel = (s: Step) => t(`services.apply_.${s === 'pay' ? 'pay' : s}` as MessageKey);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/services" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft className="size-4" aria-hidden />{t('services.title')}</Link>
      <h1 className="mt-4 font-display text-[clamp(1.9rem,5.5vw,2.6rem)] font-extrabold leading-[1.05]">{locale === 'sw' && service.name_sw ? service.name_sw : service.name}</h1>
      {service.description && <p className="mt-3 text-ink-2">{service.description}</p>}
      {service.fee_note && <p className="mt-2 text-xs text-muted">{service.fee_note}</p>}

      <ol className={cn('mt-8 grid gap-2')} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label={t('services.apply')}>
        {steps.map((s, i) => (
          <li key={s} aria-current={s === step ? 'step' : undefined}>
            <div className={cn('h-1.5 rounded-full', i <= idx ? 'bg-brand' : 'bg-line')} />
            <p className={cn('mt-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em]', s === step ? 'text-ink' : 'text-muted')}>{i < idx ? <Check className="size-3.5 text-good" aria-hidden /> : <span className="font-data">{i + 1}</span>}{stepLabel(s)}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        {step === 'details' && (
          <div className="space-y-5">
            {service.requires_kra_pin && (
              <>
                <Field label={t('services.apply_.businessName')} error={errors.business_name}>{({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} invalid={Boolean(errors.business_name)} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />}</Field>
                <Field label={t('services.apply_.kraPin')} hint={t('services.apply_.kraPinHint')} error={errors.kra_pin}>{({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} invalid={Boolean(errors.kra_pin)} autoCapitalize="characters" maxLength={11} className="font-data uppercase" value={kraPin} onChange={(e) => setKraPin(e.target.value)} />}</Field>
              </>
            )}
            {service.form_schema.map((f) => <DynamicField key={f.key} field={f} value={values[f.key] ?? ''} error={errors[f.key]} onChange={(v) => setValues((x) => ({ ...x, [f.key]: v }))} />)}
          </div>
        )}

        {step === 'documents' && (
          <div>
            <p className="text-sm text-muted">{t('services.apply_.docsHint')}</p>
            <ul className="mt-4 space-y-3">
              {service.required_documents.map((k) => (
                <li key={k} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{t(`services.docs.${k}` as MessageKey)}</p>
                    {docs[k] && <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-good"><Check className="size-4 shrink-0" aria-hidden />{t('services.apply_.docReady')} · {docs[k]!.name}</p>}
                  </div>
                  <label className="tap inline-flex cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-bg-2">
                    <FileUp className="size-4" aria-hidden />{docs[k] ? t('services.apply_.replaceDoc') : t('services.apply_.uploadDoc')}
                    <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => void addDoc(k, e.target.files?.[0])} />
                  </label>
                </li>
              ))}
            </ul>
            {errors.docs && <p role="alert" className="mt-3 text-sm font-medium text-bad">{errors.docs}</p>}
          </div>
        )}

        {step === 'review' && (
          <div>
            <h2 className="font-display text-2xl font-bold">{t('services.apply_.reviewTitle')}</h2>
            <dl className="mt-4 divide-y divide-line overflow-hidden rounded-[1.5rem] border border-line bg-surface">
              {service.requires_kra_pin && <div className="flex justify-between gap-4 p-4"><dt className="text-muted">{t('services.apply_.kraPin')}</dt><dd className="font-data font-medium">{kraPin.toUpperCase()}</dd></div>}
              {service.form_schema.map((f) => {
                const raw = values[f.key] ?? '';
                const shown = f.type === 'select' ? pick(f.options?.find((o) => o.value === raw)?.label) || raw : f.type === 'ward' ? (wardById.get(raw)?.name ?? raw) : raw;
                return <div key={f.key} className="flex justify-between gap-4 p-4"><dt className="text-muted">{pick(f.label)}</dt><dd className="max-w-[60%] text-right font-semibold">{shown || '–'}</dd></div>;
              })}
              <div className="flex justify-between gap-4 bg-brand-soft p-4"><dt className="font-semibold">{t('services.apply_.fee')}</dt><dd className="font-data text-lg font-medium">{service.fee > 0 ? kes(service.fee) : t('services.free')}</dd></div>
            </dl>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted"><ShieldCheck className="size-4" aria-hidden />{t('services.apply_.draftNote')}</p>
          </div>
        )}

        {step === 'pay' && draft && <PayWithMpesa app={draft} onPaid={() => { void qc.invalidateQueries({ queryKey: ['applications'] }); setTimeout(() => nav(`/services/applications/${draft.id}`), 1800); }} />}
      </div>

      {step !== 'pay' && (
        <div className="glass sticky bottom-20 z-20 mt-8 flex items-center justify-between gap-3 rounded-full border border-line p-2 shadow-float lg:bottom-4">
          <Button variant="ghost" onClick={() => void go(-1)} className={cn(idx === 0 && 'invisible')} icon={<ArrowLeft className="size-4" aria-hidden />}>{t('common.back')}</Button>
          <Button size="lg" loading={busy} onClick={() => void go(1)} iconRight={<ArrowRight className="size-4" aria-hidden />} className="min-w-44">
            {step === 'review' ? (service.fee > 0 ? t('services.apply_.payAndSubmit') : t('services.apply_.submitFree')) : t('common.next')}
          </Button>
        </div>
      )}
    </div>
  );
}
