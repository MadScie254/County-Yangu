import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbDel, idbGet, idbSet } from '@/shared/lib/idb';
import { uuid } from '@/shared/lib/utils';
import { SubmitError, sendReport, castVote, type ReportResult } from '@/shared/api/submit';
import type { ReportPayload } from '@/shared/lib/schemas';

export type QueueKind = 'report' | 'vote';
export type QueueStatus = 'queued' | 'sending' | 'sent' | 'failed';

type VotePayload = { token: string; cycle_id: string; ward_id: string; option_id: string };

export type QueueItem =
  | { id: string; kind: 'report'; payload: ReportPayload; photoCount: number; status: QueueStatus; attempts: number; createdAt: string; nextAttemptAt: number; error?: string; result?: ReportResult }
  | { id: string; kind: 'vote'; payload: VotePayload; photoCount: 0; status: QueueStatus; attempts: number; createdAt: string; nextAttemptAt: number; error?: string; result?: { ok: true } };

type QueueState = {
  items: QueueItem[];
  enqueueReport: (payload: Omit<ReportPayload, 'client_key'>, photos: Blob[]) => Promise<QueueItem>;
  enqueueVote: (payload: VotePayload) => Promise<QueueItem>;
  flush: () => Promise<void>;
  remove: (id: string) => void;
};

const backoff = (attempts: number) => Date.now() + Math.min(10 * 60_000, 5_000 * 2 ** attempts);
const WEEK = 7 * 86_400_000;
let flushing = false;

export const useQueue = create<QueueState>()(
  persist(
    (set, get) => ({
      items: [],

      // The item id doubles as the idempotency key (client_key): replaying a request after a dropped
      // connection can never create a second report or a second vote.
      enqueueReport: async (payload, photos) => {
        const id = uuid();
        await Promise.all(photos.map((p, i) => idbSet(`photo:${id}:${i}`, p)));
        const item: QueueItem = { id, kind: 'report', payload: { ...payload, client_key: id }, photoCount: photos.length, status: 'queued', attempts: 0, createdAt: new Date().toISOString(), nextAttemptAt: 0 };
        set((s) => ({ items: [item, ...s.items] }));
        void get().flush();
        return item;
      },

      enqueueVote: async (payload) => {
        const item: QueueItem = { id: uuid(), kind: 'vote', payload, photoCount: 0, status: 'queued', attempts: 0, createdAt: new Date().toISOString(), nextAttemptAt: 0 };
        set((s) => ({ items: [item, ...s.items] }));
        void get().flush();
        return item;
      },

      flush: async () => {
        if (flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
        flushing = true;
        try {
          const patch = (id: string, p: Partial<QueueItem>) => set((s) => ({ items: s.items.map((i) => (i.id === id ? ({ ...i, ...p } as QueueItem) : i)) }));
          // prune old confirmations
          set((s) => ({ items: s.items.filter((i) => i.status !== 'sent' || Date.now() - new Date(i.createdAt).getTime() < WEEK) }));

          for (const item of get().items.filter((i) => (i.status === 'queued' || i.status === 'sending') && i.nextAttemptAt <= Date.now())) {
            patch(item.id, { status: 'sending' });
            try {
              if (item.kind === 'report') {
                const photos = (await Promise.all(Array.from({ length: item.photoCount }, (_, i) => idbGet<Blob>(`photo:${item.id}:${i}`)))).filter((b): b is Blob => Boolean(b));
                const result = await sendReport(item.payload, photos);
                await Promise.all(Array.from({ length: item.photoCount }, (_, i) => idbDel(`photo:${item.id}:${i}`)));
                patch(item.id, { status: 'sent', result, error: undefined });
              } else {
                await castVote({ ...item.payload, client_key: item.id });
                patch(item.id, { status: 'sent', result: { ok: true }, error: undefined });
              }
            } catch (e) {
              const err = e instanceof SubmitError ? e : new SubmitError('unknown', false);
              const attempts = item.attempts + 1;
              if (err.permanent) patch(item.id, { status: 'failed', attempts, error: err.message });
              else patch(item.id, { status: 'queued', attempts, nextAttemptAt: backoff(attempts), error: err.message });
            }
          }
        } finally {
          flushing = false;
        }
      },

      remove: (id) => {
        const item = get().items.find((i) => i.id === id);
        if (item?.kind === 'report') for (let i = 0; i < item.photoCount; i++) void idbDel(`photo:${id}:${i}`);
        set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
      },
    }),
    { name: 'county-yangu-queue', version: 1, partialize: (s) => ({ items: s.items.map((i) => (i.status === 'sending' ? { ...i, status: 'queued' as const } : i)) }) },
  ),
);
