// The USSD menu (*xxx#): report a problem, check a report, vote in the budget round, subscribe to ward alerts.
//
// Africa's Talking calls us on every keypress and sends the WHOLE path so far ("1*3*2"), so this is a pure function of
// that path: no session storage. `0` goes back, `9` shows more, and choosing 5 on the first screen switches between English
// and Kiswahili. All the database work is behind `UssdDeps`, so the whole menu can be tested without a network.
//
// USSD screens hold about 182 characters, which is why lists are five long and names are clipped.

export type Lang = 'en' | 'sw';

export type UssdDeps = {
  county: string;
  categories(): Promise<{ id: string; name: string; name_sw: string | null }[]>;
  subCounties(): Promise<{ id: string; name: string }[]>;
  wards(subCountyId: string): Promise<{ id: string; name: string }[]>;
  wardName(id: string): Promise<string | null>;
  categoryName(id: string, lang: Lang): Promise<string | null>;
  openCycle(): Promise<{ id: string; title: string } | null>;
  options(cycleId: string, wardId: string): Promise<{ id: string; title: string; amount: number }[]>;
  caseStatus(reference: string): Promise<{ status: string; category: string | null; ward: string; updated_at: string } | null>;
  createReport(r: { category_id: string; ward_id: string; description: string; smsMe: boolean; lang: Lang }): Promise<{ reference: string }>;
  vote(v: { cycle_id: string; ward_id: string; option_id: string }): Promise<'ok' | 'duplicate' | 'closed' | 'invalid_option'>;
  subscribe(s: { ward_id: string; frequency: 'instant' | 'weekly' }): Promise<void>;
};

type Then = 'report' | 'vote' | 'alerts';
type Frame =
  | { s: 'root' }
  | { s: 'cat'; page: number }
  | { s: 'sub'; then: Then; page: number; cat?: string }
  | { s: 'ward'; then: Then; sub: string; page: number; cat?: string }
  | { s: 'desc'; cat: string; ward: string }
  | { s: 'confirm'; cat: string; ward: string; desc: string }
  | { s: 'ref' }
  | { s: 'opt'; cycle: string; ward: string; page: number }
  | { s: 'confirm-vote'; cycle: string; ward: string; option: string; title: string }
  | { s: 'freq'; ward: string };

const PAGE = 5;
const SCREEN_LIMIT = 182;

