// The only door to a language model. Staff-side only. It:
//   * checks the caller is working staff (roles come from the database, not the request),
//   * enforces the department's monthly AI budget BEFORE calling, and logs every call with its cost,
//   * scrubs personal details out of anything it sends,
//   * never lets the model act: it drafts text, or it picks one of a fixed list of read-only questions that the database
//     runs as the person asking. Nothing it produces is sent, saved or decided by itself.
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { requireRole, WORKING_ROLES } from '../_shared/auth.ts';
import { rpc, userClient } from '../_shared/db.ts';
import { categories } from '../_shared/directory.ts';
import { costKes, complete, llmProvider, type LlmResponse } from '../_shared/llm.ts';
import { DRAFT_SYSTEM, SUMMARY_SYSTEM, QUESTIONS, describeCall, parsePlan, plannerPrompt, toRows } from '../_shared/ai.ts';
import { limit } from '../_shared/participation.ts';
import { scrub } from '../_shared/pii.ts';
import { oneOf, str } from '../_shared/validate.ts';

Deno.serve(handler('ai-gateway', async (req) => {
  const caller = await requireRole(req, WORKING_ROLES);
  const body = await readJson(req, 16_384);
  const task = oneOf(body, 'task', ['draft_reply', 'data_question'] as const);
  const input = (typeof body.input === 'object' && body.input !== null ? body.input : {}) as Record<string, unknown>;
  await limit(`ai:user:${caller.id}`, 3600, 40);

  const department = await rpc<string | null>('svc_ai_department', { p_user: caller.id });
  const budget = await rpc<{ allowed: boolean }>('svc_ai_check', { p_department: department });
  if (!budget.allowed) throw new HttpError(402, 'budget');

  let redactions = 0;
  const provider = llmProvider();
  // one place that calls the model and records it
  const ask = async (label: string, system: string, user: string, opts: { json?: boolean; maxTokens?: number } = {}): Promise<LlmResponse> => {
    try {
      const r = await complete({ system, user, ...opts });
      await rpc('svc_ai_log', { p_task: label, p_model: r.model, p_side: 'county', p_department: department, p_actor: caller.id, p_tokens_in: r.tokensIn, p_tokens_out: r.tokensOut, p_cost_kes: costKes(provider, r.tokensIn, r.tokensOut), p_ok: true, p_redactions: redactions });
      return r;
    } catch (e) {
      await rpc('svc_ai_log', { p_task: label, p_model: provider, p_side: 'county', p_department: department, p_actor: caller.id, p_tokens_in: 0, p_tokens_out: 0, p_cost_kes: 0, p_ok: false, p_redactions: redactions }).catch(() => {});
      console.error('[ai-gateway] model call failed', e instanceof Error ? e.message : String(e));
      throw new HttpError(502, 'ai_unavailable');
    }
  };

  if (task === 'draft_reply') {
    const description = scrub(str(input, 'description', 1, 2000));
    redactions = description.redactions;
    const category = str(input, 'category', 1, 80);
    const ward = str(input, 'ward', 1, 80);
    const status = str(input, 'status', 1, 40);
    const r = await ask('draft_reply', DRAFT_SYSTEM, `Category: ${category}\nWard: ${ward}\nCurrent status: ${status}\n<report>\n${description.text}\n</report>`, { maxTokens: 300 });
    return { text: r.text.trim().slice(0, 900) };
  }

  // data_question: pick a fixed question, run it as the caller, then describe the result
  const question = scrub(str(input, 'question', 3, 400));
  redactions = question.redactions;
  const cats = await categories();
  const planReply = await ask('data_question.plan', plannerPrompt(cats.map((c) => c.id)), question.text, { json: true, maxTokens: 200 });
  const plan = parsePlan(planReply.text);
  if (!plan) {
    return { answer: `I can answer questions about: ${Object.keys(QUESTIONS).map((k) => k.replace(/_/g, ' ')).join('; ')}. Try rephrasing your question along those lines.` };
  }

  const { data, error } = await userClient(caller.jwt).rpc(QUESTIONS[plan.tool]!.rpc, plan.args);
  if (error) {
    console.error('[ai-gateway] question failed', error.code, error.message);
    throw new HttpError(500, 'server_error');
  }
  const rows = toRows(plan, (data ?? []) as Record<string, unknown>[]);
  const summary = await ask('data_question.answer', SUMMARY_SYSTEM, `Question: ${question.text}\nColumns: ${QUESTIONS[plan.tool]!.columns.join(', ')}\nRows (max 50): ${JSON.stringify(rows)}`, { maxTokens: 250 });
  return { answer: summary.text.trim().slice(0, 900), query: describeCall(plan), columns: QUESTIONS[plan.tool]!.columns, rows };
}));
