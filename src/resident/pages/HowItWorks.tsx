import { Globe, MessageSquare, PhoneCall, Smartphone, Check, X, Scale, Accessibility, ArrowDown } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { county } from '@/shared/config/county';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';

export default function HowItWorks() {
  const { t, list } = useI18n();
  usePageTitle(t('how.title'));
  const channels = [
    { icon: Globe, title: t('how.web'), body: t('how.webBody') },
    { icon: Smartphone, title: t('how.ussd'), body: t('how.ussdBody', { code: county.ussdCode }) },
    { icon: MessageSquare, title: t('how.sms'), body: t('how.smsBody', { code: county.smsShortcode }) },
    { icon: PhoneCall, title: t('how.voice'), body: t('how.voiceBody') },
  ];
  const ladder: { label: string; sub: string; tone: string }[] = [
    { label: t('how.ladder.d0'), sub: t('how.ladder.d0s'), tone: 'bg-good' },
    { label: t('how.ladder.d2'), sub: t('how.ladder.d2s'), tone: 'bg-good' },
    { label: t('how.ladder.d5'), sub: t('how.ladder.d5s'), tone: 'bg-brand' },
    { label: t('how.ladder.target'), sub: t('how.ladder.targets'), tone: 'bg-brand' },
    { label: t('how.ladder.late30'), sub: t('how.ladder.late30s'), tone: 'bg-bad' },
    { label: t('how.ladder.monthly'), sub: t('how.ladder.monthlys'), tone: 'bg-bad' },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="max-w-2xl">
        <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold">{t('how.title')}</h1>
        <p className="mt-3 text-[1.05rem] text-ink-2">{t('how.intro')}</p>
      </header>

      <section className="mt-10" aria-labelledby="ch">
        <h2 id="ch" className="font-display text-2xl font-bold">{t('how.channelsTitle')}</h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {channels.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-[1.5rem] border border-line bg-surface p-5 shadow-card">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft"><Icon className="size-5" aria-hidden /></span>
              <h3 className="mt-4 font-display text-xl font-bold">{title}</h3>
              <p className="mt-1.5 text-ink-2">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16" aria-labelledby="ladder">
        <h2 id="ladder" className="font-display text-2xl font-bold">{t('how.ladderTitle')}</h2>
        <p className="mt-2 max-w-2xl text-ink-2">{t('how.ladderIntro')}</p>
        <ol className="mt-6 space-y-2">
          {ladder.map((l, i) => (
            <li key={i}>
              <div className="flex items-stretch gap-4 rounded-[1.25rem] border border-line bg-surface p-4">
                <span className={cn('grid w-10 shrink-0 place-items-center rounded-xl font-display text-lg font-extrabold text-white', l.tone === 'bg-brand' ? 'bg-brand !text-brand-ink' : l.tone)}>{i + 1}</span>
                <div>
                  <p className="font-semibold leading-snug">{l.label}</p>
                  <p className="text-sm text-muted">{l.sub}</p>
                </div>
              </div>
              {i < ladder.length - 1 && <ArrowDown className="mx-auto my-0.5 size-4 text-muted" aria-hidden />}
            </li>
          ))}
        </ol>
        <p className="mt-5 rounded-2xl bg-info-soft p-4 text-sm font-medium text-info">{t('how.ladderNote')}</p>
      </section>

      <section id="privacy" className="mt-16 scroll-mt-24" aria-labelledby="pv">
        <h2 id="pv" className="font-display text-2xl font-bold">{t('how.privacyTitle')}</h2>
        <p className="mt-2 max-w-2xl text-ink-2">{t('how.privacyIntro')}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.5rem] bg-good-soft p-6">
            <h3 className="font-display text-lg font-bold text-good">{t('how.weKeep')}</h3>
            <ul className="mt-3 space-y-2 text-sm">{list('how.weKeepList').map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />{x}</li>)}</ul>
          </div>
          <div className="rounded-[1.5rem] bg-bad-soft p-6">
            <h3 className="font-display text-lg font-bold text-bad">{t('how.weNever')}</h3>
            <ul className="mt-3 space-y-2 text-sm">{list('how.weNeverList').map((x) => <li key={x} className="flex gap-2"><X className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />{x}</li>)}</ul>
          </div>
        </div>
        <div className="mt-4 flex gap-4 rounded-[1.5rem] border border-line bg-surface p-6">
          <Scale className="mt-1 size-6 shrink-0 text-ink-2" aria-hidden />
          <div>
            <h3 className="font-display text-lg font-bold">{t('how.rights')}</h3>
            <p className="mt-1 text-ink-2">{t('how.rightsBody', { code: county.ussdCode })}</p>
          </div>
        </div>
      </section>

      <section className="mt-12 flex gap-4 rounded-[1.5rem] bg-brand-soft p-6">
        <Accessibility className="mt-1 size-6 shrink-0" aria-hidden />
        <div>
          <h2 className="font-display text-lg font-bold">{t('how.accessTitle')}</h2>
          <p className="mt-1 text-ink-2">{t('how.accessBody')}</p>
        </div>
      </section>
    </div>
  );
}
