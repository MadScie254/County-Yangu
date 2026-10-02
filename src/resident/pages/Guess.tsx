import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Coins, RotateCcw, X } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useIsDemo, useProjects, useTenders } from '@/shared/api/hooks';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Card';
import { ShareCardButton } from '@/shared/ui/ShareCardButton';

type Item = { key: string; title: string; ward: string | null; sector: string; amount: number; link: string; kind: 'project' | 'tender' };
const ROUNDS = 5;
const BEST = 'cy-guess-best';

/** Round to two significant figures so the choices look like real budget lines. */
export const niceAmount = (n: number) => { if (n <= 0) return 0; const p = 10 ** (Math.floor(Math.log10(n)) - 1); return Math.round(n / p) * p; };

/** Four choices: the real amount and three decoys well away from it, shuffled with a seed so a round is stable. */
export function choicesFor(amount: number, seed: number): number[] {
  const factors = [0.2, 0.4, 2.5, 5, 0.6, 1.8];
  const rnd = (i: number) => { const x = Math.sin(seed * 9301 + i * 49297) * 233280; return x - Math.floor(x); };
  const picked: number[] = [];
  for (let i = 0; picked.length < 3 && i < 40; i++) {
    const f = factors[Math.floor(rnd(i) * factors.length)]!;
    const v = niceAmount(amount * f);
    if (v > 0 && v !== niceAmount(amount) && !picked.includes(v)) picked.push(v);
  }
  const all = [niceAmount(amount), ...picked];
  return all.map((v, i) => ({ v, k: rnd(100 + i) })).sort((a, b) => a.k - b.k).map((x) => x.v);
}

/** A quiz on real county spending: guess what a project or contract cost, then see the real figure and its source. */
export default function Guess() {
  const { t, kes } = useI18n();
  const projects = useProjects();
  const tenders = useTenders();
  const demo = useIsDemo();
  usePageTitle(t('guess.title'));
  const [seed, setSeed] = useState(() => Math.floor(Date.now() / 1000));
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem(BEST) ?? 0); } catch { return 0; } });

  const pool = useMemo<Item[]>(() => [
    ...(projects.data ?? []).filter((p) => p.budget > 0).map((p) => ({ key: `p${p.id}`, title: p.title, ward: p.ward_name, sector: p.sector, amount: p.budget, link: `/projects/${p.slug}`, kind: 'project' as const })),
    ...(tenders.data ?? []).filter((x) => (x.award_amount ?? 0) > 0).map((x) => ({ key: `t${x.id}`, title: x.title, ward: x.ward_name, sector: x.sector, amount: x.award_amount!, link: '/tenders', kind: 'tender' as const })),
  ], [projects.data, tenders.data]);
  const deck = useMemo(() => {
    const r = (i: number) => { const x = Math.sin(seed * 7 + i * 131) * 10000; return x - Math.floor(x); };
    return pool.map((p, i) => ({ p, k: r(i) })).sort((a, b) => a.k - b.k).slice(0, ROUNDS).map((x) => x.p);
  }, [pool, seed]);
  const item = deck[round] ?? null;
  const choices = useMemo(() => (item ? choicesFor(item.amount, seed + round) : []), [item, seed, round]);
  const done = deck.length > 0 && round >= deck.length;

  const pick = (v: number) => {
    if (picked !== null || !item) return;
    setPicked(v);
    if (v === niceAmount(item.amount)) setScore((s) => s + 1);
  };
  const next = () => {
    const last = round + 1 >= deck.length;
    if (last) { const final = score; if (final > best) { setBest(final); try { localStorage.setItem(BEST, String(final)); } catch { /* private mode */ } } }
    setRound((r) => r + 1); setPicked(null);
  };
  const again = () => { setSeed((s) => s + 1); setRound(0); setScore(0); setPicked(null); };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('guess.title')}</h1>
      <p className="mt-3 text-[1.05rem] text-ink-2">{t('guess.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}

      {projects.isLoading || tenders.isLoading ? <Skeleton className="mt-8 h-72" /> : deck.length === 0 ? <p className="mt-8 rounded-2xl bg-bg-2 p-5 text-sm">{t('guess.none')}</p> : done ? (
        <section className="mt-8 rounded-[1.75rem] bg-brand-soft p-6 text-center" aria-live="polite">
          <Coins className="mx-auto size-10" aria-hidden />
          <p className="mt-3 font-display text-4xl font-extrabold">{score} / {deck.length}</p>
          <p className="mt-1 text-sm">{t(score === deck.length ? 'guess.perfect' : score >= deck.length / 2 ? 'guess.good' : 'guess.learn')}</p>
          <p className="mt-1 text-xs text-muted">{t('guess.best', { best: Math.max(best, score) })}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button icon={<RotateCcw className="size-4" aria-hidden />} onClick={again}>{t('guess.again')}</Button>
            <ShareCardButton path="/guess" text={t('guess.shareText', { score, of: deck.length })}
              card={{ kicker: t('guess.title'), title: t('guess.cardTitle'), stat: `${score}/${deck.length}`, statLabel: t('guess.cardLabel'), tone: 'brand' }} />
          </div>
        </section>
      ) : item && (
        <section className="mt-8 rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6" aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{t('guess.round', { n: round + 1, of: deck.length })} · {t('guess.score', { score })}</p>
          <h2 className="mt-2 font-display text-xl font-bold leading-snug">{item.title}</h2>
          <p className="text-sm text-muted">{[item.ward, item.sector, t(item.kind === 'project' ? 'guess.budget' : 'guess.contract')].filter(Boolean).join(' · ')}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {choices.map((v) => {
              const right = v === niceAmount(item.amount);
              return (
                <button key={v} type="button" onClick={() => pick(v)} disabled={picked !== null}
                  className={cn('flex h-14 items-center justify-between rounded-2xl border px-4 text-left font-data font-semibold transition',
                    picked === null ? 'border-line hover:bg-bg-2' : right ? 'border-good bg-good-soft' : picked === v ? 'border-bad bg-bad-soft' : 'border-line opacity-60')}>
                  {kes(v, { compact: true })}
                  {picked !== null && right && <Check className="size-5 text-good" aria-hidden />}
                  {picked === v && !right && <X className="size-5 text-bad" aria-hidden />}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">{t('guess.real', { amount: kes(item.amount) })} <Link to={item.link} className="font-semibold underline">{t('guess.see')}</Link></p>
              <Button onClick={next}>{round + 1 >= deck.length ? t('guess.finish') : t('guess.next')}</Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
