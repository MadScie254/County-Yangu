import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BellRing, Check } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wardById, wardsBySubCounty } from '@/shared/config/county';
import { subscribeAlerts } from '@/shared/api/submit';
import { usePrefs } from '@/shared/state/prefs';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Field, Segmented, SelectInput } from '@/shared/ui/Field';
import { PhoneVerify } from '../components/PhoneVerify';

type Freq = 'instant' | 'daily' | 'weekly';

export default function Alerts() {
  const { t } = useI18n();
  usePageTitle(t('alerts.title'));
  const [params] = useSearchParams();
  const savedWard = usePrefs((s) => s.wardId);
  const initial = params.get('ward') ?? savedWard ?? '';
  const [ward, setWard] = useState(wardById.has(initial) ? initial : '');
  const [freq, setFreq] = useState<Freq>('weekly');
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const groups = wardsBySubCounty();

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-good-soft text-good"><Check className="size-10" aria-hidden strokeWidth={2.5} /></div>
        <h1 className="mt-6 font-display text-4xl font-extrabold">{t('alerts.doneTitle')}</h1>
        <p className="mt-3 text-ink-2">{t('alerts.doneBody', { ward: wardById.get(ward)?.name ?? '' })}</p>
        <Button variant="secondary" className="mt-8" onClick={() => { setDone(false); setWard(''); }}>{t('alerts.another')}</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="flex items-center gap-3 font-display text-[clamp(2rem,6vw,3rem)] font-extrabold"><BellRing className="size-9 text-brand-strong" aria-hidden />{t('alerts.title')}</h1>
      <p className="mt-3 text-[1.05rem] text-ink-2">{t('alerts.intro')}</p>

      <Field className="mt-8" label={t('alerts.ward')}>
        {({ id }) => (
          <SelectInput id={id} value={ward} onChange={(e) => setWard(e.target.value)}>
            <option value="">{t('report.wardPick')}</option>
            {groups.map((g) => <optgroup key={g.subCounty.id} label={g.subCounty.name}>{g.wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</optgroup>)}
          </SelectInput>
        )}
      </Field>

      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold">{t('alerts.frequency')}</p>
        <Segmented<Freq> label={t('alerts.frequency')} value={freq} onChange={setFreq} options={[{ value: 'weekly', label: t('alerts.weekly') }, { value: 'daily', label: t('alerts.daily') }, { value: 'instant', label: t('alerts.instant') }]} />
        {freq === 'weekly' && <p className="mt-2 text-xs text-muted">{t('alerts.weeklyHint')}</p>}
      </div>

      {ward && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-xl font-bold">{t('alerts.verify')}</h2>
          <PhoneVerify
            purpose="alerts"
            onVerified={async (token) => {
              setError(false);
              try {
                await subscribeAlerts({ token, ward_id: ward, frequency: freq });
                setDone(true);
              } catch {
                setError(true);
              }
            }}
          />
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-bad">{t('alerts.failed')}</p>}
        </div>
      )}
      <p className="mt-8 text-sm text-muted">{t('alerts.pushNote')}</p>
    </div>
  );
}
