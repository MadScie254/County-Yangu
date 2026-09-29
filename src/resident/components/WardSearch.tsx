import { useId, useMemo, useRef, useState } from 'react';
import { MapPin, Search, LocateFixed, Loader2 } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wards, subCountyById } from '@/shared/config/county';
import { cn } from '@/shared/lib/utils';

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** Accessible combobox: type a ward or sub-county, arrow keys to move, Enter to choose. */
export function WardSearch({ onPick, onLocate, locating, className }: { onPick: (wardId: string) => void; onLocate?: () => void; locating?: boolean; className?: string }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return [];
    return wards
      .filter((w) => norm(w.name).includes(n) || norm(subCountyById.get(w.subCountyId ?? '')?.name ?? '').includes(n))
      .sort((a, b) => Number(norm(b.name).startsWith(n)) - Number(norm(a.name).startsWith(n)) || a.name.localeCompare(b.name))
      .slice(0, 7);
  }, [q]);

  const choose = (id: string) => {
    onPick(id);
    setQ('');
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className={cn('relative', className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-[1.15rem] -translate-y-1/2 text-muted" />
          <input
            ref={input}
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && results[active] ? `${listId}-${results[active]!.id}` : undefined}
            aria-label={t('home.findWard')}
            placeholder={t('home.findWardPlaceholder')}
            value={q}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter' && results[active]) {
                e.preventDefault();
                choose(results[active]!.id);
              } else if (e.key === 'Escape') setOpen(false);
            }}
            className="h-12 w-full rounded-full border border-line-strong bg-surface pl-11 pr-4 text-[1rem] placeholder:text-muted/80 focus:border-info focus:outline-none focus:ring-4 focus:ring-info/25"
          />
        </div>
        {onLocate && (
          <button type="button" onClick={onLocate} disabled={locating} aria-label={locating ? t('home.locating') : t('home.useLocation')} title={t('home.useLocation')} className="tap grid size-12 shrink-0 place-items-center rounded-full border border-line-strong bg-surface transition hover:bg-bg-2 disabled:opacity-60">
            {locating ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <LocateFixed className="size-5" aria-hidden />}
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-30 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          {results.map((w, i) => (
            <li key={w.id} id={`${listId}-${w.id}`} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(w.id)} onMouseEnter={() => setActive(i)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', i === active && 'bg-bg-2')}>
                <MapPin className="size-4 shrink-0 text-brand-strong" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{w.name}</span>
                  <span className="block truncate text-xs text-muted">{subCountyById.get(w.subCountyId ?? '')?.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
