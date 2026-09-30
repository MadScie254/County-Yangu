// The demo-mode twin of public.procurement_watch() (migration 0012). Live counties get this analysis from the database;
// this runs on sample data so the Open County page works before any real awards exist. Keep the two in step:
// same rules, same thresholds, same wording. tests/unit/procurement.test.ts pins the behaviour.
import type { FlagSeverity, ProcurementContractor, ProcurementFlag, ProcurementSummary, ProcurementWatch, PublicProject, PublicTender } from '@/shared/api/types';

const money = (n: number) => Math.round(n).toLocaleString('en-US');
const pct1 = (n: number) => Math.round(n * 10) / 10;
const DAY = 86_400_000;

type Award = { t: PublicTender; cid: string; cname: string; amount: number; method: string; bids: number; at: number; days: number | null };

export function computeProcurementWatch(tenders: PublicTender[], projects: PublicProject[], now = new Date()): ProcurementWatch {
  const awards: Award[] = tenders
    .filter((t) => t.status === 'awarded' && t.awarded_to)
    .map((t) => ({
      t,
      cid: t.contractor_id ?? t.awarded_to!,
      cname: t.awarded_to!,
      amount: t.award_amount ?? t.estimated_budget,
      method: t.procurement_method ?? 'open_tender',
      bids: t.applicants_count,
      at: Date.parse(t.awarded_at ?? t.published_at ?? '') || 0,
      days: t.published_at && t.closes_at ? (Date.parse(t.closes_at) - Date.parse(t.published_at)) / DAY : null,
    }));

  const n = awards.length;
  const total = awards.reduce((a, x) => a + x.amount, 0);
  const noncomp = awards.filter((a) => a.method === 'direct' || a.method === 'restricted');
  const ncValue = noncomp.reduce((a, x) => a + x.amount, 0);
  const single = awards.filter((a) => a.bids <= 1).length;
  const short = awards.filter((a) => a.days !== null && a.days < 7).length;

  const by = new Map<string, ProcurementContractor & { _at: number }>();
  for (const a of awards) {
    const c = by.get(a.cid) ?? { id: a.cid, name: a.cname, wins: 0, value: 0, share_value: 0, share_count: 0, non_open: 0, single_bid: 0, last_award: null, _at: 0 };
    c.wins += 1;
    c.value += a.amount;
    if (a.method === 'direct' || a.method === 'restricted') c.non_open += 1;
    if (a.bids <= 1) c.single_bid += 1;
    c._at = Math.max(c._at, a.at);
    by.set(a.cid, c);
  }
  const ranked = [...by.values()]
    .map((c) => ({ ...c, share_value: total > 0 ? pct1((100 * c.value) / total) : 0, share_count: n > 0 ? pct1((100 * c.wins) / n) : 0, last_award: c._at ? new Date(c._at).toISOString() : null }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const rawShares = ranked.map((c) => (total > 0 ? (100 * c.value) / total : 0));
  const hhi = rawShares.reduce((a, s) => a + s * s, 0);
  const sum = (k: number) => pct1(rawShares.slice(0, k).reduce((a, s) => a + s, 0));
  const top3 = sum(3);
  const bidAvg = n ? awards.reduce((a, x) => a + x.bids, 0) / n : null;
  const dayVals = awards.map((a) => a.days).filter((d): d is number => d !== null);

  const summary: ProcurementSummary = {
    awarded_count: n,
    awarded_value: total,
    suppliers: ranked.length,
    hhi: Math.round(hhi),
    hhi_band: hhi >= 2500 ? 'high' : hhi >= 1500 ? 'moderate' : 'low',
    top1_share: sum(1),
    top3_share: top3,
    top5_share: sum(5),
    non_competitive_share: total > 0 ? pct1((100 * ncValue) / total) : 0,
    single_bid_share: n > 0 ? pct1((100 * single) / n) : 0,
    avg_bids: bidAvg === null ? null : pct1(bidAvg),
    avg_tender_days: dayVals.length ? pct1(dayVals.reduce((a, d) => a + d, 0) / dayVals.length) : null,
  };

  const flags: ProcurementFlag[] = [];
  const add = (code: string, severity: FlagSeverity, kind: ProcurementFlag['subject_kind'], key: string, label: string, title: string, detail: string, metrics: ProcurementFlag['metrics']) =>
    flags.push({ code, severity, subject_kind: kind, subject_key: key, subject_label: label, title, detail, metrics, status: 'open', response: null, first_seen: null });

  for (const c of ranked) {
    if (c.share_value >= 25 && c.wins >= 2) {
      add('dominant_supplier', c.share_value >= 40 ? 'high' : 'watch', 'contractor', c.id, c.name, `${c.name} holds ${c.share_value}% of awarded value`,
        `${c.wins} of ${n} awards, worth KES ${money(c.value)} of the KES ${money(total)} awarded in total. One supplier holding more than a quarter of awarded value is a common reason to look at how work is being shared.`,
        { wins: c.wins, value: c.value, share_value: c.share_value });
    }
    if (c.wins >= 4 && c.share_count >= 20) {
      add('repeat_winner', 'watch', 'contractor', c.id, c.name, `${c.name} won ${c.wins} awards, ${c.share_count}% of all`,
        'Winning four or more awards and a fifth of all awards can be entirely legitimate, and is also what repeated favouritism looks like. Worth checking that the tenders were genuinely competitive.',
        { wins: c.wins, share_count: c.share_count });
    }
  }
  if (ranked.length >= 4 && top3 >= 60) {
    add('top3_concentration', top3 >= 75 ? 'high' : 'watch', 'county', 'county', 'County procurement', `Three suppliers hold ${top3}% of awarded value`,
      `Across ${ranked.length} suppliers and KES ${money(total)} awarded, the top three received ${top3}%. A market this concentrated leaves little competitive pressure on price and quality.`,
      { top3_share: top3, suppliers: ranked.length });
  }
  if (total > 0 && n >= 4 && ncValue * 10 >= total * 3) {
    add('non_competitive_share', ncValue * 2 >= total ? 'high' : 'watch', 'county', 'county', 'County procurement', `${summary.non_competitive_share}% of awarded value skipped open tendering`,
      `KES ${money(ncValue)} was awarded by direct or restricted procurement. These methods have legitimate uses, such as emergencies, and should stay a small share.`,
      { non_competitive_value: ncValue, share: summary.non_competitive_share });
  }
  for (const c of ranked) {
    if (c.wins >= 2 && c.non_open * 10 >= c.wins * 6) {
      add('contractor_direct_reliance', 'watch', 'contractor', c.id, c.name, `${c.name}: ${c.non_open} of ${c.wins} awards were not openly tendered`,
        "Most of this supplier's awards came through direct or restricted procurement rather than open competition.", { wins: c.wins, non_open: c.non_open });
    }
  }
  if (n >= 4 && single * 4 >= n) {
    add('single_bidder_share', 'watch', 'county', 'county', 'County procurement', `${summary.single_bid_share}% of awarded tenders had one bidder or none`,
      'Tenders with a single bidder cannot show that the price was tested. Few bids is one of the most widely used procurement warning signs.', { single_bid: single, awarded: n });
  }
  for (const c of ranked) {
    if (c.single_bid >= 2) {
      add('contractor_single_bid', 'watch', 'contractor', c.id, c.name, `${c.name} won ${c.single_bid} tenders with a single bidder`,
        'Winning several tenders where nobody else bid deserves a look at how the tender was advertised and who could realistically apply.', { single_bid: c.single_bid });
    }
  }
  if (short >= 3 && short * 5 >= n) {
    add('short_tender_period', 'watch', 'county', 'county', 'County procurement', `${short} awarded tenders were open for under a week`,
      'Very short tendering periods limit who can respond in time and are a standard procurement warning sign.', { short_tenders: short });
  }
  for (const a of awards) {
    if (a.t.estimated_budget > 0 && a.amount > a.t.estimated_budget * 1.15) {
      add('award_above_estimate', a.amount >= a.t.estimated_budget * 1.3 ? 'high' : 'watch', 'tender', a.t.id, `${a.t.reference} ${a.t.title}`,
        `${a.t.reference} was awarded at ${Math.round((100 * a.amount) / a.t.estimated_budget)}% of its estimate`,
        `Estimate KES ${money(a.t.estimated_budget)}, award KES ${money(a.amount)} to ${a.cname}. A large gap between estimate and award can mean a poor estimate or a price that was not tested.`,
        { estimate: a.t.estimated_budget, award: a.amount });
    }
  }
  // several awards to one supplier for the same kind of work in the same place within 30 days
  const groups = new Map<string, Award[]>();
  for (const a of awards) groups.set(`${a.cid}:${a.t.ward_id ?? '-'}:${a.t.sector}`, [...(groups.get(`${a.cid}:${a.t.ward_id ?? '-'}:${a.t.sector}`) ?? []), a]);
  for (const [key, list] of groups) {
    const best = Math.max(...list.map((a) => list.filter((b) => b.at >= a.at && b.at < a.at + 30 * DAY).length));
    if (best >= 3) {
      const first = list[0]!;
      add('split_awards', 'watch', 'contractor', key, first.cname, `${first.cname} received ${best} ${first.t.sector} awards within 30 days${first.t.ward_name ? ` in ${first.t.ward_name}` : ''}`,
        'Several awards to one supplier for the same kind of work in the same place in a short time can indicate a larger job split up to stay under a tendering threshold.', { awards: best });
    }
  }
  for (const p of projects) {
    if (p.budget <= 0) continue;
    if (p.spent > p.budget * 1.1) {
      add('project_overrun', p.spent > p.budget * 1.25 ? 'high' : 'watch', 'project', p.id, p.title, `${p.title} has spent ${Math.round((100 * p.spent) / p.budget)}% of its budget`,
        `Budget KES ${money(p.budget)}, spent KES ${money(p.spent)}. Spending above budget should come with an approved variation and a public explanation.`, { budget: p.budget, spent: p.spent });
    }
    if (p.status === 'stalled' && p.spent >= p.budget * 0.5) {
      add('stalled_after_spend', 'watch', 'project', p.id, p.title, `${p.title} is stalled after ${Math.round((100 * p.spent) / p.budget)}% of its budget was spent`,
        'Money has left but the work has stopped. Residents should be told why and when it will resume.', { budget: p.budget, spent: p.spent });
    }
    if ((p.status === 'procurement' || p.status === 'in_progress') && p.expected_at) {
      const late = Math.floor((now.getTime() - Date.parse(p.expected_at)) / DAY);
      if (late > 60) add('project_late', 'info', 'project', p.id, p.title, `${p.title} is ${late} days past its expected date`, 'The project has not reached completion by the date the county published.', { expected_at: p.expected_at });
    }
  }

  const rank = { high: 0, watch: 1, info: 2 } as const;
  flags.sort((a, b) => rank[a.severity] - rank[b.severity] || a.title.localeCompare(b.title));

  const methods = new Map<string, { method: string; awards: number; value: number }>();
  for (const a of awards) {
    const m = methods.get(a.method) ?? { method: a.method, awards: 0, value: 0 };
    m.awards += 1;
    m.value += a.amount;
    methods.set(a.method, m);
  }

  return {
    generated_at: now.toISOString(),
    summary,
    contractors: ranked.slice(0, 15).map(({ _at, ...c }) => (void _at, c)),
    methods: [...methods.values()].sort((a, b) => b.value - a.value) as ProcurementWatch['methods'],
    flags,
  };
}
