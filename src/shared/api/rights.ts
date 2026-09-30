// Rights residents already have in law, made usable: information requests (Access to Information Act, 2016),
// consultations on drafts (Constitution art. 196), and a copy or erasure of one's data (Data Protection Act, 2019).
// Live first, labelled demo fallback; the rules (deadlines, who may do what) are enforced in migration 0020.
import { supabase } from './client';
import { dataSource } from './public';
import type { Consultation, ConsultationComment, ConsultationTally, ErasureRequest, InfoRequest, Stance } from './types';

const isDemo = async () => (await dataSource()) === 'demo' || !supabase;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

// ---- information requests ----

/** The decision date that applies now: the extended date if the county took its one extension. */
export const infoDeadline = (r: Pick<InfoRequest, 'due_at' | 'extended_to'>) => r.extended_to ?? r.due_at;
export const infoOpen = (r: Pick<InfoRequest, 'status'>) => r.status === 'submitted' || r.status === 'extended';
export const infoOverdue = (r: Pick<InfoRequest, 'status' | 'due_at' | 'extended_to'>, now = Date.now()) => infoOpen(r) && Date.parse(infoDeadline(r)) < now;

function demoInfo(): InfoRequest[] {
  const r = (id: string, title: string, body: string, ago: number, extra: Partial<InfoRequest> = {}): InfoRequest => ({
    id, reference: `NAI-I${id.toUpperCase().padEnd(10, '0')}`, requester_name: null, department_id: null, title, body, is_public: true, urgent: false,
    status: 'submitted', due_at: iso(-ago + 21 * DAY), extended_to: null, extension_reason: null, response: null, response_url: null, refusal_reason: null,
    answered_at: null, created_at: iso(-ago), ...extra,
  });
  return [
    r('a1', 'Evaluation report for the Kileleshwa roads tender', 'Please share the tender evaluation committee report and the list of bidders for the Othaya Road rehabilitation tender.', 30 * DAY,
      { requester_name: 'Wanjiru', status: 'answered', answered_at: iso(-12 * DAY), response: 'The evaluation report and the list of the nine bidders are attached. Commercial details of losing bids are withheld under section 6(1)(e).', response_url: 'https://example.org/demo-evaluation-report.pdf' }),
    r('a2', 'How much was spent on the Kawangware water kiosks', 'Please give the amount paid to each contractor for water kiosks in Kawangware ward in 2025/26, with the payment dates.', 26 * DAY,
      { status: 'extended', extended_to: iso(-5 * DAY + 14 * DAY), extension_reason: 'Payment records are being compiled from the finance office.' }),
    r('a3', 'Garbage collection contracts for Embakasi', 'Please share the current garbage collection contracts for Embakasi sub-county, including the collection schedule promised.', 25 * DAY),
    r('a4', 'Staff list of Mbagathi dispensary', 'Please share the number of nurses and clinical officers posted to the dispensary this year.', 6 * DAY),
    r('a5', 'Names and ID numbers of all market traders', 'Please give me the names and national ID numbers of every licensed trader at Gikomba.', 40 * DAY,
      { status: 'refused', answered_at: iso(-25 * DAY), refusal_reason: 'This is personal information of other people, which section 6(1)(d) of the Act protects. The number of licensed traders per market is published on Open data instead.' }),
  ];
}

export async function getInfoRequests(): Promise<InfoRequest[]> {
  if (await isDemo()) return demoInfo();
  const { data, error } = await supabase!.from('info_requests')
    .select('id, reference, requester_name, department_id, title, body, is_public, urgent, status, due_at, extended_to, extension_reason, response, response_url, refusal_reason, answered_at, created_at')
    .order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return (data ?? []) as InfoRequest[];
}

export async function getInfoRequest(reference: string): Promise<InfoRequest | null> {
  if (await isDemo()) return demoInfo().find((r) => r.reference === reference.toUpperCase()) ?? null;
  const { data, error } = await supabase!.from('info_requests')
    .select('id, reference, requester_name, department_id, title, body, is_public, urgent, status, due_at, extended_to, extension_reason, response, response_url, refusal_reason, answered_at, created_at')
    .eq('reference', reference.toUpperCase()).maybeSingle();
  if (error) throw error;
  return data as InfoRequest | null;
}

export async function getMyInfoRequests(): Promise<InfoRequest[]> {
  if (await isDemo()) return [];
  const { data, error } = await supabase!.rpc('my_info_requests');
  if (error) throw error;
  return (data ?? []) as InfoRequest[];
}

export type NewInfoRequest = { title: string; body: string; requester_name?: string; is_public: boolean; urgent: boolean; urgent_reason?: string };
export async function fileInfoRequest(r: NewInfoRequest): Promise<{ reference: string; due_at: string }> {
  if (await isDemo()) return { reference: 'NAI-IDEMO000000', due_at: iso(r.urgent ? 48 * HOUR : 21 * DAY) };
  const { data, error } = await supabase!.from('info_requests')
    .insert({ title: r.title, body: r.body, requester_name: r.requester_name || null, is_public: r.is_public, urgent: r.urgent, urgent_reason: r.urgent ? r.urgent_reason ?? null : null })
    .select('reference, due_at').single();
  if (error) throw error;
  return data as { reference: string; due_at: string };
}

export async function answerInfoRequest(id: string, patch: Partial<Pick<InfoRequest, 'status' | 'extension_reason' | 'response' | 'response_url' | 'refusal_reason'>>): Promise<void> {
  if (await isDemo()) return;
  const { error } = await supabase!.from('info_requests').update(patch).eq('id', id);
  if (error) throw error;
}

// ---- consultations ----

