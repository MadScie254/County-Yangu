// AI assistant client. Every model call goes through the `ai-gateway` Edge Function, which redacts personal
// data, enforces the department's monthly spend cap and logs the call. The browser never holds an API key.
// The assistant DRAFTS and ANSWERS; it never approves, rejects, ranks or sends anything on its own.
import { functionsUrl, supabase } from '@/shared/api/client';
import { dataSource } from '@/shared/api/public';
import { sleep } from '@/shared/lib/utils';

async function callGateway<T>(task: string, input: Record<string, unknown>): Promise<T> {
  if ((await dataSource()) !== 'live' || !supabase || !functionsUrl) throw new Error('demo');
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${functionsUrl}/ai-gateway`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string, authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify({ task, input }),
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `http-${res.status}`);
  return body;
}

export async function draftReply(input: { category: string; ward: string; status: string; description: string }): Promise<string> {
  try {
    return (await callGateway<{ text: string }>('draft_reply', input)).text;
  } catch (e) {
    if ((e as Error).message !== 'demo') throw e;
    await sleep(700);
    return `Thank you for reporting this ${input.category.toLowerCase()} in ${input.ward}. It has been passed to the responsible team and we will update you here as work progresses.`;
  }
}

export type AssistantAnswer = { answer: string; query?: string; columns?: string[]; rows?: (string | number | null)[][] };

export async function askAssistant(question: string): Promise<AssistantAnswer> {
  try {
    return await callGateway<AssistantAnswer>('data_question', { question });
  } catch (e) {
    if ((e as Error).message !== 'demo') throw e;
    await sleep(900);
    return {
      answer: 'Demo answer: in the live system the assistant writes a read-only query against approved views, runs it with your own permissions, and shows you both the result and the query behind it.',
      query: "select w.name, count(*) as open_cases\nfrom cases_view c join wards w on w.id = c.ward_id\nwhere c.category_id = 'drainage' and c.status not in ('resolved','closed')\ngroup by w.name order by open_cases desc limit 5;",
      columns: ['Ward', 'Open drainage cases'],
      rows: [['Embakasi', 14], ['Kayole North', 11], ['Mathare North', 9], ['Kibra', 8], ['Dandora Area I', 6]],
    };
  }
}

export type AiUsage = { department: string; spent_kes: number; cap_kes: number; calls: number };
