// Reports carry no reporter identity on the server, so "my reports" can only live on the device that sent them.
// This list keeps the report numbers (never the text or the phone number) so the dashboard can follow them.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SavedReport = { reference: string; ward_id: string; category_id: string | null; at: string };

type State = {
  items: SavedReport[];
  add: (r: SavedReport) => void;
  remove: (reference: string) => void;
};

export const useMyReports = create<State>()(
  persist(
    (set) => ({
      items: [],
      add: (r) => set((s) => (s.items.some((i) => i.reference === r.reference) ? s : { items: [r, ...s.items].slice(0, 30) })),
      remove: (reference) => set((s) => ({ items: s.items.filter((i) => i.reference !== reference) })),
    }),
    { name: 'county-yangu-my-reports', version: 1 },
  ),
);
