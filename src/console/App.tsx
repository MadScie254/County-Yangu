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
const Projects = lazy(() => import('./pages/Projects'));
const Tenders = lazy(() => import('./pages/Tenders'));
const Meetings = lazy(() => import('./pages/Meetings'));
const Notices = lazy(() => import('./pages/Notices'));
const Promises = lazy(() => import('./pages/Promises'));
const Budget = lazy(() => import('./pages/Budget'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Ideas = lazy(() => import('./pages/Ideas'));
const Revenue = lazy(() => import('./pages/Revenue'));
const Assistant = lazy(() => import('./pages/Assistant'));
const Procurement = lazy(() => import('./pages/Procurement'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));

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
    <Suspense fallback={<Fallback />}>
      <Routes>
        {/* An invited auditor has no account yet, so this route sits outside the sign-in gate. */}
        <Route path="invite/:token" element={<AcceptInvite />} />
        <Route path="*" element={<Gate><Console /></Gate>} />
      </Routes>
    </Suspense>
  );
}

function Console() {
  return (
    <Suspense fallback={<Fallback />}>
        <Routes>
          <Route element={<ConsoleShell />}>
            <Route index element={<Overview />} />
            <Route path="cases" element={<Allow when={(c) => c.working}><Cases /></Allow>} />
            <Route path="cases/:id" element={<Allow when={(c) => c.working}><CaseDetail /></Allow>} />
            <Route path="sla" element={<Allow when={(c) => c.working}><SlaBoard /></Allow>} />
            <Route path="applications" element={<Allow when={(c) => c.working}><Applications /></Allow>} />
            <Route path="oversight" element={<Allow when={(c) => c.oversight}><Oversight /></Allow>} />
            <Route path="procurement" element={<Allow when={(c) => c.oversight}><Procurement /></Allow>} />
            <Route path="projects" element={<Allow when={(c) => c.publish}><Projects /></Allow>} />
            <Route path="tenders" element={<Allow when={(c) => c.publish}><Tenders /></Allow>} />
            <Route path="meetings" element={<Allow when={(c) => c.publish}><Meetings /></Allow>} />
            <Route path="notices" element={<Allow when={(c) => c.publish}><Notices /></Allow>} />
            <Route path="promises" element={<Allow when={(c) => c.has('super_admin', 'admin', 'chief_officer')}><Promises /></Allow>} />
            <Route path="budget" element={<Allow when={(c) => c.admin}><Budget /></Allow>} />
            <Route path="alerts" element={<Allow when={(c) => c.working}><Alerts /></Allow>} />
            <Route path="ideas" element={<Allow when={(c) => c.working}><Ideas /></Allow>} />
            <Route path="revenue" element={<Allow when={(c) => c.finance}><Revenue /></Allow>} />
            <Route path="assistant" element={<Allow when={(c) => c.working}><Assistant /></Allow>} />
            <Route path="admin" element={<Allow when={(c) => c.admin}><Admin /></Allow>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
    </Suspense>
  );
}
