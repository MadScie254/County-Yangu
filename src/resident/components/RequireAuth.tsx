import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/state/auth';
import { Skeleton } from '@/shared/ui/Card';

/** Gate for My Services. Only proves a session exists; what a person may do is decided by RLS in the database. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const init = useAuth((s) => s.init);
  const loc = useLocation();
  useEffect(() => {
    void init();
  }, [init]);
  if (status === 'loading') return <div className="mx-auto max-w-2xl space-y-4 px-4 py-12"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-40" /></div>;
  if (status === 'anon') return <Navigate to={`/services/account?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}
