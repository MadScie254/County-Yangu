import { describe, expect, it } from 'vitest';
import { translate } from '@/shared/i18n';
import { flagText, flagVars } from '@/shared/lib/flagText';
import type { ProcurementFlag } from '@/shared/api/types';

const flag = (code: string, metrics: Record<string, unknown>, label = 'Alpha Builders'): ProcurementFlag => ({
  code, subject_key: 'k', severity: 'watch', subject_kind: 'contractor', subject_label: label, title: 'English title', detail: 'English detail', metrics, status: 'open', response: null, first_seen: null,
} as ProcurementFlag);
const t = (l: 'en' | 'sw') => (k: Parameters<typeof translate>[1], v?: Parameters<typeof translate>[2]) => translate(l, k, v);

describe('flag text', () => {
  it('keeps the database wording in English', () => {
    expect(flagText(flag('dominant_supplier', {}), 'en', t('en'))).toEqual({ title: 'English title', why: 'English detail' });
  });
  it('renders Kiswahili from the template and the numbers', () => {
    const r = flagText(flag('dominant_supplier', { share_value: 75.5, wins: 4 }), 'sw', t('sw'));
    expect(r.title).toBe('Alpha Builders ana 75.5% ya thamani ya zabuni zilizotolewa');
    expect(r.why.length).toBeGreaterThan(20);
  });
  it('computes percentages from the raw numbers', () => {
    expect(flagVars(flag('project_overrun', { budget: 10_000_000, spent: 13_000_000 })).pct).toBe(130);
    expect(flagVars(flag('award_above_estimate', { estimate: 2_000_000, award: 3_000_000 })).pct).toBe(150);
    expect(flagVars(flag('single_bidder_share', { single_bid: 3, awarded: 8 })).share).toBe(37.5);
  });
  it('falls back to English for a code with no template', () => {
    expect(flagText(flag('brand_new_rule', {}), 'sw', t('sw'))).toEqual({ title: 'English title', why: 'English detail' });
  });
  it('has a Kiswahili template for every rule the database can raise', () => {
    const codes = ['dominant_supplier', 'repeat_winner', 'top3_concentration', 'non_competitive_share', 'contractor_direct_reliance', 'single_bidder_share', 'contractor_single_bid', 'short_tender_period', 'award_above_estimate', 'split_awards', 'kra_noncompliant', 'project_overrun', 'stalled_after_spend', 'project_late'];
    for (const c of codes) expect(flagText(flag(c, {}), 'sw', t('sw')).title, c).not.toBe('English title');
  });
});