const T = {
  en: {
    menu: (c: string) => `${c}\n1. Report a problem\n2. Check a report\n3. Budget vote\n4. Ward alerts\n5. Kiswahili`,
    cat: 'What is the problem?', sub: 'Your sub-county:', ward: 'Your ward:', more: '9. More', back: '0. Back',
    desc: 'Describe it in a few words (up to 120 letters):', tooShort: 'Please write a little more.',
    confirm: (cat: string, ward: string, d: string) => `${cat} in ${ward}: "${d}"\n1. Send\n2. Send + SMS me the number\n0. Cancel`,
    ref: 'Type your report number (like NAI-R1A2B3C4D5):', notFound: 'We could not find that number. Check it and try again.',
    invalid: 'That choice is not on the list.',
    thanks: (ref: string, sms: boolean) => `Thank you. Your report number is ${ref}. Use menu 2 to check progress.${sms ? ' We sent it by SMS.' : ''}`,
    status: (ref: string, st: string, cat: string | null, ward: string, when: string) => `${ref}: ${st}. ${cat ? cat + ' in ' : ''}${ward}. Updated ${when}.`,
    noCycle: 'No budget vote is open right now.', voteFor: (w: string) => `Vote for a project in ${w}:`, noOptions: 'There are no projects to vote on in this ward yet.',
    confirmVote: (t: string) => `Vote for "${t}"?\n1. Yes, vote\n0. Back`,
    voted: 'Thank you. Your vote is counted.', already: 'You have already voted in this round.', closed: 'Voting has closed.',
    freq: 'How often?\n1. As it happens\n2. Weekly summary\n0. Back',
    subscribed: (w: string) => `Done. You will get SMS alerts for ${w}. Reply STOP to any message to stop.`,
    error: 'Sorry, something went wrong. Please try again later.',
    statuses: { received: 'Received', triaged: 'Being reviewed', assigned: 'Assigned', in_progress: 'Being fixed', resolved: 'Fixed', closed: 'Closed', rejected: 'Not accepted' } as Record<string, string>,
  },
  sw: {
    menu: (c: string) => `${c}\n1. Ripoti tatizo\n2. Angalia ripoti\n3. Kura ya bajeti\n4. Arifa za wadi\n5. English`,
    cat: 'Tatizo ni lipi?', sub: 'Kaunti ndogo yako:', ward: 'Wadi yako:', more: '9. Zaidi', back: '0. Rudi',
    desc: 'Elezea kwa maneno machache (hadi herufi 120):', tooShort: 'Tafadhali andika zaidi kidogo.',
    confirm: (cat: string, ward: string, d: string) => `${cat} ${ward}: "${d}"\n1. Tuma\n2. Tuma + nitumie nambari kwa SMS\n0. Ghairi`,
    ref: 'Andika nambari ya ripoti (mfano NAI-R1A2B3C4D5):', notFound: 'Hatukupata nambari hiyo. Iangalie kisha ujaribu tena.',
    invalid: 'Chaguo hilo halipo kwenye orodha.',
    thanks: (ref: string, sms: boolean) => `Asante. Nambari ya ripoti yako ni ${ref}. Tumia chaguo 2 kuangalia maendeleo.${sms ? ' Tumekutumia kwa SMS.' : ''}`,
    status: (ref: string, st: string, cat: string | null, ward: string, when: string) => `${ref}: ${st}. ${cat ? cat + ', ' : ''}${ward}. Imesasishwa ${when}.`,
    noCycle: 'Hakuna kura ya bajeti wazi kwa sasa.', voteFor: (w: string) => `Piga kura kwa mradi wa ${w}:`, noOptions: 'Hakuna miradi ya kupigia kura katika wadi hii bado.',
    confirmVote: (t: string) => `Piga kura kwa "${t}"?\n1. Ndiyo, piga kura\n0. Rudi`,
    voted: 'Asante. Kura yako imehesabiwa.', already: 'Tayari umepiga kura katika awamu hii.', closed: 'Kura imefungwa.',
    freq: 'Mara ngapi?\n1. Mara tu yanapotokea\n2. Muhtasari wa wiki\n0. Rudi',
    subscribed: (w: string) => `Sawa. Utapata arifa za SMS za ${w}. Jibu STOP kwa ujumbe wowote kuacha.`,
    error: 'Samahani, kuna hitilafu. Tafadhali jaribu tena baadaye.',
    statuses: { received: 'Imepokelewa', triaged: 'Inakaguliwa', assigned: 'Imekabidhiwa', in_progress: 'Inarekebishwa', resolved: 'Imerekebishwa', closed: 'Imefungwa', rejected: 'Haikukubaliwa' } as Record<string, string>,
  },
} as const;

/** GSM-safe text for a screen: printable ASCII only, no USSD control characters, clipped. */
export const clean = (s: string, max: number): string => {
  const t = s.replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7E]/g, '').replace(/[*#]/g, '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '.' : t;
};

const shortKes = (n: number): string => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));

const fit = (s: string): string => {
  if (s.length <= SCREEN_LIMIT) return s;
  const lines = s.split('\n');
  while (lines.join('\n').length > SCREEN_LIMIT && lines.length > 3) lines.splice(lines.length - 3, 1); // drop list items, keep the footer
  return lines.join('\n').slice(0, SCREEN_LIMIT);
};

function list<X>(title: string, items: X[], page: number, label: (x: X) => string, lang: Lang, back = true): { text: string; shown: X[]; page: number } {
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const p = ((page % pages) + pages) % pages;
  const shown = items.slice(p * PAGE, p * PAGE + PAGE);
  const lines = [title, ...shown.map((x, i) => `${i + 1}. ${label(x)}`)];
  if (pages > 1) lines.push(T[lang].more);
  if (back) lines.push(T[lang].back);
  return { text: lines.join('\n'), shown, page: p };
}

