import { useEffect, useState } from 'react';

export function useMediaQuery(query: string) {
  const get = () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Sets the document title for the current page ("Report a problem · County Yangu"). */
export function usePageTitle(title: string, suffix = 'County Yangu') {
  useEffect(() => {
    document.title = title ? `${title} · ${suffix}` : suffix;
  }, [title, suffix]);
}

type NetworkInfo = { saveData?: boolean; effectiveType?: string };

/** True when the visitor asked their browser to save data, or is on a 2G-class connection. */
export function useSaveData() {
  const info = () => (typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { connection?: NetworkInfo }).connection);
  const get = () => Boolean(info()?.saveData) || ['slow-2g', '2g'].includes(info()?.effectiveType ?? '');
  const [saving, setSaving] = useState(get);
  useEffect(() => {
    const c = (navigator as Navigator & { connection?: EventTarget }).connection;
    const on = () => setSaving(get());
    c?.addEventListener?.('change', on);
    return () => c?.removeEventListener?.('change', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return saving;
}
