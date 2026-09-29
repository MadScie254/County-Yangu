import { create } from 'zustand';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { cn, uuid } from '@/shared/lib/utils';

type ToastTone = 'good' | 'bad' | 'info';
type ToastItem = { id: string; tone: ToastTone; title: string; body?: string };

const useToasts = create<{ items: ToastItem[]; push: (t: Omit<ToastItem, 'id'>, ms?: number) => void; dismiss: (id: string) => void }>((set, get) => ({
  items: [],
  push: (t, ms = 5000) => {
    const id = uuid();
    set((s) => ({ items: [...s.items.slice(-2), { ...t, id }] }));
    setTimeout(() => get().dismiss(id), ms);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

export const toast = (t: Omit<ToastItem, 'id'>, ms?: number) => useToasts.getState().push(t, ms);

const icons = { good: CheckCircle2, bad: CircleAlert, info: Info } as const;
const colors = { good: 'text-good', bad: 'text-bad', info: 'text-info' } as const;

export function Toaster({ dismissLabel = 'Dismiss' }: { dismissLabel?: string }) {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 top-3 z-[100] mx-auto flex w-full max-w-md flex-col gap-2 px-3">
      {items.map((t) => {
        const Icon = icons[t.tone];
        return (
          <div key={t.id} className="pointer-events-auto flex animate-rise items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-float">
            <Icon className={cn('mt-0.5 size-5 shrink-0', colors[t.tone])} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-sm text-ink-2">{t.body}</p>}
            </div>
            <button type="button" aria-label={dismissLabel} onClick={() => dismiss(t.id)} className="tap -m-2 grid place-items-center rounded-full text-muted hover:text-ink">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