type Ctx = { deps: UssdDeps; lang: Lang };
type Step = { push: Frame } | { stay: true; error?: boolean; msg?: string } | { replace: Frame } | { end: string };

const pick = (input: string, n: number): number | null => {
  const i = Number(input);
  return Number.isInteger(i) && i >= 1 && i <= n ? i - 1 : null;
};

async function subScreen(f: Extract<Frame, { s: 'sub' }>, c: Ctx) {
  return list(T[c.lang].sub, await c.deps.subCounties(), f.page, (x) => clean(x.name, 20), c.lang);
}
async function wardScreen(f: Extract<Frame, { s: 'ward' }>, c: Ctx) {
  return list(T[c.lang].ward, await c.deps.wards(f.sub), f.page, (x) => clean(x.name, 20), c.lang);
}
async function optScreen(f: Extract<Frame, { s: 'opt' }>, c: Ctx) {
  const name = (await c.deps.wardName(f.ward)) ?? '';
  return list(T[c.lang].voteFor(clean(name, 20)), await c.deps.options(f.cycle, f.ward), f.page, (x) => `${clean(x.title, 16)} ${shortKes(x.amount)}`, c.lang);
}
async function catScreen(f: Extract<Frame, { s: 'cat' }>, c: Ctx) {
  const cats = await c.deps.categories();
  return list(T[c.lang].cat, cats, f.page, (x) => clean((c.lang === 'sw' ? x.name_sw : null) ?? x.name, 20), c.lang);
}

