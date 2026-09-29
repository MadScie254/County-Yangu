import { subCounties } from '@/shared/config/county';
import type { WardStat } from '@/shared/api/types';
import type { Metric } from './palette';

export type SubCountyStat = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  wards: number;
  open: number;
  overdue: number;
  resolved: number;
  votes: number;
  projects: number;
  trust: number | null;
};

export function aggregateBySubCounty(stats: WardStat[] | undefined): SubCountyStat[] {
  return subCounties
    .filter((sc) => sc.lat != null && sc.lng != null)
    .map((sc) => {
      const rows = (stats ?? []).filter((s) => s.sub_county_id === sc.id);
      const trusts = rows.map((r) => r.trust_index).filter((v): v is number => v != null);
      return {
        id: sc.id,
        name: sc.name,
        lat: sc.lat as number,
        lng: sc.lng as number,
        wards: rows.length,
        open: rows.reduce((a, r) => a + r.open_reports, 0),
        overdue: rows.reduce((a, r) => a + r.overdue_reports, 0),
        resolved: rows.reduce((a, r) => a + r.resolved_90d, 0),
        votes: rows.reduce((a, r) => a + r.votes_cast, 0),
        projects: rows.reduce((a, r) => a + r.projects, 0),
        trust: trusts.length ? Math.round((trusts.reduce((a, b) => a + b, 0) / trusts.length) * 10) / 10 : null,
      };
    });
}

export function metricValue(metric: Metric, s: { open_reports: number; overdue_reports: number; trust_index: number | null }): number | null {
  return metric === 'open' ? s.open_reports : metric === 'overdue' ? s.overdue_reports : s.trust_index;
}

export function subMetricValue(metric: Metric, s: SubCountyStat): number | null {
  return metric === 'open' ? s.open : metric === 'overdue' ? s.overdue : s.trust;
}
