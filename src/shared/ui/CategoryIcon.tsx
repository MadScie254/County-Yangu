import { Banknote, Building2, CircleHelp, CloudRain, Construction, Hammer, Hospital, LightbulbOff, PackageX, School, Store, Trash2, TriangleAlert, Droplets, Waves, type LucideIcon } from 'lucide-react';
import { categoryMeta, type CategoryId } from '@/shared/data/categories';

const icons: Record<string, LucideIcon> = {
  construction: Construction,
  'lightbulb-off': LightbulbOff,
  droplets: Droplets,
  waves: Waves,
  'cloud-rain': CloudRain,
  'trash-2': Trash2,
  'package-x': PackageX,
  hospital: Hospital,
  school: School,
  store: Store,
  'building-2': Building2,
  'triangle-alert': TriangleAlert,
  hammer: Hammer,
  banknote: Banknote,
  'circle-help': CircleHelp,
};

export function CategoryIcon({ id, className }: { id: CategoryId; className?: string }) {
  const Icon = icons[categoryMeta[id].icon] ?? CircleHelp;
  return <Icon className={className} aria-hidden />;
}
