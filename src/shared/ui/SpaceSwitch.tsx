import { Building2, UserRound } from 'lucide-react';
import { useAuth } from '@/shared/state/auth';
import { cn } from '@/shared/lib/utils';

type Props = { current: 'citizen' | 'staff'; citizenLabel: string; staffLabel: string; groupLabel: string; className?: string };

/**
 * One sign-in, two spaces. Anyone with a staff role can move between the citizen view and the staff console;
 * everyone else never sees this. The two spaces are separate apps on one site, so the link to the other one is a normal page load.
 * Nothing here grants access: the console checks roles again, and the database checks them once more.
 */
export function SpaceSwitch({ current, citizenLabel, staffLabel, groupLabel, className }: Props) {
  const hasStaff = useAuth((s) => s.roles.length > 0);
  if (!hasStaff) return null;
  const base = 'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition';
  const on = 'bg-ink text-bg shadow-card';
  const off = 'text-ink-2 hover:bg-bg-2 hover:text-ink';
  return (
    <div role="group" aria-label={groupLabel} className={cn('inline-flex rounded-full border border-line bg-surface p-0.5', className)}>
      {current === 'citizen' ? (
        <span aria-current="page" className={cn(base, on)}><UserRound className="size-4" aria-hidden />{citizenLabel}</span>
      ) : (
        <a href="/me" className={cn(base, off)}><UserRound className="size-4" aria-hidden />{citizenLabel}</a>
      )}
      {current === 'staff' ? (
        <span aria-current="page" className={cn(base, on)}><Building2 className="size-4" aria-hidden />{staffLabel}</span>
      ) : (
        <a href="/console/" className={cn(base, off)}><Building2 className="size-4" aria-hidden />{staffLabel}</a>
      )}
    </div>
  );
}
