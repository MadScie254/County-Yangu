import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, CalendarDays, MessagesSquare, SearchCheck, Siren, Wrench } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useConsultations, useFixedGallery, useMeetings, useNotices, usePolls } from '@/shared/api/hooks';
import { consultationOpen } from '@/shared/api/rights';
import { Button } from '@/shared/ui/Button';
import { TextInput } from '@/shared/ui/Field';
import { BeforeAfter } from './BeforeAfter';

/** What is happening in the county today, so the home page answers "what can I do right now" without a menu. */
export function RightNow() {
  const { t, locale, date } = useI18n();
  const nav = useNavigate();
  const [ref, setRef] = useState('');
  const [now] = useState(() => Date.now());
  const notices = (useNotices().data ?? []).filter((n) => n.status === 'active' && n.severity !== 'info');
  const polls = (usePolls().data ?? []).filter((p) => Date.parse(p.opens_at) <= now && Date.parse(p.closes_at) > now);
  const consultations = (useConsultations().data ?? []).filter((c) => consultationOpen(c, now));
  const meeting = (useMeetings().data ?? []).filter((m) => m.status === 'scheduled' && Date.parse(m.starts_at) > now).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
  const fixed = (useFixedGallery(3).data ?? []).slice(0, 3);
  const sw = locale === 'sw';
  const poll = polls[0];
  const cons = consultations[0];

  const tiles = [
    notices.length > 0 && { to: '/notices', icon: Siren, label: t('home.now.notices', { count: notices.length }), text: sw && notices[0]!.title_sw ? notices[0]!.title_sw : notices[0]!.title },
    poll && { to: `/polls#${poll.slug}`, icon: BarChart3, label: t('home.now.poll'), text: sw && poll.question_sw ? poll.question_sw : poll.question },
    cons && { to: `/have-your-say/${cons.slug}`, icon: MessagesSquare, label: t('home.now.consultation', { date: date(cons.closes_at) }), text: sw && cons.title_sw ? cons.title_sw : cons.title },
    meeting && { to: '/meetings', icon: CalendarDays, label: t('home.now.meeting', { date: date(meeting.starts_at, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }), text: sw && meeting.title_sw ? meeting.title_sw : meeting.title },
  ].filter(Boolean) as { to: string; icon: typeof Siren; label: string; text: string }[];

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="now-title">
      <h2 id="now-title" className="font-display text-[clamp(1.6rem,4vw,2.2rem)] font-extrabold leading-tight">{t('home.now.title')}</h2>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <form className="rounded-[1.5rem] bg-panel p-5 text-panel-ink sm:p-6" onSubmit={(e) => { e.preventDefault(); const r = ref.trim().toUpperCase(); if (r) nav(`/case/${encodeURIComponent(r)}`); }}>
          <SearchCheck className="size-6" aria-hidden />
          <label htmlFor="track-ref" className="mt-3 block font-display text-xl font-bold">{t('home.now.track')}</label>
          <p className="mt-1 text-sm opacity-80">{t('home.now.trackHint')}</p>
          <div className="mt-4 flex gap-2">
            <TextInput id="track-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="NAI-..." autoComplete="off" className="font-data placeholder:normal-case" />
            <Button type="submit" disabled={!ref.trim()}>{t('home.now.go')}</Button>
          </div>
        </form>
        {tiles.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {tiles.map((x) => (
              <li key={x.to}>
                <Link to={x.to} className="group flex h-full flex-col rounded-[1.5rem] border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-float">
                  <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-muted"><x.icon className="size-4 text-brand-strong" aria-hidden />{x.label}</span>
                  <span className="mt-2 flex-1 font-semibold leading-snug">{x.text}</span>
                  <ArrowRight className="mt-3 size-4 transition group-hover:translate-x-1" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="rounded-[1.5rem] border border-dashed border-line-strong p-6 text-sm text-muted">{t('home.now.quiet')}</p>}
      </div>

      {fixed.length > 0 && (
        <div className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h3 className="inline-flex items-center gap-2 font-display text-xl font-bold"><Wrench className="size-5" aria-hidden />{t('home.now.fixed')}</h3>
            <Link to="/fixed" className="inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4">{t('common.viewAll')}<ArrowRight className="size-4" aria-hidden /></Link>
          </div>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {fixed.map((f) => (
              <li key={f.reference}>
                <Link to={`/case/${f.reference}`} className="block rounded-[1.5rem] border border-line bg-surface p-3 shadow-card transition hover:shadow-float">
                  <BeforeAfter before={f.before} after={f.after} compact />
                  <p className="mt-2 px-1 text-sm font-semibold">{sw && f.category_sw ? f.category_sw : f.category} · {f.ward}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
