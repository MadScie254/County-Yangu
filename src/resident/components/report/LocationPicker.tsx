import { useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { county } from '@/shared/config/county';
import type { CountyMapHandle } from '@/shared/map/CountyMap';
import { LazyCountyMap as CountyMap } from '@/shared/map/LazyCountyMap';
import { useWardGeometry } from '@/shared/map/useGeometry';
import { inBbox, type LngLat } from '@/shared/map/geo';
import { Button } from '@/shared/ui/Button';
import { toast } from '@/shared/ui/Toast';

/** Pan the map under a fixed pin. Reports where the pin rests (rounded to about 10 m). */
export function LocationPicker({ point, onPoint, initial }: { point: LngLat | null; onPoint: (p: LngLat) => void; initial?: LngLat | null }) {
  const { t } = useI18n();
  const geometry = useWardGeometry();
  const map = useRef<CountyMapHandle>(null);
  const [locating, setLocating] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (initial && !started.current) {
      started.current = true;
      const id = setTimeout(() => map.current?.flyTo(initial, 15), 400);
      return () => clearTimeout(id);
    }
  }, [initial]);

  const locate = async () => {
    setLocating(true);
    const p = await map.current?.locate();
    setLocating(false);
    if (!p) toast({ tone: 'bad', title: t('errors.generic') });
  };

  const outside = point ? !inBbox(point, county.bbox, 0.02) : false;

  return (
    <div>
      <div className="relative h-[19rem] overflow-hidden rounded-[1.5rem] border border-line shadow-card sm:h-[24rem]">
        <CountyMap
          ref={map}
          className="absolute inset-0"
          ariaLabel={t('map.pinHint')}
          geometry={geometry.data ?? null}
          showBubbles={false}
          onCenterChange={(p) => {
            onPoint({ lat: Math.round(p.lat * 1e4) / 1e4, lng: Math.round(p.lng * 1e4) / 1e4 });
          }}
          padding={{ top: 20, right: 20, bottom: 20, left: 20 }}
          labels={{ zoomIn: t('map.zoomIn'), zoomOut: t('map.zoomOut'), recenter: t('map.recenter'), locate: t('map.locate'), attribution: t('map.attribution'), issues: (n) => t('map.issues', { count: n }) }}
        />
        {/* fixed centre pin; its tip sits exactly on the map centre */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full">
          <MapPin className="size-11 fill-brand text-ink drop-shadow-lg" strokeWidth={1.75} />
        </div>
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/60 shadow" />
        <div className="absolute left-3 top-3 z-10">
          <Button variant="secondary" size="sm" className="glass shadow-float" onClick={locate} loading={locating} icon={<LocateFixed className="size-4" aria-hidden />}>
            {t('home.useLocation')}
          </Button>
        </div>
        <p className="pointer-events-none absolute inset-x-3 bottom-3 z-10 mx-auto w-fit max-w-full rounded-full bg-ink/85 px-3.5 py-1.5 text-center text-xs font-semibold text-bg">{point ? t('map.pinSet') : t('map.pinHint')}</p>
      </div>
      {outside && <p role="alert" className="mt-2 text-sm font-medium text-bad">{t('map.outsideCounty', { county: county.name })}</p>}
    </div>
  );
}
