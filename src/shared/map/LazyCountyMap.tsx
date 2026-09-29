import { forwardRef, lazy, Suspense, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useSaveData } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import type { CountyMapHandle, CountyMapProps } from './CountyMap';

// The map library is the heaviest thing on the page, so it loads on demand, and not at all on a data-saver
// connection until the visitor asks for it. Everything around the map (search, lists, stats) works without it.
const Inner = lazy(() => import('./CountyMap').then((m) => ({ default: m.CountyMap })));

export const LazyCountyMap = forwardRef<CountyMapHandle, CountyMapProps>(function LazyCountyMap(props, ref) {
  const { t } = useI18n();
  const saveData = useSaveData();
  const [wanted, setWanted] = useState(false);
  if (saveData && !wanted) {
    return (
      <div className={`${props.className ?? ''} grid place-items-center bg-bg-2 p-6 text-center`} role="group" aria-label={props.ariaLabel}>
        <div className="max-w-xs">
          <p className="font-display text-lg font-bold">{t('map.saveDataTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('map.saveDataBody')}</p>
          <Button className="mt-4" variant="secondary" icon={<MapPin className="size-4" aria-hidden />} onClick={() => setWanted(true)}>{t('map.saveDataLoad')}</Button>
        </div>
      </div>
    );
  }
  return (
    <Suspense fallback={<div className={`${props.className ?? ''} animate-pulse bg-bg-2`} aria-busy="true" />}>
      <Inner ref={ref} {...props} />
    </Suspense>
  );
});
