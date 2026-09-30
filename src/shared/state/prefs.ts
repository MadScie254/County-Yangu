import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale } from '@/shared/i18n';

export type ThemePref = 'system' | 'light' | 'dark';

type PrefsState = {
  locale: Locale;
  theme: ThemePref;
  highContrast: boolean;
  simpleMode: boolean;
  textScale: number; // 0.9 to 1.4
  wardId: string | null; // the resident's ward, remembered on this device only
  votedCycles: string[]; // voting rounds already voted in on this device (the server enforces one vote per phone)
  setLocale: (l: Locale) => void;
  setTheme: (t: ThemePref) => void;
  setHighContrast: (v: boolean) => void;
  setSimpleMode: (v: boolean) => void;
  setTextScale: (n: number) => void;
  setWardId: (id: string | null) => void;
  markVoted: (cycleId: string) => void;
};

export function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (fromUrl === 'sw' || fromUrl === 'en') return fromUrl;
  return navigator.language?.toLowerCase().startsWith('sw') ? 'sw' : 'en';
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      locale: detectLocale(),
      theme: 'system',
      highContrast: false,
      simpleMode: false,
      textScale: 1,
      wardId: null,
      votedCycles: [],
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
      setHighContrast: (highContrast) => set({ highContrast }),
      setSimpleMode: (simpleMode) => set({ simpleMode }),
      setTextScale: (textScale) => set({ textScale: Math.min(1.4, Math.max(0.9, textScale)) }),
      setWardId: (wardId) => set({ wardId }),
      markVoted: (cycleId) => set((s) => ({ votedCycles: s.votedCycles.includes(cycleId) ? s.votedCycles : [...s.votedCycles, cycleId] })),
    }),
    {
      name: 'county-yangu-prefs',
      version: 1,
      // an explicit ?lang= in the URL wins over what was stored
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<PrefsState>) };
        const fromUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lang') : null;
        if (fromUrl === 'sw' || fromUrl === 'en') merged.locale = fromUrl;
        return merged;
      },
    },
  ),
);

/** Reflect preferences onto <html> so CSS tokens and screen readers pick them up. */
export function applyPrefsToDocument(p: Pick<PrefsState, 'locale' | 'theme' | 'highContrast' | 'simpleMode' | 'textScale'>) {
  const root = document.documentElement;
  root.lang = p.locale;
  const dark = p.theme === 'dark' || (p.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  if (p.highContrast) root.dataset.contrast = 'high';
  else delete root.dataset.contrast;
  root.dataset.simple = String(p.simpleMode);
  root.style.setProperty('--text-scale', String(p.textScale));
}

export function bindPrefsToDocument() {
  const run = () => applyPrefsToDocument(usePrefs.getState());
  run();
  const unsub = usePrefs.subscribe(run);
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', run);
  return () => {
    unsub();
    mq.removeEventListener('change', run);
  };
}
