// Report categories shown to residents. IDs must match supabase/migrations/*_seed_operations.sql
// (a unit test enforces this). Names come from the i18n files under `categories.<id>`.
export const categoryIds = [
  'pothole', 'streetlight', 'water_main', 'sewer', 'drainage', 'garbage', 'dumping',
  'health_facility', 'school', 'market', 'illegal_build', 'safety_hazard',
  'abandoned', 'missing_funds', 'other',
] as const;
export type CategoryId = (typeof categoryIds)[number];

/** Lucide icon names (resolved in the UI layer) and whether the category is integrity-sensitive. */
export const categoryMeta: Record<CategoryId, { icon: string; sensitive?: boolean; urgent?: boolean }> = {
  pothole: { icon: 'construction' },
  streetlight: { icon: 'lightbulb-off' },
  water_main: { icon: 'droplets', urgent: true },
  sewer: { icon: 'waves' },
  drainage: { icon: 'cloud-rain' },
  garbage: { icon: 'trash-2' },
  dumping: { icon: 'package-x' },
  health_facility: { icon: 'hospital' },
  school: { icon: 'school' },
  market: { icon: 'store' },
  illegal_build: { icon: 'building-2' },
  safety_hazard: { icon: 'triangle-alert', urgent: true },
  abandoned: { icon: 'hammer', sensitive: true },
  missing_funds: { icon: 'banknote', sensitive: true },
  other: { icon: 'circle-help' },
};
