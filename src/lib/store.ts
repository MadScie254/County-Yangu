"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ReportInput, VoteInput } from "@/lib/schemas";

export type QueueKind = "vote" | "report";
export type QueueStatus = "waiting" | "syncing" | "synced";

export type QueuedAction = {
  id: string;
  kind: QueueKind;
  status: QueueStatus;
  createdAt: string;
  payload: VoteInput | ReportInput;
  reference?: string;
};

type CountyState = {
  simpleMode: boolean;
  highContrast: boolean;
  textScale: number;
  selectedWardId: string;
  queuedActions: QueuedAction[];
  setSelectedWard: (wardId: string) => void;
  toggleSimpleMode: () => void;
  toggleHighContrast: () => void;
  setTextScale: (scale: number) => void;
  enqueueVote: (payload: VoteInput) => QueuedAction;
  enqueueReport: (payload: ReportInput) => QueuedAction;
  markSynced: (id: string) => void;
  simulateSync: () => void;
};

function makeReference(prefix: string) {
  const random = Math.floor(100 + Math.random() * 899);
  return `CY-2607-${prefix.toUpperCase().slice(0, 3)}-${random}`;
}

export const useCountyStore = create<CountyState>()(
  persist(
    (set, get) => ({
      simpleMode: false,
      highContrast: false,
      textScale: 1,
      selectedWardId: "kimilili",
      queuedActions: [],
      setSelectedWard: (wardId) => set({ selectedWardId: wardId }),
      toggleSimpleMode: () =>
        set((state) => ({ simpleMode: !state.simpleMode })),
      toggleHighContrast: () =>
        set((state) => ({ highContrast: !state.highContrast })),
      setTextScale: (textScale) => set({ textScale }),
      enqueueVote: (payload) => {
        const action: QueuedAction = {
          id: crypto.randomUUID(),
          kind: "vote",
          status: navigator.onLine ? "syncing" : "waiting",
          createdAt: new Date().toISOString(),
          payload,
        };
        set((state) => ({ queuedActions: [action, ...state.queuedActions] }));
        window.setTimeout(() => get().markSynced(action.id), navigator.onLine ? 850 : 2600);
        return action;
      },
      enqueueReport: (payload) => {
        const action: QueuedAction = {
          id: crypto.randomUUID(),
          kind: "report",
          status: navigator.onLine ? "syncing" : "waiting",
          createdAt: new Date().toISOString(),
          payload,
          reference: makeReference(payload.wardId),
        };
        set((state) => ({ queuedActions: [action, ...state.queuedActions] }));
        window.setTimeout(() => get().markSynced(action.id), navigator.onLine ? 900 : 3200);
        return action;
      },
      markSynced: (id) =>
        set((state) => ({
          queuedActions: state.queuedActions.map((action) =>
            action.id === id ? { ...action, status: "synced" } : action,
          ),
        })),
      simulateSync: () => {
        const waiting = get().queuedActions.filter(
          (action) => action.status === "waiting",
        );
        set((state) => ({
          queuedActions: state.queuedActions.map((action) =>
            action.status === "waiting"
              ? { ...action, status: "syncing" }
              : action,
          ),
        }));
        waiting.forEach((action, index) => {
          window.setTimeout(() => get().markSynced(action.id), 600 + index * 300);
        });
      },
    }),
    {
      name: "county-yangu-state",
      partialize: (state) => ({
        simpleMode: state.simpleMode,
        highContrast: state.highContrast,
        textScale: state.textScale,
        selectedWardId: state.selectedWardId,
        queuedActions: state.queuedActions,
      }),
    },
  ),
);