async function advance(f: Frame, input: string, c: Ctx): Promise<Step> {
  const t = T[c.lang];
  switch (f.s) {
    case 'root': {
      if (input === '1') return { push: { s: 'cat', page: 0 } };
      if (input === '2') return { push: { s: 'ref' } };
      if (input === '3') {
        const cycle = await c.deps.openCycle();
        return cycle ? { push: { s: 'sub', then: 'vote', page: 0 } } : { end: t.noCycle };
      }
      if (input === '4') return { push: { s: 'sub', then: 'alerts', page: 0 } };
      return { stay: true, error: true };
    }
    case 'cat': {
      const v = await catScreen(f, c);
      if (input === '9' && v.text.includes(t.more)) return { replace: { s: 'cat', page: v.page + 1 } };
      const i = pick(input, v.shown.length);
      return i === null ? { stay: true, error: true } : { push: { s: 'sub', then: 'report', page: 0, cat: v.shown[i]!.id } };
    }
    case 'sub': {
      const v = await subScreen(f, c);
      if (input === '9' && v.text.includes(t.more)) return { replace: { ...f, page: v.page + 1 } };
      const i = pick(input, v.shown.length);
      return i === null ? { stay: true, error: true } : { push: { s: 'ward', then: f.then, sub: v.shown[i]!.id, page: 0, cat: f.cat } };
    }
    case 'ward': {
      const v = await wardScreen(f, c);
      if (input === '9' && v.text.includes(t.more)) return { replace: { ...f, page: v.page + 1 } };
      const i = pick(input, v.shown.length);
      if (i === null) return { stay: true, error: true };
      const ward = v.shown[i]!.id;
      if (f.then === 'report') return { push: { s: 'desc', cat: f.cat!, ward } };
      if (f.then === 'alerts') return { push: { s: 'freq', ward } };
      const cycle = await c.deps.openCycle();
      if (!cycle) return { end: t.noCycle };
      if ((await c.deps.options(cycle.id, ward)).length === 0) return { end: t.noOptions };
      return { push: { s: 'opt', cycle: cycle.id, ward, page: 0 } };
    }
    case 'desc': {
      const d = clean(input, 120);
      return d.length < 5 ? { stay: true, error: true, msg: t.tooShort } : { push: { s: 'confirm', cat: f.cat, ward: f.ward, desc: d } };
    }
    case 'confirm': {
      if (input !== '1' && input !== '2') return { stay: true, error: true };
      const r = await c.deps.createReport({ category_id: f.cat, ward_id: f.ward, description: f.desc, smsMe: input === '2', lang: c.lang });
      return { end: t.thanks(r.reference, input === '2') };
    }
    case 'ref': {
      const ref = input.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (ref.length < 6) return { stay: true, error: true };
      const s = await c.deps.caseStatus(ref);
      if (!s) return { end: t.notFound };
      const when = new Date(s.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' });
      return { end: t.status(ref, t.statuses[s.status] ?? s.status, s.category ? clean(s.category, 24) : null, clean(s.ward, 20), when) };
    }
    case 'opt': {
      const v = await optScreen(f, c);
      if (v.shown.length === 0) return { end: t.noOptions };
      if (input === '9' && v.text.includes(t.more)) return { replace: { ...f, page: v.page + 1 } };
      const i = pick(input, v.shown.length);
      return i === null ? { stay: true, error: true } : { push: { s: 'confirm-vote', cycle: f.cycle, ward: f.ward, option: v.shown[i]!.id, title: v.shown[i]!.title } };
    }
    case 'confirm-vote': {
      if (input !== '1') return { stay: true, error: true };
      const r = await c.deps.vote({ cycle_id: f.cycle, ward_id: f.ward, option_id: f.option });
      return { end: r === 'ok' ? t.voted : r === 'duplicate' ? t.already : r === 'closed' ? t.closed : t.error };
    }
    case 'freq': {
      if (input !== '1' && input !== '2') return { stay: true, error: true };
      await c.deps.subscribe({ ward_id: f.ward, frequency: input === '1' ? 'instant' : 'weekly' });
      return { end: t.subscribed(clean((await c.deps.wardName(f.ward)) ?? '', 24)) };
    }
  }
}

async function render(f: Frame, c: Ctx): Promise<string> {
  const t = T[c.lang];
  switch (f.s) {
    case 'root': return t.menu(clean(c.deps.county, 24));
    case 'cat': return (await catScreen(f, c)).text;
    case 'sub': return (await subScreen(f, c)).text;
    case 'ward': return (await wardScreen(f, c)).text;
    case 'desc': return t.desc;
    case 'confirm': {
      const [cat, ward] = await Promise.all([c.deps.categoryName(f.cat, c.lang), c.deps.wardName(f.ward)]);
      return t.confirm(clean(cat ?? '', 22), clean(ward ?? '', 20), clean(f.desc, 60));
    }
    case 'ref': return t.ref;
    case 'opt': return (await optScreen(f, c)).text;
    case 'confirm-vote': return t.confirmVote(clean(f.title, 40));
    case 'freq': return t.freq;
  }
}

/** Returns the USSD response: "CON ..." to continue, "END ..." to finish. */
export async function ussd(text: string, deps: UssdDeps): Promise<string> {
  const inputs = text === '' ? [] : text.split('*').map((s) => s.trim());
  const ctx: Ctx = { deps, lang: 'en' };
  const stack: Frame[] = [{ s: 'root' }];
  let lastError: string | null = null;

  for (const input of inputs) {
    lastError = null;
    const top = stack[stack.length - 1]!;
    if (top.s === 'root' && input === '5') { ctx.lang = ctx.lang === 'en' ? 'sw' : 'en'; continue; }
    // 0 goes back, except where the person is typing free text
    if (input === '0' && top.s !== 'desc' && top.s !== 'ref') { if (stack.length > 1) stack.pop(); continue; }
    const step = await advance(top, input, ctx);
    if ('end' in step) return `END ${fit(step.end)}`;
    if ('push' in step) stack.push(step.push);
    else if ('replace' in step) stack[stack.length - 1] = step.replace;
    else lastError = step.error ? (step.msg ?? T[ctx.lang].invalid) : null;
  }

  const screen = await render(stack[stack.length - 1]!, ctx);
  return `CON ${fit(lastError ? `${lastError}\n${screen}` : screen)}`;
}
