import { z } from 'zod';

// Zod's just-in-time compiler probes for `eval`, which the site's Content-Security-Policy (correctly) forbids.
// Skipping the probe keeps the browser console free of a violation report on every page that validates a form.
z.config({ jitless: true });
import { categoryIds } from '@/shared/data/categories';
import { toE164Kenya } from '@/shared/lib/utils';

export const reportSchema = z
  .object({
    category_id: z.enum(categoryIds, { error: 'needCategory' }),
    /** Up to four more problems at the same place; each becomes its own linked case for the right team. */
    extra_category_ids: z.array(z.enum(categoryIds)).max(4),
    ward_id: z.string().min(1, 'needWard'),
    description: z.string().trim().min(12, 'tooShort').max(2000),
    lat: z.number().min(-5).max(5).nullable(),
    lng: z.number().min(33).max(42).nullable(),
    callback_consent: z.boolean(),
    callback_phone: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.callback_consent && !toE164Kenya(v.callback_phone)) ctx.addIssue({ code: 'custom', path: ['callback_phone'], message: 'callbackInvalid' });
  });
export type ReportForm = z.infer<typeof reportSchema>;

/** What actually goes over the wire to the report-intake function. */
export type ReportPayload = {
  client_key: string;
  category_id: string;
  /** Up to four more issues at the same place; each becomes its own linked case. */
  extra_category_ids?: string[];
  ward_id: string;
  description: string;
  lat: number | null;
  lng: number | null;
  locale: 'en' | 'sw';
  callback_phone: string | null; // E.164, only when the resident consented
};

export const alertSchema = z.object({
  ward_id: z.string().min(1),
  phone: z.string().refine((v) => toE164Kenya(v) !== null, 'callbackInvalid'),
  frequency: z.enum(['instant', 'daily', 'weekly']),
});
export type AlertForm = z.infer<typeof alertSchema>;

export const proposalSchema = z.object({
  ward_id: z.string().nullable(),
  kind: z.enum(['proposal', 'petition']),
  title: z.string().trim().min(5).max(160),
  body: z.string().trim().min(10).max(4000),
});
export type ProposalForm = z.infer<typeof proposalSchema>;

export const referenceRegex = /^[A-Z]{3}-[RA][0-9A-Z]{6,}$/;
