import { Link } from 'react-router-dom';
import { X, Megaphone, FolderKanban, BellRing, ChevronRight } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { subCountyById, wardById, wards } from '@/shared/config/county';
import type { WardStat } from '@/shared/api/types';
import type { SubCountyStat } from '@/shared/map/aggregate';
import type { MapSelection } from '@/shared/map/CountyMap';
import { buttonClass, IconButton } from '@/shared/ui/Button';
import { Ring } from '@/shared/ui/Meter';
import { Stat } from '@/shared/ui/Card';
import { cn } from '@/shared/lib/utils';

function trustTone(v: number | null): 'good' | 'warn' | 'bad' | 'brand' {
  if (v == null) return 'brand';
  return v >= 65 ? 'good' : v >= 45 ? 'warn' : 'bad';
}

/** Detail card for the ward (or sub-county) selected on the map. */
export function WardCard({ selection, stats, subStats, onSelect, onClose, className }: { selection: NonNullable<MapSelection>; stats: WardStat[]; subStats: SubCountyStat[]; onSelect: (s: MapSelection) => void; onClose: () => void; className?: string }) {
  const { t, number } = useI18n();

  if (selection.type === 'subcounty') {
    const sc = subStats.find((s) => s.id === selection.id);
    const list = wards.filter((w) => w.subCountyId === selection.id).sort((a, b) => a.name.localeCompare(b.name));
    const byId = new Map(stats.map((s) => [s.ward_id, s]));
    return (
      <div className={cn('flex max-h-full flex-col overflow-hidden rounded-[1.5rem] border border-line bg-surface shadow-pop animate-rise', className)}>
        <div className="flex items-start justify-between gap-3 p-4 pb-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{t('common.subCounty')}</p>
            <h2 className="font-display text-2xl font-extrabold">{sc?.name ?? subCountyById.get(selection.id)?.name}</h2>
          </div>
          <IconButton label={t('home.wardCard.close')} onClick={onClose} className="-mr-2 -mt-1">
            <X className="size-5" aria-hidden />
          </IconButton>
        </div>
        {sc && (
          <div className="grid grid-cols-3 gap-3 px-4 py-3">
            <Stat label={t('home.openIssues')} value={number(sc.open)} />
            <Stat label={t('home.overdue')} value={number(sc.overdue)} tone={sc.overdue > 0 ? 'bad' : undefined} />
            <Stat label={t('home.resolved')} value={number(sc.resolved)} tone="good" />
          </div>
        )}
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto border-t border-line">
          {list.map((w) => {
            const s = byId.get(w.id);
            return (
              <li key={w.id}>
                <button type="button" onClick={() => onSelect({ type: 'ward', id: w.id })} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-2">
                  <span className="font-semibold">{w.name}</span>
                  <span className="flex items-center gap-2 text-sm text-muted">
                    <span className="font-data">{s ? number(s.open_reports) : '–'}</span>
                    <ChevronRight className="size-4" aria-hidden />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const ward = wardById.get(selection.id);
  const s = stats.find((x) => x.ward_id === selection.id);
  const trust = s?.trust_index ?? null;
  return (
    <div className={cn('rounded-[1.5rem] border border-line bg-surface p-4 shadow-pop animate-rise', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase tracking-[0.14em] text-muted">{subCountyById.get(ward?.subCountyId ?? '')?.name}</p>
          <h2 className="font-display text-2xl font-extrabold leading-tight">{ward?.name ?? selection.id}</h2>
        </div>
        <IconButton label={t('home.wardCard.close')} onClick={onClose} className="-mr-2 -mt-1">
          <X className="size-5" aria-hidden />
        </IconButton>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <Ring value={(trust ?? 0) / 100} tone={trustTone(trust)} label={`${t('home.trust')}: ${trust ?? t('home.noData')}`}>
          <span className="font-display text-xl font-extrabold leading-none">{trust == null ? '–' : Math.round(trust)}</span>
        </Ring>
        <div className="grid flex-1 grid-cols-3 gap-2">
          <Stat label={t('home.openIssues')} value={s ? number(s.open_reports) : '–'} />
          <Stat label={t('home.overdue')} value={s ? number(s.overdue_reports) : '–'} tone={s && s.overdue_reports > 0 ? 'bad' : undefined} />
          <Stat label={t('home.resolved')} value={s ? number(s.resolved_90d) : '–'} tone="good" />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">{t('home.wardCard.trustHint')}</p>

      <div className="mt-4 flex flex-col gap-2">
        <Link to={`/report?ward=${selection.id}`} className={buttonClass('primary', 'md', 'w-full')}>
          <Megaphone className="size-4" aria-hidden /> {t('home.wardCard.reportHere', { ward: ward?.name ?? '' })}
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <Link to={`/projects?ward=${selection.id}`} className={buttonClass('secondary', 'sm')}>
            <FolderKanban className="size-4" aria-hidden /> {t('home.wardCard.seeProjects')}
          </Link>
          <Link to={`/alerts?ward=${selection.id}`} className={buttonClass('secondary', 'sm')}>
            <BellRing className="size-4" aria-hidden /> {t('home.wardCard.getAlerts')}
          </Link>
        </div>
      </div>
    </div>
  );
}
