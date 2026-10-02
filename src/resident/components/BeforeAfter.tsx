import { useI18n } from '@/shared/i18n';
import { fixPhotoUrl } from '@/shared/api/civic2';
import { cn } from '@/shared/lib/utils';

/** Before and after, side by side. Staff take these at the site; they are public so "fixed" can be seen. */
export function BeforeAfter({ before, after, className, compact }: { before: string | null; after: string; className?: string; compact?: boolean }) {
  const { t } = useI18n();
  const pic = (src: string, label: string, tone: string) => (
    <figure className="relative overflow-hidden rounded-2xl bg-bg-2">
      <img src={fixPhotoUrl(src)} alt={label} loading="lazy" className={cn('w-full object-cover', compact ? 'aspect-[4/3]' : 'aspect-[3/2]')} />
      <figcaption className={cn('absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-bold', tone)}>{label}</figcaption>
    </figure>
  );
  return (
    <div className={cn('grid gap-2', before ? 'grid-cols-2' : 'grid-cols-1', className)}>
      {before && pic(before, t('status.before'), 'bg-bad text-white')}
      {pic(after, t('status.after'), 'bg-good text-white')}
    </div>
  );
}