export const consultationOpen = (c: Pick<Consultation, 'opens_at' | 'closes_at'>, now = Date.now()) => Date.parse(c.opens_at) <= now && now <= Date.parse(c.closes_at);

function demoConsultations(): Consultation[] {
  return [
    { id: 'k1', slug: 'finance-bill-demo', kind: 'bill', title: 'County Finance Bill (demo)', title_sw: 'Mswada wa Fedha wa Kaunti (mfano)',
      summary: 'Sets county fees for the coming year: parking, single business permits, market stalls and building approvals. The draft raises daily parking in the CBD and merges three trade licences into one permit.',
      summary_sw: 'Inaweka ada za kaunti kwa mwaka ujao: maegesho, kibali kimoja cha biashara, vibanda vya soko na idhini za ujenzi.',
      document_url: null, questions: ['Parking fees', 'Single business permit', 'Market stall fees'], ward_id: null, opens_at: iso(-5 * DAY), closes_at: iso(16 * DAY), report: null, report_url: null, report_at: null },
    { id: 'k2', slug: 'waste-policy-demo', kind: 'policy', title: 'Solid waste management policy (demo)', title_sw: 'Sera ya usimamizi wa taka (mfano)',
      summary: 'How estates will sort waste at source, how collectors are licensed, and what residents pay.', summary_sw: null, document_url: null,
      questions: ['Sorting at source', 'Licensing of collectors'], ward_id: null, opens_at: iso(-60 * DAY), closes_at: iso(-30 * DAY),
      report: 'We received 214 comments from 38 wards. Most people supported sorting at source but opposed a new monthly fee. The fee was removed from the final policy; licensing of collectors was kept, with a public register.', report_url: null, report_at: iso(-10 * DAY) },
  ];
}
function demoComments(): ConsultationComment[] {
  const c = (id: number, question: number | null, stance: Stance, body: string, ward: string | null, ago: number): ConsultationComment =>
    ({ id, consultation_id: 'k1', author_name: null, ward_id: ward, question, stance, body, created_at: iso(-ago * HOUR) });
  return [
    c(1, 0, 'oppose', 'Parking in town is already too expensive for small traders who come in daily.', 'kawangware', 5),
    c(2, 1, 'support', 'One permit instead of three will save us many trips to City Hall.', 'kilimani', 20),
    c(3, 1, 'amend', 'Support the single permit, but let small kiosks pay monthly by M-Pesa.', 'embakasi', 30),
  ];
}

export async function getConsultations(): Promise<Consultation[]> {
  if (await isDemo()) return demoConsultations();
  const { data, error } = await supabase!.from('consultations').select('*').order('closes_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as Consultation[];
}

export async function getConsultationComments(consultationId: string): Promise<ConsultationComment[]> {
  if (await isDemo()) return consultationId === 'k1' ? demoComments() : [];
  const { data, error } = await supabase!.from('consultation_comments')
    .select('id, consultation_id, author_name, ward_id, question, stance, body, created_at').eq('consultation_id', consultationId).order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data ?? []) as ConsultationComment[];
}

export async function getConsultationTally(slug: string): Promise<ConsultationTally> {
  if (await isDemo()) return slug === 'finance-bill-demo' ? { comments: 3, people: 3, wards: 3, by_stance: { oppose: 1, support: 1, amend: 1 } } : { comments: 214, people: 180, wards: 38, by_stance: { support: 120, oppose: 60, amend: 34 } };
  const { data, error } = await supabase!.rpc('consultation_tally', { p_slug: slug });
  if (error) throw error;
  return (data as ConsultationTally | null) ?? { comments: 0, people: 0, wards: 0, by_stance: {} };
}

export async function addConsultationComment(c: { consultation_id: string; stance: Stance; body: string; question: number | null; ward_id: string | null; author_name?: string }): Promise<void> {
  if (await isDemo()) return;
  const { error } = await supabase!.from('consultation_comments').insert({ ...c, author_name: c.author_name || null });
  if (error) throw error;
}

export async function saveConsultation(c: Partial<Consultation> & Pick<Consultation, 'slug' | 'title' | 'summary' | 'closes_at' | 'kind'>): Promise<void> {
  if (await isDemo()) return;
  const { id, report_at: _ignored, ...rest } = c;
  const q = id ? supabase!.from('consultations').update(rest).eq('id', id) : supabase!.from('consultations').insert(rest);
  const { error } = await q;
  if (error) throw error;
}

// ---- petitions ----

/** Supporters a petition needs for a guaranteed public answer within 30 days (mirrors private.petition_threshold). */
export const petitionGoal = (wardId: string | null) => (wardId ? 200 : 1000);

// ---- my data ----

export async function downloadMyData(): Promise<Blob> {
  if (await isDemo()) return new Blob([JSON.stringify({ demo: true, note: 'In demo mode nothing is stored about you.' }, null, 2)], { type: 'application/json' });
  const { data, error } = await supabase!.rpc('my_data');
  if (error) throw error;
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

export async function requestErasure(reason: string): Promise<string> {
  if (await isDemo()) return iso(14 * DAY);
  const { data, error } = await supabase!.rpc('request_erasure', { p_reason: reason || null });
  if (error) throw error;
  return data as string;
}

export async function getErasureQueue(): Promise<ErasureRequest[]> {
  if (await isDemo()) return [];
  const { data, error } = await supabase!.rpc('erasure_queue');
  if (error) throw error;
  return (data ?? []) as ErasureRequest[];
}

export async function carryOutErasure(id: string): Promise<void> {
  if (await isDemo()) return;
  const { error } = await supabase!.rpc('carry_out_erasure', { p_id: id });
  if (error) throw error;
}
