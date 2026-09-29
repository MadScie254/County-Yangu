import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Gate } from './pages/Gate';
import { ConsoleShell } from './layout/ConsoleShell';
import { useCan } from './lib/perm';
import { Skeleton } from '@/shared/ui/Card';

const Overview = lazy(() => import('./pages/Overview'));
const Cases = lazy(() => import('./pages/Cases'));
const CaseDetail = lazy(() => import('./pages/CaseDetail'));
const SlaBoard = lazy(() => import('./pages/SlaBoard'));
const Applications = lazy(() => import('./pages/Applications'));
const Oversight = lazy(() => import('./pages/Oversight'));
const Admin = lazy(() => import('./pages/Admin'));

function Fallback() {
  return <div className="space-y-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-56" /></div>;
}

/** Route-level guard. The database refuses these actions anyway; this just keeps people out of empty screens. */
function Allow({ when, children }: { when: (c: ReturnType<typeof useCan>) => boolean; children: ReactNode }) {
  const can = useCan();
  return when(can) ? <>{children}</> : <Navigate to="/" replace />;
}

export function App() {
  return (
    <Gate>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route element={<ConsoleShell />}>
            <Route index element={<Overview />} />
            <Route path="cases" element={<Allow when={(c) => c.working}><Cases /></Allow>} />
            <Route path="cases/:id" element={<Allow when={(c) => c.working}><CaseDetail /></Allow>} />
            <Route path="sla" element={<Allow when={(c) => c.working}><SlaBoard /></Allow>} />
            <Route path="applications" element={<Allow when={(c) => c.working}><Applications /></Allow>} />
            <Route path="oversight" element={<Allow when={(c) => c.oversight}><Oversight /></Allow>} />
            <Route path="admin" element={<Allow when={(c) => c.admin}><Admin /></Allow>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </Gate>
  );
}
